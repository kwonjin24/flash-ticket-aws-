# Flash Tickets — 티켓팅 서비스 (Phase 1: PostgreSQL 단독)
> **목표**: AWS EKS 위에 “대규모 트래픽 대비” 가능한 **최소 기능**의 티켓팅 서비스를 구축하고, 관측/보안/로그/스케일을 검증한다.  
> **키워드**: WebSocket(실시간 방송), 원자적 판매/오버셀 방지, Idempotency, 관측/알림, HPA/CA, Cilium NetworkPolicy

---

## 1. 범위 / 비범위
### 범위 (Phase 1)
- 단일 이벤트(공연/존) **한정 수량 판매**
- HTTP API: `POST /purchase`, `POST /pay/:orderId`, `GET /healthz`, `GET /metrics`
- WebSocket: `/ws?eventId=...` (재고/대기열/주문 상태 방송)
- 데이터 저장: **PostgreSQL (RDS t4g.micro)** — *원자 차감/락 기반* (Redis 없이 시작)
- 관측: Prometheus + Grafana, 로그: Loki + S3
- 네트워크 보안: Cilium NetworkPolicy (기본 거부 + 허용만 화이트리스트)

### 비범위 (Phase 2 이상)
- 멀티 이벤트/멀티 리전, 결제 PG 연동(모의 API로 대체), 정교한 대기열 공정성 엔진
- Redis(ElastiCache) 큐/카운터, Waypoint(L7) 라우팅, 복잡한 장애 격리

---

## 2. 상위 아키텍처 (요약)
- **경로**: Route53 → **NLB(L4, PROXY)** → **NGINX Ingress(TLS 종료, WS)** → **App Pods**  
- **데이터**: **RDS(PostgreSQL)**, (옵션) Phase 2에 **Redis**  
- **관측/로그**: **kube-prometheus-stack**, **Grafana**, **Loki + Promtail(S3)**  
- **네트워크 보안**: **Cilium**(eBPF LB + NetworkPolicy) + **Hubble**

```mermaid
flowchart LR
  A[Route53 DNS] --> B[NLB (TCP 80/443, PROXY)]
  B --> C[NGINX Ingress (TLS, WS)]
  C --> D[App Pods (Tickets API + WS)]
  D <---> E[(RDS: PostgreSQL)]
  D -->|/metrics| F[Prometheus]
  D -->|logs| G[Loki]
  G --> H[S3 (Object Storage)]
```

---

## 3. API 설계 (최소)
### 3.1 POST `/purchase`
- **헤더**: `Idempotency-Key: <uuid>` *(필수, 재시도/중복 방지)*  
- **바디**:
```json
{ "eventId": "E1", "qty": 1 }
```
- **성공(잔여 OK)**:
```json
{ "orderId": "ord_abc123", "status": "HOLD", "remaining": 97, "holdExpiresAt": "2025-01-01T12:00:59Z" }
```
- **거부(품절)**:
```json
{ "status": "REJECTED", "reason": "OUT_OF_STOCK", "remaining": 0 }
```
- **에러**: `409`(중복키), `429`(레이트리밋), `5xx`(DB 락 지연/타임아웃)

### 3.2 POST `/pay/:orderId` (결제 모의)
```json
{ "ok": true, "status": "PAID" }
```

### 3.3 GET `/healthz`
- `200 OK` (`?db=ping` 사용 시 DB 연결 확인)

### 3.4 GET `/metrics`
- Prometheus 텍스트 포맷. 아래 **8. 관측 지표** 참고.

---

## 4. WebSocket 프로토콜
- **엔드포인트**: `GET /ws?eventId=E1`  
- **전달 형식**: JSON Line
- **서버 → 클라 이벤트**
  - `sale.open`: 판매 시작 알림  
  - `stock.update`: `{ "remaining": 97, "sold": 3, "inHold": 0 }`
  - `queue.update`: `{ "position": 1240, "estimateSec": 45 }` *(근사값)*
  - `order.update`: `{ "orderId":"...", "status":"HOLD|PAID|EXPIRED" }`
  - `sale.closed`
- **클라 → 서버 이벤트**
  - `client.ping` / `client.ack`
- **백프레셔**
  - 서버 send 큐가 가득 차면 **낮은 우선순위 이벤트 배압/드롭**(예: 빈번한 `queue.update` 샘플링)

---

## 5. 데이터 모델 (DDL 예시)
```sql
-- 이벤트(한정 판매 대상)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  total_qty INT NOT NULL CHECK (total_qty >= 0),
  sold_qty INT NOT NULL DEFAULT 0 CHECK (sold_qty >= 0)
);

-- 주문
CREATE TYPE order_status AS ENUM ('INIT','HOLD','PAID','EXPIRED','REJECTED');

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  status order_status NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_orders_event_idem
  ON orders(event_id, idempotency_key);

CREATE INDEX idx_orders_event_status
  ON orders(event_id, status);

-- (선택) 홀드 테이블 - 장바구니 유효시간 관리
CREATE TABLE holds (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_holds_event_expires
  ON holds(event_id, expires_at);
```

**인덱스 요점**
- `orders(event_id, idempotency_key)`로 **멱등 처리** 보장
- `orders(event_id, status)`로 판매 완료 집계/조회 최적화
- `holds(event_id, expires_at)`로 만료 스캐너 효율화

---

## 6. 동시성/정합성 (오버셀 방지)
### 6.1 트랜잭션(Phase 1, Postgres만)
- **행 잠금**: 이벤트 행을 `FOR UPDATE`로 잠궈 **원자적 차감**  
- **의사코드**
```sql
BEGIN;

-- 이벤트 락
SELECT total_qty, sold_qty
FROM events
WHERE id = :eventId
FOR UPDATE;

-- 잔여 계산
-- remaining = total_qty - sold_qty - SUM(holds.qty WHERE not expired)
WITH hold AS (
  SELECT COALESCE(SUM(qty),0) AS in_hold
  FROM holds
  WHERE event_id = :eventId AND expires_at > now()
)
SELECT (total_qty - sold_qty - hold.in_hold) AS remaining
FROM events, hold
WHERE events.id = :eventId;

-- 가능 시 판매 반영
IF remaining >= :qty THEN
  -- 주문 행 생성 (멱등키 포함)
  INSERT INTO orders(id, user_id, event_id, status, qty, idempotency_key)
  VALUES(:orderId, :userId, :eventId, 'HOLD', :qty, :idemKey);

  -- (옵션) holds 추가
  INSERT INTO holds(id, event_id, user_id, qty, expires_at)
  VALUES(:holdId, :eventId, :userId, :qty, now() + interval '60 seconds');

  COMMIT;
ELSE
  ROLLBACK;
END IF;
```
- **결제 성공 시**: `orders.status = 'PAID'`로 업데이트하고 `events.sold_qty += qty` 커밋  
- **홀드 만료 스캐너**: 주기적으로 `EXPIRED` 처리 + in_hold 감소

> 단일 이벤트에선 `events.id = E1` 행이 **경합 포인트**. 폭주 상황에선 잠금 대기(p95↑)가 생기지만 **정합성은 안전**. (Phase 2에서 Redis로 분산/샤딩)

### 6.2 멱등성
- 클라이언트가 `Idempotency-Key`를 생성, 서버가 **키별 마지막 결과 캐시/조회**  
- 중복 호출은 **동일 결과** 반환 또는 `409 Conflict`

---

## 7. 보안/네트워크 정책 (Cilium)
- **기본 거부**: 네임스페이스 단위 `default-deny`  
- **허용만**: `ingress-nginx → app`, `app → postgres:5432`
```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: tickets-allow
  namespace: app
spec:
  endpointSelector:
    matchLabels:
      app.kubernetes.io/name: tickets-api
  ingress:
    - fromEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: ingress-nginx
  egress:
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: db
      toPorts:
        - ports:
            - port: "5432"
              protocol: TCP
```

---

## 8. 관측/로그 (필수 지표/대시보드)
### 8.1 메트릭 (예시)
- `ws_connections` (gauge)  
- `ws_messages_total{direction,type}` (counter)  
- `purchase_attempts_total{result}` (counter: HOLD|PAID|REJECTED|ERROR)  
- `purchase_duration_seconds_bucket` (histogram)  
- `pg_locks_wait_seconds_bucket` (histogram)  
- `queue_depth` (gauge, 선택)

### 8.2 알림 룰 (예시)
- 5분 평균 **성공률 < 99.9%**  
- p95 **구매 지연 > 500ms** (10분)  
- DB **락 대기 > 200ms** 지속  
- WS **연결 수 급락** 또는 **send 큐 포화**

### 8.3 로그 (Loki)
- JSON Line:
```json
{"ts":"2025-01-01T12:00:01Z","lvl":"info","msg":"purchase","eventId":"E1",
 "userId":"U1","qty":1,"result":"HOLD","latencyMs":34,"idempotencyKey":"..."}
```
- **라벨 최소화**: `namespace, app, pod, level` (비용/성능 최적)

---

## 9. 성능/스케일 (HPA/리소스)
- **컨테이너 시작점**: `requests: 100m/128Mi`, `limits: 500m/512Mi`  
- **HPA**: CPU 60% + (선택) 초당 구매처리/큐 길이  
- **PodAntiAffinity + PDB**: AZ 분산, 롤링 중 가용성 유지  
- **NGINX 튜닝**: `proxy-read/send-timeout=600`, `keep-alive=75`, worker auto

---

## 10. 구성(ENV) 예시
```env
APP_PORT=8080
DB_URL=postgres://user:pass@postgres:5432/tickets?sslmode=verify-full
EVENT_ID=E1
HOLD_TTL_SEC=60
IDEMPOTENCY_TTL_SEC=120
WS_MAX_SEND_BUFFER=1000
LOG_LEVEL=info
```

---

## 11. 테스트/부하 (k6 스니펫)
```js
// purchase-smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 50, duration: '2m' };

export default function () {
  const idem = Math.random().toString(36).slice(2);
  const res = http.post(__ENV.BASE_URL + '/purchase',
    JSON.stringify({ eventId: 'E1', qty: 1 }),
    { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem } }
  );
  check(res, { 'status is 200/409': r => [200,409].includes(r.status) });
  sleep(0.2);
}
```

---

## 12. 운영 런북 (요점)
1) **알람 수신**(성공률↓/p95↑/락↑)  
2) **NGINX 대시보드**(4xx/5xx, 백엔드 지연)  
3) **Pod/HPA 상태**(레디니스/리스타트/자원)  
4) **Hubble**로 드롭/정책 위반 유무 확인  
5) **DB 락/슬로우쿼리** 확인, 필요 시 스케일아웃 또는 롤백  
6) **사후 복기**: Idempotency 충돌/재시도 패턴, 로그 상관관계 점검

---

## 13. 완료 정의(DoD)
- `/healthz`, `/purchase`, `/ws`가 **NLB DNS**에서 정상 동작  
- **오버셀 없음**: 판매 종료 후 `events.sold_qty == count(orders.status='PAID')`  
- Grafana 알람/대시보드 정상, Loki에서 `level=error` 쿼리 가능  
- HPA 반응/CA 스팟 확장 동작, NetworkPolicy 위반 시 드롭이 Hubble에 보임

---

## 14. Phase 2 제안 (선택)
- **Redis(ElastiCache)**: 카운터/큐 분리, 공정성 강화(샤딩/파티션 락)  
- **Istio Ambient Waypoint(L7)**: 카나리/리트라이/레이트리밋  
- **멀티 이벤트/멀티 리전**: 파티셔닝, CRDT/보상 트랜잭션 도입 검토

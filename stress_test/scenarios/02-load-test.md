# Load Test 시나리오 (수정됨)

코드 분석 결과를 반영한 정확한 Load Test 시나리오입니다.

## 목적

- 일반적인 부하 상황에서 시스템 성능 측정
- 응답 시간, 처리량, 에러율 확인
- 리소스 사용률 모니터링
- 성능 베이스라인 수립

## 테스트 설정

```yaml
Phase 1 (Warm-up):
  사용자 수: 100명
  Ramp-up: 2분
  기간: 3분

Phase 2 (Normal Load):
  사용자 수: 300명
  Ramp-up: 3분
  기간: 10분

Phase 3 (Peak Load):
  사용자 수: 500명
  Ramp-up: 2분
  기간: 10분

총 테스트 시간: 30분
```

## 사용자 시나리오

### 정확한 사용자 여정

```
1. 로그인 (1회)
   ↓
2. 대기열 등록 (1회)
   ↓
3. 대기열 상태 폴링 (최대 20회, 5초 간격)
   ↓ (state가 READY가 될 때까지)
4. 입장 (1회)
   ↓ (think time: 2-5초)
5. 이벤트 목록 조회 (1회)
   ↓ (think time: 3-7초)
6. 이벤트 상세 조회 (1회)
   ↓ (think time: 5-10초)
7. 주문 생성 (1회)
   ↓ (think time: 2-4초)
8. 결제 생성 (1회)
   ↓ (think time: 1-2초)
9. 결제 완료 (콜백) (1회)
   ↓ (think time: 2-3초)
10. 주문 상태 확인 (1회)
```

> Load 테스트는 이벤트 `5003037c-21e4-4eb4-9d1b-5384bafb516d`를 대상으로 진행합니다. JMeter 전역 변수 `EVENT_ID`를 이 값으로 설정해 두고, 큐 등록과 주문·결제 단계에서 동일한 이벤트를 사용합니다.

## 상세 플로우

### 1. Setup Thread Group (Once Only)

```
1.1 로그인
POST https://gateway.highgarden.cloud/auth/login
Headers:
  Content-Type: application/json
Body:
{
  "userId": "test${__threadNum}",
  "password": "testtest"
}

Extract:
- accessToken (JSON Extractor: $.accessToken)

Expected: 201 Created
```

### 2. 대기열 진입

```
2.1 대기열 등록
POST https://gateway.highgarden.cloud/queue/enqueue
Headers:
  Authorization: Bearer ${accessToken}
  Content-Type: application/json
Body:
{
  "eventId": "${EVENT_ID}"
}

Extract:
- ticketId (JSON Extractor: $.ticketId)

Expected: 201 Created

2.2 대기열 상태 폴링 (While Controller)
Condition: ${__javaScript("${queueState}" != "READY" && ${pollingCount} < 20)}

GET https://gateway.highgarden.cloud/queue/status?ticketId=${ticketId}

Extract:
- queueState (JSON Extractor: $.state)
- gateToken (JSON Extractor: $.gateToken) - READY일 때만 존재

pollingCount++
Wait: 5초 (Constant Timer)

Expected: 200 OK

2.4 입장
POST https://gateway.highgarden.cloud/queue/enter
Headers:
  Authorization: Bearer ${accessToken}
  Content-Type: application/json
Body:
{
  "ticketId": "${ticketId}",
  "gateToken": "${gateToken}"
}

Expected: 201 Created
Think Time: 2-5초
```

### 3. 이벤트 탐색

```
3.1 이벤트 목록 조회
GET https://api.highgarden.cloud/events
Headers:
  Authorization: Bearer ${accessToken}

Expected: 200 OK
Think Time: 3-7초

3.2 이벤트 상세 조회
GET https://api.highgarden.cloud/events/${EVENT_ID}
Headers:
  Authorization: Bearer ${accessToken}

Extract:
- price (JSON Extractor: $.price)
- maxPerUser (JSON Extractor: $.maxPerUser)

Expected: 200 OK
Think Time: 5-10초
```

### 4. 주문 및 결제

```
4.1 주문 생성
POST https://api.highgarden.cloud/orders
Headers:
  Authorization: Bearer ${accessToken}
  Idempotency-Key: ${__UUID}
  Content-Type: application/json
Body:
{
  "event_id": "${EVENT_ID}",
  "qty": 1
}

Extract:
- orderId (JSON Extractor: $.orderId)
- amount (JSON Extractor: $.amount)

Expected: 200 OK
Think Time: 2-4초

4.2 결제 생성
POST https://api.highgarden.cloud/payments
Headers:
  Authorization: Bearer ${accessToken}
  Content-Type: application/json
Body:
{
  "orderId": "${orderId}",
  "method": "MOCK"
}

Extract:
- paymentId (JSON Extractor: $.paymentId)

Expected: 200 OK
Think Time: 1-2초

4.3 결제 완료 (콜백 시뮬레이션)
POST https://api.highgarden.cloud/payments/callback
Headers:
  Authorization: Bearer ${accessToken}
  Content-Type: application/json
Body:
{
  "orderId": "${orderId}",
  "paymentId": "${paymentId}",
  "status": "OK"
}

Expected: 200 OK
Think Time: 2-3초

4.4 주문 확인
GET https://api.highgarden.cloud/orders/${orderId}
Headers:
  Authorization: Bearer ${accessToken}

Expected: 200 OK
Response: { "status": "PAID" }
```

## Thread Group 설정

### Ultimate Thread Group (추천)

```
Stage 1 (Warm-up):
  Initial Delay: 0s
  Start Users: 100
  Ramp-up: 120s (2분)
  Hold Load: 180s (3분)

Stage 2 (Normal):
  Initial Delay: 300s (5분)
  Start Users: 200 (총 300명)
  Ramp-up: 180s (3분)
  Hold Load: 600s (10분)

Stage 3 (Peak):
  Initial Delay: 1080s (18분)
  Start Users: 200 (총 500명)
  Ramp-up: 120s (2분)
  Hold Load: 600s (10분)

Stage 4 (Cool-down):
  Shutdown: 60s
```

## 성능 목표

### 응답 시간

| 엔드포인트 | 평균 | 95% | 99% |
|-----------|------|------|------|
| POST /auth/login | < 200ms | < 500ms | < 1000ms |
| POST /queue/enqueue | < 300ms | < 800ms | < 1500ms |
| GET /queue/status | < 100ms | < 300ms | < 500ms |
| POST /queue/enter | < 200ms | < 500ms | < 1000ms |
| GET /events | < 100ms | < 300ms | < 500ms |
| GET /events/{id} | < 150ms | < 400ms | < 800ms |
| POST /orders | < 500ms | < 1500ms | < 3000ms |
| POST /payments | < 300ms | < 800ms | < 1500ms |
| POST /payments/callback | < 200ms | < 600ms | < 1200ms |
| GET /orders/{id} | < 150ms | < 400ms | < 800ms |

### 처리량

```
최소 TPS: 50
목표 TPS: 100
최적 TPS: 150+
```

### 에러율

```
목표: < 0.1%
허용: < 1%
```

## 사용자 변수 설정

### User Defined Variables

```
GATEWAY_URL: https://gateway.highgarden.cloud
API_URL: https://api.highgarden.cloud
THREAD_NUM: ${__threadNum}
USER_ID: test${__padLeft(${THREAD_NUM},4,0)}
PASSWORD: testtest
POLLING_MAX: 20
POLLING_INTERVAL: 5000
```

### CSV Data Set Config

test-accounts.csv 생성:
```csv
userId,password
test0000,testtest
test0001,testtest
test0002,testtest
...
test0999,testtest
```

## JSON Extractors 설정

### 로그인

```
Variable: accessToken
JSON Path: $.accessToken
Match No: 1
Default Value: ERROR
```

### 대기열 등록

```
Variable: ticketId
JSON Path: $.ticketId
Match No: 1
Default Value: ERROR
```

### 대기열 상태

```
Variable: queueState
JSON Path: $.state
Match No: 1
Default Value: QUEUED

Variable: gateToken
JSON Path: $.gateToken
Match No: 1
Default Value: NOT_READY
```

### 이벤트 ID

고정 이벤트 ID `EVENT_ID=5003037c-21e4-4eb4-9d1b-5384bafb516d`를 전역 변수로 사용합니다. 별도의 JSON 추출은 필요하지 않습니다.

### 주문 생성

```
Variable: orderId
JSON Path: $.orderId
Match No: 1
Default Value: ERROR

Variable: amount
JSON Path: $.amount
Match No: 1
Default Value: 0
```

### 결제 생성

```
Variable: paymentId
JSON Path: $.paymentId
Match No: 1
Default Value: ERROR
```

## Assertions

### Response Assertion

```
POST /auth/login:
- Response Code: 200
- Response contains: accessToken

POST /queue/enqueue:
- Response Code: 200
- Response contains: ticketId

GET /queue/status:
- Response Code: 200
- Response contains: state

POST /queue/enter:
- Response Code: 200
- Response contains: entered

POST /orders:
- Response Code: 200
- Response contains: orderId

POST /payments:
- Response Code: 200
- Response contains: paymentId

POST /payments/callback:
- Response Code: 200
- Response contains: status

GET /orders/{orderId}:
- Response Code: 200
- Response contains: PAID
```

## While Controller 설정

### 대기열 폴링

```
Condition (function): ${__javaScript(
  "${queueState}" != "READY" &&
  ${pollingCount} < ${POLLING_MAX}
)}

Counter:
  Variable Name: pollingCount
  Start: 0
  Increment: 1

Constant Timer: 5000ms (5초)
```

## Listeners

```
1. Backend Listener
   - InfluxDB Backend Listener
   - influxdbUrl: http://monitoring-server:8086/write?db=jmeter
   - application: flash-tickets-load-test

2. Summary Report
   - 전체 통계

3. Aggregate Report
   - 엔드포인트별 상세 통계
   - Percentiles 포함

4. Response Times Over Time
   - 시간대별 응답 시간 추이

5. Transactions per Second
   - 처리량 추이

6. Active Threads Over Time
   - 동시 사용자 추이

7. View Results Tree (디버깅용)
   - 테스트 중에는 비활성화
```

## 실행 방법

### CLI 실행

```bash
# 기본 실행
jmeter -n -t scenarios/02-load-test.jmx \
  -l results/load-test-$(date +%Y%m%d-%H%M%S).jtl \
  -e -o results/load-test-report-$(date +%Y%m%d-%H%M%S)

# 사용자 수 조정
jmeter -n -t scenarios/02-load-test.jmx \
  -JTHREADS=300 \
  -JRAMP_UP=180 \
  -JDURATION=1200 \
  -l results/load-300users.jtl

# 분산 테스트
jmeter -n -t scenarios/02-load-test.jmx \
  -R server1,server2,server3 \
  -l results/distributed-load.jtl
```

## 모니터링

### Kubernetes

```bash
# Pod 상태
kubectl get pods -n flash-ticket -w

# 리소스 사용률
kubectl top pods -n flash-ticket
kubectl top nodes

# HPA 상태
kubectl get hpa -n flash-ticket

# Karpenter 노드
kubectl get nodes -l karpenter.sh/provisioner-name

# 로그 확인
kubectl logs -n flash-ticket -l app=flash-gateway --tail=100 -f
kubectl logs -n flash-ticket -l app=flash-api --tail=100 -f
```

### Grafana 대시보드

```
1. 시스템 메트릭
   - CPU Usage
   - Memory Usage
   - Network I/O
   - Disk I/O

2. 애플리케이션 메트릭
   - Request Rate
   - Response Time (p50, p95, p99)
   - Error Rate
   - Active Connections

3. 대기열 메트릭
   - Queue Size
   - Ready Capacity
   - Position Updates
   - WebSocket Connections

4. 데이터베이스
   - Connection Pool
   - Query Performance
   - Slow Queries

5. Redis
   - Connected Clients
   - Commands/sec
   - Memory Usage
   - Hit Rate
```

## 결과 분석

### 성공 기준

✅ **통과**:
- 평균 응답 시간 목표치 달성
- 95 percentile 허용 범위 내
- 에러율 < 1%
- 시스템 리소스 < 70%
- Auto Scaling 정상 동작

❌ **실패**:
- 평균 응답 시간 목표의 2배 초과
- 에러율 > 5%
- 시스템 다운타임 발생
- 데이터 정합성 오류

## 트러블슈팅

### 높은 응답 시간

```
증상: 평균 응답 시간 > 1초
확인:
1. kubectl top pods -n flash-ticket
2. Database 쿼리 성능
3. Redis 메모리 사용률
4. Network latency

해결:
- 리소스 증가
- 쿼리 최적화
- 캐시 추가
```

### 대기열 폴링 타임아웃

```
증상: 20번 폴링했지만 READY 안 됨
원인:
1. 대기열이 너무 길음
2. Promotion 속도가 느림
3. Ready Capacity가 작음

해결:
- POLLING_MAX 증가
- Promotion 간격 조정
- Ready Capacity 증가
```

### Gate Token 에러 (403)

```
증상: POST /queue/enter에서 403 에러
원인:
1. gateToken이 만료됨
2. ticketId와 gateToken 불일치

해결:
- 폴링 후 즉시 enter 호출
- gateToken 추출 확인
```

### Idempotency-Key 에러 (409)

```
증상: POST /orders에서 409 Conflict
원인: 동일한 Idempotency-Key 재사용

해결:
- ${__UUID} 함수 사용
- 매 요청마다 새로운 UUID 생성
```

## 다음 단계

Load Test 완료 후:
1. [Stress Test](03-stress-test.md)로 한계 테스트
2. 성능 개선 작업
3. [Spike Test](04-spike-test.md)로 급증 대응 검증
4. [Endurance Test](05-endurance-test.md)로 장시간 안정성 확인

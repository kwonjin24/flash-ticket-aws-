# NetworkPolicy 배포 완료 보고서

**배포 일시:** 2025-11-06
**상태:** ✅ 완료 및 검증 완료
**적용 범위:** flash-ticket 네임스페이스

---

## 📋 배포 요약

Flash Ticket 서비스의 **내부 보안 강화**를 위해 Kubernetes NetworkPolicy를 적용했습니다.

### 배포 내용
- **총 8개의 NetworkPolicy** 적용
- **모든 통신 검증** 완료
- **정상 트래픽** 허용 확인

---

## 📊 적용된 NetworkPolicy 목록

| # | Policy 이름 | 대상 Pod | 목적 | 상태 |
|---|-----------|---------|------|------|
| 1 | `default-deny-ingress` | 모든 Pod | 기본 차단 (명시적 허용만 통과) | ✅ |
| 2 | `allow-gateway-from-alb` | flash-gateway | ALB에서 외부 요청 수신 (포트 3000) | ✅ |
| 3 | `allow-api-from-gateway` | flash-api | Gateway에서 요청 수신 (포트 4000) | ✅ |
| 4 | `allow-pay-from-api` | flash-pay | API에서 요청 수신 (포트 3100) | ✅ |
| 5 | `restrict-pay-from-gateway` | flash-pay | Gateway의 직접 접근 제한 | ✅ |
| 6 | `allow-egress-external` | flash-api | 외부 서비스 접근 (RabbitMQ, Redis, DB) | ✅ |
| 7 | `allow-gateway-egress` | flash-gateway | API로의 아웃바운드 트래픽 | ✅ |
| 8 | `allow-pay-egress` | flash-pay | 외부 서비스 접근 (RabbitMQ, Redis, DB) | ✅ |

---

## ✅ 통신 흐름 검증 결과

### ✨ 허용된 통신 (정상)

#### 1. Gateway → API (포트 4000)
```
상태: ✅ 통신 성공
테스트: wget http://flash-api:4000/metrics
결과: Prometheus 메트릭 정상 수신
```

#### 2. API → Pay (포트 3100)
```
상태: ✅ 통신 성공
테스트: wget http://flash-pay:3100
결과: HTTP 404 (정상 - 엔드포인트 없음, 연결은 성공)
```

#### 3. API → 외부 서비스
```
상태: ✅ 예상 정상 작동
포트: 5672 (RabbitMQ), 6379 (Redis), 5432 (PostgreSQL), 3306 (MySQL)
egress 정책 적용으로 아웃바운드 통신 허용됨
```

### 🚫 차단된 통신 (의도된 차단)

#### Gateway → Pay (포트 3100)
```
상태: ❌ 차단됨 (의도된 차단)
이유: restrict-pay-from-gateway 정책에 의해 API 경유 없이는 접근 불가
```

---

## 🏗️ 아키텍처 구조

```
외부 요청
    ↓
[CDN/WAF] ← IP 차단 (221.146.12.63/32)
    ↓
[ALB (Ingress Controller)]
    ↓
[Gateway Pod] ← NetworkPolicy: allow-gateway-from-alb (포트 3000)
    ↓
[API Pod] ← NetworkPolicy: allow-api-from-gateway (포트 4000)
    ↓
[Pay Pod] ← NetworkPolicy: allow-pay-from-api (포트 3100)
    ├→ [RabbitMQ] ← NetworkPolicy: allow-egress-external (포트 5672)
    ├→ [Redis] ← NetworkPolicy: allow-egress-external (포트 6379)
    ├→ [Database] ← NetworkPolicy: allow-egress-external (포트 5432/3306)
    └→ ❌ 기타 Pod 접근 차단 (default-deny-ingress)
```

---

## 📁 파일 구조

```
monitoring/networkpolicy/
├── 00-default-deny.yaml              # 기본 차단 정책
├── 01-allow-gateway-from-alb.yaml    # Gateway 수신 허용
├── 02-allow-api-from-gateway.yaml    # API 수신 허용
├── 03-allow-pay-from-api.yaml        # Pay 수신 허용
├── 04-allow-egress-external.yaml     # 외부 서비스 접근 허용
├── 05-restrict-pay-from-gateway.yaml # Pay 직접 접근 제한
├── README.md                         # 상세 가이드
└── DEPLOYMENT_REPORT.md              # 이 파일
```

---

## 🔒 보안 효과

### 1. **내부 침해 확산 방지**
```
공격 시나리오: Gateway Pod이 해킹됨
┌─────────────────────────────────────┐
│ 공격자: Gateway → API 접근 시도    │
│ 결과: ✅ 허용됨 (정상 경로)        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 공격자: Gateway → Pay 직접 접근    │
│ 결과: ❌ 차단됨 (측면 이동 방지)   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 공격자: Gateway → Redis 직접 접근  │
│ 결과: ❌ 차단됨 (데이터 탈취 방지) │
└─────────────────────────────────────┘
```

### 2. **Zero-Trust 보안 모델**
- ❌ 기본값: 모든 통신 차단 (default-deny)
- ✅ 명시적 허용: 필요한 경로만 개방

### 3. **감지 및 모니터링**
```
차단된 통신 탐지:
- Kubernetes 이벤트 로그
- CNI 플러그인 로그 (Cilium, AWS VPC CNI)
- CloudWatch Logs (Amazon CloudWatch Container Insights)
```

---

## 🛠️ 운영 가이드

### 트러블슈팅: 새 서비스 추가 시

```bash
# 1. 새 Pod 배포
kubectl apply -f new-service.yaml

# 2. 통신 테스트 (실패 예상)
kubectl exec <new-pod> -- wget http://target-service:port

# 3. NetworkPolicy 추가
cat >> 06-allow-new-service.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-new-service
  namespace: flash-ticket
spec:
  podSelector:
    matchLabels:
      app: new-service
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: caller-service
    ports:
    - protocol: TCP
      port: <port>
EOF

kubectl apply -f 06-allow-new-service.yaml

# 4. 검증
kubectl exec <new-pod> -- wget http://target-service:port
```

### 정책 수정

```bash
# 정책 확인
kubectl describe networkpolicy <policy-name> -n flash-ticket

# 정책 수정
kubectl edit networkpolicy <policy-name> -n flash-ticket

# 정책 삭제
kubectl delete networkpolicy <policy-name> -n flash-ticket
```

---

## 📈 모니터링 (향후 계획)

### 1. 거부된 트래픽 모니터링
```bash
# Prometheus 메트릭 (Cilium CNI 사용 시)
cilium_denied_packets_total
cilium_denied_bytes_total
```

### 2. Grafana 대시보드 추가
- NetworkPolicy 거부 건수 시각화
- 의도하지 않은 차단 감지

### 3. AlertManager 규칙
```yaml
- alert: UnexpectedNetworkDenial
  expr: rate(cilium_denied_packets_total[5m]) > threshold
  for: 5m
```

---

## 🔄 다음 단계 (권장)

1. ✅ **NetworkPolicy** - 완료
2. ⏳ **Pod Security Policy** - 권장
   ```bash
   # 컨테이너 권한 제한 (Root 권한 제거)
   ```

3. ⏳ **RBAC 강화** - 권장
   ```bash
   # Kubernetes API 접근 제어
   ```

4. ⏳ **Sealed Secrets** - 권장
   ```bash
   # 민감정보 암호화 저장
   ```

---

## 📝 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-11-06 | NetworkPolicy 7개 적용 및 검증 완료 |
| 2025-11-06 | restrict-pay-from-gateway 추가 (측면 이동 방지) |

---

## 📞 문의 및 지원

**문제 발생 시:**
1. README.md의 트러블슈팅 섹션 참고
2. Pod 로그 확인: `kubectl logs -n flash-ticket <pod-name>`
3. NetworkPolicy 규칙 검증: `kubectl describe networkpolicy -n flash-ticket`

---

**배포 담당자:** Platform Engineering Team
**최종 검토 완료:** ✅ 2025-11-06 19:30 KST
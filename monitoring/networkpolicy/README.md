# Flash Ticket NetworkPolicy (내부 방화벽)

## 개요
WAF 외부 대응과 함께 **내부 Pod 간 통신 제어**를 통한 Zero-Trust 보안 구현

## 파일 구조
```
networkpolicy/
├── 00-default-deny.yaml          # 모든 트래픽 기본 차단
├── 01-allow-gateway-from-alb.yaml # 외부 -> Gateway
├── 02-allow-api-from-gateway.yaml  # Gateway -> API
├── 03-allow-pay-from-api.yaml      # API -> Pay
├── 04-allow-egress-external.yaml   # 외부 서비스 접근 (RabbitMQ, Redis, DB)
└── README.md
```

## 트래픽 흐름

### Ingress (외부 → 내부)
```
외부 요청 (CDN > WAF > ALB)
    ↓
[Gateway Pod:3000] ✅ 허용 (ALB에서만)
    ↓
[API Pod:4000] ✅ 허용 (Gateway에서만)
    ↓
[Pay Pod:3100] ✅ 허용 (API에서만)
```

### Egress (내부 → 외부)
```
[API Pod] → RabbitMQ (5672) ✅
         → Redis (6379) ✅
         → Database (5432/3306) ✅

[Gateway Pod] → API Pod (4000) ✅

[Pay Pod] → RabbitMQ (5672) ✅
         → Redis (6379) ✅
         → Database (5432/3306) ✅
```

## 적용 범위
- **네임스페이스:** `flash-ticket`만 적용
- **다른 네임스페이스:** 영향 없음 (monitoring, argocd, kube-system 등)

## 적용 전 확인 (Dry-run)

### 1단계: 개별 테스트
```bash
# 각 PolicyFile별로 dry-run 검증
kubectl apply -f 00-default-deny.yaml --dry-run=client -o yaml
kubectl apply -f 01-allow-gateway-from-alb.yaml --dry-run=client -o yaml
kubectl apply -f 02-allow-api-from-gateway.yaml --dry-run=client -o yaml
kubectl apply -f 03-allow-pay-from-api.yaml --dry-run=client -o yaml
kubectl apply -f 04-allow-egress-external.yaml --dry-run=client -o yaml
```

### 2단계: 통합 테스트
```bash
# 모든 파일 함께 dry-run
kubectl apply -f . --dry-run=client -o yaml
```

### 3단계: 통신 검증
```bash
# Gateway -> API 통신 테스트 (성공해야 함)
kubectl exec -it <gateway-pod> -n flash-ticket -- \
  curl http://flash-api:4000 -v

# API -> Pay 통신 테스트 (성공해야 함)
kubectl exec -it <api-pod> -n flash-ticket -- \
  curl http://flash-pay:3100 -v

# 차단된 통신 테스트 (실패해야 함)
kubectl exec -it <api-pod> -n flash-ticket -- \
  curl http://flash-gateway:3000 -v  # 실패 예상
```

## 실제 적용

### 배포
```bash
# 모든 NetworkPolicy 적용
kubectl apply -f monitoring/networkpolicy/

# 확인
kubectl get networkpolicies -n flash-ticket
kubectl describe networkpolicy -n flash-ticket
```

### 롤백 (문제 발생 시)
```bash
# 모든 NetworkPolicy 삭제
kubectl delete -f monitoring/networkpolicy/

# 또는 개별 삭제
kubectl delete networkpolicy default-deny-ingress -n flash-ticket
```

## 모니터링

### 거부된 트래픽 확인
```bash
# Cilium 설치되어 있다면 (CNI가 cilium인 경우)
kubectl logs -n kube-system -l k8s-app=cilium | grep "DENIED"

# AWS VPC Flow Logs 확인
aws ec2 describe-flow-logs --filter Name=resource-id,Values=<eni-id>
```

### 알림 설정
Prometheus 규칙 추가:
```yaml
- alert: NetworkPolicyDeniedTraffic
  expr: rate(cilium_denied_packets_total[5m]) > 0
  for: 1m
```

## 트러블슈팅

### 문제: 정상 트래픽이 차단됨
**증상:** 서비스가 응답하지 않음
**해결:**
```bash
# 1. NetworkPolicy 확인
kubectl describe networkpolicy -n flash-ticket

# 2. Pod 로그 확인
kubectl logs -n flash-ticket <pod-name>

# 3. 필요시 특정 Policy만 임시 제거
kubectl delete networkpolicy <policy-name> -n flash-ticket
```

### 문제: 외부 서비스 접근 불가
**증상:** RabbitMQ, Redis 연결 실패
**해결:**
```bash
# 04-allow-egress-external.yaml의 포트 확인
# RabbitMQ: 5672 (AMQP)
# Redis: 6379 (TCP)
# PostgreSQL: 5432
# MySQL: 3306

# 실제 사용 포트 확인
kubectl exec -it <pod> -n flash-ticket -- env | grep -i 'RABBITMQ\|REDIS'
```

## 참고

- [Kubernetes NetworkPolicy 공식 문서](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [CNI Plugin별 NetworkPolicy 지원](https://kubernetes.io/docs/concepts/services-networking/network-policies/#supported-by)
- [Cilium NetworkPolicy 가이드](https://docs.cilium.io/en/stable/security/policy/)

## 추가 보안 조치

이 NetworkPolicy와 함께 다음도 권장:
1. **Pod Security Policy** - 컨테이너 권한 제어
2. **RBAC** - Kubernetes API 접근 제어
3. **Sealed Secrets** - 민감정보 암호화
4. **AWS Security Group** - VPC 레벨 방화벽

---

**작성 날짜:** 2025-11-06
**최종 검토:** 배포팀과 함께

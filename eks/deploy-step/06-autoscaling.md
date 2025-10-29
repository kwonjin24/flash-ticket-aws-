# 06. Auto-scaling (HPA) 설정

## 개요
Horizontal Pod Autoscaler (HPA)를 설정하여 CPU/메모리 사용량에 따라 Pod를 자동으로 스케일링합니다.

## 전제 조건
- Metrics Server가 EKS 클러스터에 설치되어 있어야 함
- Deployment에 리소스 requests/limits가 설정되어 있어야 함

## 1. Metrics Server 확인
```bash
# Metrics Server 상태 확인
kubectl get deployment metrics-server -n kube-system

# 없다면 설치
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## 2. HPA 배포
```bash
# HPA 설정 배포
kubectl apply -f autoscaling/api-hpa.yaml
kubectl apply -f autoscaling/gateway-hpa.yaml
kubectl apply -f autoscaling/pay-hpa.yaml
```

## 3. HPA 상태 확인
```bash
# HPA 상태 확인
kubectl get hpa -n flash-ticket

# 상세 정보 확인
kubectl describe hpa flash-api-hpa -n flash-ticket
kubectl describe hpa flash-gateway-hpa -n flash-ticket
kubectl describe hpa flash-pay-hpa -n flash-ticket
```

## 4. 스케일링 설정 정보

### API 서비스 (flash-api-hpa)
- **최소 Replicas**: 2
- **최대 Replicas**: 10
- **CPU 임계값**: 70%
- **메모리 임계값**: 80%
- **스케일업**: 빠른 대응 (30초-60초)
- **스케일다운**: 안정적 (5분)

### Gateway 서비스 (flash-gateway-hpa)
- **최소 Replicas**: 1
- **최대 Replicas**: 8
- **CPU 임계값**: 65%
- **메모리 임계값**: 75%
- **스케일업**: 매우 빠른 대응 (15초-30초)
- **스케일다운**: 안정적 (5분)

### Pay Worker (flash-pay-hpa)
- **최소 Replicas**: 1
- **최대 Replicas**: 5
- **CPU 임계값**: 80%
- **메모리 임계값**: 85%
- **스케일업**: 빠른 대응 (30초-60초)
- **스케일다운**: 매우 안정적 (10분)

## 5. 모니터링 명령어
```bash
# 실시간 Pod 상태 모니터링
watch kubectl get pods -n flash-ticket

# HPA 상태 실시간 모니터링
watch kubectl get hpa -n flash-ticket

# Pod 리소스 사용량 확인
kubectl top pods -n flash-ticket
```

## 6. 로드 테스트 예시
```bash
# API 서비스 부하 테스트 (예시)
kubectl run -i --tty load-generator --rm --image=busybox --restart=Never -- /bin/sh
while true; do wget -q -O- http://flash-api.flash-ticket.svc.cluster.local:4000/health; done
```

## 7. 트러블슈팅

### HPA가 동작하지 않는 경우
1. Metrics Server 상태 확인
2. Pod의 리소스 requests 설정 확인
3. HPA 이벤트 로그 확인: `kubectl describe hpa <hpa-name> -n flash-ticket`

### 스케일링이 너무 빈번한 경우
- stabilizationWindowSeconds 값을 늘려 안정화 시간 조정
- 임계값을 조정하여 민감도 조절

## 주의사항
- Pay Worker는 메시지 처리 중간에 Pod가 종료되지 않도록 graceful shutdown 구현 필요
- Gateway는 WebSocket 연결을 고려하여 스케일다운 정책을 보수적으로 설정
- API는 트래픽 급증에 빠르게 대응하도록 스케일업 정책을 적극적으로 설정
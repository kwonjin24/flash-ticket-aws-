# 07. Network Security (NetworkPolicy) 설정

## 개요
NetworkPolicy를 통해 Pod 간 네트워크 트래픽을 제어하여 마이크로서비스 보안을 강화합니다.

## 보안 정책 개요

### 기본 정책: Default Deny All
- 모든 인바운드/아웃바운드 트래픽을 기본적으로 차단
- 필요한 트래픽만 명시적으로 허용

### 서비스별 접근 제어

#### 1. Gateway (flash-gateway)
```
인바운드: ALB에서 포트 3000 접근 허용
아웃바운드: 
  - API 서비스 (포트 4000)
  - Redis ElastiCache (포트 6379)
  - DNS 조회
```

#### 2. API (flash-api)  
```
인바운드: Gateway에서만 포트 4000 접근 허용
아웃바운드:
  - PostgreSQL (포트 15432)
  - Redis ElastiCache (포트 6379)  
  - RabbitMQ Amazon MQ (포트 5671)
  - DNS 조회
```

#### 3. Pay Worker (flash-pay)
```
인바운드: 모든 접근 차단
아웃바운드:
  - RabbitMQ Amazon MQ (포트 5671)
  - 외부 결제 API (포트 443)
  - DNS 조회
```

## 배포 절차

### 1. CNI 플러그인 확인
```bash
# EKS 클러스터에서 NetworkPolicy 지원 확인
kubectl get nodes -o wide
# Amazon VPC CNI는 기본적으로 NetworkPolicy 지원
```

### 2. 점진적 배포 (권장)
```bash
# 1단계: 현재 통신 테스트
kubectl exec -it deployment/flash-gateway -n flash-ticket -- curl flash-api:4000/health

# 2단계: NetworkPolicy 배포
kubectl apply -f security/network-policies.yaml

# 3단계: 통신 재테스트
kubectl exec -it deployment/flash-gateway -n flash-ticket -- curl flash-api:4000/health
```

### 3. 전체 배포
```bash
# NetworkPolicy 배포
kubectl apply -f security/network-policies.yaml

# 배포 상태 확인
kubectl get networkpolicy -n flash-ticket
```

## 검증 및 테스트

### 1. NetworkPolicy 상태 확인
```bash
# NetworkPolicy 목록 확인
kubectl get networkpolicy -n flash-ticket

# 상세 정보 확인
kubectl describe networkpolicy -n flash-ticket
```

### 2. 허용된 통신 테스트
```bash
# Gateway → API 통신 (허용되어야 함)
kubectl exec -it deployment/flash-gateway -n flash-ticket -- curl flash-api:4000/health

# 외부 → Gateway 통신 (ALB 헬스체크)
curl https://gateway.highgarden.cloud/queue/healthz
```

### 3. 차단된 통신 테스트
```bash
# Pay Worker 인바운드 차단 테스트 (차단되어야 함)
kubectl exec -it deployment/flash-gateway -n flash-ticket -- curl flash-pay:8080
# 응답: timeout 또는 connection refused

# API 직접 접근 차단 테스트 (Gateway 우회)
kubectl run test-pod --image=busybox --rm -it --restart=Never -- wget -T 5 flash-api:4000/health
# 응답: timeout
```

## 트러블슈팅

### 통신이 안 되는 경우
1. **NetworkPolicy 규칙 확인**
   ```bash
   kubectl describe networkpolicy <policy-name> -n flash-ticket
   ```

2. **Pod 레이블 확인**
   ```bash
   kubectl get pods -n flash-ticket --show-labels
   ```

3. **포트 번호 확인**
   ```bash
   kubectl get svc -n flash-ticket
   ```

### 일시적 비활성화
```bash
# 긴급 시 NetworkPolicy 삭제
kubectl delete networkpolicy --all -n flash-ticket

# 다시 적용
kubectl apply -f security/network-policies.yaml
```

## 모니터링

### NetworkPolicy 로그 확인
```bash
# VPC Flow Logs 또는 CNI 로그 확인
kubectl logs -n kube-system -l k8s-app=aws-node
```

### 트래픽 분석
```bash
# 실시간 네트워크 모니터링
kubectl exec -it deployment/flash-gateway -n flash-ticket -- netstat -an
```

## 주의사항

1. **점진적 적용**: 운영 환경에서는 단계별로 적용하여 서비스 중단 방지
2. **DNS 허용**: 모든 Pod에서 DNS 조회가 가능하도록 설정
3. **헬스체크 고려**: ALB 헬스체크 경로가 차단되지 않도록 주의
4. **외부 의존성**: ElastiCache, RDS, Amazon MQ 접근이 차단되지 않도록 확인

## 보안 효과

- ✅ **Zero Trust**: Pod 간 기본 차단, 필요시에만 허용
- ✅ **공격 표면 축소**: Pay Worker 완전 격리
- ✅ **측면 이동 방지**: 한 Pod 침해 시 다른 Pod 접근 차단
- ✅ **규정 준수**: 네트워크 세분화 요구사항 충족
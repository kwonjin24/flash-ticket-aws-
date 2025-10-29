# 08. Karpenter 자동 스케일링 설정

## 개요
Karpenter를 사용하여 노드 자동 스케일링을 구성합니다. HPA와 함께 사용하여 Pod와 노드 모두 자동으로 스케일링됩니다.

## 아키텍쳐 개요
```
트래픽 증가 → HPA (Pod 스케일링) → Karpenter (노드 스케일링) → 자동 확장
트래픽 감소 ← HPA (Pod 축소) ← Karpenter (노드 축소) ← 자동 축소
```

## 전제 조건
- EKS 클러스터가 실행 중이어야 함
- Helm 3.8+ 설치되어 있어야 함
- AWS CLI 구성되어 있어야 함
- 적절한 IAM 권한이 있어야 함

## 설치 과정

### 1. Karpenter 설치
```bash
# 실행 권한 부여
chmod +x karpenter/install-karpenter.sh

# Karpenter 설치 실행
./karpenter/install-karpenter.sh
```

### 2. 서브넷과 보안 그룹 태깅
```bash
# Private 서브넷에 태그 추가
aws ec2 create-tags \
    --resources subnet-xxxxx subnet-yyyyy \
    --tags Key=karpenter.sh/discovery,Value=flash-tickets-cluster

# 보안 그룹에 태그 추가  
aws ec2 create-tags \
    --resources sg-xxxxx \
    --tags Key=karpenter.sh/discovery,Value=flash-tickets-cluster
```

### 3. NodePool 배포
```bash
# NodePool과 NodeClass 배포
kubectl apply -f karpenter/nodepool.yaml

# 배포 확인
kubectl get nodepool
kubectl get ec2nodeclass
```

## 설정 정보

### NodePool 구성
- **인스턴스 타입**: t3.medium ~ m5.xlarge
- **용량 타입**: Spot 우선, On-Demand 백업
- **최대 리소스**: 1000 vCPU, 1000 GiB 메모리
- **노드 만료**: 30분 후 자동 교체
- **통합 정책**: 빈 노드는 30초 후 제거

### 비용 최적화 전략
1. **Spot Instance 우선 사용** (최대 90% 비용 절감)
2. **다양한 인스턴스 타입** (가용성 확보)
3. **빠른 스케일다운** (리소스 낭비 방지)
4. **적절한 노드 크기** (리소스 효율성)

## 동작 확인

### 1. Karpenter 상태 확인
```bash
# Karpenter 컨트롤러 상태
kubectl get pods -n karpenter

# NodePool 상태 확인
kubectl describe nodepool flash-tickets-nodepool

# 노드 상태 확인
kubectl get nodes -l node-type=karpenter-managed
```

### 2. 자동 스케일링 테스트
```bash
# 부하 생성하여 HPA 트리거
kubectl run load-test --image=busybox --rm -it --restart=Never -- /bin/sh
# 컨테이너 안에서 API 호출 반복

# 실시간 모니터링
watch "kubectl get pods -n flash-ticket && echo '---' && kubectl get nodes"
```

### 3. Spot Instance 중단 테스트
```bash
# Spot Instance 중단 시뮬레이션
aws ec2 cancel-spot-instance-requests --spot-instance-request-ids sir-xxxxx

# 자동 복구 확인
kubectl get events --sort-by='.lastTimestamp'
```

## HPA + Karpenter 통합 시나리오

### 시나리오 1: 트래픽 급증
```
1. 사용자 트래픽 급증
2. HPA가 CPU/메모리 사용률 감지 (70% 초과)
3. HPA가 Pod 수 증가 (2개 → 5개)
4. 노드 리소스 부족으로 Pod가 Pending 상태
5. Karpenter가 Pending Pod 감지
6. 새 노드 자동 생성 (30-60초 소요)
7. Pod가 새 노드에 스케줄링
```

### 시나리오 2: 트래픽 감소
```
1. 사용자 트래픽 감소
2. HPA가 낮은 사용률 감지 (30% 미만)
3. HPA가 Pod 수 감소 (5개 → 2개)
4. 노드에 빈 리소스 발생
5. Karpenter가 30초 후 빈 노드 감지
6. 사용하지 않는 노드 자동 제거
7. 비용 절약
```

## 모니터링 및 관찰

### 로그 확인
```bash
# Karpenter 컨트롤러 로그
kubectl logs -f -n karpenter -l app.kubernetes.io/name=karpenter

# 노드 프로비저닝 이벤트
kubectl get events --field-selector involvedObject.kind=Node

# Pod 스케줄링 이벤트
kubectl get events --field-selector involvedObject.kind=Pod
```

### 메트릭 확인
```bash
# 노드별 리소스 사용률
kubectl top nodes

# Pod별 리소스 사용률
kubectl top pods -n flash-ticket

# HPA 상태
kubectl get hpa -n flash-ticket
```

## 문제 해결

### 노드가 생성되지 않는 경우
1. **IAM 권한 확인**
   ```bash
   aws sts get-caller-identity
   aws iam get-role --role-name KarpenterControllerRole-flash-tickets-cluster
   ```

2. **서브넷 태그 확인**
   ```bash
   aws ec2 describe-subnets --filters "Name=tag:karpenter.sh/discovery,Values=flash-tickets-cluster"
   ```

3. **보안 그룹 확인**
   ```bash
   aws ec2 describe-security-groups --filters "Name=tag:karpenter.sh/discovery,Values=flash-tickets-cluster"
   ```

### Pod가 스케줄되지 않는 경우
1. **노드 셀렉터 확인**
2. **테인트/톨러레이션 확인**
3. **리소스 요청량 확인**

## 비용 모니터링

### AWS Cost Explorer
- EC2 비용을 Spot vs On-Demand로 분류
- 시간대별 비용 변화 추적
- 인스턴스 타입별 비용 분석

### 권장 비용 최적화
1. **Spot Instance 비율 80% 이상 유지**
2. **노드 사용률 70% 이상 유지**
3. **불필요한 노드 빠른 제거**
4. **적절한 인스턴스 크기 선택**

## 주의사항

1. **Spot Instance 중단**: 갑작스러운 중단에 대비한 복구 전략 필요
2. **데이터 유실**: Stateful 워크로드는 별도 처리 필요
3. **네트워크 정책**: 새 노드에도 보안 정책 적용 확인
4. **모니터링**: 자동 스케일링 동작을 지속적으로 모니터링

이제 HPA와 Karpenter가 함께 동작하여 완전한 자동 스케일링 환경이 구성됩니다!
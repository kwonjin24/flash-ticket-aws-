# HPA & Karpenter 자동 스케일링 가이드

## 📊 현재 구성 요약

### HPA (Horizontal Pod Autoscaler)
- **API 서비스**: 2-10 replicas, CPU 70% / Memory 80% 기준
- **Gateway 서비스**: 2-10 replicas, CPU 70% / Memory 80% 기준  
- **Pay 서비스**: 2-10 replicas, CPU 70% / Memory 80% 기준

### Karpenter (Node Autoscaler)
- **NodePool**: t3.medium 스팟 인스턴스
- **최대 CPU**: 1000 (약 500개 노드)
- **통합 정책**: WhenUnderutilized

---

## 🔄 자동 스케일링 시나리오

### 시나리오 1: 정상 트래픽 (현재 상태)
```
사용자 요청 → 기존 Pod들이 처리 → 메트릭 정상 → 변화 없음
```
- **HPA**: 최소 2개 Pod 유지
- **Karpenter**: 기존 노드 유지

---

### 시나리오 2: 트래픽 증가 (부하 발생)

#### 2-1. Pod 부족 상황
```
높은 트래픽 → CPU/Memory 사용률 증가 → HPA 작동
```

**HPA 작동 조건:**
- CPU 사용률 > 70% (1분 이상 지속)
- Memory 사용률 > 80% (1분 이상 지속)

**HPA 작동 과정:**
1. **0-30초**: 메트릭 수집 및 임계값 확인
2. **30-60초**: 스케일 업 결정
3. **1분 후**: 새 Pod 생성 시작 (예: 2 → 3 → 4개)

#### 2-2. 노드 부족 상황
```
새 Pod 생성 → 노드 리소스 부족 → Pod Pending → Karpenter 작동
```

**Karpenter 작동 조건:**
- Pending 상태인 Pod 발견
- 기존 노드에 리소스 부족

**Karpenter 작동 과정:**
1. **0-15초**: Pending Pod 감지
2. **15-30초**: 새 노드 프로비저닝 시작
3. **2-3분**: 새 EC2 인스턴스 시작 및 클러스터 조인
4. **3-4분**: Pod이 새 노드에 스케줄링

---

### 시나리오 3: 트래픽 감소 (부하 해소)

#### 3-1. Pod 스케일 다운
```
트래픽 감소 → CPU/Memory 사용률 감소 → HPA 스케일 다운
```

**HPA 스케일 다운 조건:**
- CPU 사용률 < 70% (5분 이상 지속)
- Memory 사용률 < 80% (5분 이상 지속)

**HPA 스케일 다운 과정:**
1. **5분**: 낮은 사용률 지속 확인
2. **5분 후**: Pod 개수 감소 (예: 4 → 3 → 2개)

#### 3-2. 노드 스케일 다운
```
Pod 감소 → 노드 리소스 낭비 → Karpenter 통합
```

**Karpenter 스케일 다운 조건:**
- 노드 활용률이 낮음 (WhenUnderutilized 정책)
- 다른 노드로 Pod 재배치 가능

**Karpenter 스케일 다운 과정:**
1. **30분**: 저활용 상태 지속 확인
2. **30분 후**: Pod을 다른 노드로 이전
3. **이전 완료 후**: 불필요한 노드 종료

---

## 📈 실제 동작 예시

### 예시 1: 티켓 판매 오픈 (갑작스런 트래픽 급증)
```
1. 사용자 급증 → API Pod CPU 70% 초과
2. [1분 후] HPA: API Pod 2개 → 4개 증가
3. 새 Pod들이 Pending (노드 리소스 부족)
4. [3분 후] Karpenter: 새 t3.medium 노드 추가
5. Pending Pod들이 새 노드에 배치
6. 안정적인 서비스 제공
```

### 예시 2: 심야 시간 (트래픽 감소)
```
1. 사용자 감소 → API Pod CPU 50%로 감소
2. [5분 후] HPA: API Pod 4개 → 2개 감소
3. 여러 노드의 활용률 저하
4. [30분 후] Karpenter: 활용률 낮은 노드 제거
5. Pod 재배치 후 불필요한 노드 종료
```

---

## ⚙️ 설정 파일 위치

### HPA 설정
- `/eks/autoscaling/api-hpa.yaml`
- `/eks/autoscaling/gateway-hpa.yaml`  
- `/eks/autoscaling/pay-hpa.yaml`

### Karpenter 설정
- `/eks/karpenter/karpenter-new.yaml` (컨트롤러)
- `/eks/karpenter/nodepool-new.yaml` (노드풀 & EC2NodeClass)

### 리소스 요청/제한 설정
- `/eks/deployments/api-deployment.yaml`
- `/eks/deployments/gateway-deployment.yaml`
- `/eks/deployments/pay-deployment.yaml`

---

## 🎯 모니터링 방법

### HPA 모니터링
```bash
# HPA 상태 확인
kubectl get hpa -A

# 상세 정보 확인  
kubectl describe hpa flash-api-hpa -n flash-ticket

# 메트릭 확인
kubectl top pods -n flash-ticket
```

### Karpenter 모니터링
```bash
# 노드 상태 확인
kubectl get nodes

# Karpenter 로그 확인
kubectl logs -f deployment/karpenter -n karpenter

# NodeClaim 상태 확인
kubectl get nodeclaims
```

---

## 💡 최적화 팁

1. **리소스 요청 정확히 설정**: HPA가 올바르게 작동하려면 `requests` 값이 실제 사용량과 일치해야 함

2. **임계값 조정**: 서비스 특성에 맞게 CPU/Memory 임계값 조정

3. **Karpenter 노드 타입**: 워크로드에 적합한 인스턴스 타입 선택

4. **스케일 다운 시간**: 비용 절약과 안정성 균형 고려
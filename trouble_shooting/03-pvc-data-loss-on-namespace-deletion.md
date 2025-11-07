# PVC 데이터 손실 문제 트러블슈팅

**날짜:** 2025-11-06
**증상:** `kubectl delete namespace monitoring` 실행 시 Grafana 대시보드 데이터 전체 손실
**상태:** ✅ 해결 완료

## 문제 증상

```bash
# monitoring namespace 삭제
$ kubectl delete namespace monitoring
namespace "monitoring" deleted

# namespace 재생성 후 Grafana 접속
# 결과: 모든 대시보드, 설정, 사용자 정보 손실
```

## 원인 분석

### PVC 삭제 메커니즘

```
kubectl delete namespace monitoring
  ↓
PVC 삭제 (CascadeDelete)
  ↓
RECLAIM POLICY 확인
  ├─ Delete (기본값) → EBS 볼륨 자동 삭제 ❌ 데이터 손실
  └─ Retain → EBS 볼륨 유지 ✅ 데이터 안전
```

**우리의 상황:**
- 기존 storage.yaml에서 `storageClassName: gp2` 사용
- `gp2` StorageClass의 기본 정책: `reclaimPolicy: Delete`
- → PVC 삭제 시 EBS 볼륨도 자동 삭제됨

### 삭제 전/후 상태

```bash
# 삭제 전
$ kubectl get pv
NAME                                      RECLAIM POLICY
pvc-45ca90bb-ae47-46ce-bfc3-6d025e481b90  Delete
pvc-9730234b-b013-45d3-a317-83e8ff2fa272  Delete

# namespace 삭제 후
$ kubectl get pv
# 결과: 없음 (모두 삭제됨)
```

## 해결 방법

### Step 1: storage.yaml 수정

StorageClass 추가 + reclaimPolicy를 Retain으로 변경:

```yaml
# monitoring/kubernetes/storage.yaml

apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp2-retain
provisioner: ebs.csi.aws.com
reclaimPolicy: Retain  # ← 중요: Delete에서 Retain으로 변경

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-data
  namespace: monitoring
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: gp2-retain  # ← 새로운 StorageClass 사용
```

(grafana-data, alertmanager-data도 동일하게 `gp2-retain` 사용)

### Step 2: 기존 PV의 RECLAIM POLICY 변경

이미 생성된 PV는 kubectl patch로 변경:

```bash
# 현재 PV 확인
kubectl get pv

# 각 PV의 정책 변경 (Delete → Retain)
kubectl patch pv pvc-45ca90bb-ae47-46ce-bfc3-6d025e481b90 \
  -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'

kubectl patch pv pvc-9730234b-b013-45d3-a317-83e8ff2fa272 \
  -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'

# 확인
kubectl get pv | grep pvc-
# RECLAIM POLICY 열이 Retain으로 변경됨
```

### Step 3: 향후 namespace 삭제 시

```bash
# namespace 삭제해도 이제 안전함
kubectl delete namespace monitoring

# PVC는 삭제되지만 EBS 볼륨은 유지됨
$ kubectl get pv
# STATUS: Released

# 같은 이름의 PVC 재생성 시 기존 데이터 자동 복구
kubectl apply -f monitoring/kubernetes/storage.yaml
kubectl apply -f monitoring/kubernetes/grafana.yaml

# PVC가 "Released" 상태의 PV에 자동 바인딩 → 기존 데이터 유지! ✅
```

## 적용된 해결책

✅ **storage.yaml 수정 완료**
- StorageClass `gp2-retain` 추가 (reclaimPolicy: Retain)
- 모든 PVC가 `gp2-retain` 사용하도록 설정

✅ **기존 PV Reclaim Policy 변경 완료**
- `pvc-45ca90bb-ae47-46ce-bfc3-6d025e481b90` (Grafana): Delete → Retain
- `pvc-9730234b-b013-45d3-a317-83e8ff2fa272` (Prometheus): Delete → Retain

```bash
# 확인
$ kubectl get pv | grep pvc-
pvc-45ca90bb-ae47-46ce-bfc3-6d025e481b90    5Gi    RWO   Retain   Bound
pvc-9730234b-b013-45d3-a317-83e8ff2fa272    10Gi   RWO   Retain   Bound
```

## 핵심 개념

| 항목 | 설명 |
|------|------|
| **StorageClass** | 동적 PV 프로비저닝 정책 정의 |
| **reclaimPolicy: Delete** | PVC 삭제 시 EBS 볼륨도 삭제 (기본값, 위험) |
| **reclaimPolicy: Retain** | PVC 삭제되도 EBS 볼륨 유지 (안전) |
| **PVC** | 애플리케이션이 요청하는 저장소 (namespace 범위) |
| **PV** | Kubernetes가 관리하는 실제 저장소 (클러스터 범위) |

## 예방 체크리스트

중요한 데이터를 저장하는 시스템(DB, 캐시, 모니터링)을 배포할 때:

- [ ] StorageClass의 reclaimPolicy 확인
- [ ] 중요 데이터는 **Retain** 정책 적용
- [ ] namespace 삭제 전 PVC 확인
- [ ] EBS 스냅샷 정기 생성 고려

## 참고

- [Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Kubernetes Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)

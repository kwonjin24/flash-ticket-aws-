# Kubernetes 모니터링 스택 배포

Prometheus + Grafana를 EKS 클러스터에 배포하기 위한 Kubernetes 설정 파일들입니다.

**주요 변경사항 (2025-11-03):**
- ✅ Alertmanager 제거 (alertmanager.yaml, alertmanager-config.yaml 삭제)
- ✅ Alert Rules 제거 (alert-rules.yaml 삭제)
- ✅ Prometheus alerting 섹션 제거
- ✅ CloudWatch Alarms로 전환 예정

## 📋 파일 목록 및 배포 순서

### 1단계: 네임스페이스 생성

**파일:** `namespace.yaml`

```bash
kubectl apply -f monitoring-sample/kubernetes/namespace.yaml
```

모니터링 스택을 위한 독립적인 `monitoring` 네임스페이스를 생성합니다.

---

### 2단계: 스토리지 생성

**파일:** `storage.yaml`

```bash
kubectl apply -f monitoring-sample/kubernetes/storage.yaml
```

**포함 리소스:**
- Prometheus PVC (10Gi)
- Grafana PVC (5Gi)
- Alertmanager PVC (2Gi)
- StorageClass (gp2)

---

### 3단계: 설정 파일 생성

#### 3-1. Prometheus 설정

**파일:** `prometheus-config.yaml`

```bash
kubectl apply -f monitoring-sample/kubernetes/prometheus-config.yaml
```

**포함:**
- Prometheus ConfigMap (prometheus.yml)
- 스크레이프 대상 (targets) 정의
- 외부 라벨 설정
- ✅ Alertmanager 설정 제거됨

**주요 스크레이프 대상:**
```yaml
scrape_configs:
  - job_name: 'flash-api-metrics'        # API 메트릭
  - job_name: 'flash-gateway-metrics'    # Gateway 메트릭
  - job_name: 'flash-api-health'         # API 헬스 체크
  - job_name: 'flash-gateway-health'     # Gateway 헬스 체크
  - job_name: 'flash-pay-health'         # Pay 헬스 체크
```

---

### 4단계: 서비스 배포

#### 4-1. Prometheus 배포

**파일:** `prometheus.yaml`

```bash
kubectl apply -f monitoring-sample/kubernetes/prometheus.yaml
```

**리소스:**
- Deployment (Pod)
- Service (ClusterIP)
- 리소스 요청/제한

#### 4-2. Grafana 배포

**파일:** `grafana.yaml`

```bash
kubectl apply -f monitoring-sample/kubernetes/grafana.yaml
```

**포함:**
- Grafana Datasource 설정
- 초기 admin 계정

---

## 🚀 한 번에 배포하기

```bash
# 모든 설정 파일을 순서대로 적용
kubectl apply -f monitoring-sample/kubernetes/namespace.yaml
kubectl apply -f monitoring-sample/kubernetes/storage.yaml
kubectl apply -f monitoring-sample/kubernetes/prometheus-config.yaml
kubectl apply -f monitoring-sample/kubernetes/alertmanager-config.yaml
kubectl apply -f monitoring-sample/kubernetes/alert-rules.yaml
kubectl apply -f monitoring-sample/kubernetes/prometheus.yaml
kubectl apply -f monitoring-sample/kubernetes/alertmanager.yaml
kubectl apply -f monitoring-sample/kubernetes/grafana.yaml

# 또는 모든 파일을 한 번에
kubectl apply -f monitoring-sample/kubernetes/
```

---

## ✅ 배포 확인

```bash
# monitoring 네임스페이스의 모든 Pod 확인
kubectl get pods -n monitoring

# Pod가 Running 상태인지 확인
kubectl get pods -n monitoring -w

# 특정 Pod의 로그 확인
kubectl logs -n monitoring -l app=prometheus --tail=50
kubectl logs -n monitoring -l app=grafana --tail=50
kubectl logs -n monitoring -l app=alertmanager --tail=50

# PVC 상태 확인
kubectl get pvc -n monitoring
```

---

## 🔧 각 서비스 접근

### Prometheus
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# http://localhost:9090
```

### Grafana
```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
# http://localhost:3000
# 기본 계정: admin / admin
```

### Alertmanager
```bash
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
# http://localhost:9093
```

---

## 📝 리소스 명세

| 컴포넌트 | CPU 요청 | CPU 제한 | Memory 요청 | Memory 제한 |
|---------|---------|---------|-----------|-----------|
| Prometheus | 500m | 1000m | 512Mi | 1Gi |
| Grafana | 100m | 500m | 128Mi | 512Mi |
| Alertmanager | 100m | 200m | 128Mi | 256Mi |

---

## ⚠️ 주의사항

1. **EBS CSI Driver**: PVC 사용을 위해 EKS에 EBS CSI Driver Addon이 설치되어 있어야 합니다
   ```bash
   aws eks describe-addon --cluster-name flash-tickets-eks --addon-name aws-ebs-csi-driver
   ```

2. **StorageClass**: gp2 StorageClass 사용 (기본값)

3. **IAM 권한**: Grafana가 CloudWatch에 접근하려면 IRSA (IAM Role for Service Account) 설정 필요

4. **네트워크**: monitoring 네임스페이스에서 flash-tickets 네임스페이스의 서비스에 접근 가능해야 함

---

## 🔄 배포 후 커스터마이징

### Prometheus 스크레이프 대상 변경
```bash
kubectl edit configmap prometheus-config -n monitoring
# prometheus.yml 수정
kubectl rollout restart deployment/prometheus -n monitoring
```

### Slack 알림 설정 변경
```bash
kubectl edit configmap alertmanager-config -n monitoring
# alertmanager.yml의 slack_configs 수정
kubectl rollout restart deployment/alertmanager -n monitoring
```

### 리소스 제한 변경
```bash
kubectl edit deployment prometheus -n monitoring
# resources 섹션 수정
kubectl rollout status deployment/prometheus -n monitoring
```

---

## 📚 참고 문서

- [eks-monitoring-setup-guide.md](../../documents/EKS/eks-monitoring-setup-guide.md) - 상세 구성 가이드
- [monitoring-metric-solved-issues.md](../../trouble_shooting/monitoring-metric-solved-issues.md) - 문제 해결 기록
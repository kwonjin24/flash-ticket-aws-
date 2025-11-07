# Grafana 모니터링 메트릭 구축 및 최적화

**날짜:** 2025-10-29 ~ 2025-10-31
**증상:** Grafana 대시보드 구축 중 메트릭 정확성, 쿼리 성능, 데이터 파이프라인 관련 다양한 이슈 발생
**상태:** ✅ 해결 완료

---

## 문제 해결 과정

### 문제 1: 특정 Pod만 Pending 상태

**증상:**
```bash
kubectl get pods -n monitoring
# NAME                STATUS    RESTARTS   AGE
# prometheus-xxxx     Running   0          5m
# alertmanager-xxxx   Pending   0          5m  ← 하나만 Pending
# grafana-xxxx        Running   0          5m
```

**원인:** PVC가 바인딩되지 않음 또는 리소스 부족

**해결:**
```bash
# 1. 특정 Pod 상세 정보 확인
kubectl describe pod -n monitoring alertmanager-xxxx

# 2. PVC 상태 확인
kubectl get pvc -n monitoring flash-tickets-alertmanager
kubectl describe pvc -n monitoring flash-tickets-alertmanager

# 3. 노드 리소스 확인
kubectl describe nodes
kubectl top nodes

# 4. StorageClass 확인
kubectl get storageclass gp3
```

### 문제 2: Prometheus Pod가 재시작 반복

**증상:**
```bash
kubectl get pods -n monitoring
# NAME                READY   STATUS             RESTARTS   AGE
# prometheus-xxxx     0/1     CrashLoopBackOff   5          10m
```

**원인 확인:**

```bash
# 1. Pod 로그 확인
kubectl logs -n monitoring -l app=prometheus --tail=100

# 2. 이전 로그 확인 (재시작 전)
kubectl logs -n monitoring -l app=prometheus --previous

# 3. ConfigMap 문법 확인
kubectl get configmap prometheus-config -n monitoring -o yaml
```

**일반적인 원인:**
- `prometheus.yml` 문법 오류
- Alert Rules 문법 오류
- 권한 문제 (PVC 마운트 실패)

**해결:**
```bash
# ConfigMap 수정 후 Pod 재시작
kubectl rollout restart deployment/prometheus -n monitoring
```

### 문제 3: Prometheus Targets DOWN

**증상:**
```
Prometheus UI → Targets
flash-tickets-metrics: DOWN (빨간색)
Error: context deadline exceeded
```

**원인 확인:**

```bash
# 1. API 서비스 존재 확인
kubectl get svc -n flash-tickets api-server-service

# 2. API Pods 상태 확인
kubectl get pods -n flash-tickets

# 3. Prometheus Pod에서 DNS 테스트
kubectl exec -n monitoring -it deployment/prometheus -- sh
# nslookup api-server-service.flash-tickets.svc.cluster.local
# wget -O- http://api-server-service.flash-tickets.svc.cluster.local:4000/metrics
```

**해결:**
- API 서비스 이름이 틀렸으면 ConfigMap 수정
- API Pods가 Running이 아니면 API 서비스 확인
- 네트워크 정책이 있으면 `monitoring` 네임스페이스에서 `flash-tickets` 접근 허용

### 문제 4: Grafana Pod 데이터 없음

**증상:**
```
대시보드는 표시되지만 "No data" 또는 빈 그래프
```

**원인:** Datasource 연결 실패 또는 쿼리 오류

**해결:**

```bash
# 1. Grafana Pod 로그 확인
kubectl logs -n monitoring -l app=grafana --tail=100

# 2. Datasource 설정 확인
kubectl get configmap flash-tickets-grafanasources -n monitoring -o yaml

# 3. Grafana Pod에서 Prometheus 연결 테스트
kubectl exec -n monitoring -it deployment/grafana -- \
  wget -O- http://prometheus:9090/api/v1/query?query=up

# 4. Prometheus에 데이터가 있는지 확인
kubectl exec -n monitoring -it deployment/prometheus -- \
  wget -O- 'http://localhost:9090/api/v1/query?query=orders_created_total'
```

### 문제 5: kubectl port-forward 연결 끊김

**증상:**
```
Handling connection for 9090
E0127 10:30:00.123456    1234 portforward.go:400] an error occurred forwarding 9090 -> 9090
```

**해결:**
```bash
# 1. Pod가 Running 상태인지 확인
kubectl get pods -n monitoring -l app=prometheus

# 2. Pod 재시작
kubectl rollout restart deployment/prometheus -n monitoring

# 3. 다른 워커 노드 시도
aws ssm start-session --target i-<다른-워커-노드-ID>

# 4. port-forward 재실행
kubectl port-forward -n monitoring svc/prometheus 9090:9090
```

### 문제 6: Alertmanager Slack 알림 실패

**증상:**
```
Alertmanager Pod 로그:
level=error msg="Notify for alerts failed" num_alerts=1 err="Post https://hooks.slack.com/...: context deadline exceeded"
```

**원인:** EKS Pods에서 외부 인터넷 접근 불가

**해결:**
```bash
# 1. NAT Gateway 확인
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=vpc-0b89143b4397e00e6"

# 2. Private Subnet Route Table 확인
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-0b89143b4397e00e6"

# 0.0.0.0/0 → NAT Gateway로 라우팅되어야 함

# 3. Alertmanager Pod에서 외부 접속 테스트
kubectl exec -n monitoring -it deployment/alertmanager -- \
  wget -O- https://hooks.slack.com/
```

### 문제 7: 특정 Pod 리소스 부족으로 재시작

**증상:**
```bash
kubectl get pods -n monitoring
# NAME              READY   STATUS      RESTARTS   AGE
# prometheus-xxxx   0/1     OOMKilled   3          15m
```

**해결:**
```bash
# 1. Pod 리소스 사용량 확인
kubectl top pod -n monitoring

# 2. Deployment의 리소스 제한 증가
kubectl edit deployment prometheus -n monitoring

# resources 섹션 수정:
# limits:
#   memory: "2Gi"  # 1Gi → 2Gi로 증가
#   cpu: "2000m"   # 1000m → 2000m로 증가

# 3. 변경 적용 확인
kubectl rollout status deployment/prometheus -n monitoring
```

### 문제 8: NodePort 범위 오류

**증상:**
```bash
kubectl apply -f k8s/monitoring-stack/prometheus.yaml
# Error: spec.ports[0].nodePort: Invalid value: 39090: provided port is not in the valid range. The range of valid ports is 30000-32767
```

**원인:** Kubernetes NodePort는 30000-32767 범위만 허용

**해결:**
```bash
# prometheus.yaml, alertmanager.yaml, grafana.yaml의 nodePort 수정
# Prometheus: 39090 → 30090
# Alertmanager: 39093 → 30093
# Grafana: 33000 → 30030
```

### 문제 9: StorageClass gp3 없음

**증상:**
```bash
kubectl get pvc -n monitoring
# NAME                         STATUS    VOLUME   CAPACITY
# flash-tickets-prometheus     Pending
# flash-tickets-grafana        Pending
# flash-tickets-alertmanager   Pending

kubectl describe pvc flash-tickets-prometheus -n monitoring
# Events:
#   Warning  ProvisioningFailed  ... storageclass.storage.k8s.io "gp3" not found
```

**원인:** EKS 클러스터에 gp3 StorageClass가 없음 (gp2만 존재)

**해결:**
```bash
# 1. 사용 가능한 StorageClass 확인
kubectl get storageclass

# 2. storage.yaml에서 gp3 → gp2로 변경
# storageClassName: gp3 → storageClassName: gp2

# 3. 기존 PVC 삭제 후 재생성
kubectl delete pvc -n monitoring flash-tickets-prometheus flash-tickets-grafana flash-tickets-alertmanager
kubectl apply -f k8s/monitoring-stack/storage.yaml
```

### 문제 10: EBS CSI Driver 없음 (가장 중요!)

**증상:**
```bash
kubectl get pods -n monitoring
# NAME                            READY   STATUS    RESTARTS   AGE
# prometheus-xxxx                 0/1     Pending   0          5m
# alertmanager-xxxx               0/1     Pending   0          5m
# grafana-xxxx                    0/1     Pending   0          5m

kubectl describe pod prometheus-xxxx -n monitoring
# Events:
#   Warning  FailedScheduling  ... 0/2 nodes are available: pod has unbound immediate PersistentVolumeClaims

kubectl describe pvc flash-tickets-prometheus -n monitoring
# Events:
#   Normal  ExternalProvisioning  ... Waiting for a volume to be created either by the external provisioner 'ebs.csi.aws.com'
```

**원인:** EBS CSI Driver addon이 설치되지 않음

**해결 (3단계):**

**Step 1: OIDC Provider 확인**
```bash
# EKS 클러스터의 OIDC Issuer 확인
aws eks describe-cluster --name flash-tickets-eks --query 'cluster.identity.oidc.issuer' --output text

# IAM OIDC Provider 등록 확인
aws iam list-open-id-connect-providers
```

**Step 2: IAM ServiceAccount 생성**
```bash
# eksctl로 EBS CSI Driver용 IAM Role 생성
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster flash-tickets-eks \
  --role-name AmazonEKS_EBS_CSI_DriverRole_FlashTickets \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve \
  --override-existing-serviceaccounts
```

**Step 3: EBS CSI Driver Addon 설치**
```bash
# IAM Role ARN 확인
aws iam get-role --role-name AmazonEKS_EBS_CSI_DriverRole_FlashTickets --query 'Role.Arn' --output text

# Addon 설치 (IAM Role 포함)
aws eks create-addon \
  --cluster-name flash-tickets-eks \
  --addon-name aws-ebs-csi-driver \
  --service-account-role-arn arn:aws:iam::339712948064:role/AmazonEKS_EBS_CSI_DriverRole_FlashTickets

# Addon 상태 확인
aws eks describe-addon --cluster-name flash-tickets-eks --addon-name aws-ebs-csi-driver --query 'addon.status' --output text
# 출력: ACTIVE (완료)

# EBS CSI Controller Pod 확인
kubectl get pods -n kube-system -l app=ebs-csi-controller
# NAME                                  READY   STATUS    RESTARTS   AGE
# ebs-csi-controller-xxxx               6/6     Running   0          2m
# ebs-csi-controller-xxxx               6/6     Running   0          2m
```

**검증:**
```bash
# PVC가 자동으로 Bound 상태가 되는지 확인
kubectl get pvc -n monitoring
# NAME                         STATUS   VOLUME                                     CAPACITY
# flash-tickets-prometheus     Bound    pvc-xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx      10Gi
# flash-tickets-grafana        Bound    pvc-yyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy      5Gi
# flash-tickets-alertmanager   Bound    pvc-zzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz      2Gi
```

### 문제 11: API 서버 준비 안됨 - 알람 음소거 설정

**증상:**
```
Prometheus Targets → flash-tickets-metrics: DOWN
APIServiceDown 알람이 계속 Slack으로 전송됨
```

**원인:** API 서버가 아직 준비되지 않았거나, Readiness Probe 실패로 Service Endpoint에 등록되지 않음

**해결 (임시 - 알람 음소거):**

개발팀이 API 서버 문제를 해결할 때까지 알람을 음소거하려면:

**Step 1: Prometheus 환경 라벨 변경**
```bash
# prometheus-config.yaml 수정
kubectl edit configmap prometheus-config -n monitoring

# 수정 내용:
# external_labels:
#   env: prod  →  env: test
```

**Step 2: Prometheus 재시작**
```bash
# ConfigMap 적용
kubectl apply -f k8s/monitoring-stack/prometheus-config.yaml

# 기존 Pod 삭제 (리소스 부족시)
kubectl get pods -n monitoring | grep prometheus
kubectl delete pod -n monitoring prometheus-<old-hash>-xxxx

# Prometheus 재시작
kubectl rollout restart deployment/prometheus -n monitoring
```

**검증:**
```bash
# Alertmanager에서 확인
# env: test인 알람은 'null' receiver로 라우팅됨 (알람 무시)
```

**복원 (API 서비스 정상화 후):**
```bash
# prometheus-config.yaml에서 env: test → env: prod로 변경
kubectl apply -f k8s/monitoring-stack/prometheus-config.yaml
kubectl rollout restart deployment/prometheus -n monitoring
```

---

### 문제 12: /live 엔드포인트 JSON 응답 형식 오류

**증상:**
```
Prometheus Targets:
- flash-api-health: DOWN
- flash-gateway-health: DOWN

Error: expected a valid start token, got "{" ("INVALID") while parsing: "{"
```

**원인:** `/live` 엔드포인트가 JSON 형식으로 응답하고 있으나, Prometheus는 텍스트 형식의 메트릭을 기대함

**현재 응답 (잘못된 형식)**:
```json
{"status": "ok"}
```

**올바른 응답 (Prometheus 형식)**:
```
# HELP up Service is up
# TYPE up gauge
up 1
```

**해결:**
개발팀에서 `/live` 엔드포인트를 Prometheus 형식으로 수정해야 합니다.

**임시 회피책 (선택 사항)**:
헬스체크 알람이 필요 없다면 해당 job을 주석 처리:
```yaml
# prometheus-config.yaml
scrape_configs:
  # - job_name: 'flash-api-health'  # 주석 처리
  #   static_configs:
  #     - targets: ['flash-api.flash-ticket.svc.cluster.local:4000']
  #   metrics_path: '/live'
```

**상태**: ⏳ 개발팀 수정 대기 중

---

### 문제 13: flash-pay 서비스 미배포

**증상:**
```
Prometheus Targets:
- flash-pay-health: DOWN

Error: dial tcp: lookup flash-pay.flash-ticket.svc.cluster.local on 172.20.0.10:53: no such host
```

**원인:** flash-pay 서비스가 아직 클러스터에 배포되지 않음

**해결:**
개발팀에서 flash-pay 서비스를 3100 포트로 배포하면 자동으로 UP 상태가 됩니다.

**상태**: ⏳ 개발팀 배포 예정

---

### 문제 14: Pod CPU/Memory 메트릭 잘못된 수치

**증상:**
```
Grafana 대시보드에서 모든 Pod의 CPU가 5%, Memory가 6.65%로 동일하게 표시
하지만 k9s에서는 CPU/R: 2%/1%/1%/1%, MEM/R: 21%/20%/19%/6%로 다르게 표시
```

**원인:** `pod_cpu_utilization`과 `pod_memory_utilization` 메트릭은 **노드 전체 리소스 대비 비율**을 계산

**잘못된 쿼리:**
```promql
# 노드 전체 대비 비율 (잘못됨)
pod_cpu_utilization
pod_memory_utilization
```

**올바른 쿼리:**
```promql
# Pod Limit 대비 비율 (0-100% 범위)
pod_cpu_utilization_over_pod_limit
pod_memory_utilization_over_pod_limit
```

**왜 Limit 기준이 올바른가?**
- ✅ **0-100% 범위**: 명확한 사용률 (100% = 리소스 제한에 도달)
- ✅ **알림 설정 용이**: 80% 초과 시 경고, 90% 초과 시 긴급
- ✅ **실제 Pod 상태 반영**: CPU Throttling, OOM Kill 위험 사전 감지
- ❌ Request 기준 사용 시: 100% 초과 가능 (Limit까지 사용 가능)
- ❌ 노드 전체 기준 사용 시: 여러 Pod이 동일한 수치로 표시됨

**Pod 리소스 설정 (현재 구성):**
```yaml
resources:
  requests:
    cpu: 100m      # 보장되는 최소 CPU
    memory: 256Mi  # 보장되는 최소 메모리
  limits:
    cpu: 500m      # 최대 CPU (초과 시 Throttling)
    memory: 512Mi  # 최대 메모리 (초과 시 OOM Kill)
```

**Grafana 패널 수정:**
```json
{
  "datasource": "CloudWatch",
  "dimensions": {
    "ClusterName": ["flash-tickets-eks"],
    "Namespace": ["flash-ticket"]
  },
  "metricName": "pod_cpu_utilization_over_pod_limit",
  "namespace": "ContainerInsights",
  "period": "60",
  "statistic": "Average"
}
```

**참고: 노드 메트릭은 다름**
노드는 Limit 개념이 없으므로 **전체 물리 리소스 대비**가 올바른 접근:
```promql
# 노드는 이것이 맞음 (EC2 인스턴스의 전체 CPU/Memory)
node_cpu_utilization
node_memory_utilization
```

---
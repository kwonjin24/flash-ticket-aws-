# Flash Tickets - Kubernetes 배포 가이드

현재 Flash Tickets 애플리케이션을 Kubernetes에서 실행하기 위한 매니페스트와 배포 스크립트입니다.

## 📁 디렉토리 구조

```
k8s/
├── configmaps/          # 환경변수 설정
│   └── app-config.yaml
├── secrets/             # 민감정보 (JWT Secret 등)
│   └── app-secrets.yaml
├── deployments/         # 애플리케이션 배포 정의
│   ├── api-server.yaml
│   └── pay-service.yaml
├── services/            # 네트워크 서비스
│   └── api-server-service.yaml
├── hpa/                 # Auto Scaling 정의
│   ├── api-server-hpa.yaml
│   └── pay-service-hpa.yaml
├── infrastructure/      # 인프라 (Redis, RabbitMQ)
│   ├── redis.yaml
│   └── rabbitmq.yaml
├── deploy.sh           # 배포 스크립트 (Linux/Mac)
├── deploy.ps1          # 배포 스크립트 (Windows)
└── README.md           # 이 파일
```

## 🚀 빠른 시작 (Minikube)

### 1. 사전 준비

```bash
# Minikube가 실행 중인지 확인
minikube status

# 실행 중이 아니면 시작
minikube start --cpus=4 --memory=8192

# Metrics Server 활성화 (HPA에 필요)
minikube addons enable metrics-server
```

### 2. 한 번에 배포

**Windows (PowerShell):**
```powershell
cd c:\Temp\test\flash-ticket-final
.\k8s\deploy.ps1
```

**Linux/Mac:**
```bash
cd /c/Temp/test/flash-ticket-final
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

### 3. 수동 배포 (단계별)

#### Step 1: Docker 이미지 빌드

```bash
# API 서버 이미지
docker build -t flash-tickets-api:latest -f Dockerfile.api .

# Pay 서비스 이미지
docker build -t flash-tickets-pay:latest -f Dockerfile.pay .

# Minikube에 이미지 로드
minikube image load flash-tickets-api:latest
minikube image load flash-tickets-pay:latest
```

#### Step 2: ConfigMap & Secret 적용

```bash
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/
```

#### Step 3: 인프라 배포

```bash
# Redis, RabbitMQ 배포
kubectl apply -f k8s/infrastructure/

# 준비될 때까지 대기
kubectl wait --for=condition=ready pod -l app=redis --timeout=120s
kubectl wait --for=condition=ready pod -l app=rabbitmq --timeout=120s
```

#### Step 4: 애플리케이션 배포

```bash
# API 서버, Pay 서비스 배포
kubectl apply -f k8s/deployments/

# 준비될 때까지 대기
kubectl wait --for=condition=available deployment/api-server --timeout=180s
kubectl wait --for=condition=available deployment/pay-service --timeout=180s
```

#### Step 5: Service 생성

```bash
kubectl apply -f k8s/services/
```

#### Step 6: HPA (Auto Scaling) 적용

```bash
kubectl apply -f k8s/hpa/
```

## 📊 상태 확인

### Pod 상태 확인
```bash
kubectl get pods
kubectl get pods -w  # 실시간 모니터링
```

### Deployment 상태
```bash
kubectl get deployments
```

### Service 확인
```bash
kubectl get services
```

### HPA 상태 (Auto Scaling)
```bash
kubectl get hpa
kubectl describe hpa api-server-hpa
```

### 로그 확인
```bash
# API 서버 로그
kubectl logs -f deployment/api-server

# Pay 서비스 로그
kubectl logs -f deployment/pay-service

# 특정 Pod 로그
kubectl logs -f <pod-name>
```

## 🌐 애플리케이션 접속

### Minikube 사용 시

```bash
# API 서버 URL 확인
minikube service api-server --url

# 브라우저로 API 서버 열기
minikube service api-server

# RabbitMQ 관리 UI
minikube service rabbitmq-management
```

### Port Forwarding 사용

```bash
# API 서버
kubectl port-forward service/api-server 4000:4000

# RabbitMQ 관리 UI
kubectl port-forward service/rabbitmq 15672:15672

# Redis
kubectl port-forward service/redis 6379:6379
```

그 후 브라우저에서:
- API: http://localhost:4000
- RabbitMQ: http://localhost:15672 (guest/guest)

## 🔄 Auto Scaling 테스트

### HPA 동작 확인

```bash
# HPA 상태 모니터링
kubectl get hpa -w
```

### 부하 생성 (CPU 사용률 증가)

```bash
# Pod에 접속해서 부하 생성
kubectl run -it --rm load-generator --image=busybox -- /bin/sh

# Pod 내부에서 반복 요청
while true; do wget -q -O- http://api-server:4000/events; done
```

또는 로컬에서:
```bash
# API 서버 URL 가져오기
API_URL=$(minikube service api-server --url)

# 부하 생성 (Linux/Mac)
for i in {1..1000}; do curl -s $API_URL/events > /dev/null & done
```

### 스케일링 확인

```bash
# Pod 수 실시간 확인
watch kubectl get pods

# 또는
kubectl get pods -w
```

**예상 동작:**
1. CPU 사용률이 70%를 넘으면
2. HPA가 Pod 수를 자동으로 증가 (2 → 4 → 6 → ...)
3. 부하가 줄면 다시 축소 (5분 후)

## 📈 모니터링

### Kubernetes 대시보드

```bash
minikube dashboard
```

### 리소스 사용량 확인

```bash
# Pod 리소스 사용량
kubectl top pods

# Node 리소스 사용량
kubectl top nodes
```

## 🛠️ 문제 해결

### Pod가 시작되지 않을 때

```bash
# Pod 상세 정보
kubectl describe pod <pod-name>

# 이벤트 확인
kubectl get events --sort-by=.metadata.creationTimestamp
```

### 이미지를 찾을 수 없을 때

```bash
# Minikube Docker 환경 사용
eval $(minikube docker-env)

# 이미지 다시 빌드
docker build -t flash-tickets-api:latest -f Dockerfile.api .

# 또는 이미지 로드
minikube image load flash-tickets-api:latest
```

### HPA가 동작하지 않을 때

```bash
# Metrics Server 확인
kubectl get deployment metrics-server -n kube-system

# 활성화되지 않았다면
minikube addons enable metrics-server

# 메트릭 확인
kubectl top pods
```

### Service 접속이 안 될 때

```bash
# Service 엔드포인트 확인
kubectl get endpoints

# Port forwarding으로 직접 연결
kubectl port-forward service/api-server 4000:4000
```

## 🗑️ 정리 (Clean Up)

### 전체 삭제

```bash
# 역순으로 삭제
kubectl delete -f k8s/hpa/
kubectl delete -f k8s/services/
kubectl delete -f k8s/deployments/
kubectl delete -f k8s/infrastructure/
kubectl delete -f k8s/configmaps/
kubectl delete -f k8s/secrets/
```

### 한 번에 삭제

```bash
kubectl delete all --all
```

### Minikube 중지/삭제

```bash
# 중지
minikube stop

# 완전 삭제
minikube delete
```

## 📝 설정 변경

### 환경변수 변경

1. `k8s/configmaps/app-config.yaml` 수정
2. 적용:
   ```bash
   kubectl apply -f k8s/configmaps/app-config.yaml
   kubectl rollout restart deployment/api-server
   ```

### Secret 변경

1. `k8s/secrets/app-secrets.yaml` 수정
2. 적용:
   ```bash
   kubectl apply -f k8s/secrets/app-secrets.yaml
   kubectl rollout restart deployment/api-server
   ```

### Replica 수 변경

```bash
# 수동 스케일링
kubectl scale deployment api-server --replicas=5

# 또는 매니페스트 수정 후
kubectl apply -f k8s/deployments/api-server.yaml
```

### HPA 설정 변경

1. `k8s/hpa/api-server-hpa.yaml` 수정
2. 적용:
   ```bash
   kubectl apply -f k8s/hpa/api-server-hpa.yaml
   ```

## 🚀 EKS 배포

Minikube에서 테스트 완료 후 AWS EKS로 배포:

1. EKS 클러스터 생성
2. Docker 이미지를 ECR에 푸시
3. 매니페스트의 이미지 주소를 ECR 주소로 변경
4. `kubectl apply` 명령어는 동일하게 사용

자세한 내용은 `plan.txt`의 Phase 3 참고.

## 📚 참고 자료

- [Kubernetes 공식 문서](https://kubernetes.io/docs/)
- [Minikube 가이드](https://minikube.sigs.k8s.io/docs/)
- [HPA 가이드](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [plan.txt](../plan.txt) - 전체 로드맵

## ❓ 자주 묻는 질문

**Q: Minikube에서 NodePort로 접속이 안 돼요**
```bash
minikube service api-server
# 이 명령어가 자동으로 터널을 만들어줍니다
```

**Q: HPA가 `<unknown>` 상태예요**
```bash
# Metrics Server가 준비될 때까지 1-2분 대기
kubectl get hpa -w
```

**Q: Pod가 CrashLoopBackOff 상태예요**
```bash
# 로그로 원인 확인
kubectl logs <pod-name>
kubectl describe pod <pod-name>
```

**Q: Docker 이미지가 너무 커요**
```bash
# 멀티 스테이지 빌드 사용 (이미 적용됨)
# .dockerignore 파일 확인
```

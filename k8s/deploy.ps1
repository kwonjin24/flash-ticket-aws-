# Flash Tickets - Kubernetes Deployment Script (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Flash Tickets K8s Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. Docker 이미지 빌드
Write-Host ""
Write-Host "[1/7] Building Docker images..." -ForegroundColor Yellow
Write-Host "Building API server..."
docker build -t flash-tickets-api:latest -f Dockerfile.api .

Write-Host "Building Pay service..."
docker build -t flash-tickets-pay:latest -f Dockerfile.pay .

# 2. Minikube에 이미지 로드 (로컬 개발용)
if (Get-Command minikube -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "[2/7] Loading images to Minikube..." -ForegroundColor Yellow
    minikube image load flash-tickets-api:latest
    minikube image load flash-tickets-pay:latest
} else {
    Write-Host ""
    Write-Host "[2/7] Skipping Minikube image load (Minikube not found)" -ForegroundColor Gray
}

# 3. ConfigMap & Secret 적용
Write-Host ""
Write-Host "[3/7] Applying ConfigMaps and Secrets..." -ForegroundColor Yellow
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/

# 4. 인프라 배포 (Redis, RabbitMQ)
Write-Host ""
Write-Host "[4/7] Deploying infrastructure..." -ForegroundColor Yellow
kubectl apply -f k8s/infrastructure/

Write-Host "Waiting for infrastructure to be ready..."
kubectl wait --for=condition=ready pod -l app=redis --timeout=120s
kubectl wait --for=condition=ready pod -l app=rabbitmq --timeout=120s

# 5. 애플리케이션 배포
Write-Host ""
Write-Host "[5/7] Deploying applications..." -ForegroundColor Yellow
kubectl apply -f k8s/deployments/

Write-Host "Waiting for deployments to be ready..."
kubectl wait --for=condition=available deployment/api-server --timeout=180s
kubectl wait --for=condition=available deployment/pay-service --timeout=180s

# 6. Service 생성
Write-Host ""
Write-Host "[6/7] Creating services..." -ForegroundColor Yellow
kubectl apply -f k8s/services/

# 7. HPA 적용
Write-Host ""
Write-Host "[7/7] Applying Horizontal Pod Autoscalers..." -ForegroundColor Yellow
kubectl apply -f k8s/hpa/

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Current status:" -ForegroundColor Cyan
kubectl get pods
Write-Host ""
kubectl get services
Write-Host ""
kubectl get hpa

Write-Host ""
Write-Host "Access the application:" -ForegroundColor Cyan
if (Get-Command minikube -ErrorAction SilentlyContinue) {
    $API_URL = minikube service api-server --url
    $RABBITMQ_URL = minikube service rabbitmq-management --url
    Write-Host "API Server: $API_URL" -ForegroundColor Green
    Write-Host "RabbitMQ Management: $RABBITMQ_URL" -ForegroundColor Green
    Write-Host ""
    Write-Host "Or run: minikube service api-server" -ForegroundColor Gray
} else {
    Write-Host "API Server: kubectl port-forward service/api-server 4000:4000" -ForegroundColor Green
    Write-Host "RabbitMQ Management: kubectl port-forward service/rabbitmq 15672:15672" -ForegroundColor Green
}

Write-Host ""
Write-Host "Monitor with:" -ForegroundColor Cyan
Write-Host "  kubectl get pods -w"
Write-Host "  kubectl logs -f deployment/api-server"
Write-Host "  minikube dashboard"

#!/bin/bash
# Flash Tickets - Kubernetes Deployment Script

set -e

echo "================================"
echo "Flash Tickets K8s Deployment"
echo "================================"

# 1. Docker 이미지 빌드
echo ""
echo "[1/7] Building Docker images..."
echo "Building API server..."
docker build -t flash-tickets-api:latest -f Dockerfile.api .

echo "Building Pay service..."
docker build -t flash-tickets-pay:latest -f Dockerfile.pay .

# 2. Minikube에 이미지 로드 (로컬 개발용)
if command -v minikube &> /dev/null; then
  echo ""
  echo "[2/7] Loading images to Minikube..."
  minikube image load flash-tickets-api:latest
  minikube image load flash-tickets-pay:latest
else
  echo ""
  echo "[2/7] Skipping Minikube image load (Minikube not found)"
fi

# 3. ConfigMap & Secret 적용
echo ""
echo "[3/7] Applying ConfigMaps and Secrets..."
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/

# 4. 인프라 배포 (Redis, RabbitMQ)
echo ""
echo "[4/7] Deploying infrastructure..."
kubectl apply -f k8s/infrastructure/

echo "Waiting for infrastructure to be ready..."
kubectl wait --for=condition=ready pod -l app=redis --timeout=120s
kubectl wait --for=condition=ready pod -l app=rabbitmq --timeout=120s

# 5. 애플리케이션 배포
echo ""
echo "[5/7] Deploying applications..."
kubectl apply -f k8s/deployments/

echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available deployment/api-server --timeout=180s
kubectl wait --for=condition=available deployment/pay-service --timeout=180s

# 6. Service 생성
echo ""
echo "[6/7] Creating services..."
kubectl apply -f k8s/services/

# 7. HPA 적용
echo ""
echo "[7/7] Applying Horizontal Pod Autoscalers..."
kubectl apply -f k8s/hpa/

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
echo ""
echo "Current status:"
kubectl get pods
echo ""
kubectl get services
echo ""
kubectl get hpa

echo ""
echo "Access the application:"
if command -v minikube &> /dev/null; then
  API_URL=$(minikube service api-server --url)
  RABBITMQ_URL=$(minikube service rabbitmq-management --url)
  echo "API Server: $API_URL"
  echo "RabbitMQ Management: $RABBITMQ_URL"
  echo ""
  echo "Or run: minikube service api-server"
else
  echo "API Server: kubectl port-forward service/api-server 4000:4000"
  echo "RabbitMQ Management: kubectl port-forward service/rabbitmq 15672:15672"
fi

echo ""
echo "Monitor with:"
echo "  kubectl get pods -w"
echo "  kubectl logs -f deployment/api-server"
echo "  minikube dashboard"

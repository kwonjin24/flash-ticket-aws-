# 03. Deployment / Service 작성

## 3-1. API Deployment & Service
- 이미지: `flash-tickets-api:amd64` (필요 시 리전/계정 경로 포함)
- 네임스페이스: `flash-tickets`
- Secret / ConfigMap: `api-secret`, `api-config`
- 예시 파일: `deployments/api-deployment.yaml`
- 적용: `kubectl apply -f deployments/api-deployment.yaml`

## 3-2. Gateway Deployment & Service
- 이미지: `flash-tickets-gateway:amd64`
- Secret / ConfigMap: `gateway-secret`, `gateway-config`
- 예시 파일: `deployments/gateway-deployment.yaml`

## 3-3. Web Deployment & Service
- 이미지: `flash-tickets-web:amd64`
- ConfigMap: `web-config`
- Web pod는 `API_BASE_URL`, `GATEWAY_BASE_URL` 등의 환경변수를 ConfigMap으로 주입
- 예시 파일: `deployments/web-deployment.yaml`

## 3-4. Pay Deployment (선택)
- Pay 워커를 Kubernetes에서 돌릴 경우 `flash-tickets-pay:amd64` 이미지 사용
- ConfigMap: `pay-config`
- 예시 파일: `deployments/pay-deployment.yaml`

## 3-5. 이미지 업데이트 후 재배포
- 새 태그를 ECR에 푸시한 뒤, 해당 Deployment에서 이미지를 교체합니다.
  ```bash
  kubectl set image deployment/flash-gateway \
    gateway=339712948064.dkr.ecr.ap-northeast-2.amazonaws.com/flash-tickets/gateway:<NEW_TAG> \
    -n flash-tickets
  ```
- 롤링 업데이트 진행 상황 확인:
  ```bash
  kubectl rollout status deployment/flash-gateway -n flash-tickets
  kubectl get pods -n flash-tickets
  ```
- 문제가 있으면 롤백:
  ```bash
  kubectl rollout undo deployment/flash-gateway -n flash-tickets
  ```
- 다른 서비스(API, Web 등)도 동일한 방식으로 이미지를 교체할 수 있습니다.

> 각 매니페스트에는 `imagePullSecrets`, `resources`, `liveness/readinessProbe` 등을 필요한 수준으로 설정하세요. 작성 후 `kubectl apply -f deployments/ -n flash-tickets`로 배포합니다. 이후 `kubectl get pods -n flash-tickets`로 상태를 확인합니다.

# Flash Tickets GitOps Repository

ArgoCD를 사용한 Kubernetes 배포 매니페스트

## 디렉토리 구조

```
gitops/
├── apps/                          # 애플리케이션 매니페스트
│   ├── api/
│   │   └── base/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       └── kustomization.yaml
│   ├── gateway/
│   │   └── base/
│   └── pay/
│       └── base/
├── infrastructure/                # 공통 인프라
│   ├── namespace/
│   │   ├── namespace.yaml
│   │   └── kustomization.yaml
│   └── ingress/
│       ├── ingress.yaml
│       └── kustomization.yaml
└── argocd-apps/                   # ArgoCD Application 정의
    ├── app-of-apps.yaml           # Root Application
    ├── api-app.yaml
    ├── gateway-app.yaml
    └── pay-app.yaml
```

## 배포 서비스

- **API**: NestJS 백엔드 서비스 (포트 4000)
- **Gateway**: WebSocket Gateway (포트 3000)
- **Pay**: 결제 Worker (포트 3100)

## 이미지 자동 업데이트

GitHub Actions가 새로운 이미지를 빌드하면 자동으로:
1. ECR에 이미지 푸시 (태그: git-sha)
2. `kustomization.yaml`의 `newTag` 업데이트
3. Git commit & push
4. ArgoCD가 변경 감지하여 자동 배포

## 사용 방법

### Kustomize로 매니페스트 확인

```bash
# API 매니페스트 미리보기
kubectl kustomize gitops/apps/api/base

# 전체 리소스 확인
kubectl kustomize gitops/apps/*/base
```

### 수동 배포 (ArgoCD 없이)

```bash
# 네임스페이스 생성
kubectl apply -k gitops/infrastructure/namespace

# 서비스 배포
kubectl apply -k gitops/apps/api/base
kubectl apply -k gitops/apps/gateway/base
kubectl apply -k gitops/apps/pay/base

# Ingress 배포
kubectl apply -k gitops/infrastructure/ingress
```

### ArgoCD 배포

```bash
# App-of-Apps 배포 (권장)
kubectl apply -f gitops/argocd-apps/app-of-apps.yaml

# 개별 배포
kubectl apply -f gitops/argocd-apps/api-app.yaml
kubectl apply -f gitops/argocd-apps/gateway-app.yaml
kubectl apply -f gitops/argocd-apps/pay-app.yaml
```

## 이미지 태그 변경

```bash
# 수동으로 이미지 태그 변경
cd gitops/apps/api/base
kustomize edit set image 339712948064.dkr.ecr.ap-northeast-2.amazonaws.com/flash-tickets/api=339712948064.dkr.ecr.ap-northeast-2.amazonaws.com/flash-tickets/api:new-tag
git add kustomization.yaml
git commit -m "chore: update api image to new-tag"
git push
```

## 주의사항

- **Secret**: 이 저장소에는 Secret이 없습니다. 별도로 `kubectl apply`로 수동 배포하세요.
  ```bash
  kubectl apply -f eks/configs/api-secret.yaml
  kubectl apply -f eks/configs/gateway-secret.yaml
  kubectl apply -f eks/configs/pay-secret.yaml
  ```

- **ConfigMap**: Config도 별도 관리됩니다.
  ```bash
  kubectl apply -f eks/configs/api-config.yaml
  kubectl apply -f eks/configs/gateway-config.yaml
  kubectl apply -f eks/configs/pay-config.yaml
  ```

## 트러블슈팅

### ArgoCD Sync 실패
```bash
kubectl describe application flash-tickets-api -n argocd
kubectl logs -n argocd deployment/argocd-application-controller
```

### Pod 상태 확인
```bash
kubectl get pods -n flash-ticket
kubectl describe pod <pod-name> -n flash-ticket
kubectl logs <pod-name> -n flash-ticket
```

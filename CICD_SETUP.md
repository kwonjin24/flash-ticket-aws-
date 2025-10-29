# CI/CD 파이프라인 설정 가이드

## 📋 개요

Git Push → Docker 빌드 → ECR 푸시 → ArgoCD 자동 배포

**대상 서비스**: API, Gateway, Pay (총 3개)

---

## 🚀 1단계: ArgoCD 설치

### 1.1 ArgoCD 설치

```bash
# ArgoCD 네임스페이스 생성
kubectl create namespace argocd

# ArgoCD 설치
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 설치 확인
kubectl get pods -n argocd
```

### 1.2 ArgoCD CLI 설치 (선택사항)

```bash
# macOS
brew install argocd

# Linux
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64
```

### 1.3 ArgoCD 접속

**옵션 A: Port Forward (간단, 개발용)**
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
브라우저에서 `https://localhost:8080` 접속

**옵션 B: LoadBalancer (운영용)**
```bash
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'
kubectl get svc argocd-server -n argocd
```

### 1.4 초기 비밀번호 확인

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

- **사용자명**: `admin`
- **비밀번호**: 위 명령어 결과

### 1.5 비밀번호 변경 (권장)

```bash
argocd login localhost:8080
argocd account update-password
```

---

## 🔐 2단계: AWS IAM 설정

### 2.1 GitHub Actions용 OIDC Provider 생성

AWS Console → IAM → Identity Providers → Add Provider

- **Provider Type**: OpenID Connect
- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`

### 2.2 IAM Role 생성

**Trust Policy** (`github-actions-trust-policy.json`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::339712948064:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:CloudDx/flash-tickets:*"
        }
      }
    }
  ]
}
```

**CLI로 Role 생성**:
```bash
# Role 생성
aws iam create-role \
  --role-name GitHubActionsECRRole \
  --assume-role-policy-document file://github-actions-trust-policy.json

# ECR 권한 부여
aws iam attach-role-policy \
  --role-name GitHubActionsECRRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

# Role ARN 확인 (GitHub Secrets에 필요)
aws iam get-role --role-name GitHubActionsECRRole --query 'Role.Arn' --output text
```

---

## 🔑 3단계: GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret

### 필수 Secret

| Secret 이름 | 값 | 설명 |
|-------------|-----|------|
| `AWS_ROLE_ARN` | `arn:aws:iam::339712948064:role/GitHubActionsECRRole` | IAM Role ARN |

**설정 방법**:
1. GitHub 저장소 페이지 접속
2. Settings → Secrets and variables → Actions
3. "New repository secret" 클릭
4. Name: `AWS_ROLE_ARN`
5. Secret: 위에서 확인한 Role ARN 입력

---

## 📦 4단계: ECR Repository 확인

```bash
# 필요한 ECR 저장소 확인
aws ecr describe-repositories --region ap-northeast-2 | grep flash-tickets

# 없으면 생성
aws ecr create-repository --repository-name flash-tickets/api --region ap-northeast-2
aws ecr create-repository --repository-name flash-tickets/gateway --region ap-northeast-2
aws ecr create-repository --repository-name flash-tickets/pay --region ap-northeast-2
```

---

## 🎯 5단계: ArgoCD Application 배포

### 5.1 App-of-Apps 배포 (모든 서비스 한번에)

```bash
kubectl apply -f gitops/argocd-apps/app-of-apps.yaml
```

### 5.2 개별 배포 (선택사항)

```bash
kubectl apply -f gitops/argocd-apps/api-app.yaml
kubectl apply -f gitops/argocd-apps/gateway-app.yaml
kubectl apply -f gitops/argocd-apps/pay-app.yaml
```

### 5.3 ArgoCD UI에서 확인

`https://localhost:8080` 접속 후:
- Applications 탭에서 `flash-tickets`, `flash-tickets-api`, `flash-tickets-gateway`, `flash-tickets-pay` 확인
- 각 앱을 클릭하여 배포 상태 확인

---

## ✅ 6단계: 전체 파이프라인 테스트

### 6.1 코드 변경 및 Push

```bash
# API 코드 수정 (예시)
echo "// Test change" >> api/src/main.ts

# Git commit & push
git add .
git commit -m "test: trigger CI/CD pipeline"
git push origin main
```

### 6.2 GitHub Actions 확인

1. GitHub 저장소 → Actions 탭
2. "CI/CD Pipeline" 워크플로우 실행 확인
3. 변경된 서비스만 빌드되는지 확인

### 6.3 ECR 이미지 확인

```bash
aws ecr list-images --repository-name flash-tickets/api --region ap-northeast-2
```

### 6.4 ArgoCD 자동 배포 확인

```bash
# ArgoCD에서 자동 sync 확인
kubectl get applications -n argocd

# Pod 재시작 확인
kubectl get pods -n flash-ticket -w
```

---

## 🔄 동작 흐름

```
1. 개발자가 코드 변경 후 main 브랜치에 push
   ↓
2. GitHub Actions 트리거
   - 변경된 서비스 감지 (api/gateway/pay)
   - Docker 이미지 빌드 (멀티 스테이지)
   - ECR에 이미지 푸시 (태그: git-sha, latest)
   ↓
3. Kustomize 이미지 태그 업데이트
   - gitops/apps/[service]/base/kustomization.yaml 수정
   - Git commit & push (github-actions bot)
   ↓
4. ArgoCD 변경 감지 (폴링 3분 간격 또는 webhook)
   - 새로운 매니페스트 적용
   - Kubernetes Deployment 업데이트
   ↓
5. Kubernetes Rolling Update
   - 새 Pod 생성
   - Readiness Probe 대기
   - 구 Pod 종료
   ↓
6. 배포 완료 ✅
```

---

## 🛠️ 트러블슈팅

### 문제 1: GitHub Actions 빌드 실패

**증상**: `Error: Failed to build Docker image`

**해결**:
```bash
# 로컬에서 빌드 테스트
docker buildx build --platform linux/amd64 -f Dockerfile.api -t test:latest .
```

### 문제 2: ECR 푸시 권한 오류

**증상**: `denied: User is not authorized to perform ecr:*`

**해결**:
```bash
# IAM Role 권한 확인
aws iam list-attached-role-policies --role-name GitHubActionsECRRole

# 권한 추가
aws iam attach-role-policy \
  --role-name GitHubActionsECRRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
```

### 문제 3: ArgoCD 자동 sync 안됨

**증상**: 이미지 태그 변경됐는데 배포 안됨

**해결**:
```bash
# 수동 sync
kubectl patch application flash-tickets-api -n argocd --type merge -p '{"operation":{"initiatedBy":{"username":"admin"},"sync":{"revision":"HEAD"}}}'

# 또는 ArgoCD CLI
argocd app sync flash-tickets-api
```

### 문제 4: Pod ImagePullBackOff

**증상**: `Failed to pull image: 403 Forbidden`

**해결**:
```bash
# EKS Node IAM Role에 ECR 권한 확인
aws iam list-attached-role-policies --role-name eksctl-flash-tickets-nodegroup-NodeInstanceRole

# 권한 추가
aws iam attach-role-policy \
  --role-name eksctl-flash-tickets-nodegroup-NodeInstanceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```

---

## 📊 모니터링

### ArgoCD Health 확인

```bash
# 전체 앱 상태
kubectl get applications -n argocd

# 특정 앱 상세
kubectl describe application flash-tickets-api -n argocd
```

### 배포 히스토리

```bash
# ArgoCD UI 또는
argocd app history flash-tickets-api
```

### 롤백

```bash
# 이전 버전으로 롤백
argocd app rollback flash-tickets-api <REVISION_NUMBER>

# 또는 Kubernetes 직접
kubectl rollout undo deployment/flash-api -n flash-ticket
```

---

## 🎉 완료!

이제 코드 변경 시 자동으로 빌드 → ECR → EKS 배포가 진행됩니다.

**다음 단계 (선택사항)**:
- [ ] Slack/Discord 배포 알림 설정
- [ ] Prometheus/Grafana 메트릭 모니터링
- [ ] 프로덕션 환경 분리 (staging/prod)
- [ ] Sealed Secrets로 보안 강화

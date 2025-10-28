# 01. 준비 사항 확인

## 1-1. 클러스터 연결 확인
```bash
kubectl get nodes
```
- 노드 목록이 출력되면 정상 연결.
- 오류 발생 시 `aws eks update-kubeconfig` 등으로 kubeconfig 재구성 필요.

## 1-2. ECR 로그인 확인
```bash
aws ecr get-login-password --region <AWS_REGION> \
  | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com
```
- `Login Succeeded` 메시지 확인.

## 1-3. Ingress/ALB 등 인프라 확인
- ALB Ingress Controller 등을 사용한다면, 관련 파드가 정상인지 확인합니다.
```bash
kubectl get pods -n kube-system | grep ingress
```

> 위 확인이 모두 완료되면 다음 단계로 이동합니다.

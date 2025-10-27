# EKS 배포 작업 플랜

## 1. 준비 사항 확인
- EKS 클러스터 및 `kubectl` 연결 상태 확인 (`kubectl get nodes`).
- AWS CLI/ECR 인증 확인 (`aws ecr get-login-password` 등).
- 필수 인프라(DNS, ALB/Ingress Controller 등) 준비 여부 확인.

## 2. 네임스페이스 및 공통 리소스 설정
- 배포용 네임스페이스 생성: `kubectl create namespace flash-tickets` (필요 시).
- 공통 `ConfigMap` / `Secret` 정의:
  - 각 서비스에 필요한 환경변수(API DB 접속, JWT 시크릿 등)를 `Secret` 또는 `ConfigMap`으로 분리 관리.
  - `kubectl apply -f`로 적용.

## 3. 외부 의존 서비스 연결
- RDS(PostgreSQL), ElastiCache(Redis), RabbitMQ(수행 중인 경우) 등 외부 엔드포인트 확인.
- 보안 그룹/네트워크 정책 확인.
- 필요한 경우 Kubernetes `Secret`에 연결 정보 저장.

## 4. 컨테이너 이미지 준비
- ECR에 등록된 이미지 사용: `flash-tickets-api:amd64`, `flash-tickets-gateway:amd64`, `flash-tickets-web:amd64`.
- 최신 태그 확인 후 배포 매니페스트에 반영.

## 5. Kubernetes 매니페스트 작성
- 서비스별 `Deployment`, `Service` 매니페스트 작성.
  - `deployment/api-deployment.yaml`
  - `deployment/gateway-deployment.yaml`
  - `deployment/web-deployment.yaml`
- 환경변수는 `envFrom`(ConfigMap/Secret) 또는 `env`로 주입.
- 필요 시 `HorizontalPodAutoscaler`, `Ingress` 등 추가.

## 6. 배포 시나리오
1. ConfigMap/Secret 적용: `kubectl apply -f configs/`
2. 서비스별 Deployment/Service 적용: `kubectl apply -f deployments/`
3. Ingress(또는 ALB) 설정: `kubectl apply -f ingress/`
4. 배포 상태 확인: `kubectl get pods -n flash-tickets`, `kubectl describe pod ...`

## 7. 검증 체크리스트
- Pod 상태 및 레디니스 확인 (Ready 1/1).
- Service/Ingress 통해 외부에서 웹 접근 확인.
- Gateway API/WebSocket 요청 정상 여부.
- API 요청 및 DB 연결 검증.
- Pay 워커가 RabbitMQ에 연결되는지 확인.

## 8. 모니터링 & 롤백
- CloudWatch/Prometheus 등 관측 설정 확인.
- 장애 시 롤백 전략(이전 이미지 태그 또는 `kubectl rollout undo`) 마련.

> 배포 시 `kubectl diff` 또는 간이 테스트 환경(예: staging 네임스페이스)을 활용해 검증 후 운영에 반영하세요.

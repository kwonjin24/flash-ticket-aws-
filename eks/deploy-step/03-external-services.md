# 03. 외부 의존 서비스 확인

## 3-1. PostgreSQL (RDS 등)
- 연결 엔드포인트, 포트, 인증 정보를 확인합니다.
- EKS에서 접근 가능하도록 보안 그룹/네트워크 설정을 검토합니다.
- 필요한 자격증명은 Kubernetes `Secret`으로 관리하세요.

## 3-2. Redis (ElastiCache 등)
- Gateway 및 API/모니터링에서 사용할 Redis 엔드포인트 확인.
- 인증이 필요한 경우 비밀번호를 Secret에 저장.

## 3-3. RabbitMQ
- Pay 워커 및 API가 사용할 RabbitMQ URL/자격증명 확인.
- (Managed 서비스 사용 시) 외부 트래픽 허용 설정을 검토.

## 3-4. 기타 외부 시스템
- ALB/Ingress, S3, CloudWatch 등 외부 연동이 있다면 필요한 설정을 준비합니다.

> 외부 의존 리소스에 맞는 ConfigMap/Secret을 작성한 뒤, 다음 단계(Deployment/Service 작성)로 진행합니다.

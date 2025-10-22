# Flash Tickets 개발 서버 배포 가이드

이 문서는 EC2 한 대에서 Flash Tickets 서비스의 개발 환경을 컨테이너로 실행하는 시나리오를 정리합니다. 프런트엔드는 별도로 빌드된 정적 파일을 사용하며, API 서버와 의존성은 모두 Docker 컨테이너로 구성됩니다.

## 1. 사전 준비

- Ubuntu 22.04 이상의 EC2 인스턴스 (t3.medium 권장)
- Docker Engine 설치
- 도메인(Route53)과 HTTPS 인증서(ACM)는 별도 구성
- 리포지토리를 `/opt/flash-tickets` 등에 클론

### 1.1 Docker 설치 (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

> `newgrp docker` 명령을 실행하면 현재 세션에서 sudo 없이 docker 명령을 사용할 수 있습니다.

### 1.2 디렉터리 구조 준비

컨테이너별 데이터/로그를 `/data/docker` 아래에 저장합니다.

```bash
sudo mkdir -p /data/docker/{redis,rabbitmq,api,pay,nginx}/data
sudo mkdir -p /data/docker/nginx/html
sudo chown -R $USER:$USER /data/docker
```

### 1.3 FTP로 전달된 패키지 배포 절차

로컬 또는 CI에서 생성한 아카이브 (`output/flash-tickets-dev-images.tar.gz`, `output/web-dist.tar.gz`)를 FTP로 업로드 받은 경우 다음 순서를 따르면 됩니다.

```bash
# 1) 아카이브 준비 & 압축 해제
mkdir -p /data/docker/deploy
cd /data/docker/deploy

# 파일 무결성 확인 (선택사항)
file /data/docker/deploy/flash-tickets-dev-images.tar.gz
ls -lh /data/docker/deploy/flash-tickets-dev-images.tar.gz

# flash-tickets-dev-images.tar.gz를 gunzip으로 압축 해제
# FTP 전송 시 바이너리 모드를 사용했는지 확인 필요
gunzip -c /data/docker/deploy/flash-tickets-dev-images.tar.gz > /data/docker/deploy/flash-tickets-dev-images.tar

# 압축 해제된 파일 확인
file /data/docker/deploy/flash-tickets-dev-images.tar

mkdir -p /data/docker/deploy/web-dist && tar -xzf /data/docker/deploy/web-dist.tar.gz -C /data/docker/deploy/web-dist

# 2) Docker 이미지 로드
# gunzip으로 압축 해제한 tar 파일을 직접 로드
docker load -i /data/docker/deploy/flash-tickets-dev-images.tar

# 3) 프런트 정적 파일 배치
rm -rf /data/docker/nginx/html/*
cp -r /data/docker/deploy/web-dist/dist/* /data/docker/nginx/html/

# 4) 네트워크 및 컨테이너 재기동
docker network create backend || true

source /data/docker/.env.dev

docker rm -f flash-tickets-nginx flash-tickets-api flash-tickets-pay flash-tickets-rabbitmq flash-tickets-redis 2>/dev/null || true

docker run -d --name flash-tickets-redis \
  --network backend \
  -p 6379:6379 \
  -v /data/docker/redis/data:/data \
  redis:7-alpine \
  redis-server --save 60 1 --loglevel warning

docker run -d --name flash-tickets-rabbitmq \
  --hostname flash-rabbitmq \
  --network backend \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER="$RABBITMQ_USER" \
  -e RABBITMQ_DEFAULT_PASS="$RABBITMQ_PASSWORD" \
  -e RABBITMQ_DEFAULT_VHOST="$RABBITMQ_VHOST" \
  -v /data/docker/rabbitmq/data:/var/lib/rabbitmq \
  rabbitmq:3.13-management

docker run -d --name flash-tickets-api \
  --network backend \
  --env-file /data/docker/.env.dev \
  -v /data/docker/api/logs:/app/logs \
  flash-tickets-api:dev

docker run -d --name flash-tickets-pay \
  --network backend \
  --env-file /data/docker/.env.dev \
  -v /data/docker/pay/logs:/app/logs \
  flash-tickets-pay:dev

docker run -d --name flash-tickets-nginx \
  --network backend \
  -p 80:80 \
  -v /data/docker/nginx/html:/usr/share/nginx/html:ro \
  flash-tickets-nginx:dev

# 5) 상태 확인
docker ps
docker logs -f flash-tickets-api
```

> **중요**: FTP 전송 시 반드시 **바이너리 모드(binary mode)**를 사용해야 합니다. 텍스트 모드로 전송하면 파일이 손상됩니다.
>
> `scripts/package-dev.sh`에서 `docker save ... | gzip`으로 생성한 아카이브는 먼저 `gunzip`으로 압축 해제 후 `docker load -i`로 이미지를 로드합니다.
>
> **파일 무결성 확인**: 서버에서 `file` 명령으로 파일 타입을 확인하세요. `gzip compressed data`가 출력되어야 정상입니다.

## 2. 환경 변수 파일 구성

환경별 설정은 루트에 있는 `.env.<environment>` 파일을 사용합니다.

| 환경 | 설명 | 파일 |
| --- | --- | --- |
| local | 로컬 개발 | `.env.local` |
| dev | 개발 서버 | `.env.dev` |
| prod | 운영 | `.env.prod` |

개발 서버에서는 `.env.dev` 값을 검토하고 필요한 값(Redis/RabbitMQ 호스트 등)을 수정하십시오. 컨테이너 실행 시 자동으로 로드됩니다.

> 🔐 **주의**: `.env.dev`에는 민감 정보가 포함될 수 있으므로 버전 관리에서 제외되어야 합니다.

> 💡 **ECS 등 런타임 환경변수 사용 시**  
> 컨테이너 실행 시 `LOAD_ENV_FILES=false`를 함께 전달하면(`-e LOAD_ENV_FILES=false`) 애플리케이션이 `.env` 파일 로딩을 건너뛰고 런타임에 주입된 환경변수만 사용합니다.

## 3. 정적 프런트 배포

- CI 또는 로컬 환경에서 `web` 워크스페이스를 빌드합니다.

```bash
pnpm --dir web install
pnpm --dir web build
```

- 결과물(`web/dist`)을 EC2의 `nginx/html` 경로(또는 S3)로 복사합니다.
  - 기본적으로 `nginx/html/index.html`이 자리잡고 있으며, 빌드 파일로 교체하면 됩니다.

## 4. Docker 이미지 빌드 및 실행

### 4.1 Docker 파일 개요

| 파일 | 역할 |
| --- | --- |
| `Dockerfile.api` | NestJS API를 빌드하고 `node dist/main.js`로 실행 |
| `Dockerfile.pay` | RabbitMQ mock 결제 워커를 빌드/실행 |
| `nginx/Dockerfile` | Nginx reverse proxy + 정적 파일 서빙 |
| `docker-compose.dev.yml` | 전체 스택(redis, rabbitmq, api, pay, nginx) 오케스트레이션 |

### 4.2 Docker 이미지 빌드

리포지토리 루트에서 다음 명령으로 이미지를 생성합니다.

```bash
# API 이미지 빌드
docker build -t flash-tickets-api:dev -f Dockerfile.api .

# Mock 결제 서버 이미지 빌드
docker build -t flash-tickets-pay:dev -f Dockerfile.pay .

# Nginx 이미지 빌드 (정적 파일 포함)
docker build -t flash-tickets-nginx:dev ./nginx
```

### 4.3 Docker 컨테이너 실행 (docker run)

1. **공용 네트워크 생성**

```bash
docker network create backend
```

2. **Redis**

```bash
docker run -d \
  --name flash-tickets-redis \
  --network backend \
  -p 6379:6379 \
  -v /data/docker/redis/data:/data \
  redis:7-alpine \
  redis-server --save 60 1 --loglevel warning
```

3. **RabbitMQ**

```bash
source .env.dev
docker run -d \
  --name flash-tickets-rabbitmq \
  --hostname flash-rabbitmq \
  --network backend \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER="$RABBITMQ_USER" \
  -e RABBITMQ_DEFAULT_PASS="$RABBITMQ_PASSWORD" \
  -e RABBITMQ_DEFAULT_VHOST="$RABBITMQ_VHOST" \
  -v /data/docker/rabbitmq/data:/var/lib/rabbitmq \
  rabbitmq:3.13-management
```

   > 관리 콘솔은 http://<host>:15672 에서 접속 가능 (기본 guest/guest 혹은 설정한 자격증명).

4. **API 서버**

```bash
docker run -d \
  --name flash-tickets-api \
  --network backend \
  --env-file .env.dev \
  -v /data/docker/api/logs:/app/logs \
  flash-tickets-api:dev
```

5. **Mock 결제 서버(pay)**

```bash
docker run -d \
  --name flash-tickets-pay \
  --network backend \
  --env-file .env.dev \
  -v /data/docker/pay/logs:/app/logs \
  flash-tickets-pay:dev
```

6. **Nginx (정적 프런트 + 프록시)**

```bash
docker run -d \
  --name flash-tickets-nginx \
  --network backend \
  -p 80:80 \
  -v /data/docker/nginx/html:/usr/share/nginx/html:ro \
  flash-tickets-nginx:dev
```

### 4.4 로그 확인

```bash
docker logs -f flash-tickets-api
docker logs -f flash-tickets-pay
```

### 4.5 컨테이너 중지 및 삭제

```bash
docker stop flash-tickets-nginx flash-tickets-api flash-tickets-pay flash-tickets-rabbitmq flash-tickets-redis
docker rm flash-tickets-nginx flash-tickets-api flash-tickets-pay flash-tickets-rabbitmq flash-tickets-redis
docker network rm backend
```

## 5. Nginx Reverse Proxy

`nginx/default.conf`는 기본적으로 다음 규칙을 제공합니다.

- `/api/` → `http://api:4000/` (Nest API)
- `/socket.io/` → WebSocket Proxy → `api:4000`
- `/*` → 정적 파일 (SPA)

HTTPS(ACM) 적용 시 ALB 또는 CloudFront에서 SSL 종료 후 Nginx로 트래픽을 전달하는 구조를 권장합니다.

## 6. RabbitMQ/Redis

- Redis: 포트 6379, 데이터 영속화가 필요하다면 볼륨(`/data`)을 연결하세요.
- RabbitMQ: 포트 5672(AMQP), 15672(관리 콘솔). `.env.dev`에 맞춰 사용자/비밀번호를 갱신하세요.

## 7. 배포 시나리오 요약

1. EC2에 Docker/Docker Compose 설치
2. 리포지토리 클론 및 `.env.dev` 수정
3. 프런트 빌드 결과물을 `nginx/html`에 업로드
4. Docker 이미지를 빌드한 뒤 `docker run` 명령(위 4.3 단계)을 차례로 실행
5. Route53에서 도메인 → Nginx 인스턴스 를 매핑하고, ACM 인증서를 적용한 ALB/CloudFront로 HTTPS 구성
6. 배포 후 `http://<dev-domain>`에 접속하여 API/프런트 연결 확인


## 8. 운영/추가 고려 사항

- 로그 및 모니터링: CloudWatch 에이전트 또는 Loki/Promtail 등을 통해 컨테이너 로그 수집 고려
- 데이터 백업: PostgreSQL은 별도 관리(예: Amazon RDS). Redis/RabbitMQ는 개발 환경이므로 영속성 요구에 따라 볼륨 매핑.
- 스케일 업: 필요 시 `docker-compose` 대신 ECS/EKS 전환을 검토할 수 있습니다.

이 문서를 기반으로 개발 서버를 빠르게 재현하고 배포 파이프라인을 구축할 수 있습니다.

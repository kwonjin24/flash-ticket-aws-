# 로컬 Docker 실행 가이드

로컬 환경에서 각 서비스를 컨테이너로 실행해 보는 방법을 정리했습니다.  
먼저 필요한 이미지를 빌드하고, 의존 서비스를 띄운 뒤 각 애플리케이션을 실행하세요.

---

## 1. 이미지 빌드

루트 디렉터리에서 다음 스크립트를 실행하여 ARM64/AMD64 이미지를 만들 수 있습니다.

```bash
# ARM64 이미지를 모두 빌드 (Apple Silicon 등)
./scripts/package-dev.sh

# AMD64 이미지를 모두 빌드 (Intel/AMD 기반)
./scripts/package-dev-amd64.sh

# web 이미지만 AMD64로 따로 빌드하고 싶다면
./scripts/package-web-dev-amd64.sh
```

빌드가 끝나면 다음 이름의 이미지가 생성됩니다.

- `flash-tickets-api:{arm64|amd64}`
- `flash-tickets-gateway:{arm64|amd64}`
- `flash-tickets-pay:{arm64|amd64}`
- `flash-tickets-web:{arm64|amd64}`

사용 중인 머신 아키텍처에 맞는 태그를 선택하여 실행하면 됩니다.

---

## 2. 의존 서비스 실행 (PostgreSQL / Redis / RabbitMQ)

아래 `docker compose` 예시를 사용하면 기본 의존 서비스를 한 번에 띄울 수 있습니다.

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: flash-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: flash_tickets
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: flash-redis
    restart: unless-stopped
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3.13-management
    container_name: flash-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"
```

파일을 `docker-compose.yaml`로 저장한 뒤 아래 명령으로 실행하세요.

```bash
docker compose up -d
```

---

## 3. 환경 변수 샘플

각 모듈별로 필요한 환경변수는 다음과 같습니다.

| 서비스 | 필수 값 |
|--------|---------|
| API    | `DATABASE_URL`, `JWT_ACCESS_SECRET` |
| Gateway | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXP`, `JWT_REFRESH_EXP`, `ADMIN_REGISTER_SECRET` |
| Pay 워커 | `PAYMENT_REQUEST_QUEUE`, `PAYMENT_RESULT_QUEUE` (RabbitMQ 연결 정보는 URL 또는 Host/Port 조합) |
| Web    | 런타임에서 `API_BASE_URL`, `GATEWAY_BASE_URL` 전달 |

각 디렉터리(`api/.env.example`, `gateway/.env.example`, `pay/.env.example`, `web/.env.example`)에 예시 파일이 있으니 참고하세요.

---

## 4. 애플리케이션 컨테이너 실행

아래 예시는 ARM64 이미지를 기준으로 작성했습니다.  
AMD64 환경이라면 태그를 `:amd64`로 바꿔 실행하면 됩니다.

### 4.1 API

```bash
docker run --rm -d \
  --name flash-api \
  -p 4000:4000 \
  -e DATABASE_URL=postgres://flash_tickets_app:flash_tickets_app@localhost:5432/flash_tickets \
  -e JWT_ACCESS_SECRET=replace-with-access-secret \
  -e RABBITMQ_HOST=localhost \
  -e RABBITMQ_PORT=5672 \
  -e RABBITMQ_USER=guest \
  -e RABBITMQ_PASSWORD=guest \
  -e REDIS_HOST=localhost \
  -e REDIS_PORT=6379 \
  -e PAYMENT_REQUEST_QUEUE=payments_request \
  -e PAYMENT_RESULT_QUEUE=payments_result \
  flash-tickets-api:arm64
```

### 4.2 Gateway

```bash
docker run --rm -d \
  --name flash-gateway \
  -p 3000:3000 \
  --network backend \
  -e DATABASE_URL=postgres://postgres:postgres@postgres:5432/flash_tickets \
  -e JWT_ACCESS_SECRET=replace-with-access-secret \
  -e JWT_REFRESH_SECRET=replace-with-refresh-secret \
  -e JWT_ACCESS_EXP=15m \
  -e JWT_REFRESH_EXP=7d \
  -e ADMIN_REGISTER_SECRET=replace-with-admin-secret \
  -e REDIS_HOST=flash-redis \
  -e REDIS_PORT=6379 \
  flash-tickets-gateway:arm64
```

### 4.3 Pay 워커

```bash
docker run --rm -d \
  --name flash-pay \
  --network backend \
  -e RABBITMQ_URL=amqp://guest:guest@flash-rabbitmq:5672/ \
  -e PAYMENT_REQUEST_QUEUE=payments_request \
  -e PAYMENT_RESULT_QUEUE=payments_result \
  -e PAYMENT_SUCCESS_RATE=0.85 \
  -e PAYMENT_PROCESSING_MIN_MS=1000 \
  -e PAYMENT_PROCESSING_MAX_MS=4000 \
  flash-tickets-pay:arm64
```

### 4.4 Web (정적 사이트)

```bash
docker run --rm -d \
  --name flash-web \
  -p 8080:80 \
  --network backend \
  -e API_BASE_URL=http://flash-api:4000 \
  -e GATEWAY_BASE_URL=http://flash-gateway:3000 \
  flash-tickets-web:arm64
```

> `host.docker.internal`은 Docker Desktop에서 호스트 머신을 가리키는 주소입니다.  
> Linux 원격 환경에서는 실제 호스트 IP 주소를 사용하세요.

---

## 5. 접속 확인

- Web UI: `http://localhost:8080`
- Gateway WebSocket/API: `http://localhost:3000`
- API: `http://localhost:4000`
- RabbitMQ Management UI: `http://localhost:15672` (guest/guest)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

필요에 따라 `docker logs {컨테이너명}` 명령으로 로그를 확인하세요.

---

## 6. 종료

```bash
# 애플리케이션 컨테이너 중지
docker stop flash-web flash-api flash-gateway flash-pay

# 의존 서비스 중지
docker compose down
```

---

> ⚠️ 실제 운영 환경(ECS 등)에서는 위 환경변수를 각각의 서비스에 주입하고,  
> VPC 내부에서 연결 정보(hostname, credentials)를 업데이트해야 합니다.

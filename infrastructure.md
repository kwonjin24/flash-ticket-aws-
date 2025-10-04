# Flash Tickets 서비스 실행을 위한 의존성 정리

## 1. 필수 도구

| 항목 | 권장 버전 | 비고 |
| --- | --- | --- |
| Node.js | 20.x LTS | `pnpm env use --global 20` 등으로 설치 권장 |
| pnpm | 10.x | `corepack enable` 후 `corepack prepare pnpm@10.17.1 --activate` |
| PostgreSQL | 14 이상 | `DATABASE_URL`에 맞춰 생성 (기본: `flash_tickets`) |
| Redis | 최신 안정판 | 대기열/세션용 (docker 사용 가능) |
| RabbitMQ | 3.13 이상 | 결제 큐용 (docker 사용 가능) |

> **Tip**: 저장소에는 `pnpm-workspace.yaml`이 포함되어 있으므로 루트에서 의존성을 설치하면 `api`, `web`, `pay` 워크스페이스가 모두 설치됩니다.

```bash
pnpm install
```

## 2. Docker 네트워크 생성

모든 인프라 컨테이너를 같은 네트워크(`backend`)에 연결합니다.

```bash
docker network create backend
```

> 네트워크가 이미 존재한다면 오류가 발생할 수 있습니다. 그 경우 무시하거나 `docker network inspect backend`로 확인하세요.

## 3. Redis 컨테이너 실행

```bash
docker run -d \
  --name flash-redis \
  --network backend \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --save 60 1 --loglevel warning
```

- 포트: `6379`
- 환경 변수: `.env`의 `REDIS_HOST=localhost`, `REDIS_PORT=6379`

## 4. RabbitMQ 컨테이너 실행

```bash
docker run -d \
  --name flash-rabbitmq \
  --hostname flash-rabbitmq \
  --network backend \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  -e RABBITMQ_DEFAULT_VHOST=/ \
  rabbitmq:3.13-management
```

- AMQP 포트: `5672`
- 관리 콘솔: http://localhost:15672 (기본 계정 `guest` / `guest`)
- `.env` 기본값과 동일한 자격 증명입니다.

## 5. PostgreSQL 예시 (선택)

이미 로컬에 DB가 있다면 생략 가능합니다. 컨테이너로 실행할 경우:

```bash
docker run -d \
  --name flash-postgres \
  --network backend \
  -e POSTGRES_USER=flash_tickets_app \
  -e POSTGRES_PASSWORD=flash_tickets_app \
  -e POSTGRES_DB=flash_tickets \
  -p 5432:5432 \
  postgres:14
```

## 6. 환경 변수 설정

루트 `.env.example`과 `pay/.env.example`을 복사해 적용합니다.

```bash
cp .env.example .env
cp pay/.env.example pay/.env
```

필요 시 RabbitMQ/Redis/PostgreSQL 주소를 수정합니다.

## 7. 애플리케이션 실행

컨테이너와 환경 변수가 준비되면 루트에서 다음 명령을 실행해 API/웹/모의 결제 서버를 동시에 띄울 수 있습니다.

```bash
pnpm dev
```

- `api` : NestJS 서버 (http://localhost:4000)
- `web` : Vite 프런트엔드 (http://127.0.0.1:5173)
- `pay` : RabbitMQ 기반 mock 결제 워커

필요 시 각 워크스페이스에서 개별 스크립트(`pnpm --dir api start:dev` 등)를 사용해도 됩니다.

## 8. 추가 참고

- Redis, RabbitMQ 컨테이너는 항상 같은 네트워크(`backend`)에 속해야 API/결제 워커가 서로 통신할 수 있습니다.
- 개발용 컨테이너는 `docker compose`로 묶어도 좋습니다. 위 명령을 `services` 정의로 변환하면 손쉽게 일괄 관리할 수 있습니다.
- RabbitMQ 큐 이름 기본값: `payments_request`, `payments_result` (환경 변수로 변경 가능).

필요한 추가 의존성이 생기면 이 파일을 업데이트 하세요.

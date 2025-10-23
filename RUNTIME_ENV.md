# Runtime Environment Variables

컨테이너를 `.env` 파일 없이 실행할 때 필요한 환경변수를 한눈에 정리했습니다. 서비스별 **필수값**(🚨)과 **선택값**(⚙️)을 구분해두었으니, ECS 등에서 태스크 정의를 구성할 때 참고하세요.

## 공통(Global)
- 🚨 `NODE_ENV` – 런타임 모드 (`production`, `staging`, `dev` 등)
- ⚙️ `LOAD_ENV_FILES` – `.env` 자동 로딩 여부 (`false`로 설정하면 런타임 변수만 사용)

## API 서비스 (NestJS)
- 🚨 `DATABASE_URL` – PostgreSQL 접속 URL
- 🚨 `JWT_ACCESS_SECRET` – Gateway에서 발급한 Access 토큰 검증용 시크릿
- ⚙️ `PORT` – HTTP 리스닝 포트 (기본 `4000`)
- ⚙️ `RABBITMQ_HOST` / `RABBITMQ_PORT` / `RABBITMQ_USER` / `RABBITMQ_PASSWORD` / `RABBITMQ_VHOST`
- ⚙️ `PAYMENT_REQUEST_QUEUE`, `PAYMENT_RESULT_QUEUE` – 결제 요청/결과 큐 이름 (기본 `payments_request`, `payments_result`)
- ⚙️ `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` – 모니터링에 사용하는 Redis 접속 정보 (기본 `localhost:6379`)

## Gateway 서비스 (NestJS)
- 🚨 `DATABASE_URL` – 사용자/인증 정보 저장용 PostgreSQL URL
- 🚨 `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` – Access/Refresh 토큰 서명 시크릿
- 🚨 `JWT_ACCESS_EXP`, `JWT_REFRESH_EXP` – 토큰 만료 시간 예: `15m`, `7d`
- 🚨 `ADMIN_REGISTER_SECRET` – 관리자 등록 시 사용하는 공유 시크릿
- ⚙️ `PORT` – HTTP/WebSocket 포트 (기본 `3000`)
- ⚙️ `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` – 대기열 상태를 저장할 Redis 정보 (기본 `localhost:6379`)
- ⚙️ `QUEUE_READY_CAPACITY` – READY 슬롯 수 (기본 `50`)
- ⚙️ `QUEUE_GATE_TOKEN_TTL_MS` – READY 상태 지속 시간(ms, 기본 `120000`)
- ⚙️ `QUEUE_PROMOTION_INTERVAL_MS` – 승격 주기(ms, 기본 `5000`)
- ⚙️ `QUEUE_WS_REFRESH_MS` – 클라이언트 상태 갱신 주기(ms, 기본 `3000`)

## Pay 워커 (Mock 결제)
- 🚨 `PAYMENT_REQUEST_QUEUE`, `PAYMENT_RESULT_QUEUE` – API와 동일한 큐 이름
- ⚙️ `RABBITMQ_HOST` / `RABBITMQ_PORT` / `RABBITMQ_USER` / `RABBITMQ_PASSWORD` / `RABBITMQ_VHOST`
- ⚙️ `PAYMENT_SUCCESS_RATE` – 성공 확률(0~1, 기본 `0.85`)
- ⚙️ `PAYMENT_PROCESSING_MIN_MS`, `PAYMENT_PROCESSING_MAX_MS` – 처리 소요 시간 범위(ms, 기본 `1000`~`4000`)

## Web (Vite 프런트)
- 🚨 `API_BASE_URL` – API 호출 베이스 URL (로컬 개발 시 사용)
- 🚨 `GATEWAY_BASE_URL` – Gateway 호출 베이스 URL (로컬 개발 시 사용)

> 💡 **Tip**  
> `LOAD_ENV_FILES=false`로 실행하면 모든 서비스가 `.env` 파일을 무시하고 위 변수들을 런타임 주입값으로만 사용합니다. Docker/ECS에서는 환경변수 섹션에 위 항목을 정의하고, 필요 시 시크릿 매니저/파라미터 스토어와 연동해 관리하세요.

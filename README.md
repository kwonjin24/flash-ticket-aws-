# Flash Tickets Monorepo

Flash Tickets는 대규모 이벤트 티켓팅을 안정적으로 처리하기 위한 서비스로, 실시간 대기열과 주문 파이프라인을 포함한 멀티 패키지(monorepo) 구조입니다. NestJS 기반 API(`api/`), Vite React 프런트엔드(`web/`), 모의 결제 서비스(`pay/`)가 함께 포함되어 있어 개발·테스트·운영을 한 저장소에서 관리합니다.

## 프로젝트 소개

Flash Tickets는 “티켓팅 전쟁”과 같은 폭주 상황에서도 **오버셀 없이 주문을 처리**하고, **대기열 진입부터 결제까지 관측 가능**하도록 하는 것을 목표로 합니다. 핵심 기능은 다음과 같습니다.

- 실시간 WebSocket 대기열: 사용자는 대기열 위치와 상태를 실시간으로 확인하며, 서버는 BullMQ 기반 승격 작업을 통해 병목 없이 READY 상태를 부여합니다.
- 주문 및 결제 파이프라인: NestJS API가 주문/결제/보류(hold)를 관리하고, Redis와 PostgreSQL을 조합해 일관성 있게 재고를 차감합니다.
- 운영 친화적 구성: 환경 변수 템플릿, Dev/Prod용 Dockerfile, 배포/패키징 스크립트를 제공하여 로컬 개발부터 클러스터 배포까지 한 흐름으로 구성했습니다.
- 모의 결제 시나리오: `pay/` 서비스가 메시지 큐 기반(mock) 결제 응답을 반환해 전체 플로우를 검증할 수 있습니다.

## 프로젝트 주요 구성 기술

- **NestJS 11 / TypeScript**: API 및 대기열 비즈니스 로직, BullMQ 작업 프로세서를 포함한 서버 애플리케이션.
- **BullMQ + Redis**: 대기열 승격 작업 및 비동기 처리. Redis는 `queue-ticket-promotion` 큐를 통해 READY 슬롯을 관리합니다.
- **PostgreSQL / TypeORM**: 주문, 이벤트, 사용자 엔터티를 관리하는 관계형 데이터베이스. 트랜잭션과 락을 활용해 재고 정합성을 확보합니다.
- **Vite + React 18**: WebSocket 기반 실시간 UI 및 사용자 대기열 흐름을 구현한 프런트엔드.
- **pnpm Workspaces**: `api`, `web`, `pay` 패키지를 단일 레포에서 관리하며 종속성을 공유합니다.
- **Docker / Nginx**: Dev/Prod 환경을 위한 컨테이너 이미지와 Nginx 리버스 프록시 설정.
- **관측 도구 통합**: Prometheus 메트릭 엔드포인트와 구조화 로그(Loki/S3 연계 시나리오) 지원.

## 개발 환경 준비

- Node.js 20.19.0 (`.nvmrc` 제공) — `nvm install && nvm use` 권장
- pnpm 10.17.1 — `corepack prepare pnpm@10.17.1 --activate`

## 개발 서버 실행

```bash
pnpm install
pnpm --dir api install
pnpm --dir web install
pnpm dev
```

환경 변수는 루트 `.env.example`과 각 패키지의 예시 파일을 참고해 `.env`를 준비하세요. dev/prod 배포 절차는 `DEV_DEPLOYMENT.md` 및 `scripts/` 디렉터리를 참고하면 빠르게 따라 할 수 있습니다.

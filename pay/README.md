# 모의 결제 프로세서 (Mock Payment Processor)

이 서비스는 RabbitMQ 큐에서 결제 요청을 소비하고, 비동기 처리를 시뮬레이션한 뒤 결과 메시지를 발행하는 외부 결제 게이트웨이를 에뮬레이션합니다. 실제 PG 연동 전, 메인 API가 메시지 기반 결제 플로우를 통합할 수 있도록 돕습니다.

## Features

- API가 생성한 결제 작업을 `payments_request` 큐에서 수신
- 설정 가능한 성공 확률과 지연 시간으로 처리 지연/성공·실패를 시뮬레이션
- 처리 결과를 `payments_result` 큐에 게시하여 API가 최종 주문 트랜잭션을 완료할 수 있게 지원
- 구조화된 로깅과 우아한 종료(Graceful shutdown) 지원

## 프로젝트 구조

```
pay/
├── package.json
├── tsconfig.json
└── src
    ├── config.ts        # 환경변수 로딩 및 기본값
    ├── index.ts         # 워커 부트스트랩
    ├── logger.ts        # 최소 콘솔 로거
    ├── types.ts         # 큐 페이로드 공용 타입
    └── utils.ts         # 유틸(지연, 실패 사유 생성)
```

## 환경 변수

| 변수                          | 설명             | 기본값                |
| --------------------------- | -------------- | ------------------ |
| `RABBITMQ_URL`              | AMQP 연결 URL (우선 적용) | 자동 조합 (아래 값) |
| `RABBITMQ_HOST`             | RabbitMQ 호스트      | `127.0.0.1`        |
| `RABBITMQ_PORT`             | RabbitMQ 포트       | `5672`             |
| `RABBITMQ_USER`             | RabbitMQ 사용자      | `guest`            |
| `RABBITMQ_PASSWORD`         | RabbitMQ 비밀번호    | `guest`            |
| `RABBITMQ_VHOST`            | RabbitMQ Virtual Host | `/`               |
| `PAYMENT_REQUEST_QUEUE`     | 결제 요청 큐 이름     | `payments_request` |
| `PAYMENT_RESULT_QUEUE`      | 결과 게시 큐 이름     | `payments_result`  |
| `PAYMENT_SUCCESS_RATE`      | 결제 성공 확률(0–1)  | `0.85`             |
| `PAYMENT_PROCESSING_MIN_MS` | 최소 처리 지연(ms)   | `1000`             |
| `PAYMENT_PROCESSING_MAX_MS` | 최대 처리 지연(ms)   | `4000`             |


pay/ 디렉토리에 .env 파일을 두어 값을 재정의할 수 있습니다.
# 제공된 `.env.example`을 복사하여 시작할 수 있습니다.

## Scripts

- `pnpm --dir pay install` – 의존성 설치
- `pnpm --dir pay dev` – 개발 모드 시작(ts-node-dev 라이브 리로드)
- `pnpm --dir pay build` – TypeScript 컴파일(dist/ 생성)
- `pnpm --dir pay start` – 컴파일된 JS 실행(사전 build 필요)

## 큐 계약(Contracts)

### 요청 페이로드 (`payments_request`)

```ts
{
  requestId: string;   // 고유 요청 식별자
  paymentId: string;   // 결제 엔티티 ID
  orderId: string;     // 연관 주문 ID
  userId: string;      // 구매자
  amount: number;      // 결제 금액 합계
  method: string;      // 결제 수단 코드(예: MOCK)
  metadata?: Record<string, unknown>;
}
```

### 결과 페이로드 (`payments_result`)

```ts
{
  requestId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  status: 'OK' | 'FAIL';
  processedAt: string;   // ISO 타임스탬프
  message?: string;      // 사람 친화적 설명(옵션)
}
```

워커는 RabbitMQ 메시지 속성(`correlationId`, `messageId`)을 설정해 추적을 돕습니다. 컨슈머는 성공/실패 모두를 수신하여 주문 상태를 갱신해야 합니다.

## 다음 단계 / 통합 가이드

1. API 서버에서 결제 요청 시 `payments_request` 큐에 위 포맷으로 메시지를 넣습니다.
2. Mock 결제 서버가 메시지를 처리하고 `payments_result` 큐에 결과를 게시합니다.
3. API 서버는 결과 큐를 구독하여 `completePayment` 로직을 호출해 주문 상태를
   갱신합니다.
4. 프론트는 주문 상태/알림을 통해 비동기 결제 완료 여부를 표시할 수 있습니다.

이 구조를 기반으로 실제 PG 연동을 위한 어댑터를 이후에 교체하면 됩니다.

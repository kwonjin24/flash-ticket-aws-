# API 엔드포인트 목록

Flash Tickets 시스템의 모든 API 엔드포인트 목록과 사용 방법입니다.

## 목차

1. [Gateway API (대기열)](#gateway-api-대기열)
2. [API (비즈니스 로직)](#api-비즈니스-로직)
3. [인증 방법](#인증-방법)
4. [에러 응답](#에러-응답)

---

## Gateway API (대기열)

**Base URL**: `https://gateway.highgarden.cloud`

### 1. 인증 (Auth)

#### 1.1 회원가입
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동"
}
```

**응답**:
```json
HTTP 200 OK
```

#### 1.2 관리자 회원가입
```http
POST /auth/register/admin
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123",
  "name": "관리자"
}
```

#### 1.3 로그인
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**응답**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 1.4 토큰 갱신
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 1.5 로그아웃
```http
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 2. 대기열 (Queue)

#### 2.1 대기열 등록 (Enqueue)
```http
POST /queue/enqueue
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "eventId": "event-uuid"
}
```

**응답**:
```json
{
  "ticketId": "ticket-uuid"
}
```

**부하 테스트 핵심 엔드포인트** ⭐
- 동시 접속자 폭증 시나리오
- 대기열 시스템 성능 측정

#### 2.2 대기열 상태 확인 (Status)
```http
GET /queue/status?ticketId={ticketId}
```

**응답**:
```json
{
  "ticketId": "ticket-uuid",
  "status": "waiting",  // waiting | ready | expired
  "position": 42,        // 대기 순번
  "estimatedWaitTimeMs": 120000,
  "gateToken": null      // ready일 때만 존재
}
```

**부하 테스트 핵심 엔드포인트** ⭐
- 폴링 패턴 테스트
- Redis 부하 측정

#### 2.3 입장 (Enter)
```http
POST /queue/enter
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "ticketId": "ticket-uuid",
  "gateToken": "gate-token"
}
```

**응답**:
```json
{
  "status": "entered"
}
```

#### 2.4 헬스체크
```http
GET /queue/healthz
```

**응답**:
```json
{
  "status": "ok"
}
```

---

## API (비즈니스 로직)

**Base URL**: `https://api.highgarden.cloud`

### 1. 이벤트 (Events)

#### 1.1 이벤트 목록 조회 (Public)
```http
GET /events
```

**응답**:
```json
[
  {
    "id": "event-uuid",
    "name": "BTS 콘서트",
    "description": "2025년 BTS 월드 투어",
    "eventDate": "2025-12-31T19:00:00Z",
    "totalSeats": 50000,
    "availableSeats": 48000,
    "price": 150000,
    "isPublic": true,
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

#### 1.2 이벤트 상세 조회
```http
GET /events/{eventId}
```

#### 1.3 이벤트 생성 (Admin)
```http
POST /events
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "name": "이벤트명",
  "description": "설명",
  "eventDate": "2025-12-31T19:00:00Z",
  "totalSeats": 50000,
  "price": 150000,
  "isPublic": true
}
```

#### 1.4 이벤트 수정 (Admin)
```http
PATCH /events/{eventId}
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "name": "수정된 이벤트명",
  "availableSeats": 45000
}
```

#### 1.5 이벤트 삭제 (Admin)
```http
DELETE /events/{eventId}
Authorization: Bearer {adminToken}
```

### 2. 주문 (Orders)

#### 2.1 주문 생성
```http
POST /orders
Authorization: Bearer {accessToken}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "eventId": "event-uuid",
  "qty": 2
}
```

**응답**:
```json
{
  "id": "order-uuid",
  "eventId": "event-uuid",
  "userId": "user-uuid",
  "qty": 2,
  "totalPrice": 300000,
  "status": "pending",  // pending | paid | failed | cancelled
  "createdAt": "2025-01-01T12:00:00Z"
}
```

**부하 테스트 핵심 엔드포인트** ⭐
- 동시 주문 처리 성능
- 재고 관리 동시성 제어
- Idempotency 검증

**중요 헤더**:
- `Idempotency-Key`: 중복 요청 방지용 고유 키 (필수)

#### 2.2 내 주문 목록
```http
GET /orders
Authorization: Bearer {accessToken}
```

**응답**:
```json
[
  {
    "id": "order-uuid",
    "event": {
      "id": "event-uuid",
      "name": "BTS 콘서트",
      "eventDate": "2025-12-31T19:00:00Z"
    },
    "qty": 2,
    "totalPrice": 300000,
    "status": "paid",
    "payment": {
      "id": "payment-uuid",
      "status": "OK",
      "processedAt": "2025-01-01T12:00:05Z"
    },
    "createdAt": "2025-01-01T12:00:00Z"
  }
]
```

#### 2.3 주문 상세
```http
GET /orders/{orderId}
Authorization: Bearer {accessToken}
```

### 3. 결제 (Payments)

결제는 RabbitMQ를 통한 비동기 처리로, 직접 호출하는 API는 없습니다.
주문 생성 후 자동으로 결제 큐에 메시지가 전송됩니다.

### 4. 모니터링

#### 4.1 API 헬스체크
```http
GET /health
```

**응답**:
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok"
}
```

#### 4.2 메트릭 (Prometheus)
```http
GET /metrics
```

#### 4.3 Liveness
```http
GET /live
```

---

## 인증 방법

### JWT Bearer Token

대부분의 엔드포인트는 JWT 인증이 필요합니다.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 토큰 획득 과정

1. **회원가입**: `POST /auth/register`
2. **로그인**: `POST /auth/login` → `accessToken` 획득
3. **API 호출**: `Authorization: Bearer {accessToken}` 헤더 추가
4. **토큰 만료 시**: `POST /auth/refresh` → 새 토큰 획득

### JMeter에서 토큰 관리

```
1. Thread Group
   └── Login Request (POST /auth/login)
       └── JSON Extractor (accessToken 추출)
           └── HTTP Header Manager (모든 요청에 Bearer Token 추가)
```

---

## 에러 응답

### 공통 에러 포맷

```json
{
  "statusCode": 400,
  "message": "에러 메시지",
  "error": "Bad Request"
}
```

### 주요 HTTP 상태 코드

| 코드 | 의미 | 예시 |
|-----|------|------|
| 200 | 성공 | 정상 응답 |
| 400 | 잘못된 요청 | 필수 파라미터 누락 |
| 401 | 인증 실패 | 토큰 없음 또는 만료 |
| 403 | 권한 없음 | Admin 전용 API |
| 404 | 리소스 없음 | 존재하지 않는 이벤트 |
| 409 | 충돌 | 재고 부족, 중복 요청 |
| 429 | 너무 많은 요청 | Rate Limiting |
| 500 | 서버 에러 | 내부 오류 |
| 503 | 서비스 불가 | 시스템 과부하 |

---

## 부하 테스트 시나리오별 엔드포인트

### Smoke Test (기본 동작 검증)
- `POST /auth/register`
- `POST /auth/login`
- `GET /events`
- `GET /events/{id}`
- `GET /health`

### Load Test (일반 부하)
- `POST /auth/login` (1회)
- `GET /events` (조회)
- `POST /queue/enqueue` (대기열 등록)
- `GET /queue/status` (상태 확인, 폴링)
- `POST /queue/enter` (입장)
- `POST /orders` (주문)

### Stress Test (극한 부하)
- 동시 `POST /queue/enqueue` (대량 동시 접속)
- 연속 `GET /queue/status` (폴링 폭증)
- 동시 `POST /orders` (동시 주문)

### Spike Test (급증)
- 단시간에 `POST /queue/enqueue` 폭증
- `GET /queue/status` 폴링

---

## 다음 단계

1. [JMeter 설정 가이드](jmeter-setup.md)에서 환경 구성
2. [테스트 계획](test-plan.md)에서 시나리오 확인
3. `scenarios/` 디렉토리의 시나리오별 상세 가이드 참고
4. `scripts/` 디렉토리의 JMX 파일로 테스트 실행

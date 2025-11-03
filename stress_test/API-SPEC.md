# 정확한 API 스펙 문서

완전한 코드 분석을 통해 작성된 정확한 API 명세서입니다.

## 기본 정보

```
Gateway 도메인: gateway.highgarden.cloud
API 도메인: api.highgarden.cloud
WebSocket 경로: wss://gateway.highgarden.cloud/socket.io/

테스트 계정:
- userId: test0000 ~ test0999
- password: testtest
```

## 인증 (Gateway)

### 1. 로그인

```http
POST https://gateway.highgarden.cloud/auth/login
Content-Type: application/json

{
  "userId": "test0001",
  "password": "testtest"
}
```

**응답 (200 OK)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 대기열 시스템 (Gateway)

### 중요: 대기열 등록 방식

**실제 웹 애플리케이션 동작:**
- 로그인 성공 후 **WebSocket**을 통해 자동으로 대기열 등록
- WebSocket 이벤트: `queue/join` emit

**JMeter 부하 테스트용:**
- WebSocket 대신 **REST API**로 대기열 등록 가능
- 아래 HTTP 엔드포인트 사용

### 2. 대기열 등록 (REST API)

```http
POST https://gateway.highgarden.cloud/queue/enqueue
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "eventId": "이벤트 UUID"
}
```

**응답 (200 OK)**:
```json
{
  "ticketId": "티켓 UUID"
}
```

### 3. 대기열 상태 조회

```http
GET https://gateway.highgarden.cloud/queue/status?ticketId={ticketId}
```

**인증 불필요** (ticketId만으로 조회 가능)

**응답 (200 OK)**:
```json
{
  "ticketId": "티켓 UUID",
  "state": "QUEUED",
  "position": 42,
  "gateToken": null
}
```

**state 가능한 값:**
- `QUEUED`: 대기 중
- `READY`: 입장 가능 (gateToken 발급됨)
- `USED`: 입장 완료
- `ORDER_PENDING`: 주문 대기 중
- `ORDERED`: 주문 완료
- `EXPIRED`: 만료됨

**state가 READY일 때:**
```json
{
  "ticketId": "티켓 UUID",
  "state": "READY",
  "position": 1,
  "gateToken": "게이트 토큰 문자열"
}
```

### 4. 대기열 입장

```http
POST https://gateway.highgarden.cloud/queue/enter
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "ticketId": "티켓 UUID",
  "gateToken": "발급받은 게이트 토큰"
}
```

**응답 (200 OK)**:
```json
{
  "status": "entered"
}
```

### 5. Gateway 헬스체크

```http
GET https://gateway.highgarden.cloud/queue/healthz
```

**응답 (200 OK)**:
```json
{
  "status": "ok"
}
```

## WebSocket 대기열 (실제 웹 동작)

### WebSocket 연결

```javascript
// WebSocket 엔드포인트
wss://gateway.highgarden.cloud/socket.io/

// 네임스페이스
/queue
```

### WebSocket 이벤트

**클라이언트 → 서버:**

1. **대기열 참여**
```javascript
socket.emit('queue/join', {
  eventId: "이벤트 UUID",
  userId: "사용자 ID"
})
```

2. **대기열 나가기**
```javascript
socket.emit('queue/leave', {
  clearTicket: true
})
```

**서버 → 클라이언트:**

1. **설정 정보**
```javascript
socket.on('queue:config', (payload) => {
  // payload: { readyCapacity: 100 }
})
```

2. **등록 완료**
```javascript
socket.on('queue:joined', (payload) => {
  // payload: { ticketId: "...", eventId: "..." }
})
```

3. **상태 업데이트**
```javascript
socket.on('queue:update', (payload) => {
  // payload: {
  //   ticketId: "...",
  //   eventId: "...",
  //   state: "QUEUED" | "READY" | ...,
  //   position: 42,
  //   queueSize: 1000,
  //   readyCapacity: 100,
  //   gateToken: "..." // READY 상태일 때만
  // }
})
```

4. **대기열 요약**
```javascript
socket.on('queue:summary', (payload) => {
  // payload: {
  //   eventId: "...",
  //   queueSize: 1000,
  //   readyCapacity: 100
  // }
})
```

5. **에러**
```javascript
socket.on('queue:error', (payload) => {
  // payload: { message: "에러 메시지" }
})
```

## 이벤트 조회 (API)

### 6. 이벤트 목록 조회

```http
GET https://api.highgarden.cloud/events
```

**인증 불필요** (공개 API)

**응답 (200 OK)**:
```json
[
  {
    "id": "이벤트 UUID",
    "name": "이벤트명",
    "startsAt": "2025-11-03T10:00:00.000Z",
    "endsAt": "2025-11-03T18:00:00.000Z",
    "totalQty": 1000,
    "soldQty": 450,
    "maxPerUser": 4,
    "price": 50000,
    "status": "ACTIVE",
    "createdAt": "2025-11-01T00:00:00.000Z",
    "updatedAt": "2025-11-03T12:00:00.000Z"
  }
]
```

### 7. 이벤트 상세 조회

```http
GET https://api.highgarden.cloud/events/{eventId}
```

**인증 불필요** (공개 API)

**응답 (200 OK)**:
```json
{
  "id": "이벤트 UUID",
  "name": "이벤트명",
  "startsAt": "2025-11-03T10:00:00.000Z",
  "endsAt": "2025-11-03T18:00:00.000Z",
  "totalQty": 1000,
  "soldQty": 450,
  "maxPerUser": 4,
  "price": 50000,
  "status": "ACTIVE",
  "createdAt": "2025-11-01T00:00:00.000Z",
  "updatedAt": "2025-11-03T12:00:00.000Z"
}
```

## 주문 (API)

### 8. 주문 생성

```http
POST https://api.highgarden.cloud/orders
Authorization: Bearer {accessToken}
Idempotency-Key: {UUID}
Content-Type: application/json

{
  "event_id": "이벤트 UUID",
  "qty": 2
}
```

**중요:**
- `Idempotency-Key` 헤더 필수 (UUID 형식)
- 대기열 통과 후 (gateToken 발급 후) 호출해야 함
- 요청 본문 필드명: `event_id` (언더스코어 사용)

**응답 (200 OK)**:
```json
{
  "orderId": "주문 UUID",
  "status": "HOLD",
  "amount": 100000,
  "qty": 2,
  "eventId": "이벤트 UUID",
  "eventName": "이벤트명",
  "createdAt": "2025-11-03T12:30:00.000Z",
  "updatedAt": "2025-11-03T12:30:00.000Z"
}
```

**가능한 status 값:**
- `HOLD`: 주문 생성됨, 결제 대기 중
- `PAID`: 결제 완료
- `CANCELLED`: 취소됨
- `EXPIRED`: 만료됨
- `FAIL`: 결제 실패

### 9. 주문 목록 조회

```http
GET https://api.highgarden.cloud/orders
Authorization: Bearer {accessToken}
```

**응답 (200 OK)**:
```json
[
  {
    "orderId": "주문 UUID",
    "status": "HOLD",
    "amount": 100000,
    "qty": 2,
    "eventId": "이벤트 UUID",
    "eventName": "이벤트명",
    "createdAt": "2025-11-03T12:30:00.000Z",
    "updatedAt": "2025-11-03T12:30:00.000Z"
  }
]
```

### 10. 주문 상세 조회

```http
GET https://api.highgarden.cloud/orders/{orderId}
Authorization: Bearer {accessToken}
```

**응답 (200 OK)**:
```json
{
  "orderId": "주문 UUID",
  "status": "HOLD",
  "amount": 100000,
  "qty": 2,
  "eventId": "이벤트 UUID",
  "eventName": "이벤트명",
  "createdAt": "2025-11-03T12:30:00.000Z",
  "updatedAt": "2025-11-03T12:30:00.000Z"
}
```

## 결제 (API)

### 11. 결제 생성

```http
POST https://api.highgarden.cloud/payments
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "orderId": "주문 UUID",
  "method": "MOCK"
}
```

**method 가능한 값:**
- `MOCK`: 테스트용 결제 방식
- 기타 PG사 코드 (CARD, BANK 등)

**응답 (200 OK)**:
```json
{
  "paymentId": "결제 UUID",
  "orderId": "주문 UUID",
  "status": "REQ",
  "method": "MOCK",
  "amount": 100000,
  "createdAt": "2025-11-03T12:31:00.000Z",
  "updatedAt": "2025-11-03T12:31:00.000Z"
}
```

**가능한 status 값:**
- `REQ`: 결제 요청됨
- `OK`: 결제 성공
- `FAIL`: 결제 실패

### 12. 결제 완료 (콜백 시뮬레이션)

```http
POST https://api.highgarden.cloud/payments/callback
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "orderId": "주문 UUID",
  "paymentId": "결제 UUID",
  "status": "OK"
}
```

**status 값:**
- `OK`: 결제 성공
- `FAIL`: 결제 실패

**응답 (200 OK)**:
```json
{
  "paymentId": "결제 UUID",
  "orderId": "주문 UUID",
  "status": "OK",
  "method": "MOCK",
  "amount": 100000,
  "createdAt": "2025-11-03T12:31:00.000Z",
  "updatedAt": "2025-11-03T12:31:10.000Z"
}
```

**결제 완료 후:**
- 주문 상태가 `HOLD` → `PAID`로 변경됨
- GET /orders/{orderId}로 확인 가능

## API 헬스체크

### 13. API 헬스체크

```http
GET https://api.highgarden.cloud/health
```

**응답 (200 OK)**:
```json
{
  "status": "ok"
}
```

## 전체 사용자 여정

### 실제 웹 애플리케이션 플로우

```
1. POST /auth/login
   → accessToken 발급

2. WebSocket 연결 + emit('queue/join')
   → ticketId 발급

3. WebSocket on('queue:update') 수신
   → state가 READY가 될 때까지 대기
   → gateToken 발급됨

4. POST /queue/enter (gateToken 사용)
   → 입장 완료

5. GET /events
   → 이벤트 목록 조회

6. GET /events/{eventId}
   → 이벤트 상세 조회

7. POST /orders (Idempotency-Key 필수)
   → 주문 생성 (status: HOLD)

8. POST /payments
   → 결제 생성 (status: REQ)

9. POST /payments/callback
   → 결제 완료 (status: OK)

10. GET /orders/{orderId} (폴링)
    → 주문 상태 확인 (status: PAID)
```

### JMeter 테스트용 단순화 플로우

```
1. POST /auth/login
   → accessToken 발급

2. POST /queue/enqueue (REST API 사용)
   → ticketId 발급

3. GET /queue/status?ticketId={ticketId} (폴링)
   → state가 READY가 될 때까지 반복 (5초 간격)
   → gateToken 추출

4. POST /queue/enter (gateToken 사용)
   → 입장 완료

5. GET /events
   → 이벤트 목록 조회
   → eventId 추출

6. GET /events/{eventId}
   → 이벤트 상세 조회

7. POST /orders (Idempotency-Key 필수)
   → 주문 생성
   → orderId 추출

8. POST /payments
   → 결제 생성
   → paymentId 추출

9. POST /payments/callback
   → 결제 완료

10. GET /orders/{orderId}
    → 최종 주문 상태 확인
```

## 에러 응답

### 인증 에러 (401)

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Gate Token 에러 (403)

```json
{
  "statusCode": 403,
  "message": "Invalid gate token or gate token expired"
}
```

### Validation 에러 (400)

```json
{
  "statusCode": 400,
  "message": [
    "userId should not be empty",
    "password should not be empty"
  ],
  "error": "Bad Request"
}
```

### 재고 부족 (400)

```json
{
  "statusCode": 400,
  "message": "Not enough stock available"
}
```

### 1인당 구매 한도 초과 (400)

```json
{
  "statusCode": 400,
  "message": "Exceeded per-user limit for this event"
}
```

## 참고사항

1. **Idempotency-Key**: UUID v4 형식 사용 권장 (`crypto.randomUUID()`)
2. **폴링 간격**:
   - 대기열 상태: 5초
   - 주문 상태: 4초
3. **타임아웃**:
   - Gateway: 30초
   - API: 30초
4. **Rate Limiting**: 설정되어 있을 수 있으므로 과도한 요청 자제
5. **WebSocket vs REST**:
   - 실제 서비스: WebSocket 사용
   - 부하 테스트: REST API 사용 (단순화)

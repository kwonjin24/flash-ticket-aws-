# Smoke Test 시나리오 (수정됨)

코드 분석 결과를 반영한 정확한 Smoke Test 시나리오입니다.

## 목적

- 모든 API 엔드포인트가 정상 동작하는지 확인
- 배포 후 기본 기능 검증
- 다음 단계 테스트를 위한 사전 검증

## 테스트 설정

```yaml
사용자 수: 10명
Ramp-up 시간: 10초
테스트 기간: 1분
반복 횟수: 1회
```

## 시나리오 흐름

### 1. 로그인

```
POST https://gateway.highgarden.cloud/auth/login
Headers:
  Content-Type: application/json
Body:
{
  "userId": "test${__padLeft(${__threadNum},4,0)}",
  "password": "testtest"
}

Expected: 200 OK
Response:
{
  "accessToken": "...",
  "refreshToken": "..."
}

Extract: accessToken → JWT_TOKEN
```

> 주문/결제 단계에서는 고정 이벤트 ID `eabd190f-00bb-4f26-a539-997eacdad568`을 `EVENT_ID` 변수에 주입해 사용합니다.

### 2. 대기열 등록

```
POST https://gateway.highgarden.cloud/queue/enqueue
Headers:
  Authorization: Bearer ${JWT_TOKEN}
  Content-Type: application/json
Body:
{
  "eventId": "${EVENT_ID}"
}

Expected: 200 OK
Response:
{
  "ticketId": "..."
}

Extract: ticketId → TICKET_ID
```

### 3. 대기열 상태 폴링 (While Loop)

```
GET https://gateway.highgarden.cloud/queue/status?ticketId=${TICKET_ID}

Expected: 200 OK

Condition: ${QUEUE_STATE} != "READY" && ${pollingCount} < 10

Loop:
  GET https://gateway.highgarden.cloud/queue/status?ticketId=${TICKET_ID}

  Extract:
  - state → QUEUE_STATE
  - gateToken → GATE_TOKEN

  Wait: 4초 (ConfigMap `QUEUE_WS_REFRESH_MS`와 동일)
  pollingCount++

최대 10회 폴링 (40초)

폴링 완료 후에도 `QUEUE_STATE`가 READY가 아니면 테스트가 실패하도록 구성되어 있습니다.
```

### 4. 입장 (state가 READY일 때)

```
POST https://gateway.highgarden.cloud/queue/enter
Headers:
  Authorization: Bearer ${JWT_TOKEN}
  Content-Type: application/json
Body:
{
  "ticketId": "${TICKET_ID}",
  "gateToken": "${GATE_TOKEN}"
}

Expected: 200 OK
Response:
{
  "status": "entered"
}
```

### 5. 이벤트 상세 조회

```
GET https://api.highgarden.cloud/events/${EVENT_ID}
Headers:
  Authorization: Bearer ${JWT_TOKEN}

Expected: 200 OK
Response:
{
  "id": "...",
  "name": "...",
  "totalQty": 1000,
  "soldQty": 0,
  "maxPerUser": 4,
  "price": 50000
}
```

### 6. 주문 생성

```
POST https://api.highgarden.cloud/orders
Headers:
  Authorization: Bearer ${JWT_TOKEN}
  Idempotency-Key: ${__UUID}
  Content-Type: application/json
Body:
{
  "event_id": "${EVENT_ID}",
  "qty": 1
}

Expected: 200 OK
Response:
{
  "orderId": "...",
  "status": "HOLD",
  "amount": 50000,
  "qty": 1,
  "eventId": "...",
  "eventName": "..."
}

Extract:
- orderId → ORDER_ID
- amount → AMOUNT
```

### 7. 결제 생성

```
POST https://api.highgarden.cloud/payments
Headers:
  Authorization: Bearer ${JWT_TOKEN}
  Content-Type: application/json
Body:
{
  "orderId": "${ORDER_ID}",
  "method": "MOCK"
}

Expected: 200 OK
Response:
{
  "paymentId": "...",
  "orderId": "...",
  "status": "REQ",
  "method": "MOCK",
  "amount": 50000
}

Extract: paymentId → PAYMENT_ID
```

### 8. 결제 완료 (콜백)

```
POST https://api.highgarden.cloud/payments/callback
Headers:
  Authorization: Bearer ${JWT_TOKEN}
  Content-Type: application/json
Body:
{
  "orderId": "${ORDER_ID}",
  "paymentId": "${PAYMENT_ID}",
  "status": "OK"
}

Expected: 200 OK
Response:
{
  "paymentId": "...",
  "orderId": "...",
  "status": "OK",
  "method": "MOCK",
  "amount": 50000
}
```

### 9. 주문 확인

```
GET https://api.highgarden.cloud/orders/${ORDER_ID}
Headers:
  Authorization: Bearer ${JWT_TOKEN}

Expected: 200 OK
Response:
{
  "orderId": "...",
  "status": "PAID",
  "amount": 50000,
  "qty": 1,
  "eventId": "...",
  "eventName": "..."
}
```

## 검증 항목

### 응답 시간
- [ ] 평균 응답 시간 < 1초
- [ ] 최대 응답 시간 < 3초

### 성공률
- [ ] 모든 요청 성공 (200 OK)
- [ ] 에러율 0%

### 데이터 정합성
- [ ] accessToken 정상 발급
- [ ] ticketId 정상 생성
- [ ] gateToken 정상 발급 (READY 상태일 때)
- [ ] orderId 정상 생성
- [ ] paymentId 정상 생성
- [ ] 최종 주문 상태가 PAID

## JMeter 설정

### Thread Group

```
Number of Threads: 10
Ramp-up Period: 10 seconds
Loop Count: 1
Scheduler: Unchecked
```

### User Defined Variables

```
GATEWAY_URL: https://gateway.highgarden.cloud
API_URL: https://api.highgarden.cloud
EVENT_ID: eabd190f-00bb-4f26-a539-997eacdad568
GLOBAL_EVENT_ID: __global__
QUEUE_WS_REFRESH_MS: 4000
POLLING_MAX: 10
```

### CSV Data Set Config (선택)

```csv
userId,password
test0000,testtest
test0001,testtest
test0002,testtest
test0003,testtest
test0004,testtest
test0005,testtest
test0006,testtest
test0007,testtest
test0008,testtest
test0009,testtest
```

### Assertions

```
Response Assertion:
- Response Code: 200

JSON Assertion:
- POST /auth/login: $.accessToken exists
- POST /queue/enqueue: $.ticketId exists
- GET /queue/status: $.state exists
- POST /orders: $.orderId exists
- POST /payments: $.paymentId exists
- GET /orders/{id}: $.status == "PAID"
```

### Listeners

```
- View Results Tree (디버깅용)
- Summary Report
- Aggregate Report
```

## 실행 방법

### GUI 모드 (개발/디버깅)

```bash
jmeter -t scenarios/01-smoke-test.jmx
```

### CLI 모드 (자동화)

```bash
jmeter -n -t scenarios/01-smoke-test.jmx \
  -l results/smoke-test.jtl \
  -e -o results/smoke-test-report
```

### CI/CD 파이프라인 통합

```bash
#!/bin/bash
# smoke-test.sh

echo "Running Smoke Test..."

jmeter -n -t scenarios/01-smoke-test.jmx \
  -l results/smoke-test-$(date +%Y%m%d-%H%M%S).jtl \
  -e -o results/smoke-report-$(date +%Y%m%d-%H%M%S)

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Smoke Test PASSED"
else
  echo "❌ Smoke Test FAILED"
  exit 1
fi
```

## 예상 결과

```
Summary Report:
- Samples: 130 (10 users × 13 requests)
- Average: 200-500ms
- Min: 50ms
- Max: 1000ms
- Error%: 0.00%
- Throughput: 10-20 requests/sec
```

## 트러블슈팅

### 401 Unauthorized

```
원인: accessToken이 제대로 추출되지 않음
해결:
1. JSON Extractor 설정 확인
   - Variable name: JWT_TOKEN
   - JSON Path: $.accessToken
   - Match No: 1

2. HTTP Header Manager 확인
   - Authorization: Bearer ${JWT_TOKEN}
```

### 400 Bad Request (로그인)

```
원인: userId 형식이 잘못됨
해결:
- userId는 "test0000" ~ "test0999" 형식
- ${__padLeft(${__threadNum},4,0)} 사용
```

### 403 Forbidden (queue/enter)

```
원인: gateToken이 만료되었거나 잘못됨
해결:
1. 폴링 후 즉시 enter 호출
2. gateToken 추출 확인
3. ticketId와 gateToken 매칭 확인
```

### 409 Conflict (주문 생성)

```
원인: Idempotency-Key 중복
해결:
- ${__UUID} 함수 사용 확인
- 매 요청마다 새로운 UUID 생성
```

### Connection Timeout

```
원인: 네트워크 또는 서버 문제
해결:
1. 서버 상태 확인
   kubectl get pods -n flash-ticket

2. 네트워크 연결 확인
   ping gateway.highgarden.cloud
   ping api.highgarden.cloud

3. Timeout 설정 증가
   - Connect Timeout: 30000ms
   - Response Timeout: 30000ms
```

### 대기열 폴링 타임아웃

```
원인: READY 상태가 되지 않음
해결:
1. POLLING_MAX 증가 (10 → 20)
2. 대기열 설정 확인
   - Ready Capacity 확인
   - Promotion 간격 확인
3. 서버 로그 확인
   kubectl logs -n flash-ticket -l app=flash-gateway
```

### eventId 추출 실패

```
원인: 이벤트가 없거나 응답 형식이 다름
해결:
1. 이벤트 데이터 확인
   curl https://api.highgarden.cloud/events

2. JSON Extractor 확인
   - JSON Path: $[0].id (배열의 첫 번째 요소)
   - Default Value: ERROR
```

## 성공 기준

✅ **통과 조건**:
1. 모든 요청이 200 OK
2. 에러율 0%
3. 모든 변수 정상 추출
4. 최종 주문 상태가 PAID
5. 평균 응답 시간 < 1초

❌ **실패 조건**:
1. 하나라도 에러 발생
2. 변수 추출 실패
3. 최종 주문 상태가 PAID가 아님
4. 평균 응답 시간 > 3초

## 다음 단계

Smoke Test 성공 후:
1. [Load Test](02-load-test.md) 진행
2. 성능 베이스라인 수립
3. 본격적인 부하 테스트

## 참고

- [정확한 API 스펙](../API-SPEC.md)
- [JMeter 설정 가이드](../jmeter-setup.md)
- [테스트 계획](../test-plan.md)

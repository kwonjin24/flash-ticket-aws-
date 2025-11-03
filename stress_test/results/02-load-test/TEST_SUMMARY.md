# 02 Load Test 결과 요약

## 테스트 일시
- 2025년 11월 3일 15:07 ~ 15:08 (50초 소요)

## 테스트 구성
- **동시 사용자**: 50명
- **Ramp-up 시간**: 30초
- **Event ID**: `60ebfb32-5f71-440f-b402-117674421f77`
- **테스트 데이터**: CSV 파일 (test0000 ~ test0049)

## 전체 결과

```
총 요청 수: 900개
처리량: 18.0 req/s
평균 응답시간: 40ms
최소 응답시간: 9ms
최대 응답시간: 565ms
에러율: 120개 실패 (13.33%)
```

## 단계별 결과

| 단계 | 성공 | 실패 | 성공률 | 비고 |
|------|------|------|--------|------|
| 1. Login | 50 | 0 | 100% | ✅ |
| 2. Enqueue | 50 | 0 | 100% | ✅ |
| Queue Status Check | 500 | 0 | 100% | ✅ (10회 폴링) |
| 4. Enter Queue | 50 | 0 | 100% | ✅ |
| 5. Get Event Detail | 50 | 0 | 100% | ✅ |
| 6. Create Order | 20 | 30 | 40% | ⚠️ 400 Bad Request |
| 7. Create Payment | 20 | 30 | 40% | ⚠️ 400 Bad Request |
| 8. Payment Callback | 20 | 30 | 40% | ⚠️ 400 Bad Request |
| 9. Verify Order | 20 | 30 | 40% | ⚠️ 500 Internal Server Error |

## 성공한 플로우

**20명의 사용자가 완전한 여정을 성공적으로 완료했습니다:**

```
1. Login (POST) → 201 Created
2. Enqueue (POST) → 201 Created
3. Queue Status (GET × 10) → 200 OK
4. Enter Queue (POST) → 201 Created
5. Get Event Detail (GET) → 200 OK
6. Create Order (POST) → 201 Created
7. Create Payment (POST) → 201 Created
8. Payment Callback (POST) → 201 Created
9. Verify Order (GET) → 200 OK
```

## 실패 분석

### 주문 생성 실패 (30명)
- **HTTP 상태**: 400 Bad Request
- **원인 추정**:
  - 이벤트 재고 부족 (20장만 남은 상황)
  - 또는 per-user limit 적용 (일부 계정이 이미 구매)
- **패턴**: 처음 20명 성공 후, 나머지 30명 모두 실패

### 연쇄 실패
주문 생성이 실패한 30명의 사용자는:
- Payment 생성 실패 (400)
- Payment Callback 실패 (400)
- Order 조회 실패 (500)

이것은 예상된 동작입니다 (주문이 없으면 결제도 불가능).

## 성능 지표

### 응답 시간 분포
```
평균: 40ms
최소: 9ms (대기열 상태 확인)
최대: 565ms (로그인)
```

### 처리량
```
초당 요청: 18.0 req/s
50초 동안 900개 요청 처리
```

### 대기열 성능
- 50명 사용자 모두 대기열 통과 성공
- 폴링 10회 × 50명 = 500개 요청 모두 성공
- 평균 폴링 응답시간: ~30ms

## 수정 사항

### 첫 번째 시도 (실패)
**문제점:**
1. JSONPostProcessor에서 두 변수를 한번에 추출 시도 (`match_numbers: 1,1`)
2. WhileController의 JavaScript 조건문 오류

**오류:**
```
NumberFormatException: For input string: "1,1"
JavaScript: missing ; before statement
```

### 수정 후 (성공)
1. JSONPostProcessor를 두 개로 분리:
   - Extract state (queueState)
   - Extract gateToken (gateToken)
2. WhileController → LoopController로 변경 (10회 고정 반복)

## 시스템 병목점

### ✅ 병목이 없는 부분
- 인증 시스템 (50명 동시 로그인 처리)
- 대기열 시스템 (50명 동시 큐잉, 500회 상태 조회)
- 이벤트 조회 (50명 동시 조회)

### ⚠️ 제한이 있는 부분
- 주문 생성: 20명만 성공 (60% 실패율)
  - 원인: 이벤트 재고 제한 또는 비즈니스 로직

## 결론

### ✅ 성공 사항
1. **전체 플로우 검증 완료**: 20명이 처음부터 끝까지 성공
2. **대기열 시스템 안정성**: 100% 성공률, 50명 동시 처리
3. **인증/권한 시스템**: 100% 성공률
4. **응답 시간 우수**: 평균 40ms, 최대 565ms
5. **처리량 양호**: 18 req/s (900개 요청 / 50초)

### ⚠️ 발견된 제한
1. **주문 시스템**: 30명 실패 (재고 또는 limit 제한)
2. **에러 응답 개선 필요**: 500 에러 발생 (주문 없을 때)

## 다음 단계 권장사항

### 1. 재고 관리 확인
- 이벤트 재고를 늘려서 50명 모두 구매 가능하도록 설정
- 또는 대량 재고가 있는 이벤트로 테스트

### 2. 동시성 테스트 확대
- 100명 → 500명 → 1000명으로 점진적 증가
- 현재 50명에서 20명 성공 = 40% 성공률
- 재고 문제 해결 후 더 많은 사용자 테스트

### 3. 스트레스 테스트
- Ramp-up 시간 단축 (30초 → 10초 → 5초)
- 순간적인 트래픽 폭증 시뮬레이션

### 4. 에러 처리 개선
- 재고 부족 시 명확한 에러 메시지
- 500 에러 대신 400 에러로 통일

## 생성된 파일

### 테스트 시나리오
- `scenarios/02-load-test.jmx`: 50명 동시 사용자 전체 플로우 테스트

### 결과 파일
- `results/02-load-test/load-test-20251103-150332.jtl`: 첫 번째 시도 (실패)
- `results/02-load-test/load-test-retry-20251103-150754.jtl`: 수정 후 재시도 (성공)
- `results/02-load-test/load-test.log`: 첫 번째 시도 로그
- `results/02-load-test/load-test-retry.log`: 재시도 로그
- `results/02-load-test/TEST_SUMMARY.md`: 본 파일

## 참고사항

### JMeter 설정
- 버전: 5.6.3
- Java: OpenJDK 21
- Heap: 1GB

### API 엔드포인트
- Gateway: `https://gateway.highgarden.cloud`
- API: `https://api.highgarden.cloud`

### 테스트 계정
- CSV 파일: `test-users.csv`
- 계정 범위: test0000 ~ test0049 (50개)
- 비밀번호: testtest

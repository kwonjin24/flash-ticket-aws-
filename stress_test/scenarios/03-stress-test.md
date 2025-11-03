# Stress Test 시나리오

시스템의 한계를 찾기 위한 극한 부하 테스트입니다.

## 목적

- 시스템의 최대 처리 능력 측정
- Breaking Point (임계점) 식별
- 병목 구간 파악
- 장애 복구 능력 확인

## 테스트 설정

```yaml
Phase 1: 1000 users (5분)
Phase 2: 2000 users (5분)
Phase 3: 3500 users (5분)
Phase 4: 5000 users (5분)

총 테스트 시간: 20분
Ramp-up: 각 단계마다 1-2분
```

## 시나리오

Load Test와 동일한 사용자 여정, 단 더 많은 동시 사용자.

## 예상 결과

```
1000 users: 정상 동작
2000 users: 응답 시간 증가 시작
3500 users: 에러율 증가
5000 users: 시스템 임계점
```

## 모니터링 포인트

- Breaking Point 식별
- 리소스 고갈 시점
- Auto Scaling 최대치
- 복구 시간

## 다음: [Spike Test](04-spike-test.md)

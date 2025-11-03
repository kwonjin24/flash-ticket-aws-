# Spike Test 시나리오

갑작스런 트래픽 급증 상황 테스트입니다.

## 목적

- 트래픽 급증 시 시스템 대응 능력 확인
- Auto Scaling 반응 시간 측정
- 복구 시간 측정

## 테스트 설정

```yaml
Phase 1: 10 users (2분) - 기준선
Phase 2: 1000 users (10초 Ramp-up) - 급증
Phase 3: 1000 users (10분 유지)
Phase 4: 10 users (10초 Ramp-down) - 복구
Phase 5: 10 users (2분) - 안정화

총 시간: 약 15분
```

## 검증 항목

- 급증 시 에러율 < 5%
- Auto Scaling 동작 시간 < 2분
- 복구 시간 < 2분
- 시스템 완전 복구 확인

## 다음: [Endurance Test](05-endurance-test.md)

# Endurance Test 시나리오

장시간 운영 안정성 테스트입니다.

## 목적

- 장시간 운영 시 안정성 확인
- 메모리 누수 검증
- Connection Leak 확인
- 성능 저하 여부 확인

## 테스트 설정

```yaml
사용자 수: 200명 (일정)
Ramp-up: 5분
테스트 기간: 1시간
```

## 모니터링

### 1분마다 수집

```
- Memory Usage
- CPU Usage
- Heap Memory
- Thread Count
- Connection Pool
- Response Time
```

## 검증 항목

- 메모리 사용량이 일정 수준 유지
- 응답 시간 변화 < 10%
- Connection Pool 안정적
- 에러율 일정

## 실행 명령

```bash
jmeter -n -t scenarios/05-endurance-test.jmx \
  -JTHREADS=200 \
  -JRAMP_UP=300 \
  -JDURATION=3600 \
  -l results/endurance-test.jtl \
  -e -o results/endurance-report
```

## 다음: 최종 보고서 작성

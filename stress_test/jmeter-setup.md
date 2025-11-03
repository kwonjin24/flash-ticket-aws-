# JMeter 설치 및 설정 가이드

Apache JMeter를 사용한 부하 테스트 환경 설정 가이드입니다.

## 목차

1. [JMeter 설치](#jmeter-설치)
2. [기본 설정](#기본-설정)
3. [Test Plan 구성](#test-plan-구성)
4. [플러그인 설치](#플러그인-설치)
5. [CLI 실행](#cli-실행)
6. [결과 분석](#결과-분석)

---

## JMeter 설치

### macOS

```bash
# Homebrew 사용
brew install jmeter

# 설치 확인
jmeter --version
```

### Linux (Ubuntu/Debian)

```bash
# Java 설치 (JMeter 실행 요구사항)
sudo apt update
sudo apt install openjdk-11-jdk

# JMeter 다운로드
wget https://downloads.apache.org/jmeter/binaries/apache-jmeter-5.6.3.tgz
tar -xzf apache-jmeter-5.6.3.tgz
cd apache-jmeter-5.6.3

# 실행
./bin/jmeter
```

### Windows

1. [JMeter 다운로드 페이지](https://jmeter.apache.org/download_jmeter.cgi)에서 ZIP 파일 다운로드
2. 압축 해제
3. `bin/jmeter.bat` 실행

---

## 기본 설정

### JMeter 설정 파일

`jmeter.properties` 파일 수정:

```properties
# 최대 힙 메모리 설정 (jmeter 스크립트에서 설정)
# export HEAP="-Xms1g -Xmx1g -XX:MaxMetaspaceSize=256m"

# SSL 인증서 검증 비활성화 (테스트 환경)
https.socket.protocols=TLSv1.2,TLSv1.3

# 연결 타임아웃
httpclient.timeout=60000

# 최대 연결 수
hc.parameters.file=hc.parameters

# 로그 레벨
log_level.jmeter=INFO
```

### 환경 변수 설정

테스트 실행 전 환경 변수 설정:

```bash
# .env 파일 생성
cat > .env << 'EOF'
GATEWAY_URL=https://gateway.highgarden.cloud
API_URL=https://api.highgarden.cloud
WEB_URL=https://www.highgarden.cloud

# 테스트 설정
THREAD_COUNT=100
RAMP_UP_TIME=60
DURATION=600
EOF

# 환경 변수 로드
source .env
```

---

## Test Plan 구성

### 1. 기본 구조

```
Test Plan
├── User Defined Variables (전역 변수)
├── HTTP Request Defaults (공통 설정)
├── HTTP Header Manager (공통 헤더)
├── Thread Group (사용자 시뮬레이션)
│   ├── Setup Thread Group (초기화)
│   │   └── Login Request
│   ├── Main Thread Group (메인 테스트)
│   │   ├── Queue Enqueue
│   │   ├── Queue Status Poll
│   │   ├── Queue Enter
│   │   └── Order Create
│   └── Teardown Thread Group (정리)
├── Listeners (결과 수집)
│   ├── View Results Tree
│   ├── Summary Report
│   ├── Aggregate Report
│   └── Response Time Graph
└── Assertions (검증)
    ├── Response Assertion
    └── JSON Assertion
```

### 2. User Defined Variables

테스트 전반에 사용할 변수 정의:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| GATEWAY_HOST | gateway.highgarden.cloud | Gateway 도메인 |
| API_HOST | api.highgarden.cloud | API 도메인 |
| PROTOCOL | https | 프로토콜 |
| PORT | 443 | 포트 |
| THREADS | 100 | 동시 사용자 수 |
| RAMP_UP | 60 | Ramp-up 시간 (초) |
| LOOP_COUNT | 10 | 반복 횟수 |

### 3. HTTP Request Defaults

모든 HTTP 요청에 적용되는 기본 설정:

```
Protocol: ${PROTOCOL}
Server Name: ${GATEWAY_HOST}
Port: ${PORT}
Connect Timeout: 30000
Response Timeout: 30000
Follow Redirects: ✓
Use KeepAlive: ✓
```

### 4. HTTP Header Manager

공통 HTTP 헤더:

```
Content-Type: application/json
Accept: application/json
User-Agent: JMeter-StressTest/1.0
```

### 5. Thread Group 설정

#### Setup Thread Group (초기화)

```
Number of Threads: 1
Ramp-up Period: 1
Loop Count: 1
Action after error: Stop Thread
```

**용도**: 테스트 사용자 로그인 및 토큰 획득

#### Main Thread Group

```
Number of Threads: ${THREADS}
Ramp-up Period: ${RAMP_UP}
Loop Count: ${LOOP_COUNT}
Scheduler: ✓
Duration (seconds): 600
```

**용도**: 실제 부하 테스트 시뮬레이션

---

## 플러그인 설치

### JMeter Plugins Manager 설치

1. [Plugins Manager JAR](https://jmeter-plugins.org/get/) 다운로드
2. `lib/ext/` 디렉토리에 복사
3. JMeter 재시작

### 추천 플러그인

```bash
# Options > Plugins Manager 에서 설치

1. Custom Thread Groups
   - Ultimate Thread Group (복잡한 부하 패턴)
   - Stepping Thread Group (단계적 증가)

2. 3 Basic Graphs
   - Response Times Over Time
   - Transactions Per Second
   - Active Threads Over Time

3. PerfMon (Servers Performance Monitoring)
   - 서버 리소스 모니터링

4. JSON Plugins
   - JSON Extractor
   - JSON Assertion
```

---

## CLI 실행

### 기본 실행

```bash
# GUI 모드 (테스트 개발용)
jmeter -t scripts/load-test.jmx

# CLI 모드 (실제 부하 테스트용)
jmeter -n -t scripts/load-test.jmx \
  -l results/result.jtl \
  -e -o results/report
```

### 옵션 설명

| 옵션 | 설명 |
|------|------|
| `-n` | Non-GUI 모드 |
| `-t` | Test plan 파일 |
| `-l` | 결과 로그 파일 (JTL) |
| `-e` | 테스트 완료 후 HTML 리포트 생성 |
| `-o` | HTML 리포트 출력 디렉토리 |
| `-J` | JMeter 속성 설정 |
| `-G` | 전역 속성 파일 |

### 매개변수 전달

```bash
# 사용자 수와 ramp-up 시간 변경
jmeter -n -t scripts/load-test.jmx \
  -JTHREADS=500 \
  -JRAMP_UP=120 \
  -l results/load-500users.jtl \
  -e -o results/report-500users
```

### 분산 테스트 (Distributed Testing)

여러 머신에서 동시에 부하 생성:

```bash
# Master 노드에서 실행
jmeter -n -t test.jmx \
  -R server1,server2,server3 \
  -l results/distributed.jtl

# 각 Slave 노드에서 jmeter-server 실행
jmeter-server -Djava.rmi.server.hostname=192.168.1.100
```

---

## 결과 분석

### JTL 파일

Raw 데이터 파일 (CSV 형식):

```csv
timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect
1699012345678,234,Login,200,OK,Thread Group 1-1,text,true,,1234,567,100,100,https://gateway.highgarden.cloud/auth/login,123,0,45
```

### HTML Dashboard

```bash
# 기존 JTL 파일로 HTML 리포트 생성
jmeter -g results/result.jtl -o results/dashboard
```

**Dashboard 구성**:
- **Test and Report Information**: 테스트 개요
- **APDEX (Application Performance Index)**: 성능 지수
- **Requests Summary**: 요청 통계
- **Statistics**: 상세 통계
- **Errors**: 에러 분석
- **Top 5 Errors**: 주요 에러
- **Response Times Over Time**: 응답 시간 추이
- **Throughput Over Time**: 처리량 추이
- **Response Time Percentiles**: 백분위수 분포

### 주요 메트릭

#### 1. 응답 시간 (Response Time)

```
Average: 평균 응답 시간
Min: 최소 응답 시간
Max: 최대 응답 시간
90th pct: 90% 요청의 응답 시간
95th pct: 95% 요청의 응답 시간
99th pct: 99% 요청의 응답 시간
```

#### 2. 처리량 (Throughput)

```
Throughput: 초당 처리 요청 수 (requests/sec)
KB/sec: 초당 전송 데이터 (KB/sec)
```

#### 3. 에러율 (Error Rate)

```
Error %: 전체 요청 중 실패한 요청 비율
Error Count: 실패한 요청 수
```

### Grafana 연동

JMeter 결과를 Grafana로 시각화:

```bash
# InfluxDB에 실시간 결과 전송
jmeter -n -t test.jmx \
  -JinfluxdbUrl=http://localhost:8086 \
  -JinfluxdbDatabase=jmeter \
  -l results/result.jtl
```

---

## 모범 사례 (Best Practices)

### 1. GUI vs CLI

- **GUI 모드**: 테스트 개발 및 디버깅에만 사용
- **CLI 모드**: 실제 부하 테스트 실행

### 2. 리소스 관리

```bash
# JVM 힙 메모리 증가
export HEAP="-Xms2g -Xmx4g"

# 최대 파일 디스크립터 증가
ulimit -n 65536
```

### 3. 결과 저장

```bash
# 타임스탬프 포함 결과 저장
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
jmeter -n -t test.jmx \
  -l results/result-${TIMESTAMP}.jtl \
  -j logs/jmeter-${TIMESTAMP}.log \
  -e -o results/report-${TIMESTAMP}
```

### 4. 단계별 테스트

```
1. Smoke Test: 10 users, 1분
2. Load Test: 100 users, 10분
3. Stress Test: 500 users, 20분
4. Spike Test: 10 → 1000 → 10, 15분
5. Endurance Test: 200 users, 1시간
```

### 5. 병목 구간 식별

```
1. 응답 시간이 급증하는 구간 확인
2. 에러율이 증가하는 지점 확인
3. 서버 리소스 (CPU/Memory) 모니터링
4. 데이터베이스 쿼리 성능 확인
5. 네트워크 대역폭 확인
```

---

## 트러블슈팅

### 1. Connection Timeout

```
문제: java.net.ConnectException: Connection timed out
해결:
- HTTP Request Defaults에서 timeout 증가
- 서버 max connections 확인
- 네트워크 방화벽 확인
```

### 2. OutOfMemoryError

```
문제: java.lang.OutOfMemoryError: Java heap space
해결:
- HEAP 메모리 증가: export HEAP="-Xms2g -Xmx4g"
- Listener 최소화 (특히 View Results Tree)
- 불필요한 데이터 저장 줄이기
```

### 3. Too Many Open Files

```
문제: java.io.IOException: Too many open files
해결:
- ulimit -n 65536
- /etc/security/limits.conf 수정
```

---

## 다음 단계

1. [테스트 계획](test-plan.md) 검토
2. [시나리오별 가이드](scenarios/) 참고
3. `scripts/` 디렉토리의 JMX 파일 실행
4. 결과 분석 및 최적화

## 참고 자료

- [Apache JMeter 공식 문서](https://jmeter.apache.org/usermanual/index.html)
- [JMeter Best Practices](https://jmeter.apache.org/usermanual/best-practices.html)
- [JMeter Plugins](https://jmeter-plugins.org/)

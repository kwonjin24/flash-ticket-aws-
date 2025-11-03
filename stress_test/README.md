# Flash Tickets 부하 테스트 가이드

Flash Tickets 시스템에 대한 Apache JMeter 부하 테스트 문서입니다.

## 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [테스트 환경](#테스트-환경)
4. [테스트 시나리오](#테스트-시나리오)
5. [JMeter 설정](#jmeter-설정)
6. [실행 방법](#실행-방법)
7. [결과 분석](#결과-분석)

## 개요

Flash Tickets는 이벤트 티켓 예매 시스템으로, 대기열 기반의 선착순 티켓 판매를 지원합니다.

### 주요 기능
- 사용자 인증 (회원가입/로그인)
- 이벤트 조회
- 대기열 시스템 (Queue)
- 주문 생성 및 결제
- 실시간 대기열 상태 확인

### 부하 테스트 목표
- **대기열 시스템 성능 검증**: 동시 접속자 처리 능력
- **병목 구간 식별**: API/Gateway/Database 성능 측정
- **Auto Scaling 동작 검증**: Karpenter 기반 노드 자동 확장
- **시스템 한계치 측정**: 최대 처리 가능한 TPS 확인

## 시스템 아키텍처

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         ALB (AWS)                   │
│  - api.highgarden.cloud            │
│  - gateway.highgarden.cloud        │
│  - www.highgarden.cloud            │
└──────┬──────────────────────────────┘
       │
       ▼
┌──────────────────────┬─────────────────────┐
│                      │                     │
▼                      ▼                     ▼
┌────────────┐  ┌──────────────┐  ┌──────────────┐
│  Gateway   │  │     API      │  │     Web      │
│  (Queue)   │  │   (Orders)   │  │  (Frontend)  │
│  Port:3000 │  │   Port:4000  │  │   Port:80    │
└─────┬──────┘  └──────┬───────┘  └──────────────┘
      │                │
      │         ┌──────┴──────┐
      │         │             │
      ▼         ▼             ▼
┌──────────┐  ┌──────┐  ┌──────────┐
│  Redis   │  │  RDS │  │ RabbitMQ │
│ (Queue)  │  │ (PG) │  │  (Pay)   │
└──────────┘  └──────┘  └──────────┘
```

## 테스트 환경

### 인프라
- **Kubernetes**: EKS
- **Node Scaling**: Karpenter
- **Ingress**: AWS ALB
- **Monitoring**: Prometheus + Grafana

### 서비스 구성
- **Gateway**: 대기열 관리 (Redis 기반)
- **API**: 주문/이벤트 처리 (PostgreSQL)
- **Pay**: 결제 처리 (RabbitMQ)

### 리소스 설정
현재 각 서비스의 리소스 할당:
```yaml
# Gateway
requests: cpu 100m, memory 128Mi
limits: cpu 200m, memory 256Mi

# API
requests: cpu 100m, memory 128Mi
limits: cpu 200m, memory 256Mi
```

## 테스트 시나리오

### 1. Smoke Test (기본 동작 검증)
- 목적: 모든 API 엔드포인트 정상 동작 확인
- 사용자: 10명
- 기간: 1분
- 시나리오: [scenarios/01-smoke-test.md](scenarios/01-smoke-test.md)

### 2. Load Test (부하 테스트)
- 목적: 일반적인 트래픽 처리 능력 확인
- 사용자: 100-500명
- 기간: 10분
- 시나리오: [scenarios/02-load-test.md](scenarios/02-load-test.md)

### 3. Stress Test (스트레스 테스트)
- 목적: 시스템 한계 확인
- 사용자: 1000-5000명
- 기간: 20분
- 시나리오: [scenarios/03-stress-test.md](scenarios/03-stress-test.md)

### 4. Spike Test (급증 테스트)
- 목적: 트래픽 급증 상황 대응 확인
- 사용자: 10 → 1000 → 10
- 기간: 15분
- 시나리오: [scenarios/04-spike-test.md](scenarios/04-spike-test.md)

### 5. Endurance Test (지속성 테스트)
- 목적: 장시간 운영 시 메모리 누수 등 확인
- 사용자: 200명
- 기간: 1시간
- 시나리오: [scenarios/05-endurance-test.md](scenarios/05-endurance-test.md)

## JMeter 설정

자세한 JMeter 설치 및 설정은 [jmeter-setup.md](jmeter-setup.md)를 참고하세요.

### 빠른 시작

```bash
# JMeter 다운로드 (macOS)
brew install jmeter

# JMeter 실행
jmeter

# CLI 모드 실행
jmeter -n -t scenarios/load-test.jmx -l results/load-test-result.jtl
```

## 실행 방법

### 1. 사전 준비

```bash
# 환경 변수 설정
export GATEWAY_URL="https://gateway.highgarden.cloud"
export API_URL="https://api.highgarden.cloud"

# 테스트 계정 생성 (선택사항)
# scripts/create-test-users.sh 스크립트 실행
```

### 2. 테스트 실행

```bash
# GUI 모드 (테스트 개발/디버깅)
jmeter -t scenarios/load-test.jmx

# CLI 모드 (실제 부하 테스트)
jmeter -n -t scenarios/load-test.jmx \
  -l results/load-test-$(date +%Y%m%d-%H%M%S).jtl \
  -e -o results/load-test-report-$(date +%Y%m%d-%H%M%S)
```

### 3. 모니터링

테스트 실행 중 다음을 모니터링:

```bash
# Grafana 대시보드
https://grafana.highgarden.cloud

# Pod 상태 확인
kubectl get pods -n flash-ticket -w

# 리소스 사용량 확인
kubectl top pods -n flash-ticket
kubectl top nodes

# Karpenter 로그 확인
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter -f
```

## 결과 분석

### 주요 지표

1. **응답 시간 (Response Time)**
   - 평균: < 500ms (목표)
   - 95 percentile: < 1000ms
   - 99 percentile: < 2000ms

2. **처리량 (Throughput)**
   - TPS (Transactions Per Second)
   - 목표: 대기열 등록 100 TPS 이상

3. **에러율 (Error Rate)**
   - 목표: < 1%

4. **리소스 사용률**
   - CPU: < 80%
   - Memory: < 80%
   - Network I/O

### 결과 파일

```
results/
├── load-test-20251029-150000.jtl      # Raw 데이터
├── load-test-report-20251029-150000/  # HTML 리포트
│   ├── index.html
│   ├── statistics.json
│   └── ...
└── screenshots/                        # Grafana 스크린샷
```

## 문서 구조

```
stress_test/
├── README.md                    # 이 파일
├── endpoints.md                 # API 엔드포인트 목록
├── jmeter-setup.md             # JMeter 설치 및 설정
├── test-plan.md                # 상세 테스트 계획
├── scenarios/                  # 시나리오별 문서
│   ├── 01-smoke-test.md
│   ├── 02-load-test.md
│   ├── 03-stress-test.md
│   ├── 04-spike-test.md
│   └── 05-endurance-test.md
├── scripts/                    # 스크립트 및 JMX 파일
│   ├── create-test-users.sh
│   ├── load-test.jmx
│   └── stress-test.jmx
└── results/                    # 테스트 결과
```

## 다음 단계

1. [API 엔드포인트 목록](endpoints.md) 확인
2. [JMeter 설정 가이드](jmeter-setup.md) 참고하여 환경 구성
3. [테스트 계획](test-plan.md) 검토
4. 시나리오별 테스트 수행
5. 결과 분석 및 최적화

## 참고 자료

- [Apache JMeter 공식 문서](https://jmeter.apache.org/usermanual/index.html)
- [Kubernetes 리소스 모니터링](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
- [Karpenter 문서](https://karpenter.sh/docs/)

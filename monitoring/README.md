# Monitoring Sample - CloudWatch + Prometheus + Grafana on EKS

Flash Ticket EKS 클러스터의 모니터링 인프라 구성 및 대시보드 샘플입니다.

**주요 업데이트 (2025-11-03):**
- ✅ CloudWatch Logs Insights 기반 ALB 분석 (레이턴시, 에러율)
- ✅ CloudWatch 기반 AmazonMQ 로깅
- ✅ Alertmanager 제거 (CloudWatch Alarms로 전환 예정)

## 📁 디렉토리 구조

```
monitoring-sample/
├── dashboards/              # Grafana 대시보드 JSON 파일
│   ├── system-overview-20251102-modified.json      # 최신 시스템 대시보드 (ALB + AmazonMQ)
│   ├── business-overview-*.json                     # 비즈니스 메트릭 대시보드
│   └── README.md
├── kubernetes/              # Kubernetes 배포 설정 파일 (정리됨)
│   ├── namespace.yaml
│   ├── prometheus.yaml                      # Alert rules 제거됨
│   ├── grafana.yaml
│   ├── prometheus-config.yaml               # Alertmanager 설정 제거됨
│   ├── storage.yaml
│   └── README.md
├── Lambda/                  # AWS Lambda 함수
│   └── alb-log-processor.py                 # ALB 로그 파싱 → CloudWatch Logs 전송
└── README.md (이 파일)
```

## 🚀 빠른 시작

### 1단계: Kubernetes 리소스 배포

```bash
# monitoring 네임스페이스 생성
kubectl apply -f monitoring-sample/kubernetes/namespace.yaml

# 스토리지 생성
kubectl apply -f monitoring-sample/kubernetes/storage.yaml

# Prometheus, Grafana 배포 (Alertmanager 제거됨)
kubectl apply -f monitoring-sample/kubernetes/prometheus-config.yaml
kubectl apply -f monitoring-sample/kubernetes/prometheus.yaml
kubectl apply -f monitoring-sample/kubernetes/grafana.yaml
```

### 2단계: Grafana 접근

```bash
# Port Forward
kubectl port-forward -n monitoring svc/grafana 3000:3000

# 브라우저에서 접속
# http://localhost:3000
# 기본 계정: admin / admin
```

### 3단계: 대시보드 Import

Grafana UI에서:
1. **Dashboards** → **+ New** → **Import**
2. 파일 선택:
   - `monitoring-sample/dashboards/system-overview-20251031.json`
   - `monitoring-sample/dashboards/business-overview-20251031.json`

## 📊 포함된 대시보드

### System Overview Dashboard
- Pod 리소스 메트릭 (CPU, Memory - Limit 기준)
- Node 리소스 메트릭
- Network 트래픽
- HTTP 메트릭 (Request Rate, Success Rate)
- Database 메트릭 (Connection, Cache, I/O, Row Operations)

### Business Overview Dashboard
- 실시간 메트릭: Queue, Order, Payment 상태
- 시간 추이: Orders Created, Payment Success Rate, Queue Throughput

## 🔧 구성 요소

### Kubernetes에서 실행되는 서비스

| 컴포넌트 | 포트 | 역할 |
|---------|------|------|
| Prometheus | 9090 | EKS 클러스터 메트릭 수집 및 저장 |
| Grafana | 3000 | 메트릭 시각화 (CloudWatch + Prometheus) |

### AWS 클라우드에서 실행되는 서비스

| 컴포넌트 | 목적 | 데이터 소스 |
|---------|------|-----------|
| CloudWatch Logs | 로그 저장소 | ALB Access Logs, AmazonMQ 로그 |
| CloudWatch Logs Insights | 로그 분석 | ALB 레이턴시, HTTP 에러율, AmazonMQ |
| Lambda (alb-log-processor) | ALB 로그 처리 | S3 ALB 로그 → CloudWatch Logs |

## 📝 참고

더 자세한 구성 방법은 [eks-monitoring-setup-guide.md](../documents/EKS/eks-monitoring-setup-guide.md) 참고

## 📚 주요 기능

### ALB 모니터링 (CloudWatch Logs Insights)

**Lambda + S3 Events를 통한 자동 처리:**
- S3에 저장된 ALB 로그 (gzip 압축)
- Lambda 함수로 파싱 및 CloudWatch Logs 전송
- 크롤러 요청 자동 필터링 (`-1` 값 감지)

**Grafana 패널:**
- ALB Latency (ms): 평균, P95, P99
- HTTP Error Rate (%): 정상 요청 기준 에러율
- End-to-End 응답시간: Pay 서비스 포함 전체 경로

### AmazonMQ 모니터링 (CloudWatch Logs)

**기존 Log Groups 활용:**
- `/aws/amazonmq/broker/[broker-id]/general` - 일반 로그
- `/aws/amazonmq/broker/[broker-id]/connection` - 연결 로그

**Grafana 패널:**
- Connection Timeline: RabbitMQ 연결 이벤트
- Recent Authentications: 인증 시도 기록
- Errors & Warnings: 에러 및 경고 로그

## 🔄 주요 변경사항 (2025-11-03)

### ✅ 추가됨
- Lambda 함수 (ALB 로그 처리)
- CloudWatch Logs Insights 쿼리 (ALB/AmazonMQ 분석)
- Grafana 패널 (레이턴시, 에러율, AmazonMQ)

### ❌ 제거됨
- Alertmanager (Kubernetes)
- Alert Rules ConfigMap
- Slack 알림 설정
- Prometheus alerting 섹션

### 📝 이유
- CloudWatch Alarms로 알림 기능 대체 예정
- Logs Insights로 실시간 분석 가능
- 운영 복잡도 감소

## ⚠️ 주의사항

- `monitoring-config/monitoring/` 디렉토리는 EC2 기반 Docker Compose 구성으로 더 이상 사용되지 않습니다
- 현재 모든 모니터링은 이 `monitoring-sample` 구성을 사용합니다
- **Alertmanager가 제거되었습니다**: CloudWatch Alarms로 전환 중입니다
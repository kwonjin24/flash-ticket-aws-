# Pay 서비스 Prometheus 모니터링 연결 실패

**날짜:** 2025-10-28
**증상:** Prometheus에서 Pay 서비스의 `/live` 엔드포인트 스크레이핑 실패 (DNS 조회 에러)
**상태:** ✅ 해결 완료

## 문제 증상

```
Endpoint State: DOWN
Target: flash-pay.flash-ticket.svc.cluster.local:3100
Last Scrape: 11.593s ago
Scrape Duration: 8.138ms

Error: Get "http://flash-pay.flash-ticket.svc.cluster.local:3100/live":
dial tcp: lookup flash-pay.flash-ticket.svc.cluster.local on 172.20.0.10:53: no such host
```

**증상:**
- Prometheus ServiceMonitor에서 Pay 서비스 타겟이 DOWN 상태
- DNS 조회 실패로 연결 불가
- 클러스터 내부에서 서비스 디스커버리 불가

## 원인 분석

### 1단계: Kubernetes Service 리소스 확인

**문제점 발견:**
```bash
$ kubectl get svc -n flash-ticket
NAME            TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
flash-api       ClusterIP   172.20.xxx.xxx   <none>        4000/TCP   2d
flash-gateway   ClusterIP   172.20.xxx.xxx   <none>        3000/TCP   2d
# flash-pay Service 없음!
```

- `eks/deployments/pay-deployment.yaml`에 Deployment만 정의되고 Service 리소스가 누락됨
- Kubernetes Service가 없으면 DNS 기반 서비스 디스커버리 불가능
- 다른 서비스(API, Gateway)는 Deployment와 Service가 함께 정의되어 있음

### 2단계: Pay Pod 로그 확인

**문제점 발견:**
```bash
$ kubectl logs -n flash-ticket -l app=flash-pay

[INFO] [Pay] Process started at 2025-10-28T09:59:03.415Z
[INFO] [Pay] Starting mock payment processor
[INFO] [Pay] 🔧 Initializing payment processor...
[INFO] [Pay] ✅ Successfully connected to RabbitMQ
[INFO] [Pay] ✅ Payment processor started successfully
# Health server 시작 로그 없음!
```

Health server 시작 로그(`[Pay] Health server listening on port 3100`)가 누락됨

### 3단계: 환경 변수 확인

```bash
$ kubectl exec -n flash-ticket flash-pay-xxx -- env | grep PAY
PAYMENT_PROCESSING_MIN_MS=1000
PAYMENT_RESULT_QUEUE=payments_result
PAYMENT_SUCCESS_RATE=0.85
PAYMENT_PROCESSING_MAX_MS=4000
PAYMENT_REQUEST_QUEUE=payments_request
# PAY_HEALTH_PORT 환경 변수 없음!
```

- `eks/configs/pay-config.yaml`에 `PAY_HEALTH_PORT` 환경 변수 누락
- 기본값(3100)이 설정되어 있어도 Health server가 시작되지 않음

### 4단계: 코드 분석

**`pay/src/index.ts:44-50`:**
```typescript
server.listen(port, () => {
  logger.info(`[Pay] Health server listening on port ${port}`);
});

server.on('error', (error) => {
  logger.error('[Pay] Health server encountered an error', error);
});
```

**문제점:**
- error handler가 `server.listen()` **후**에 등록됨
- listen 시점에 발생하는 에러를 캐치하지 못함
- 에러가 발생해도 로그에 기록되지 않아 문제 파악 어려움

## 해결 방법

### 1. Kubernetes Service 추가

**파일:** `eks/deployments/pay-deployment.yaml`

Deployment에 containerPort 명시:
```yaml
spec:
  containers:
    - name: pay
      image: 339712948064.dkr.ecr.ap-northeast-2.amazonaws.com/flash-tickets/pay:amd64
      imagePullPolicy: Always
      ports:
        - containerPort: 3100  # 추가
```

Service 정의 추가:
```yaml
---
apiVersion: v1
kind: Service
metadata:
  name: flash-pay
  namespace: flash-ticket
spec:
  selector:
    app: flash-pay
  ports:
    - name: health
      port: 3100
      targetPort: 3100
```

**적용:**
```bash
kubectl apply -f eks/deployments/pay-deployment.yaml
```

### 2. 환경 변수 추가

**파일:** `eks/configs/pay-config.yaml`

```yaml
data:
  NODE_ENV: "production"
  LOAD_ENV_FILES: "false"
  PAY_HEALTH_PORT: "3100"  # 추가
  PAYMENT_REQUEST_QUEUE: "payments_request"
  PAYMENT_RESULT_QUEUE: "payments_result"
  PAYMENT_SUCCESS_RATE: "0.85"
  PAYMENT_PROCESSING_MIN_MS: "1000"
  PAYMENT_PROCESSING_MAX_MS: "4000"
```

**적용:**
```bash
kubectl apply -f eks/configs/pay-config.yaml
```

### 3. Error Handler 순서 수정

**파일:** `pay/src/index.ts:44-50`

**변경 전:**
```typescript
server.listen(port, () => {
  logger.info(`[Pay] Health server listening on port ${port}`);
});

server.on('error', (error) => {
  logger.error('[Pay] Health server encountered an error', error);
});
```

**변경 후:**
```typescript
server.on('error', (error) => {
  logger.error('[Pay] Health server encountered an error', error);
});

server.listen(port, () => {
  logger.info(`[Pay] Health server listening on port ${port}`);
});
```

**재배포:**
```bash
# 이미지 빌드 및 푸시
docker buildx build --platform linux/amd64 \
  -t 339712948064.dkr.ecr.ap-northeast-2.amazonaws.com/flash-tickets/pay:amd64 \
  -f Dockerfile.pay --push .

# Deployment 재시작
kubectl rollout restart deployment flash-pay -n flash-ticket
```

## 검증

### 1. Service 및 Endpoints 확인

```bash
$ kubectl get svc -n flash-ticket flash-pay
NAME        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
flash-pay   ClusterIP   172.20.140.250   <none>        3100/TCP   5m

$ kubectl get endpoints -n flash-ticket flash-pay
NAME        ENDPOINTS          AGE
flash-pay   10.0.30.175:3100   5m
```

✅ Service와 Endpoints 정상 생성됨

### 2. Pod 로그 확인

```bash
$ kubectl logs -n flash-ticket -l app=flash-pay

[PayConfig] LOAD_ENV_FILES=false, runtime environment variables only
[INFO] [Pay] Process started at 2025-10-28T10:06:25.198Z
[INFO] [Pay] Starting mock payment processor
[INFO] [Pay] 🔧 Initializing payment processor...
[INFO] [Pay] Health server listening on port 3100  ✅
[INFO] [Pay] ✅ Successfully connected to RabbitMQ
[INFO] [Pay] ✅ Payment processor started successfully
```

✅ Health server 시작 로그 출력됨

### 3. Health Endpoint 테스트

**Pod 내부에서:**
```bash
$ kubectl exec -n flash-ticket flash-pay-xxx -- \
  node -e "const http = require('http'); ..."

Status: 200
Data: # HELP service_live Service liveness signal
# TYPE service_live gauge
service_live 1
```

**다른 Pod에서 DNS를 통해:**
```bash
$ kubectl exec -n flash-ticket flash-api-xxx -- \
  wget -qO- http://flash-pay.flash-ticket.svc.cluster.local:3100/live

# HELP service_live Service liveness signal
# TYPE service_live gauge
service_live 1
```

✅ localhost 및 DNS를 통한 접근 모두 정상

### 4. Prometheus 타겟 상태

- Endpoint State: **UP** ✅
- Last Scrape: 성공
- Scrape Duration: ~8ms
- 메트릭 정상 수집 중

## 영향 범위

- **영향받은 컴포넌트:** Pay 서비스, Prometheus 모니터링
- **다운타임:** 약 20분 (문제 파악 및 수정)
- **데이터 손실:** 없음
- **사용자 영향:** 없음 (모니터링만 영향받음)
- **결제 처리:** 정상 동작 (RabbitMQ 기반 처리는 문제 없음)

## 학습 사항

### 1. Kubernetes Service는 필수
- Deployment만으로는 DNS 기반 서비스 디스커버리 불가
- 클러스터 내부 통신을 위해서는 Service 리소스 필수
- API, Gateway는 Service가 있었지만 Pay는 누락됨

### 2. Error Handler 등록 시점
- Node.js에서 비동기 작업(listen) 전에 error handler를 먼저 등록해야 함
- listen 시점의 에러(포트 충돌, 권한 등)를 캐치하려면 순서가 중요함

### 3. 환경 변수 명시
- 기본값이 코드에 있더라도 프로덕션 환경에서는 명시적으로 설정
- ConfigMap에서 관리하면 재배포 없이 변경 가능

### 4. Health Check 엔드포인트 중요성
- 모니터링 엔드포인트는 애플리케이션 시작 시 가장 먼저 초기화
- Health check 실패는 전체 서비스 상태를 파악하기 어렵게 만듦

## 예방 조치

### 1. Deployment 템플릿 표준화
- 모든 서비스는 Deployment + Service를 함께 정의
- 템플릿 파일 또는 Helm Chart 사용 검토

### 2. 배포 체크리스트
```bash
# 배포 후 자동 검증 스크립트
./scripts/verify-deployment.sh <service-name>

- [ ] Service 리소스 존재 확인
- [ ] Endpoints 정상 연결 확인
- [ ] Health endpoint 응답 확인
- [ ] Prometheus target UP 확인
```

### 3. 로그 모니터링 개선
- Health server 시작 로그가 없으면 알림 발생
- 애플리케이션 시작 후 30초 이내에 health check 성공 여부 검증

### 4. 코드 리뷰 체크리스트
- [ ] Error handler가 비동기 작업 전에 등록되어 있는가?
- [ ] Health check endpoint가 독립적으로 동작하는가?
- [ ] 환경 변수가 ConfigMap/Secret에 정의되어 있는가?

## 관련 파일

- `eks/deployments/pay-deployment.yaml` (Service 추가)
- `eks/configs/pay-config.yaml` (PAY_HEALTH_PORT 추가)
- `pay/src/index.ts` (error handler 순서 수정)
- `pay/src/config.ts` (환경 변수 로딩)

## 참고 문서

- [Kubernetes Service 공식 문서](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Node.js HTTP Server Error Handling](https://nodejs.org/api/http.html#http_event_error)
- [Prometheus Kubernetes Service Discovery](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config)

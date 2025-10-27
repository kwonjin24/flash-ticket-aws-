# 02. 네임스페이스 및 공통 리소스 구성

## 2-1. 네임스페이스 생성
```bash
kubectl create namespace flash-tickets
```
이미 존재하면 아래 명령으로 확인만 합니다.
```bash
kubectl get ns flash-tickets
```

## 2-2. Secret / ConfigMap 작성 계획
각 서비스에 필요한 환경변수는 Secret 또는 ConfigMap으로 관리합니다. 예시 구조는 다음과 같습니다.

```
configs/
  api-secret.yaml
  api-config.yaml
  gateway-secret.yaml
  gateway-config.yaml
  web-config.yaml
  pay-config.yaml
```

### 2-2-1. API 서비스
- Secret 항목 (예: `api-secret.yaml`)
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `RABBITMQ_URL` 혹은 `RABBITMQ_{HOST,PORT,USER,PASSWORD,VHOST}`
- ConfigMap 항목 (예: `api-config.yaml`)
  - `PORT` (선택)
  - `PAYMENT_REQUEST_QUEUE`, `PAYMENT_RESULT_QUEUE`
  - Redis 관련 (`REDIS_HOST`, `REDIS_PORT`) – 모니터링 용도

### 2-2-2. Gateway 서비스
- Secret
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `ADMIN_REGISTER_SECRET`
- ConfigMap
  - `JWT_ACCESS_EXP`, `JWT_REFRESH_EXP`
  - `PORT`
  - `QUEUE_READY_CAPACITY`, `QUEUE_GATE_TOKEN_TTL_MS`, `QUEUE_PROMOTION_INTERVAL_MS`, `QUEUE_WS_REFRESH_MS`
  - Redis 접속 정보 (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`)

### 2-2-3. Web 프런트엔드
- ConfigMap
  - `API_BASE_URL`
  - `GATEWAY_BASE_URL`

### 2-2-4. Pay 워커
- ConfigMap
  - `PAYMENT_REQUEST_QUEUE`, `PAYMENT_RESULT_QUEUE`
  - `PAYMENT_SUCCESS_RATE`
  - `PAYMENT_PROCESSING_MIN_MS`, `PAYMENT_PROCESSING_MAX_MS`
- Secret
  - `RABBITMQ_URL` 또는 host/port/user/password

## 2-3. 적용
작성한 YAML을 아래 순서로 적용합니다.
```bash
kubectl apply -f configs/ -n flash-tickets
```
적용 후 리소스를 확인합니다.
```bash
kubectl get secret,cm -n flash-tickets
```

> 다음 단계에서는 Deployment/Service 매니페스트를 작성합니다.

# EKS API Pod Health Check 실패 트러블슈팅

**날짜:** 2025-10-28
**증상:** EKS의 flash-api Pod가 정상적으로 실행되지 않고 Health Check 실패
**상태:** ✅ 해결 완료

## 문제 증상

```bash
$ kubectl get pods -n flash-ticket
NAME                            READY   STATUS             RESTARTS         AGE
flash-api-67599b77fd-9jmlw      0/1     CrashLoopBackOff   18 (6m26s ago)   65m
flash-api-6ccc878ffd-66qbh      0/1     CrashLoopBackOff   17 (8s ago)      59m
flash-api-6ccc878ffd-krhpk      0/1     Running            19 (20s ago)     65m
```

**Pod 이벤트:**
```
Liveness probe failed: Get "http://10.0.30.175:4000/health": context deadline exceeded
Readiness probe failed: Get "http://10.0.30.175:4000/health": context deadline exceeded
```

## 원인 분석

### 1단계: Health Check Endpoint 분석

**문제점:**
- Health check가 DB와 Redis를 체크하는데 1초 이상 소요
- Kubernetes probe의 `timeoutSeconds: 1`로 설정되어 타임아웃 발생
- Health check 실패 시에도 HTTP 200 반환 → Kubernetes는 성공으로 판단

**파일 위치:**
- `api/src/presentation/monitoring/controllers/health.controller.ts:12`
- `eks/deployments/api-deployment.yaml:26-37`

### 2단계: Redis 연결 문제 발견

**로그 분석:**
```
[HealthCheck] Starting health check...
[HealthCheck] Checking database connection...
[HealthCheck] Checking Redis connection...
[HealthCheck] ✅ Database check passed (9ms)
[HealthCheck] ❌ Redis health check failed: Redis ping timeout
[HealthCheck] Health check completed { database: 'up', redis: 'down', overall: 'error' }
```

**초기 연결은 성공하지만 PING 실패:**
```
[QueueRedis] ✅ Connected to Redis at master.flash-tickets-redis.rrzszk.apn2.cache.amazonaws.com:6379
[QueueRedis] ❌ Redis error: Command timed out
```

### 3단계: 네트워크 및 보안 그룹 확인

**EKS 노드 보안 그룹:**
- `sg-06bf5f46ace325ef6` (eks-cluster-sg)
- `sg-0e5a96d33de056bfe` (flash-tickets-eks-nodes-sg) ⚠️ Redis 접근 불가
- `sg-0dbb3b70d0ed46885` (elasticache-ec2-flash-tickets-redis) ✅ Redis 접근 가능

**Redis 보안 그룹:**
- `sg-0fa691754479af0fc` (ec2-elasticache:flash-tickets-redis)
- 초기에는 `sg-0dbb3b70d0ed46885`만 허용

**문제:** EKS Pod가 노드의 모든 보안 그룹을 상속하지 않아, `sg-0e5a96d33de056bfe`에서 Redis 접근 불가

### 4단계: ElastiCache Transit Encryption 발견

**CloudWatch 로그:**
```
flash-tickets-redis-001/0001:M 28 Oct 2025 04:38:22.275 UTC
* Error accepting a client connection: connection is closed.
```

**ElastiCache 설정 확인:**
```json
{
    "TransitEncryptionEnabled": true,
    "AtRestEncryptionEnabled": true,
    "AuthTokenEnabled": false
}
```

**핵심 원인:** ElastiCache에 Transit Encryption(TLS)이 활성화되어 있었지만, 애플리케이션은 `REDIS_TLS: false`로 암호화되지 않은 연결 시도

## 해결 과정

### 1. Health Controller 수정

**파일:** `api/src/presentation/monitoring/controllers/health.controller.ts`

```typescript
// 변경 전
@Get()
async checkHealth(): Promise<HealthCheckResult> {
  return this.healthService.check();
}

// 변경 후
@Get()
async checkHealth(): Promise<HealthCheckResult> {
  const result = await this.healthService.check();

  // If health check fails, return HTTP 503 Service Unavailable
  if (result.status === 'error') {
    throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
  }

  return result;
}
```

### 2. Health Service 로깅 및 타임아웃 추가

**파일:** `api/src/application/monitoring/health.service.ts`

```typescript
// DB 체크에 타임아웃 추가
private async checkDatabase() {
  const queryPromise = this.dataSource.query('SELECT 1');
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database query timeout')), 3000)
  );

  await Promise.race([queryPromise, timeoutPromise]);
}

// Redis 체크에 타임아웃 추가
private async checkRedis() {
  const pingPromise = this.redis.ping();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Redis ping timeout')), 3000)
  );

  await Promise.race([pingPromise, timeoutPromise]);
}
```

### 3. Deployment Probe 설정 수정

**파일:** `eks/deployments/api-deployment.yaml`

```yaml
# 변경 전
readinessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 20
  periodSeconds: 20

# 변경 후
readinessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5      # 추가
  failureThreshold: 3    # 추가
livenessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 45
  periodSeconds: 20
  timeoutSeconds: 5      # 추가
  failureThreshold: 3    # 추가
```

### 4. ImagePullPolicy 설정

**파일:** `eks/deployments/*-deployment.yaml` (모든 deployment)

```yaml
containers:
  - name: api
    image: 339712948064.dkr.ecr.ap-northeast-2.amazonaws.com/flash-tickets/api:amd64
    imagePullPolicy: Always  # 추가: 항상 최신 이미지 사용
```

### 5. 보안 그룹 규칙 추가

**명령:**
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0fa691754479af0fc \
  --protocol tcp \
  --port 6379 \
  --source-group sg-0e5a96d33de056bfe \
  --region ap-northeast-2
```

**결과:** EKS 노드 보안 그룹에서 Redis 접근 허용

### 6. Redis Provider 설정 수정

**파일:** `libs/queue/src/infrastructure/redis.provider.ts`

```typescript
// 변경 사항
const redisOptions = {
  host,
  port,
  password,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,          // false → true로 변경
  connectTimeout: 10000,           // 5000 → 10000으로 증가
  commandTimeout: 10000,           // 30000 → 10000으로 변경
  maxReconnectingDelay: 3000,
  keepAlive: 30000,                // 추가
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`[Redis] Retrying connection (attempt ${times}, delay ${delay}ms)`);
    return delay;
  },
  lazyConnect: false,
  ...(tls && { tls: {} }),
};
```

### 7. Redis TLS 활성화 (최종 해결)

**파일:**
- `eks/configs/api-config.yaml`
- `eks/configs/gateway-config.yaml`

```yaml
# 변경 전
REDIS_TLS: "false"

# 변경 후
REDIS_TLS: "true"
```

**적용:**
```bash
kubectl apply -f eks/configs/api-config.yaml
kubectl apply -f eks/configs/gateway-config.yaml
kubectl delete pod -n flash-ticket -l app=flash-api
kubectl delete pod -n flash-ticket -l app=flash-gateway
```

## 최종 결과

```bash
$ kubectl get pods -n flash-ticket
NAME                            READY   STATUS    RESTARTS   AGE
flash-api-67bcc8b7f8-p2pc7      1/1     Running   0          2m33s
flash-api-67bcc8b7f8-p8qww      1/1     Running   0          88s
flash-gateway-86c8c97b6-kq722   1/1     Running   0          2m
flash-pay-76f885d5d9-tr6sm      1/1     Running   0          45m
flash-web-74c9b9dcd4-cfn4g      1/1     Running   0          45m
flash-web-74c9b9dcd4-tjgq2      1/1     Running   0          45m
```

**Health Check 로그:**
```
[HealthCheck] ✅ Redis check passed (0-1ms)
[HealthCheck] ✅ Database check passed (9-10ms)
[HealthCheck] Health check completed { database: 'up', redis: 'up', overall: 'ok' }
```

## 교훈

1. **Transit Encryption 확인 필수**
   - ElastiCache 생성 시 Transit Encryption 설정 확인
   - TLS 활성화 시 반드시 클라이언트도 TLS 연결 사용

2. **보안 그룹 계획**
   - EKS Pod가 사용하는 보안 그룹 정확히 파악
   - ElastiCache 등 VPC 리소스 접근 시 적절한 보안 그룹 설정

3. **Health Check 설계**
   - 외부 의존성 체크 시 적절한 타임아웃 설정
   - 실패 시 HTTP 상태 코드로 명확히 표현
   - 상세한 로그로 디버깅 용이하게

4. **Kubernetes Probe 설정**
   - 애플리케이션 시작 시간을 고려한 `initialDelaySeconds`
   - 충분한 `timeoutSeconds` 설정
   - `imagePullPolicy: Always`로 최신 이미지 사용

## 관련 파일

- `api/src/presentation/monitoring/controllers/health.controller.ts`
- `api/src/application/monitoring/health.service.ts`
- `libs/queue/src/infrastructure/redis.provider.ts`
- `eks/deployments/api-deployment.yaml`
- `eks/deployments/gateway-deployment.yaml`
- `eks/deployments/pay-deployment.yaml`
- `eks/deployments/web-deployment.yaml`
- `eks/configs/api-config.yaml`
- `eks/configs/gateway-config.yaml`

## 참고 명령어

```bash
# Pod 상태 확인
kubectl get pods -n flash-ticket

# Pod 로그 확인
kubectl logs -n flash-ticket <pod-name> --tail=100

# Pod 이벤트 확인
kubectl describe pod -n flash-ticket <pod-name>

# ElastiCache 상태 확인
aws elasticache describe-cache-clusters \
  --cache-cluster-id flash-tickets-redis-001 \
  --region ap-northeast-2

# 보안 그룹 규칙 확인
aws ec2 describe-security-groups \
  --group-ids <sg-id> \
  --region ap-northeast-2
```

# Flash Tickets 모니터링 시스템 가이드

## 📊 **메트릭 수집기 역할 설명**

### 1️⃣ **Node Exporter (Port 9100)**

**역할:**
- **시스템 하드웨어/OS 레벨 메트릭** 수집
- EC2 인스턴스의 물리적 리소스 상태 모니터링

**수집하는 주요 메트릭:**
```
CPU 사용률:
- node_cpu_seconds_total{cpu="0",mode="user"}
- node_cpu_seconds_total{cpu="0",mode="system"}
- node_cpu_seconds_total{cpu="0",mode="idle"}

메모리 사용량:
- node_memory_MemTotal_bytes
- node_memory_MemAvailable_bytes
- node_memory_MemFree_bytes

디스크 I/O:
- node_disk_reads_completed_total
- node_disk_writes_completed_total
- node_filesystem_avail_bytes

네트워크:
- node_network_receive_bytes_total
- node_network_transmit_bytes_total

시스템 정보:
- node_load1, node_load5, node_load15
- node_boot_time_seconds
- node_filesystem_size_bytes
```

**실제 사용 예시:**
- CPU 사용률 90% 이상시 알림
- 메모리 사용률 85% 이상시 경고
- 디스크 사용량 90% 이상시 알림
- 네트워크 트래픽 급증 감지

---

### 2️⃣ **cAdvisor (Port 8080)**

**역할:**
- **Docker 컨테이너별 메트릭** 수집
- 각 컨테이너의 리소스 사용량 및 성능 모니터링

**수집하는 주요 메트릭:**
```
컨테이너 CPU:
- container_cpu_usage_seconds_total{name="flash-tickets-api"}
- container_cpu_system_seconds_total{name="flash-tickets-api"}

컨테이너 메모리:
- container_memory_usage_bytes{name="flash-tickets-api"}
- container_memory_max_usage_bytes{name="flash-tickets-api"}
- container_memory_cache{name="flash-tickets-api"}

컨테이너 네트워크:
- container_network_receive_bytes_total{name="flash-tickets-api"}
- container_network_transmit_bytes_total{name="flash-tickets-api"}

컨테이너 파일시스템:
- container_fs_usage_bytes{name="flash-tickets-api"}
- container_fs_limit_bytes{name="flash-tickets-api"}

컨테이너 상태:
- container_last_seen{name="flash-tickets-api"}
- container_start_time_seconds{name="flash-tickets-api"}
```

**실제 사용 예시:**
- API 컨테이너 메모리 리크 감지
- 특정 컨테이너 CPU 스파이크 모니터링
- 컨테이너 재시작 횟수 추적
- 컨테이너별 네트워크 사용량 분석

---

### 3️⃣ **Redis Exporter (Port 9121)**

**역할:**
- **Redis 데이터베이스 메트릭** 수집
- 캐시 성능, 연결 상태, 메모리 사용량 모니터링

**수집하는 주요 메트릭:**
```
Redis 연결:
- redis_connected_clients
- redis_blocked_clients
- redis_client_recent_max_input_buffer
- redis_client_recent_max_output_buffer

Redis 메모리:
- redis_memory_used_bytes
- redis_memory_used_rss_bytes
- redis_memory_max_bytes
- redis_memory_fragmentation_ratio

Redis 성능:
- redis_keyspace_hits_total
- redis_keyspace_misses_total
- redis_commands_total{cmd="get"}
- redis_commands_total{cmd="set"}

Redis 키 정보:
- redis_db_keys{db="db0"}
- redis_db_avg_ttl_seconds{db="db0"}

Redis 서버 정보:
- redis_up
- redis_uptime_in_seconds
- redis_last_save_time_seconds
```

**실제 사용 예시:**
- 캐시 히트율 모니터링 (히트율 < 80% 시 알림)
- Redis 메모리 사용량 임계값 설정
- 연결된 클라이언트 수 급증 감지
- Redis 서버 다운 즉시 알림

---

### 4️⃣ **NestJS API Metrics (Port 3001/4000)**

**역할:**
- **애플리케이션 비즈니스 메트릭** 수집
- Flash Tickets 서비스의 핵심 기능 모니터링

**수집할 주요 메트릭:**
```
HTTP 요청:
- http_requests_total{method="POST", route="/api/orders", status="200"}
- http_request_duration_seconds{method="GET", route="/api/events"}
- http_request_size_bytes
- http_response_size_bytes

비즈니스 메트릭:
- queue_waiting_users_total (대기열 대기 중인 사용자 수)
- queue_processing_users_total (처리 중인 사용자 수)
- orders_created_total (생성된 주문 수)
- orders_completed_total (완료된 주문 수)
- payments_successful_total (성공한 결제 수)
- payments_failed_total (실패한 결제 수)

시스템 메트릭:
- nodejs_heap_size_total_bytes
- nodejs_heap_size_used_bytes
- nodejs_external_memory_bytes
- process_cpu_user_seconds_total
- process_resident_memory_bytes

데이터베이스 연결:
- db_connections_active
- db_query_duration_seconds
- db_query_errors_total
```

**실제 사용 예시:**
- 대기열에 1000명 이상 대기시 알림
- API 응답 시간 2초 이상시 경고
- 결제 실패율 5% 이상시 알림
- 주문 생성 급증 감지 (트래픽 스파이크)

---

## 🎯 **계층별 모니터링 구조**

```
┌─────────────────────────────────────────────────────────────┐
│ 4. 비즈니스 메트릭 (API Metrics)                           │
│ - 대기열, 주문, 결제 등 Flash Tickets 핵심 비즈니스 로직    │
│ - 사용자 경험과 직결되는 메트릭                             │
├─────────────────────────────────────────────────────────────┤
│ 3. 애플리케이션 메트릭 (Redis Exporter)                    │
│ - 캐시 성능, 데이터베이스 상태                             │
│ - 애플리케이션 의존성 모니터링                             │
├─────────────────────────────────────────────────────────────┤
│ 2. 컨테이너 메트릭 (cAdvisor)                              │
│ - Docker 컨테이너별 리소스 사용량                          │
│ - 마이크로서비스 개별 성능 모니터링                        │
├─────────────────────────────────────────────────────────────┤
│ 1. 시스템 메트릭 (Node Exporter)                           │
│ - EC2 하드웨어/OS 레벨 기본 인프라                         │
│ - 전체 시스템의 기반 모니터링                              │
└─────────────────────────────────────────────────────────────┘
```

## 🚨 **알림 시나리오 예시**

### **장애 감지 흐름:**
1. **시스템 레벨**: CPU 90% → 시스템 과부하 감지
2. **컨테이너 레벨**: API 컨테이너 메모리 급증 → 메모리 리크 의심
3. **애플리케이션 레벨**: Redis 히트율 급락 → 캐시 문제 감지
4. **비즈니스 레벨**: 결제 실패율 증가 → 실제 사용자 영향 확인

### **성능 최적화 인사이트:**
- Node Exporter: "디스크 I/O 병목 발견"
- cAdvisor: "특정 컨테이너가 리소스 과다 사용"
- Redis Exporter: "캐시 미스율 증가로 DB 부하 증가"
- API Metrics: "특정 API 엔드포인트 응답 시간 지연"

---

## 📈 **대시보드 구성 권장사항**

### **인프라 대시보드:**
- Node Exporter + cAdvisor 메트릭
- 시스템 전반적인 상태 모니터링

### **애플리케이션 대시보드:**
- Redis Exporter + API Metrics
- 서비스 성능 및 비즈니스 메트릭

### **비즈니스 대시보드:**
- API Metrics 중심
- 실시간 사용자, 주문, 매출 현황

이렇게 4개 수집기를 통해 **하드웨어부터 비즈니스 로직까지** 전방위 모니터링이 가능합니다!
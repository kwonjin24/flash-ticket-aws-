# Flash Tickets Monitoring & Health Update (2025-10-28)

이번 작업으로 Gateway, API, Pay 서비스 전반에 다음과 같은 모니터링/헬스 기능을 추가했습니다.

## 1. Gateway
- `GET /metrics`: Redis 기반 대기열 길이를 Prometheus 포맷으로 노출합니다.
  - 메트릭 예시: `flash_queue_length{event="global"}`.
- `GET /live`: 단순한 liveness 응답(`{"status":"ok"}`) 제공.

## 2. API
- 기존 비즈니스 지표에 더해 PostgreSQL 통계 뷰를 직접 조회하여 DB 관련 메트릭을 `/metrics`로 노출합니다.
  - 연결 수, 커밋/롤백, I/O 시간(`db_block_read_time_ms_total`, `db_block_write_time_ms_total`), `pg_stat_bgwriter` 기반 체크포인트/버퍼 지표 등 포함.
- `GET /live`: Gateway와 동일한 형식의 liveness 응답 추가.

## 3. Pay (Mock 결제 워커)
- `PAY_HEALTH_PORT`(기본 3100)에서 간단한 HTTP 서버를 띄워 `GET /live`를 제공합니다.
  - 종료 시 health 서버도 함께 정리하도록 graceful shutdown 처리.

## 4. Queue 라이브러리
- `QueueTicketService.getQueueLengths()`를 통해 이벤트별 대기열 길이를 배열로 반환하는 헬퍼를 추가했습니다.
  - Gateway 및 API 메트릭 수집 로직에서 재사용 가능합니다.

## 5. 빌드/배포 참고
- 코드 변경 후 각 패키지에서 `pnpm --dir <service> build`가 통과함을 확인했습니다.
- Gateway/Web 이미지 배포 시 새 엔드포인트를 포함한 버전으로 `kubectl set image` 및 `kubectl rollout status`로 교체 완료.
- Pay 디플로이먼트에는 `PAY_HEALTH_PORT` 환경 변수를 노출하고, 필요하다면 Kubernetes에서 `containerPort: 3100`을 열어 readiness/liveness probe를 구성해주세요.

## 6. 활용 가이드
1. Prometheus가 Gateway `/metrics`와 API `/metrics`를 스크랩하도록 등록하면 대기열/DB 지표를 그대로 사용할 수 있습니다.
2. KEDA 스케일링 조건을 `flash_queue_length`로 지정하면 대기열 인원에 따라 Gateway를 자동 확장할 수 있습니다.
3. `/live` 엔드포인트를 Kubernetes liveness probe에 연결하면 파드 상태를 빠르게 감지할 수 있습니다.

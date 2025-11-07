# Grafana 대시보드

Flash Ticket의 모니터링 대시보드 JSON 파일들입니다.

## 📊 대시보드 목록

### system-overview-20251031.json
**시스템 메트릭 대시보드 (최신 버전)**

**포함 패널:**
- Pod CPU Utilization (Limit 기준)
- Pod Memory Utilization (Limit 기준)
- Node CPU Utilization
- Node Memory Utilization
- Network Traffic
- Request Rate (RPS)
- HTTP Success Rate (%)
- DB Connection Pool
- DB Cache Hit Ratio
- Transaction Success Rate
- DB I/O Performance
- Row Operations Rate
- Temp Files Usage

**쿼리 간격:** 1분 (CloudWatch 데이터 수집 주기)

**데이터 소스:** CloudWatch Container Insights

---

### business-overview-20251031.json
**비즈니스 메트릭 대시보드 (최신 버전)**

**포함 패널:**

**실시간 메트릭 (30초 간격):**
- Queue Status (Waiting/Active 사용자)
- Order Status (Created/Hold/Paid/Cancelled)
- Payment Status (Pending/Successful/Failed)
- Queue Conversion Rate (%)
- Order Success Rate (%)
- Payment Success Rate (%)

**시간 추이 분석 (1시간 집계):**
- Orders Created Rate Over Time (ops/sec)
- Payment Success Rate Over Time (%)
- Queue Throughput Over Time (Ready Rate + Waiting Users)

**쿼리 간격:** 30초 (Prometheus 스크래핑 주기)

**데이터 소스:** Prometheus

---

## 🔄 버전 관리

| 파일명 | 상태 | 설명 |
|--------|------|------|
| system-overview-20251031.json | ✅ 최신 | 현재 사용 중 |
| business-overview-20251031.json | ✅ 최신 | 현재 사용 중 |
| (이전 버전들) | 📦 아카이빙 | k8s/monitoring에 보관 |

---

## 📝 대시보드 Import 방법

### Grafana UI를 통한 Import

1. Grafana 접속 (http://localhost:3000)
2. **Dashboards** 메뉴 → **+ New** → **Import** 클릭
3. **Upload JSON file** 버튼 클릭
4. JSON 파일 선택:
   - `system-overview-20251031.json`
   - `business-overview-20251031.json`
5. **Import** 버튼 클릭

### CLI를 통한 Import (선택사항)

```bash
# Grafana API를 통한 임포트
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @monitoring-sample/dashboards/system-overview-20251031.json
```

---

## 🎨 커스터마이징

각 대시보드의 패널을 Grafana UI에서 직접 편집할 수 있습니다:

1. Panel 우측 상단의 메뉴 아이콘 클릭
2. **Edit** 선택
3. 필요한 변경 사항 적용
4. **Apply** 클릭

변경 사항을 저장하려면:
- **Dashboard Settings** → **Save dashboard**
- 또는 JSON 파일로 export: **Dashboard Settings** → **Export JSON**

---

## ⚠️ 주의사항

- **Pod 메트릭:** `pod_cpu_utilization_over_pod_limit` 사용 (Limit 기준)
- **Node 메트릭:** `node_cpu_utilization` 사용 (전체 물리 리소스 기준)
- **시스템 메트릭:** 1분 간격 (CloudWatch 데이터 수집 주기)
- **비즈니스 메트릭:** 30초 간격 (Prometheus 스크래핑 주기)

---

## 📚 참고 문서

- [eks-monitoring-setup-guide.md](../../documents/EKS/eks-monitoring-setup-guide.md) - 상세 구성 가이드
- [monitoring-metric-solved-issues.md](../../trouble_shooting/monitoring-metric-solved-issues.md) - 문제 해결 기록
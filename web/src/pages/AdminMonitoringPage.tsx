import { useCallback, useEffect, useState } from 'react'
import { http } from '../api/http'

type HealthStatus = 'ok' | 'error'

type HealthCheckResponse = {
  status: HealthStatus
  timestamp: string
  uptime: number
  checks: {
    database: {
      status: 'up' | 'down'
      responseTime?: number
    }
    redis: {
      status: 'up' | 'down'
      responseTime?: number
    }
  }
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

export const AdminMonitoringPage = () => {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null)
  const [metrics, setMetrics] = useState<string>('')
  const [healthState, setHealthState] = useState<FetchState>('idle')
  const [metricsState, setMetricsState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadHealth = useCallback(async () => {
    setHealthState('loading')
    setErrorMessage(null)
    try {
      const response = await http.get('health').json<HealthCheckResponse>()
      setHealth(response)
      setHealthState('success')
    } catch (error) {
      console.error('Failed to load health status', error)
      setHealthState('error')
      setErrorMessage('헬스 상태를 불러오는 중 오류가 발생했습니다.')
    }
  }, [])

  const loadMetrics = useCallback(async () => {
    setMetricsState('loading')
    setErrorMessage(null)
    try {
      const response = await http.get('metrics').text()
      setMetrics(response)
      setMetricsState('success')
    } catch (error) {
      console.error('Failed to load metrics', error)
      setMetricsState('error')
      setErrorMessage('메트릭을 불러오는 중 오류가 발생했습니다.')
    }
  }, [])

  useEffect(() => {
    void loadHealth()
    void loadMetrics()
  }, [loadHealth, loadMetrics])

  const refreshAll = async () => {
    await Promise.all([loadHealth(), loadMetrics()])
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">모니터링 대시보드</h1>
          <p className="page-subtitle">헬스 체크 및 Prometheus 메트릭을 한 곳에서 확인합니다.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={refreshAll}>
          새로고침
        </button>
      </header>

      {errorMessage && <div className="monitoring-alert monitoring-alert--error">{errorMessage}</div>}

      <section className="card">
        <div className="card-header">
          <h2>Health 상태</h2>
          <span
            className={`status-indicator ${
              health?.status === 'ok' ? 'status-indicator--ok' : 'status-indicator--error'
            }`}
          >
            {health?.status === 'ok' ? '정상' : '오류'}
          </span>
        </div>
        <div className="card-body">
          {healthState === 'loading' && <p>헬스 상태를 불러오는 중...</p>}
          {healthState === 'error' && <p>헬스 상태를 불러오는 데 실패했습니다.</p>}
          {healthState === 'success' && health && (
            <div className="health-grid">
              <div>
                <h3>데이터베이스</h3>
                <p>
                  상태: <strong>{health.checks.database.status === 'up' ? '정상' : '장애'}</strong>
                </p>
                {typeof health.checks.database.responseTime === 'number' && (
                  <p>응답 시간: {health.checks.database.responseTime}ms</p>
                )}
              </div>
              <div>
                <h3>Redis</h3>
                <p>
                  상태: <strong>{health.checks.redis.status === 'up' ? '정상' : '장애'}</strong>
                </p>
                {typeof health.checks.redis.responseTime === 'number' && (
                  <p>응답 시간: {health.checks.redis.responseTime}ms</p>
                )}
              </div>
              <div>
                <h3>기타 정보</h3>
                <p>서버 상태: {health.status === 'ok' ? '정상' : '오류'}</p>
                <p>업타임: {Math.floor(health.uptime)}초</p>
                <p>갱신 시각: {new Date(health.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Prometheus 메트릭</h2>
          {metricsState === 'loading' && <span className="monitoring-badge monitoring-badge--info">불러오는 중</span>}
          {metricsState === 'error' && <span className="monitoring-badge monitoring-badge--error">오류</span>}
        </div>
        <div className="card-body">
          {metricsState === 'success' && (
            <pre className="metrics-output">
              <code>{metrics}</code>
            </pre>
          )}
          {metricsState === 'loading' && <p>메트릭을 불러오는 중...</p>}
          {metricsState === 'error' && <p>메트릭을 불러오지 못했습니다.</p>}
        </div>
      </section>
    </div>
  )
}

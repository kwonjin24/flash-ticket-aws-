import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { LoginCredentials } from '../types'
import { INITIAL_LOGIN_FORM } from '../utils'
import { CenteredPage } from '../components/CenteredPage'
import { useQueueStore } from '../store/queue'

export const LoginPage = ({ onLogin }: { onLogin: (credentials: LoginCredentials) => Promise<void> }) => {
  const [form, setForm] = useState<LoginCredentials>(INITIAL_LOGIN_FORM)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { gateToken, eventId, ticketId, queuedUserId, setState } = useQueueStore()

  useEffect(() => {
    if (queuedUserId) {
      setForm((prev) => ({ ...prev, userId: queuedUserId }))
    }
  }, [queuedUserId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUserId = form.userId.trim()

    if (!trimmedUserId || !form.password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onLogin({ userId: trimmedUserId, password: form.password })
      setState('ORDER_PENDING')
      navigate('/ticket', { replace: true })
    } catch (submitError) {
      console.error(submitError)
      setError('로그인에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CenteredPage>
      <main className="auth-page">
        <div className="auth-page__card">
          <header className="auth-page__header">
            <h1 className="auth-page__title">Flash Tickets</h1>
            <p className="auth-page__subtitle">
              대기열을 통과했습니다! 로그인하여 티켓 선택을 이어가세요.
            </p>
            <dl className="auth-page__meta">
              {eventId && (
                <div>
                  <dt>이벤트 ID</dt>
                  <dd>{eventId}</dd>
                </div>
              )}
              {ticketId && (
                <div>
                  <dt>티켓 ID</dt>
                  <dd>{ticketId}</dd>
                </div>
              )}
              {gateToken && (
                <div>
                  <dt>게이트 토큰</dt>
                  <dd>{gateToken}</dd>
                </div>
              )}
            </dl>
          </header>

          <form className="auth-page__form" onSubmit={handleSubmit}>
            <label className="auth-page__label">
              아이디
              <input
                className="auth-page__input"
                name="userId"
                placeholder="아이디를 입력하세요"
                value={form.userId}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, userId: event.target.value }))
                  setError(null)
                }}
              />
            </label>

            <label className="auth-page__label">
              비밀번호
              <input
                className="auth-page__input"
                type="password"
                name="password"
                placeholder="비밀번호를 입력하세요"
                value={form.password}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                  setError(null)
                }}
              />
            </label>

            {error && <p className="auth-page__error">{error}</p>}

            <button className="auth-page__submit" type="submit" disabled={loading}>
              {loading ? '잠시만 기다려주세요...' : '로그인'}
            </button>
          </form>

          <p className="auth-page__hint">
            아직 계정이 없으신가요? <Link to="/register">회원가입하기</Link>
          </p>
        </div>
      </main>
    </CenteredPage>
  )
}

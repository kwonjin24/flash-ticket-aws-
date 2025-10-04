import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { RegisterCredentials } from '../types'
import { INITIAL_REGISTER_FORM } from '../utils'
import { CenteredPage } from '../components/CenteredPage'
import { useQueueStore } from '../store/queue'

export const RegisterPage = ({ onRegister }: { onRegister: (credentials: RegisterCredentials) => Promise<void> }) => {
  const [form, setForm] = useState<RegisterCredentials>(INITIAL_REGISTER_FORM)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { eventId, ticketId, gateToken, queuedUserId, setQueuedUserId, setState } = useQueueStore()

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

    if (form.password !== form.confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (form.isAdmin && !form.adminSecret.trim()) {
      setError('관리자 등록을 위해 관리자 비밀키를 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onRegister(form)
      setState('ORDER_PENDING')
      navigate('/ticket', { replace: true })
    } catch (submitError) {
      console.error(submitError)
      setError('회원가입에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CenteredPage>
      <main className="auth-page">
        <div className="auth-page__card">
          <header className="auth-page__header">
            <h1 className="auth-page__title">계정 만들기</h1>
            <p className="auth-page__subtitle">
              대기열을 통과했습니다. 계정을 생성하고 티켓 선택으로 이동하세요.
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
                placeholder="4~50자 영문/숫자/특수문자(_, -)"
                value={form.userId}
                onChange={(event) => {
                  const next = event.target.value
                  setForm((prev) => ({ ...prev, userId: next }))
                  setQueuedUserId(next)
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
                placeholder="8자 이상 입력하세요"
                value={form.password}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                  setError(null)
                }}
              />
            </label>

            <label className="auth-page__label">
              비밀번호 확인
              <input
                className="auth-page__input"
                type="password"
                name="confirmPassword"
                placeholder="비밀번호를 다시 입력하세요"
                value={form.confirmPassword}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  setError(null)
                }}
              />
            </label>

            <div className="auth-page__checkbox">
              <input
                id="register-admin"
                type="checkbox"
                checked={form.isAdmin}
                onChange={(event) => setForm((prev) => ({ ...prev, isAdmin: event.target.checked }))}
              />
              <label htmlFor="register-admin">관리자 계정으로 등록할까요?</label>
            </div>

            {form.isAdmin && (
              <label className="auth-page__label">
                관리자 비밀키
                <input
                  className="auth-page__input"
                  name="adminSecret"
                  value={form.adminSecret}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, adminSecret: event.target.value }))
                    setError(null)
                  }}
                />
              </label>
            )}

            {error && <p className="auth-page__error">{error}</p>}

            <button className="auth-page__submit" type="submit" disabled={loading}>
              {loading ? '가입 진행 중...' : '회원가입'}
            </button>
          </form>

          <p className="auth-page__hint">
            이미 계정이 있으신가요? <Link to="/login">로그인하기</Link>
          </p>
        </div>
      </main>
    </CenteredPage>
  )
}

import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { LoginCredentials } from '../types'
import { INITIAL_LOGIN_FORM } from '../utils'

export const LoginPage = ({ onLogin }: { onLogin: (credentials: LoginCredentials) => Promise<void> }) => {
  const [form, setForm] = useState<LoginCredentials>(INITIAL_LOGIN_FORM)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
      navigate('/', { replace: true })
    } catch (submitError) {
      console.error(submitError)
      setError('로그인에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__container">
        <h2 className="auth-page__title">Flash Tickets</h2>
        <p className="auth-page__subtitle">계정에 로그인하여 이벤트에 참여하세요.</p>

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
  )
}

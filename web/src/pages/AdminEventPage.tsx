import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'

export const AdminEventPage = () => {
  const { role } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    startsAt: '',
    endsAt: '',
    totalQty: 100,
    maxPerUser: 2,
    price: 100000,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isAdmin = role === 'ADMIN'
  const nowIso = useMemo(() => new Date().toISOString().slice(0, 16), [])

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.name.trim()) {
      setError('이벤트 이름을 입력해주세요.')
      return
    }

    if (!form.startsAt || !form.endsAt) {
      setError('시작/종료 일시를 모두 선택해주세요.')
      return
    }

    setLoading(true)
    try {
      await http.post('events', {
        json: {
          name: form.name,
          starts_at: new Date(form.startsAt).toISOString(),
          ends_at: new Date(form.endsAt).toISOString(),
          total_qty: Number(form.totalQty),
          max_per_user: Number(form.maxPerUser),
          price: Number(form.price),
        },
      })
      setSuccess('이벤트가 생성되었습니다.')
      setForm({
        name: '',
        startsAt: '',
        endsAt: '',
        totalQty: 100,
        maxPerUser: 2,
        price: 100000,
      })
    } catch (submitError) {
      console.error(submitError)
      setError('이벤트 생성에 실패했습니다. 입력값을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CenteredPage>
      <section className="admin-event">
        <div className="admin-event__card">
          <header className="admin-event__header">
            <h1>이벤트 생성</h1>
            <p>판매 기간, 수량, 1인당 구매 한도를 설정해 이벤트를 등록하세요.</p>
          </header>

            <form className="admin-event__form" onSubmit={handleSubmit}>
              <label className="admin-event__label">
                이벤트 이름
                <input
                  className="admin-event__input"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>

              <div className="admin-event__grid">
                <label className="admin-event__label">
                  판매 시작
                  <input
                    className="admin-event__input"
                    type="datetime-local"
                    min={nowIso}
                    value={form.startsAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                  />
                </label>
                <label className="admin-event__label">
                  판매 종료
                  <input
                    className="admin-event__input"
                    type="datetime-local"
                    min={form.startsAt || nowIso}
                    value={form.endsAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                  />
                </label>
              </div>

              <div className="admin-event__grid">
                <label className="admin-event__label">
                  총 수량
                  <input
                    className="admin-event__input"
                    type="number"
                    min={1}
                    value={form.totalQty}
                    onChange={(event) => setForm((prev) => ({ ...prev, totalQty: Number(event.target.value) }))}
                  />
                </label>
                <label className="admin-event__label">
                  1인당 구매 제한
                  <input
                    className="admin-event__input"
                    type="number"
                    min={1}
                    value={form.maxPerUser}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxPerUser: Number(event.target.value) }))}
                  />
                </label>
              </div>

              <label className="admin-event__label">
                티켓 가격 (원)
                <input
                  className="admin-event__input"
                  type="number"
                  min={0}
                  step={100}
                  value={form.price}
                  onChange={(event) => setForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
                />
              </label>

              {error && <p className="admin-event__error">{error}</p>}
              {success && <p className="admin-event__success">{success}</p>}

              <div className="admin-event__actions">
                <button className="admin-event__submit" type="submit" disabled={loading}>
                  {loading ? '등록 중...' : '이벤트 등록'}
                </button>
                <button className="admin-event__secondary" type="button" onClick={() => navigate('/')}>
                  대시보드로 이동
                </button>
              </div>
            </form>
        </div>
      </section>
    </CenteredPage>
  )
}

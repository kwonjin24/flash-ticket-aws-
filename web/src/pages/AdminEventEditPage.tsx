import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
import type { EventSummary } from './LandingPage'

export const AdminEventEditPage = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    startsAt: '',
    endsAt: '',
    totalQty: 100,
    maxPerUser: 2,
    price: 100000,
    status: 'DRAFT',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const nowIso = useMemo(() => new Date().toISOString().slice(0, 16), [])

  const eventQuery = useQuery({
    queryKey: ['events', eventId],
    queryFn: async (): Promise<EventSummary> => {
      const response = await http.get(`events/${eventId}`)
      return (await response.json()) as EventSummary
    },
    enabled: Boolean(eventId),
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      await http.patch(`events/${eventId}`, {
        json: {
          name: form.name,
          starts_at: new Date(form.startsAt).toISOString(),
          ends_at: new Date(form.endsAt).toISOString(),
          total_qty: Number(form.totalQty),
          max_per_user: Number(form.maxPerUser),
          price: Number(form.price),
          status: form.status,
        },
      })
    },
    onSuccess: () => {
      setSuccess('이벤트가 수정되었습니다.')
      setTimeout(() => navigate('/admin/events'), 1500)
    },
    onError: () => {
      setError('이벤트 수정에 실패했습니다. 입력값을 확인해주세요.')
    },
  })

  useEffect(() => {
    if (eventQuery.data) {
      const event = eventQuery.data
      setForm({
        name: event.name,
        startsAt: new Date(event.startsAt).toISOString().slice(0, 16),
        endsAt: new Date(event.endsAt).toISOString().slice(0, 16),
        totalQty: event.totalQty,
        maxPerUser: event.maxPerUser,
        price: event.price,
        status: event.status,
      })
    }
  }, [eventQuery.data])

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

    updateMutation.mutate()
  }

  if (eventQuery.isLoading) {
    return (
      <CenteredPage>
        <div className="admin-event">
          <p>이벤트 정보를 불러오는 중...</p>
        </div>
      </CenteredPage>
    )
  }

  if (eventQuery.isError) {
    return (
      <CenteredPage>
        <div className="admin-event">
          <p className="admin-event__error">이벤트를 불러올 수 없습니다.</p>
          <button type="button" onClick={() => navigate('/admin/events')}>
            목록으로 돌아가기
          </button>
        </div>
      </CenteredPage>
    )
  }

  return (
    <CenteredPage>
      <section className="admin-event">
        <div className="admin-event__card">
          <header className="admin-event__header">
            <h1>이벤트 수정</h1>
            <p>이벤트 정보를 수정하세요. 판매된 수량보다 적게 변경할 수 없습니다.</p>
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
                  min={eventQuery.data?.soldQty || 1}
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

            <label className="admin-event__label">
              상태
              <select
                className="admin-event__input"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="DRAFT">임시저장</option>
                <option value="ONSALE">판매중</option>
                <option value="CLOSED">종료</option>
              </select>
            </label>

            {error && <p className="admin-event__error">{error}</p>}
            {success && <p className="admin-event__success">{success}</p>}

            <div className="admin-event__actions">
              <button className="admin-event__submit" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '수정 중...' : '수정하기'}
              </button>
              <button className="admin-event__secondary" type="button" onClick={() => navigate('/admin/events')}>
                취소
              </button>
            </div>
          </form>
        </div>
      </section>
    </CenteredPage>
  )
}

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
import { useQueueStore } from '../store/queue'
import { useOrderStore } from '../store/order'
import type { Event } from '../types'

const mapEvent = (payload: {
  id: string
  name: string
  starts_at: string
  ends_at: string
  total_qty: number
  sold_qty: number
  max_per_user: number
  price: number
  status: Event['status']
}): Event => ({
  id: payload.id,
  name: payload.name,
  startsAt: payload.starts_at,
  endsAt: payload.ends_at,
  totalQty: payload.total_qty,
  soldQty: payload.sold_qty,
  maxPerUser: payload.max_per_user,
  price: payload.price,
  status: payload.status,
})

const generateIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const PurchasePage = ({ onLogout }: { onLogout: () => void }) => {
  const navigate = useNavigate()
  const eventId = useQueueStore((state) => state.eventId)
  const gateToken = useQueueStore((state) => state.gateToken)
  const setQueueState = useQueueStore((state) => state.setState)
  const setOrder = useOrderStore((state) => state.setOrder)
  const [qty, setQty] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || !gateToken) {
      navigate('/', { replace: true })
    }
  }, [eventId, gateToken, navigate])

  const eventQuery = useQuery({
    queryKey: ['event-detail', eventId],
    queryFn: async (): Promise<Event> => {
      const result = await http.get(`events/${eventId}`).json<{
        id: string
        name: string
        starts_at: string
        ends_at: string
        total_qty: number
        sold_qty: number
        max_per_user: number
        price: number
        status: Event['status']
      }>()
      return mapEvent(result)
    },
    enabled: Boolean(eventId),
  })

  const orderMutation = useMutation({
    mutationFn: async (payload: { eventId: string; qty: number }) => {
      const idemKey = generateIdempotencyKey()
      const response = await http.post('orders', {
        json: payload,
        headers: {
          'Idempotency-Key': idemKey,
          'X-Gate-Token': gateToken ?? '',
        },
      })
      return (await response.json()) as { orderId: string; status: 'HOLD'; amount: number }
    },
    onSuccess: (data) => {
      setOrder({ orderId: data.orderId, amount: data.amount, status: data.status })
      setQueueState('ORDERED')
      navigate('/payment', { replace: true })
    },
    onError: (mutationError) => {
      console.error(mutationError)
      setError('주문 생성에 실패했습니다. 수량과 게이트 토큰을 확인해주세요.')
    },
  })

  if (!eventId || !gateToken) {
    return null
  }

  const event = eventQuery.data
  const maxPerUser = event?.maxPerUser ?? 1
  const remaining = event ? Math.max(event.totalQty - event.soldQty, 0) : 1
  const maxSelectable = Math.min(maxPerUser, remaining)

  const handleSubmit = (eventInstance: FormEvent<HTMLFormElement>) => {
    eventInstance.preventDefault()
    if (!eventId) {
      return
    }
    if (qty < 1) {
      setError('수량은 1개 이상이어야 합니다.')
      return
    }
    setError(null)
    orderMutation.mutate({ eventId, qty })
  }

  return (
    <CenteredPage>
      <main className="purchase-page">
        <div className="purchase-page__card">
          <header className="purchase-page__header">
            <h1>티켓 주문</h1>
            <button className="purchase-page__logout" type="button" onClick={onLogout}>
              로그아웃
            </button>
          </header>

          {event && (
            <section className="purchase-page__event">
              <h2>{event.name}</h2>
              <p>
                판매 기간: {new Date(event.startsAt).toLocaleString()} ~ {new Date(event.endsAt).toLocaleString()}
              </p>
              <p>
                남은 수량: {remaining} / {event.totalQty} (1인당 최대 {event.maxPerUser}매)
              </p>
              <p>티켓 가격: {event.price.toLocaleString()} 원</p>
            </section>
          )}

          <form className="purchase-page__form" onSubmit={handleSubmit}>
            <label className="purchase-page__label">
              구매 수량
              <input
                className="purchase-page__input"
                type="number"
                min={1}
                max={maxSelectable}
                value={qty}
                onChange={(eventInstance) => setQty(Number(eventInstance.target.value))}
              />
            </label>

            {error && <p className="purchase-page__error">{error}</p>}

            <button className="purchase-page__submit" type="submit" disabled={orderMutation.isPending}>
              {orderMutation.isPending ? '주문 생성 중...' : '주문하기'}
            </button>
          </form>
        </div>
      </main>
    </CenteredPage>
  )
}

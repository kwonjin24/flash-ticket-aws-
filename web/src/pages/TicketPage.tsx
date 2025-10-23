import { useEffect, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http, gatewayHttp } from '../api/http'
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

export const TicketPage = () => {
  const navigate = useNavigate()
  const eventId = useQueueStore((state) => state.eventId)
  const ticketId = useQueueStore((state) => state.ticketId)
  const gateToken = useQueueStore((state) => state.gateToken)
  const setQueueState = useQueueStore((state) => state.setState)
  const resetQueue = useQueueStore((state) => state.reset)
  const resetOrder = useOrderStore((state) => state.reset)
  const hasEnteredQueue = useRef(false)

  useEffect(() => {
    resetOrder()
  }, [resetOrder])

  useEffect(() => {
    if (!eventId || !ticketId || !gateToken) {
      navigate('/', { replace: true })
    }
  }, [eventId, ticketId, gateToken, navigate])

  const enterMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId || !gateToken) return
      await gatewayHttp.post('queue/enter', { json: { ticketId, gateToken } })
    },
    onSuccess: () => {
      setQueueState('ORDER_PENDING')
    },
    onError: () => {
      resetQueue()
      navigate('/', { replace: true })
    },
  })

  useEffect(() => {
    if (ticketId && gateToken && !hasEnteredQueue.current) {
      hasEnteredQueue.current = true
      enterMutation.mutate()
    }
  }, [ticketId, gateToken, enterMutation])

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

  if (!eventId || !ticketId || !gateToken) {
    return null
  }

  const event = eventQuery.data

  return (
    <CenteredPage>
      <section className="ticket-page">
        <div className="ticket-page__card">
          <header className="ticket-page__header">
            <h1>티켓 정보 확인</h1>
            <p>이벤트 정보를 확인하고 구매를 진행하세요.</p>
          </header>

            {enterMutation.isPending && <p className="ticket-page__status">대기열 입장 처리 중입니다...</p>}
            {enterMutation.isError && <p className="ticket-page__status">게이트 토큰 검증에 실패했습니다. 처음부터 다시 시도해주세요.</p>}
            {eventQuery.isLoading && <p className="ticket-page__status">이벤트 정보를 불러오는 중입니다...</p>}
            {eventQuery.isError && <p className="ticket-page__status">이벤트 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>}

            {event && (
              <section className="ticket-page__details">
                <dl>
                  <div>
                    <dt>이벤트 이름</dt>
                    <dd>{event.name}</dd>
                  </div>
                  <div>
                    <dt>판매 기간</dt>
                    <dd>
                      {new Date(event.startsAt).toLocaleString()} ~ {new Date(event.endsAt).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt>남은 수량</dt>
                    <dd>
                      {Math.max(event.totalQty - event.soldQty, 0)} / {event.totalQty}
                    </dd>
                  </div>
                  <div>
                    <dt>1인당 구매 제한</dt>
                    <dd>{event.maxPerUser} 매</dd>
                  </div>
                  <div>
                    <dt>티켓 가격</dt>
                    <dd>{event.price.toLocaleString()} 원</dd>
                  </div>
                </dl>
              </section>
            )}

            <footer className="ticket-page__footer">
              <button
                className="ticket-page__next"
                type="button"
                onClick={() => navigate('/purchase')}
                disabled={enterMutation.isPending || eventQuery.isLoading || eventQuery.isError || !event}
              >
                구매 단계로 이동
              </button>
            </footer>
        </div>
      </section>
    </CenteredPage>
  )
}

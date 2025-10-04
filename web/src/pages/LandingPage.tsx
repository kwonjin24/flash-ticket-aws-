import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import { useAuthStore } from '../store/auth'
import { useQueueStore } from '../store/queue'

export type EventSummary = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  totalQty: number
  soldQty: number
  maxPerUser: number
  price: number
  status: string
}

const formatDateRange = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  return `${start.toLocaleString('ko-KR')} ~ ${end.toLocaleString('ko-KR')}`
}

type FilterOption = 'ALL' | 'ACTIVE' | 'UPCOMING' | 'CLOSED'

const FILTER_OPTIONS: { label: string; value: FilterOption }[] = [
  { label: '모든 이벤트', value: 'ALL' },
  { label: '진행 중', value: 'ACTIVE' },
  { label: '오픈 예정', value: 'UPCOMING' },
  { label: '종료됨', value: 'CLOSED' },
]

const sortEvents = (events: EventSummary[]) => {
  const order: Record<EventSummary['status'], number> = {
    ONSALE: 0,
    DRAFT: 1,
    CLOSED: 2,
  }
  return [...events].sort((a, b) => {
    const statusOrder = (order[a.status as keyof typeof order] ?? 3) -
      (order[b.status as keyof typeof order] ?? 3)
    if (statusOrder !== 0) {
      return statusOrder
    }
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  })
}

export const LandingPage = () => {
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.userId) ?? ''
  const [filter, setFilter] = useState<FilterOption>('ALL')
  const queueState = useQueueStore((state) => state.state)
  const queuedEventId = useQueueStore((state) => state.eventId)
  const gateToken = useQueueStore((state) => state.gateToken)
  const queueStatusMessage = useQueueStore((state) => state.statusMessage)
  const queueError = useQueueStore((state) => state.error)

  const eventsQuery = useQuery({
    queryKey: ['events', 'public'],
    queryFn: async (): Promise<EventSummary[]> => {
      const response = await http.get('events')
      return (await response.json()) as EventSummary[]
    },
  })

  const events = useMemo(() => sortEvents(eventsQuery.data ?? []), [eventsQuery.data])

  const filteredEvents = useMemo(() => {
    switch (filter) {
      case 'ACTIVE':
        return events.filter((event) => event.status === 'ONSALE')
      case 'UPCOMING':
        return events.filter((event) => event.status === 'DRAFT')
      case 'CLOSED':
        return events.filter((event) => event.status === 'CLOSED')
      case 'ALL':
      default:
        return events
    }
  }, [events, filter])

  const handleEventClick = (event: EventSummary) => {
    if (event.status !== 'ONSALE') {
      return
    }
    if (!queuedEventId) {
      window.alert('로그인 후 대기열을 먼저 통과해야 합니다.')
      return
    }
    if (queuedEventId !== event.id) {
      window.alert('선택한 이벤트와 대기열 이벤트가 일치하지 않습니다. 다시 로그인하여 대기열을 초기화해주세요.')
      return
    }
    if (!gateToken) {
      window.alert('대기열 준비가 완료될 때까지 잠시만 기다려주세요.')
      return
    }
    if (queueState === 'READY' || queueState === 'ORDER_PENDING' || queueState === 'ORDERED') {
      navigate('/ticket')
    } else {
      window.alert('대기열 준비가 완료될 때까지 잠시만 기다려주세요.')
    }
  }

  return (
    <>
      <section className="landing-page">
        <div className="landing-page__content">
          <div className="landing-page__welcome">
            <h2>환영합니다, {userId}님!</h2>
            <p>대기열을 통과한 이벤트로 티켓 구매를 계속 진행하세요.</p>
            {queueStatusMessage && <p className="landing-page__hint">{queueStatusMessage}</p>}
            {queueError && <p className="landing-page__error">{queueError}</p>}
          </div>

          {eventsQuery.isLoading && (
            <div className="landing-page__loading">
              <p>이벤트를 불러오는 중...</p>
            </div>
          )}

          {eventsQuery.isError && (
            <div className="landing-page__error">
              <p>이벤트 목록을 불러올 수 없습니다.</p>
            </div>
          )}

          {!eventsQuery.isLoading && (
            <div className="landing-page__filters">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`landing-page__filter-btn ${
                    filter === option.value ? 'landing-page__filter-btn--active' : ''
                  }`}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {filteredEvents.length > 0 ? (
            <div className="landing-page__events-grid">
              {filteredEvents.map((event) => {
                const isSelectedEvent = queuedEventId === event.id
                const canPurchase =
                  isSelectedEvent &&
                  gateToken &&
                  (queueState === 'READY' || queueState === 'ORDER_PENDING' || queueState === 'ORDERED')
                const buttonLabel = (() => {
                  if (event.status !== 'ONSALE') {
                    return '진행 예정'
                  }
                  if (canPurchase) {
                    return '티켓 구매하기'
                  }
                  if (isSelectedEvent) {
                    return '대기 중...'
                  }
                  return '다른 이벤트'
                })()
                const disabled = !canPurchase

                return (
                  <article
                    key={event.id}
                    className={`landing-page__event-card landing-page__event-card--${event.status.toLowerCase()}`}
                  >
                    <header className="landing-page__event-header">
                    <h4 className="landing-page__event-title">{event.name}</h4>
                    <span className="landing-page__event-badge">
                      {event.status === 'ONSALE'
                        ? '진행 중'
                        : event.status === 'DRAFT'
                        ? '오픈 예정'
                        : '종료됨'}
                    </span>
                  </header>
                  <p className="landing-page__event-date">{formatDateRange(event.startsAt, event.endsAt)}</p>
                  <p className="landing-page__event-stock">
                    재고: {Math.max(event.totalQty - event.soldQty, 0)} / {event.totalQty}
                  </p>
                  <p className="landing-page__event-price">{event.price.toLocaleString()} 원</p>
                  <button
                    type="button"
                    className="landing-page__event-btn"
                    onClick={() => handleEventClick(event)}
                    disabled={disabled}
                  >
                    {buttonLabel}
                  </button>
                </article>
              )})}
            </div>
          ) : (
            !eventsQuery.isLoading && (
              <div className="landing-page__no-events">
                <p>선택한 조건에 해당하는 이벤트가 없습니다.</p>
              </div>
            )
          )}
        </div>
      </section>

    </>
  )
}

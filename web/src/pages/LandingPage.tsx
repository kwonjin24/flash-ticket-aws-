import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QueuePopup } from '../components/QueuePopup'
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

type FilterOption = 'ACTIVE' | 'UPCOMING' | 'CLOSED' | 'ALL'

const FILTER_OPTIONS: { label: string; value: FilterOption }[] = [
  { label: '진행 중', value: 'ACTIVE' },
  { label: '오픈 예정', value: 'UPCOMING' },
  { label: '종료됨', value: 'CLOSED' },
  { label: '모든 이벤트', value: 'ALL' },
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
  const userId = useAuthStore((state) => state.userId) ?? ''
  const userUuid = useAuthStore((state) => state.userUuid)
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null)
  const [filter, setFilter] = useState<FilterOption>('ACTIVE')
  const { joinQueue, ticketId } = useQueueStore()

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
    setSelectedEvent(event)
    if (!userUuid) {
      return
    }
    if (event.status !== 'ONSALE') {
      return
    }
    joinQueue(event.id, userUuid)
  }

  const handleClosePopup = () => {
    setSelectedEvent(null)
  }

  return (
    <>
      <section className="landing-page">
        <div className="landing-page__content">
          <div className="landing-page__welcome">
            <h2>환영합니다, {userId}님!</h2>
            <p>원하는 이벤트를 선택하고 대기열에 참여하세요.</p>
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
              {filteredEvents.map((event) => (
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
                    disabled={event.status !== 'ONSALE'}
                  >
                    {event.status === 'ONSALE' ? '대기열 참여하기' : '진행 예정'}
                  </button>
                </article>
              ))}
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

      {ticketId && selectedEvent && <QueuePopup event={selectedEvent} onClose={handleClosePopup} />}
    </>
  )
}

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

export const LandingPage = () => {
  const userId = useAuthStore((state) => state.userId) ?? ''
  const userUuid = useAuthStore((state) => state.userUuid)
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null)
  const { joinQueue, ticketId } = useQueueStore()

  const eventsQuery = useQuery({
    queryKey: ['events', 'public'],
    queryFn: async (): Promise<EventSummary[]> => {
      const response = await http.get('events')
      return (await response.json()) as EventSummary[]
    },
  })

  const events = eventsQuery.data ?? []
  const activeEvents = useMemo(() => events.filter((e) => e.status === 'ONSALE'), [events])

  const handleEventClick = (event: EventSummary) => {
    setSelectedEvent(event)
    if (!userUuid) {
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

          {activeEvents.length > 0 ? (
            <div>
              <h3 className="landing-page__section-title">진행 중인 이벤트</h3>
              <div className="landing-page__events-grid">
                {activeEvents.map((event) => (
                  <article key={event.id} className="landing-page__event-card">
                    <h4 className="landing-page__event-title">{event.name}</h4>
                    <p className="landing-page__event-date">{formatDateRange(event.startsAt, event.endsAt)}</p>
                    <p className="landing-page__event-stock">
                      재고: {Math.max(event.totalQty - event.soldQty, 0)} / {event.totalQty}
                    </p>
                    <p className="landing-page__event-price">{event.price.toLocaleString()} 원</p>
                    <button
                      type="button"
                      className="landing-page__event-btn"
                      onClick={() => handleEventClick(event)}
                    >
                      대기열 참여하기
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            !eventsQuery.isLoading && (
              <div className="landing-page__no-events">
                <p>현재 진행 중인 이벤트가 없습니다.</p>
              </div>
            )
          )}
        </div>
      </section>

      {ticketId && selectedEvent && <QueuePopup event={selectedEvent} onClose={handleClosePopup} />}
    </>
  )
}

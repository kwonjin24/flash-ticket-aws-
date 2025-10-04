import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import { useAuthStore } from '../store/auth'
import { useQueueStore } from '../store/queue'

export type QueueEventSummary = {
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

export const LoginQueueModal = () => {
  const navigate = useNavigate()
  const {
    isPopupMode,
    setPopupMode,
    joinQueue,
    leaveQueue,
    eventId,
    ticketId,
    gateToken,
    state,
    position,
    queueSize,
    readyCapacity,
    statusMessage,
    error,
    queuedUserId,
    setQueuedUserId,
  } = useQueueStore()
  const userUuid = useAuthStore((state) => state.userUuid)
  const userId = useAuthStore((state) => state.userId)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  useEffect(() => {
    if (userUuid) {
      setQueuedUserId(userUuid)
    } else if (userId) {
      setQueuedUserId(userId)
    }
  }, [userUuid, userId, setQueuedUserId])

  const eventsQuery = useQuery({
    queryKey: ['queue', 'events'],
    queryFn: async (): Promise<QueueEventSummary[]> => {
      const response = await http.get('events')
      return (await response.json()) as QueueEventSummary[]
    },
    enabled: isPopupMode,
  })

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])
  const selectedEvent = useMemo(() => {
    if (ticketId) {
      return events.find((event) => event.id === eventId) ?? null
    }
    if (selectedEventId) {
      return events.find((event) => event.id === selectedEventId) ?? null
    }
    return null
  }, [events, ticketId, eventId, selectedEventId])

  useEffect(() => {
    if (!isPopupMode) {
      return
    }
    if (state === 'READY' && gateToken) {
      setPopupMode(false)
      navigate('/', { replace: true })
    }
  }, [state, gateToken, isPopupMode, setPopupMode, navigate])

  if (!isPopupMode) {
    return null
  }

  const handleJoin = (event: QueueEventSummary) => {
    if (!queuedUserId && userUuid) {
      setQueuedUserId(userUuid)
    }
    const userIdentifier = queuedUserId ?? userUuid ?? userId
    if (!userIdentifier) {
      return
    }
    setSelectedEventId(event.id)
    joinQueue(event.id, userIdentifier)
  }

  const handleClose = () => {
    leaveQueue()
    setPopupMode(false)
    navigate('/', { replace: true })
  }

  const waitingAhead = typeof position === 'number' ? Math.max(position - 1, 0) : null

  return (
    <div
      className="queue-popup-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div className="queue-popup" onClick={(event) => event.stopPropagation()}>
        <header className="queue-popup__header">
          <h2 className="queue-popup__title">대기열 안내</h2>
          <button className="queue-popup__close" onClick={handleClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {!ticketId && (
          <section className="queue-popup__event queue-popup__event--selection">
            <h3>참여할 이벤트를 선택하세요</h3>
            {eventsQuery.isLoading && <p className="queue-popup__message">이벤트를 불러오는 중입니다...</p>}
            {eventsQuery.isError && (
              <p className="queue-popup__error">이벤트 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
            )}
            {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && (
              <p className="queue-popup__message">현재 참여 가능한 이벤트가 없습니다.</p>
            )}
            {!eventsQuery.isLoading && !eventsQuery.isError && events.length > 0 && (
              <div className="queue-popup__selection">
                {events
                  .filter((event) => event.status === 'ONSALE')
                  .map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="queue-popup__selection-item"
                      onClick={() => handleJoin(event)}
                    >
                      <div className="queue-popup__selection-main">
                        <h4>{event.name}</h4>
                        <p>{formatDateRange(event.startsAt, event.endsAt)}</p>
                      </div>
                      <div className="queue-popup__selection-meta">
                        <span>가격 {event.price.toLocaleString()} 원</span>
                        <span>잔여 {Math.max(event.totalQty - event.soldQty, 0)} 매</span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </section>
        )}

        {ticketId && selectedEvent && (
          <>
            <section className="queue-popup__event">
              <h3>{selectedEvent.name}</h3>
              <p className="queue-popup__event-price">{selectedEvent.price.toLocaleString()} 원</p>
              <p className="queue-popup__event-stock">
                남은 수량: {Math.max(selectedEvent.totalQty - selectedEvent.soldQty, 0)} / {selectedEvent.totalQty}
              </p>
              <p className="queue-popup__event-date">{formatDateRange(selectedEvent.startsAt, selectedEvent.endsAt)}</p>
            </section>

            <section className="queue-popup__status">
              {typeof queueSize === 'number' && (
                <div className="queue-popup__stat">
                  <span className="queue-popup__stat-label">현재 대기 인원</span>
                  <span className="queue-popup__stat-value">{queueSize}명</span>
                </div>
              )}

              {typeof readyCapacity === 'number' && (
                <div className="queue-popup__stat">
                  <span className="queue-popup__stat-label">동시 처리 가능</span>
                  <span className="queue-popup__stat-value">{readyCapacity}명</span>
                </div>
              )}

              {typeof waitingAhead === 'number' && (
                <div className="queue-popup__stat queue-popup__stat--highlight">
                  <span className="queue-popup__stat-label">내 앞 대기</span>
                  <span className="queue-popup__stat-value">{waitingAhead}명</span>
                </div>
              )}

              {typeof position === 'number' && (
                <div className="queue-popup__stat queue-popup__stat--primary">
                  <span className="queue-popup__stat-label">내 순번</span>
                  <span className="queue-popup__stat-value">{position}번</span>
                </div>
              )}
            </section>

            {statusMessage && <p className="queue-popup__message">{statusMessage}</p>}
            {error && <p className="queue-popup__error">{error}</p>}
          </>
        )}

        <footer className="queue-popup__footer">
          <button className="queue-popup__leave" onClick={handleClose}>
            {ticketId ? '대기열 나가기' : '로그인 화면으로 돌아가기'}
          </button>
        </footer>
      </div>
    </div>
  )
}

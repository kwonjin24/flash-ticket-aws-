import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../api/http'
import { useQueueStore } from '../store/queue'
import { useAuthStore } from '../store/auth'

type EventSummary = {
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

export const QueuePage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const userId = useAuthStore((state) => state.userId)
  const {
    eventId,
    ticketId,
    gateToken,
    state,
    position,
    queueSize,
    readyCapacity,
    statusMessage,
    error,
    isJoining,
    joinQueue,
    leaveQueue,
    reset,
  } = useQueueStore()

  const [selectedEventId, setSelectedEventId] = useState(eventId ?? searchParams.get('eventId') ?? '')
  const redirectedRef = useRef(false)

  const eventsQuery = useQuery({
    queryKey: ['events', 'public'],
    queryFn: async (): Promise<EventSummary[]> => {
      const response = await http.get('events')
      return (await response.json()) as EventSummary[]
    },
  })

  const events = eventsQuery.data ?? []

  useEffect(() => {
    const eventIdFromUrl = searchParams.get('eventId')
    if (eventIdFromUrl && !selectedEventId) {
      setSelectedEventId(eventIdFromUrl)
    } else if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id)
    }
  }, [selectedEventId, events, searchParams])

  useEffect(() => {
    if (eventId) {
      setSelectedEventId(eventId)
    }
  }, [eventId])

  useEffect(() => {
    if (state === 'READY' && gateToken && !redirectedRef.current) {
      redirectedRef.current = true
      navigate('/purchase', { replace: true })
    }
  }, [state, gateToken, navigate])

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )

  const handleJoin = () => {
    if (!selectedEventId || !userId) {
      return
    }
    joinQueue(selectedEventId, userId)
  }

  const handleLeave = () => {
    leaveQueue()
    redirectedRef.current = false
  }

  const handleReset = () => {
    reset()
    redirectedRef.current = false
  }

  const waitingAhead = typeof position === 'number' ? Math.max(position - 1, 0) : null

  return (
    <section className="queue-page">
      <div className="queue-page__card">
        <header className="queue-page__header">
          <h2>대기열 참여</h2>
          <p>이벤트를 선택하고 실시간 현황을 확인하세요.</p>
        </header>

          {eventsQuery.isError && (
            <p className="queue-page__error">이벤트 목록을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</p>
          )}

          <div className="queue-page__form">
            <label className="queue-page__label">
              이벤트 선택
              <select
                className="queue-page__select"
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                disabled={Boolean(ticketId) || eventsQuery.isLoading}
              >
                {events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="queue-page__actions">
              <button
                className="queue-page__submit"
                type="button"
                onClick={handleJoin}
                disabled={isJoining || !selectedEventId || !userId || Boolean(ticketId)}
              >
                {isJoining ? '등록 중...' : '대기열 등록'}
              </button>
              <button
                className="queue-page__secondary"
                type="button"
                onClick={handleLeave}
                disabled={!ticketId && !state}
              >
                대기열 나가기
              </button>
            </div>
          </div>

          {selectedEvent && (
            <section className="queue-page__event">
              <h3>{selectedEvent.name}</h3>
              <p>{formatDateRange(selectedEvent.startsAt, selectedEvent.endsAt)}</p>
              <p>재고: {Math.max(selectedEvent.totalQty - selectedEvent.soldQty, 0)} / {selectedEvent.totalQty}</p>
              <p>1인당 최대 {selectedEvent.maxPerUser}매</p>
              <p className="queue-page__event-price">{selectedEvent.price.toLocaleString()} 원</p>
            </section>
          )}

          {typeof queueSize === 'number' && (
            <section className="queue-page__status">
              <h3>대기열 현황</h3>
              <p>현재 대기열 인원: {queueSize}명</p>
              {typeof readyCapacity === 'number' && <p>동시 처리 가능 인원: {readyCapacity}명</p>}
              {typeof waitingAhead === 'number' && <p>내 앞 순번: {waitingAhead}명</p>}
              {typeof position === 'number' && <p className="queue-page__status-position">내 순번: {position}번</p>}
              {gateToken && <p className="queue-page__status-token">게이트 토큰: {gateToken}</p>}
            </section>
          )}

          {statusMessage && <p className="queue-page__message">{statusMessage}</p>}
          {error && <p className="queue-page__error">{error}</p>}

          <footer className="queue-page__footer">
            <button className="queue-page__back" type="button" onClick={() => navigate('/')}>
              홈으로 돌아가기
            </button>
            <button className="queue-page__reset" type="button" onClick={handleReset}>
              초기화
            </button>
          </footer>
      </div>
    </section>
  )
}

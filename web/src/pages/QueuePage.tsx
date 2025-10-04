import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
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
  return `${start.toLocaleString()} ~ ${end.toLocaleString()}`
}

export const QueuePage = () => {
  const navigate = useNavigate()
  const {
    eventId,
    ticketId,
    gateToken,
    state,
    position,
    queueSize,
    readyCapacity,
    queuedUserId,
    statusMessage,
    error,
    isJoining,
    joinQueue,
    leaveQueue,
    setState,
    setQueuedUserId,
  } = useQueueStore()

  const [selectedEventId, setSelectedEventId] = useState(eventId ?? '')
  const [userIdInput, setUserIdInput] = useState(queuedUserId ?? '')
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
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id)
    }
  }, [selectedEventId, events])

  useEffect(() => {
    if (eventId) {
      setSelectedEventId(eventId)
    }
  }, [eventId])

  useEffect(() => {
    if (queuedUserId) {
      setUserIdInput(queuedUserId)
    }
  }, [queuedUserId])

  useEffect(() => {
    if (state === 'READY' && gateToken && !redirectedRef.current) {
      redirectedRef.current = true
      navigate('/login', { replace: true })
    }
  }, [state, gateToken, navigate])

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )

  const handleJoin = () => {
    if (!selectedEventId || !userIdInput.trim()) {
      return
    }
    joinQueue(selectedEventId, userIdInput)
  }

  const handleLeave = () => {
    leaveQueue()
    redirectedRef.current = false
  }

  const waitingAhead = typeof position === 'number' ? Math.max(position - 1, 0) : null

  return (
    <CenteredPage>
      <main className="queue-page">
        <div className="queue-page__card">
          <header className="queue-page__header">
            <h1>대기열 참여</h1>
            <p>이벤트를 선택하고 대기열에 등록하세요. 순번이 도착하면 로그인 단계로 이동합니다.</p>
          </header>

          {eventsQuery.isError && <p className="queue-page__error">이벤트 목록을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</p>}

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

            <label className="queue-page__label">
              사용자 ID
              <input
                className="queue-page__input"
                value={userIdInput}
                onChange={(event) => {
                  const next = event.target.value
                  setUserIdInput(next)
                  setQueuedUserId(next)
                }}
                placeholder="로그인에 사용할 ID를 입력하세요"
                disabled={Boolean(ticketId)}
              />
            </label>

            <div className="queue-page__actions">
              <button
                className="queue-page__submit"
                type="button"
                onClick={handleJoin}
                disabled={isJoining || !selectedEventId || !userIdInput.trim() || Boolean(ticketId)}
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
              <h2>{selectedEvent.name}</h2>
              <p>판매 기간: {formatDateRange(selectedEvent.startsAt, selectedEvent.endsAt)}</p>
              <p>
                재고: {Math.max(selectedEvent.totalQty - selectedEvent.soldQty, 0)} / {selectedEvent.totalQty} (1인당 최대{' '}
                {selectedEvent.maxPerUser}매)
              </p>
              <p>티켓 가격: {selectedEvent.price.toLocaleString()} 원</p>
            </section>
          )}

          {typeof queueSize === 'number' && (
            <section className="queue-page__status">
              <h2>대기열 현황</h2>
              <p>현재 대기열 인원: {queueSize}명</p>
              {typeof readyCapacity === 'number' && <p>동시 처리 가능 인원: {readyCapacity}명</p>}
              {typeof waitingAhead === 'number' && <p>내 앞 순번: {waitingAhead}명</p>}
              {typeof position === 'number' && <p>내 순번: {position}번</p>}
              {gateToken && <p>게이트 토큰: {gateToken}</p>}
            </section>
          )}

          {statusMessage && <p className="queue-page__message">{statusMessage}</p>}
          {error && <p className="queue-page__error">{error}</p>}

          <footer className="queue-page__footer">
            <button className="queue-page__back" type="button" onClick={() => navigate('/')}>홈으로 돌아가기</button>
            <button
              className="queue-page__reset"
              type="button"
              onClick={() => {
                leaveQueue()
                setState(null)
                redirectedRef.current = false
              }}
            >
              초기화
            </button>
          </footer>
        </div>
      </main>
    </CenteredPage>
  )
}

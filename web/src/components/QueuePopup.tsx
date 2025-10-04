import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueueStore } from '../store/queue'
import type { EventSummary } from '../pages/LandingPage'

type QueuePopupProps = {
  event: EventSummary | null
  onClose: () => void
}

export const QueuePopup = ({ event, onClose }: QueuePopupProps) => {
  const navigate = useNavigate()
  const {
    ticketId,
    gateToken,
    state,
    position,
    queueSize,
    readyCapacity,
    statusMessage,
    error,
    leaveQueue,
  } = useQueueStore()

  useEffect(() => {
    if (state === 'READY' && gateToken) {
      onClose()
      navigate('/purchase', { replace: true })
    }
  }, [state, gateToken, navigate, onClose])

  const handleLeave = () => {
    leaveQueue()
    onClose()
  }

  if (!event || !ticketId) {
    return null
  }

  const waitingAhead = typeof position === 'number' ? Math.max(position - 1, 0) : null

  return (
    <div className="queue-popup-overlay" onClick={handleLeave}>
      <div className="queue-popup" onClick={(e) => e.stopPropagation()}>
        <header className="queue-popup__header">
          <h2 className="queue-popup__title">대기열 현황</h2>
          <button className="queue-popup__close" onClick={handleLeave} aria-label="닫기">
            ✕
          </button>
        </header>

        <section className="queue-popup__event">
          <h3>{event.name}</h3>
          <p className="queue-popup__event-price">{event.price.toLocaleString()} 원</p>
          <p className="queue-popup__event-stock">
            남은 수량: {Math.max(event.totalQty - event.soldQty, 0)} / {event.totalQty}
          </p>
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

        <footer className="queue-popup__footer">
          <button className="queue-popup__leave" onClick={handleLeave}>
            대기열 나가기
          </button>
        </footer>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { GLOBAL_QUEUE_EVENT_ID, useQueueStore } from '../store/queue'

export const LoginQueueModal = () => {
  const navigate = useNavigate()
  const {
    isPopupMode,
    setPopupMode,
    joinQueue,
    leaveQueue,
    state,
    position,
    queueSize,
    readyCapacity,
    statusMessage,
    error,
    ticketId,
    queuedUserId,
    setQueuedUserId,
    isJoining,
  } = useQueueStore()
  const userUuid = useAuthStore((state) => state.userUuid)
  const userId = useAuthStore((state) => state.userId)

  useEffect(() => {
    if (!isPopupMode) {
      return
    }
    if (userUuid) {
      setQueuedUserId(userUuid)
    } else if (userId) {
      setQueuedUserId(userId)
    }
  }, [isPopupMode, userUuid, userId, setQueuedUserId])

  useEffect(() => {
    if (!isPopupMode) {
      return
    }
    const identifier = queuedUserId ?? userUuid ?? userId
    if (identifier && !ticketId && !isJoining) {
      joinQueue(GLOBAL_QUEUE_EVENT_ID, identifier)
    }
  }, [isPopupMode, queuedUserId, userUuid, userId, ticketId, isJoining, joinQueue])

  useEffect(() => {
    if (!isPopupMode) {
      return
    }
    if (state === 'READY' || state === 'ORDER_PENDING' || state === 'ORDERED') {
      setPopupMode(false)
      navigate('/', { replace: true })
    }
  }, [state, isPopupMode, setPopupMode, navigate])

  if (!isPopupMode) {
    return null
  }

  const handleClose = () => {
    leaveQueue()
    setPopupMode(false)
    navigate('/auth/login', { replace: true })
  }

  const waitingAhead = typeof position === 'number' ? Math.max(position - 1, 0) : null

  return (
    <div className="queue-popup-overlay" role="dialog" aria-modal="true" onClick={handleClose}>
      <div className="queue-popup" onClick={(event) => event.stopPropagation()}>
        <header className="queue-popup__header">
          <h2 className="queue-popup__title">대기열 안내</h2>
          <button className="queue-popup__close" onClick={handleClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <section className="queue-popup__event">
          <h3>대기열 참여 중입니다</h3>
          <p className="queue-popup__message">
            로그인과 동시에 대기열에 등록되었습니다. 순번이 오면 자동으로 랜딩 페이지로 이동합니다.
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
          <button className="queue-popup__leave" onClick={handleClose}>
            대기열 나가기
          </button>
        </footer>
      </div>
    </div>
  )
}

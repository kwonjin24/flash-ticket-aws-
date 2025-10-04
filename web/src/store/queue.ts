import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { QueueStatus } from '../types'
import { createQueueSocket, destroyQueueSocket, getQueueSocket } from '../api/queueSocket'

type QueueState = {
  eventId: string | null
  ticketId: string | null
  gateToken: string | null
  state: QueueStatus['state'] | null
  position: number | null
  queueSize: number | null
  readyCapacity: number | null
  queuedUserId: string | null
  statusMessage: string | null
  error: string | null
  isJoining: boolean
  isPopupMode: boolean
  joinQueue: (eventId: string, userId: string) => void
  leaveQueue: () => void
  setState: (nextState: QueueStatus['state'] | null) => void
  setQueuedUserId: (userId: string | null) => void
  setPopupMode: (isPopup: boolean) => void
  reset: () => void
}

const initialState: Omit<QueueState, 'joinQueue' | 'leaveQueue' | 'setState' | 'setQueuedUserId' | 'setPopupMode' | 'reset'> = {
  eventId: null,
  ticketId: null,
  gateToken: null,
  state: null,
  position: null,
  queueSize: null,
  readyCapacity: null,
  queuedUserId: null,
  statusMessage: null,
  error: null,
  isJoining: false,
  isPopupMode: false,
}

const buildStatusMessage = (state: QueueStatus['state'] | null, position?: number | null) => {
  switch (state) {
    case 'QUEUED':
      return typeof position === 'number' ? `대기 중입니다. 현재 순번 ${position}번` : '대기 중입니다.'
    case 'READY':
      return '게이트 토큰이 발급되었습니다. 로그인 단계로 이동해주세요.'
    case 'ORDER_PENDING':
      return '주문을 진행할 준비가 되었습니다.'
    case 'ORDERED':
    case 'USED':
      return '대기열을 통과했습니다.'
    case 'EXPIRED':
      return '대기열 티켓이 만료되었습니다. 다시 참여해주세요.'
    default:
      return null
  }
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => {
      let socketInitialized = false

      const ensureSocket = () => {
        const existing = getQueueSocket()
        if (existing && socketInitialized) {
          return existing
        }
        const socket = createQueueSocket({
          onConfig: ({ readyCapacity }) => {
            set((state) => ({ readyCapacity: readyCapacity ?? state.readyCapacity }))
          },
          onJoined: ({ ticketId, eventId }) => {
            set((state) => ({
              ticketId,
              eventId,
              statusMessage: '대기열에 등록되었습니다. 순번을 기다리는 중입니다.',
              isJoining: false,
              error: null,
              position: state.position,
              queueSize: state.queueSize,
            }))
          },
          onUpdate: (payload) => {
            set((state) => {
              const nextState = payload.state as QueueStatus['state']
              const nextPosition = typeof payload.position === 'number' ? payload.position : state.position
              const nextGateToken = payload.gateToken ?? state.gateToken
              return {
                state: nextState,
                position: nextPosition,
                gateToken: nextGateToken,
                queueSize: payload.queueSize,
                readyCapacity: payload.readyCapacity,
                statusMessage: buildStatusMessage(nextState, nextPosition),
                error: null,
              }
            })
          },
          onSummary: (payload) => {
            set((state) => {
              if (state.eventId !== payload.eventId) {
                return {}
              }
              return {
                queueSize: payload.queueSize,
                readyCapacity: payload.readyCapacity,
              }
            })
          },
          onError: (message) => {
            set({ error: message, isJoining: false })
          },
          onLeft: () => {
            set((state) => ({
              ...initialState,
              queuedUserId: state.queuedUserId,
              statusMessage: '대기열에서 이탈했습니다.',
            }))
          },
          onDisconnected: () => {
            set({ statusMessage: '대기열 서버와의 연결이 종료되었습니다.', isJoining: false })
            socketInitialized = false
          },
        })
        socketInitialized = true
        return socket
      }

      return {
        ...initialState,
        joinQueue: (eventId, userId) => {
          const trimmedEventId = eventId.trim()
          const trimmedUserId = userId.trim()
          if (!trimmedEventId || !trimmedUserId) {
            set({ error: '이벤트와 사용자 ID를 모두 입력해주세요.' })
            return
          }
          const socket = ensureSocket()
          set({
            eventId: trimmedEventId,
            queuedUserId: trimmedUserId,
            isJoining: true,
            statusMessage: '대기열에 등록 중입니다...',
            error: null,
          })
          socket.emit('queue/join', { eventId: trimmedEventId, userId: trimmedUserId })
        },
        leaveQueue: () => {
          const socket = getQueueSocket()
          socket?.emit('queue/leave', { clearTicket: true })
          set((state) => ({
            ...initialState,
            queuedUserId: state.queuedUserId,
          }))
        },
        setState: (nextState) => {
          set({
            state: nextState,
            statusMessage: buildStatusMessage(nextState),
          })
        },
        setQueuedUserId: (userId) => {
          set({ queuedUserId: userId })
        },
        setPopupMode: (isPopup) => {
          set({ isPopupMode: isPopup })
        },
        reset: () => {
          set({ ...initialState })
          destroyQueueSocket()
          socketInitialized = false
        },
      }
    },
    {
      name: 'flash-tickets-queue',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        eventId: state.eventId,
        ticketId: state.ticketId,
        gateToken: state.gateToken,
        state: state.state,
        position: state.position,
        queueSize: state.queueSize,
        readyCapacity: state.readyCapacity,
        queuedUserId: state.queuedUserId,
      }),
    },
  ),
)

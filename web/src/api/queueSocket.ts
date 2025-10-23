import { io, type Socket } from 'socket.io-client'
import { GATEWAY_BASE_URL } from './http'

let queueSocket: Socket | null = null

export type QueueSocketHandlers = {
  onConfig: (payload: { readyCapacity: number }) => void
  onJoined: (payload: { ticketId: string; eventId: string }) => void
  onUpdate: (payload: {
    ticketId: string
    eventId: string
    queueSize: number
    readyCapacity: number
    state: string
    position?: number
    gateToken?: string
  }) => void
  onSummary: (payload: { eventId: string; queueSize: number; readyCapacity: number }) => void
  onError: (message: string) => void
  onLeft?: () => void
  onDisconnected?: () => void
}

export const createQueueSocket = (handlers: QueueSocketHandlers): Socket => {
  if (queueSocket) {
    return queueSocket
  }

  const endpoint = GATEWAY_BASE_URL.replace(/\/$/, '')
  queueSocket = io(`${endpoint}/queue`, {
    path: '/socket.io/',
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: true,
  })

  queueSocket.on('queue:config', handlers.onConfig)
  queueSocket.on('queue:joined', handlers.onJoined)
  queueSocket.on('queue:update', handlers.onUpdate)
  queueSocket.on('queue:summary', handlers.onSummary)
  queueSocket.on('queue:error', (payload?: { message?: string }) => {
    handlers.onError(payload?.message ?? '대기열 처리 중 오류가 발생했습니다.')
  })
  queueSocket.on('queue:left', () => handlers.onLeft?.())
  queueSocket.on('disconnect', () => handlers.onDisconnected?.())

  return queueSocket
}

export const getQueueSocket = (): Socket | null => queueSocket

export const destroyQueueSocket = (): void => {
  if (!queueSocket) {
    return
  }
  queueSocket.removeAllListeners()
  queueSocket.disconnect()
  queueSocket = null
}

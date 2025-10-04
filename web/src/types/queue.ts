export type QueueStatus = {
  ticketId: string
  state: 'QUEUED' | 'READY' | 'USED' | 'ORDER_PENDING' | 'ORDERED' | 'EXPIRED'
  position?: number
  gateToken?: string
}

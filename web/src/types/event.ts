export type Event = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  totalQty: number
  soldQty: number
  maxPerUser: number
  price: number
  status: 'DRAFT' | 'ONSALE' | 'CLOSED'
}

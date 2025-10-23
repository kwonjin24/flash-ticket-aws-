import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type OrderStatus = 'HOLD' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAIL'

export type PaymentStatus = 'REQ' | 'OK' | 'FAIL'

type OrderState = {
  orderId: string | null
  amount: number | null
  status: OrderStatus | null
  paymentId: string | null
  paymentStatus: PaymentStatus | null
  qty: number | null
  eventId: string | null
  eventName: string | null
  setOrder: (payload: {
    orderId: string
    amount: number
    status: OrderStatus
    qty?: number
    eventId?: string
    eventName?: string
  }) => void
  setStatus: (status: OrderStatus) => void
  setPayment: (payload: { paymentId: string; status: PaymentStatus }) => void
  reset: () => void
}

const initialState = {
  orderId: null,
  amount: null,
  status: null,
  paymentId: null,
  paymentStatus: null,
  qty: null,
  eventId: null,
  eventName: null,
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      ...initialState,
      setOrder: ({ orderId, amount, status, qty, eventId, eventName }) =>
        set({ orderId, amount, status, qty, eventId, eventName, paymentId: null, paymentStatus: null }),
      setStatus: (status) => set({ status }),
      setPayment: ({ paymentId, status }) => set({ paymentId, paymentStatus: status }),
      reset: () => set(initialState),
    }),
    {
      name: 'flash-tickets-order',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        orderId: state.orderId,
        amount: state.amount,
        status: state.status,
        paymentId: state.paymentId,
        paymentStatus: state.paymentStatus,
        qty: state.qty,
        eventId: state.eventId,
        eventName: state.eventName,
      }),
    },
  ),
)

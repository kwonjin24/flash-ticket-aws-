import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
import { useOrderStore, type PaymentStatus } from '../store/order'

type PaymentResponse = {
  paymentId: string
  status: PaymentStatus
  orderId: string
  method: string
}

export const PaymentPage = () => {
  const navigate = useNavigate()
  const orderId = useOrderStore((state) => state.orderId)
  const amount = useOrderStore((state) => state.amount)
  const qty = useOrderStore((state) => state.qty)
  const eventName = useOrderStore((state) => state.eventName)
  const paymentId = useOrderStore((state) => state.paymentId)
  const paymentStatus = useOrderStore((state) => state.paymentStatus)
  const setPayment = useOrderStore((state) => state.setPayment)
  const setOrderStatus = useOrderStore((state) => state.setStatus)

  useEffect(() => {
    if (!orderId) {
      navigate('/purchase', { replace: true })
    }
  }, [orderId, navigate])

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('orderId is missing')
      return http
        .post('payments', {
          json: { orderId, method: 'MOCK' },
        })
        .json<PaymentResponse>()
    },
    onSuccess: (data) => {
      setPayment({ paymentId: data.paymentId, status: data.status })
    },
  })

  const finalizePaymentMutation = useMutation({
    mutationFn: async (status: 'OK' | 'FAIL') => {
      if (!orderId || !paymentId) throw new Error('payment is not initialized')
      return http
        .post('payments/callback', {
          json: { orderId, paymentId, status },
        })
        .json<PaymentResponse>()
    },
    onSuccess: (payment) => {
      setPayment({ paymentId: payment.paymentId, status: payment.status })
      if (payment.status === 'OK') {
        setOrderStatus('PAID')
      }
      navigate(`/result/${orderId}`, { replace: true })
    },
  })

  if (!orderId || amount == null) {
    return null
  }

  return (
    <CenteredPage>
      <section className="payment-page">
        <div className="payment-page__card">
          <header className="payment-page__header">
            <h1>결제 진행</h1>
          </header>

            <section className="payment-page__summary">
              {eventName && <p className="payment-page__event-name">{eventName}</p>}
              <div className="payment-page__info">
                <p>주문 번호: {orderId}</p>
                {qty && <p>수량: {qty}매</p>}
                <p className="payment-page__amount">결제 금액: {amount.toLocaleString()} 원</p>
              </div>
              {paymentId && (
                <div className="payment-page__payment-info">
                  <p>결제 ID: {paymentId}</p>
                  {paymentStatus && <p>결제 상태: {paymentStatus}</p>}
                </div>
              )}
            </section>

            <div className="payment-page__actions">
              <button
                className="payment-page__primary"
                type="button"
                onClick={() => createPaymentMutation.mutate()}
                disabled={createPaymentMutation.isPending || Boolean(paymentId)}
              >
                {createPaymentMutation.isPending ? '결제 생성 중...' : '결제 요청'}
              </button>
              <button
                className="payment-page__secondary"
                type="button"
                onClick={() => finalizePaymentMutation.mutate('OK')}
                disabled={!paymentId || finalizePaymentMutation.isPending}
              >
                {finalizePaymentMutation.isPending ? '결제 처리 중...' : '결제 성공 처리'}
              </button>
              <button
                className="payment-page__danger"
                type="button"
                onClick={() => finalizePaymentMutation.mutate('FAIL')}
                disabled={!paymentId || finalizePaymentMutation.isPending}
              >
                결제 실패 처리
              </button>
            </div>
        </div>
      </section>
    </CenteredPage>
  )
}

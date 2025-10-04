import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
import { useOrderStore } from '../store/order'

export const PaymentPage = ({ onLogout }: { onLogout: () => void }) => {
  const navigate = useNavigate()
  const orderId = useOrderStore((state) => state.orderId)
  const amount = useOrderStore((state) => state.amount)
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
      const response = await http.post('payments', {
        json: { orderId, method: 'MOCK' },
      })
      return (await response.json()) as { paymentId: string; status: 'REQ' }
    },
    onSuccess: (data) => {
      setPayment({ paymentId: data.paymentId, status: data.status })
    },
  })

  const finalizePaymentMutation = useMutation({
    mutationFn: async (status: 'OK' | 'FAIL') => {
      if (!orderId || !paymentId) throw new Error('payment is not initialized')
      await http.post('payments/callback', {
        json: { orderId, paymentId, status },
      })
      return status
    },
    onSuccess: (status) => {
      setPayment({ paymentId: paymentId ?? '', status })
      if (status === 'OK') {
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
      <main className="payment-page">
        <div className="payment-page__card">
          <header className="payment-page__header">
            <h1>결제 진행</h1>
            <button className="payment-page__logout" type="button" onClick={onLogout}>
              로그아웃
            </button>
          </header>

          <section className="payment-page__summary">
            <p>주문 번호: {orderId}</p>
            <p>결제 금액: {amount.toLocaleString()} 원</p>
            {paymentId && <p>결제 ID: {paymentId}</p>}
            {paymentStatus && <p>결제 상태: {paymentStatus}</p>}
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
      </main>
    </CenteredPage>
  )
}

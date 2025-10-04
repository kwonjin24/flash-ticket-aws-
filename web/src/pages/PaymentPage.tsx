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
  const orderStatus = useOrderStore((state) => state.status)
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

  const formatPaymentStatus = (status: PaymentStatus | null) => {
    switch (status) {
      case 'OK':
        return '결제 완료'
      case 'FAIL':
        return '결제 실패'
      case 'REQ':
        return '결제 대기'
      default:
        return '결제 준비 중'
    }
  }

  const formatOrderStatus = (status: typeof orderStatus) => {
    switch (status) {
      case 'HOLD':
        return '주문 대기'
      case 'PAID':
        return '결제 완료'
      case 'CANCELLED':
        return '취소됨'
      case 'EXPIRED':
        return '만료됨'
      default:
        return '확인 중'
    }
  }

  const isPaymentCreated = Boolean(paymentId)

  const handleCreatePayment = () => {
    if (!isPaymentCreated) {
      createPaymentMutation.mutate()
    }
  }

  return (
    <CenteredPage>
      <section className="payment-screen">
        <div className="payment-screen__card">
          <header className="payment-screen__header">
            <div>
              <h1>결제 진행</h1>
              <p>주문을 확정하기 위해 결제를 완료해주세요.</p>
            </div>
            <span className="payment-screen__badge">{formatOrderStatus(orderStatus)}</span>
          </header>

          <div className="payment-screen__content">
            <section className="payment-screen__section">
              <h2>주문 정보</h2>
              <dl className="payment-screen__list">
                <div>
                  <dt>이벤트</dt>
                  <dd>{eventName ?? '이벤트'}</dd>
                </div>
                <div>
                  <dt>주문 번호</dt>
                  <dd>{orderId}</dd>
                </div>
                {qty && (
                  <div>
                    <dt>수량</dt>
                    <dd>{qty}매</dd>
                  </div>
                )}
                <div>
                  <dt>결제 금액</dt>
                  <dd>{amount.toLocaleString()} 원</dd>
                </div>
              </dl>
            </section>

            <section className="payment-screen__section">
              <h2>결제 상태</h2>
              <div className="payment-screen__status">
                <div>
                  <p className="payment-screen__status-label">상태</p>
                  <p className="payment-screen__status-value">{formatPaymentStatus(paymentStatus ?? null)}</p>
                </div>
                {isPaymentCreated && paymentId && (
                  <div>
                    <p className="payment-screen__status-label">결제 ID</p>
                    <p className="payment-screen__status-value">{paymentId}</p>
                  </div>
                )}
              </div>
              <p className="payment-screen__helper">결제 요청 후 5분 이내에 결제 완료 또는 실패를 선택해주세요.</p>
            </section>
          </div>

          <div className="payment-screen__actions">
            <button
              className="payment-screen__button payment-screen__button--primary"
              type="button"
              onClick={handleCreatePayment}
              disabled={createPaymentMutation.isPending || isPaymentCreated}
            >
              {createPaymentMutation.isPending ? '결제 생성 중...' : isPaymentCreated ? '결제 요청 완료' : '결제 요청'}
            </button>
            <div className="payment-screen__actions-row">
              <button
                className="payment-screen__button payment-screen__button--success"
                type="button"
                onClick={() => finalizePaymentMutation.mutate('OK')}
                disabled={!isPaymentCreated || finalizePaymentMutation.isPending}
              >
                {finalizePaymentMutation.isPending ? '처리 중...' : '결제 성공 처리'}
              </button>
              <button
                className="payment-screen__button payment-screen__button--danger"
                type="button"
                onClick={() => finalizePaymentMutation.mutate('FAIL')}
                disabled={!isPaymentCreated || finalizePaymentMutation.isPending}
              >
                결제 실패 처리
              </button>
            </div>
          </div>
        </div>
      </section>
    </CenteredPage>
  )
}

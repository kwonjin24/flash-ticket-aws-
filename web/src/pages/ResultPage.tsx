import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
import { useOrderStore, type PaymentStatus } from '../store/order'
import { useQueueStore } from '../store/queue'

type OrderDetail = {
  id: string
  status: 'HOLD' | 'PAID' | 'CANCELLED' | 'EXPIRED'
  qty: number
  amount: number
  eventId: string
  eventName?: string
  createdAt: string
  updatedAt: string
}

export const ResultPage = () => {
  const navigate = useNavigate()
  const params = useParams()
  const orderIdParam = params.orderId
  const resetOrder = useOrderStore((state) => state.reset)
  const paymentStatus = useOrderStore((state) => state.paymentStatus)
  const queueReset = useQueueStore((state) => state.reset)

  useEffect(() => {
    if (!orderIdParam) {
      navigate('/', { replace: true })
    }
  }, [orderIdParam, navigate])

  const orderQuery = useQuery({
    queryKey: ['order-detail', orderIdParam],
    queryFn: async (): Promise<OrderDetail> => {
      const result = await http.get(`orders/${orderIdParam}`).json<OrderDetail>()
      return result
    },
    enabled: Boolean(orderIdParam),
  })

  if (!orderIdParam) {
    return null
  }

  const order = orderQuery.data

  const handleRestart = () => {
    resetOrder()
    queueReset()
    navigate('/', { replace: true })
  }

  const renderStatus = (status: OrderDetail['status']) => {
    switch (status) {
      case 'PAID':
        return '결제 완료'
      case 'HOLD':
        return '결제 대기'
      case 'CANCELLED':
        return '취소됨'
      case 'EXPIRED':
        return '만료됨'
      default:
        return status
    }
  }

  const renderPaymentStatus = (status: PaymentStatus | null) => {
    switch (status) {
      case 'OK':
        return '결제 완료'
      case 'FAIL':
        return '결제 실패'
      case 'REQ':
        return '결제 대기'
      default:
        return '확인 중'
    }
  }

  return (
    <CenteredPage>
      <section className="result-screen">
        <div className="result-screen__card">
          <header className="result-screen__header">
            <div>
              <h1>주문 결과</h1>
              <p>결제 상태와 주문 정보를 확인하세요.</p>
            </div>
            {order && <span className="result-screen__badge">{renderStatus(order.status)}</span>}
          </header>

          {orderQuery.isLoading && <p className="result-screen__status">주문 정보를 불러오는 중입니다...</p>}
          {orderQuery.isError && <p className="result-screen__status">주문 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>}

          {order && (
            <section className="result-screen__summary">
              <dl className="result-screen__list">
                {order.eventName && (
                  <div>
                    <dt>이벤트</dt>
                    <dd>{order.eventName}</dd>
                  </div>
                )}
                <div>
                  <dt>주문 번호</dt>
                  <dd>{order.id}</dd>
                </div>
                <div>
                  <dt>구매 수량</dt>
                  <dd>{order.qty}매</dd>
                </div>
                <div>
                  <dt>결제 금액</dt>
                  <dd>{order.amount.toLocaleString()} 원</dd>
                </div>
                <div>
                  <dt>주문 일시</dt>
                  <dd>{new Date(order.createdAt).toLocaleString('ko-KR')}</dd>
                </div>
              </dl>

              <section className="result-screen__payment">
                <h2>결제 상태</h2>
                <p className="result-screen__payment-status">{renderPaymentStatus(paymentStatus)}</p>
              </section>
            </section>
          )}

          <footer className="result-screen__footer">
            <button className="result-screen__restart" type="button" onClick={handleRestart}>
              대기열로 돌아가기
            </button>
          </footer>
        </div>
      </section>
    </CenteredPage>
  )
}

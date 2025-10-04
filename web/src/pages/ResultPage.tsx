import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
import { useOrderStore } from '../store/order'
import { useQueueStore } from '../store/queue'

type OrderDetail = {
  id: string
  status: 'HOLD' | 'PAID' | 'CANCELLED' | 'EXPIRED'
  qty: number
  amount: number
  eventId: string
}

export const ResultPage = ({ onLogout }: { onLogout: () => void }) => {
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

  return (
    <CenteredPage>
      <main className="result-page">
        <div className="result-page__card">
          <header className="result-page__header">
            <h1>주문 결과</h1>
            <button className="result-page__logout" type="button" onClick={onLogout}>
              로그아웃
            </button>
          </header>

          {orderQuery.isLoading && <p className="result-page__status">주문 정보를 불러오는 중입니다...</p>}
          {orderQuery.isError && <p className="result-page__status">주문 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>}

          {order && (
            <section className="result-page__summary">
              <p>주문 번호: {order.id}</p>
              <p>상태: {order.status}</p>
              <p>구매 수량: {order.qty} 매</p>
              <p>결제 금액: {order.amount.toLocaleString()} 원</p>
              <p>결제 상태: {paymentStatus ?? '확인 중'}</p>
            </section>
          )}

          <footer className="result-page__footer">
            <button className="result-page__restart" type="button" onClick={handleRestart}>
              대기열로 돌아가기
            </button>
          </footer>
        </div>
      </main>
    </CenteredPage>
  )
}

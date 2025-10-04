import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import { CenteredPage } from '../components/CenteredPage'
import type { OrderStatus } from '../store/order'
import { useOrderStore } from '../store/order'

type OrderListItem = {
  id: string
  status: OrderStatus
  amount: number
  qty: number
  eventId: string
  eventName?: string
  createdAt: string
  updatedAt: string
}

const EMPTY_ORDERS: OrderListItem[] = []

const formatDateTime = (timestamp: string) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  return date.toLocaleString('ko-KR')
}

const getStatusLabel = (status: OrderStatus) => {
  switch (status) {
    case 'HOLD':
      return '결제 대기'
    case 'PAID':
      return '결제 완료'
    case 'CANCELLED':
      return '취소됨'
    case 'EXPIRED':
      return '만료됨'
    default:
      return status
  }
}

export const MyOrdersPage = () => {
  const navigate = useNavigate()
  const resetOrder = useOrderStore((state) => state.reset)
  const setOrder = useOrderStore((state) => state.setOrder)

  const ordersQuery = useQuery({
    queryKey: ['orders', 'me'],
    queryFn: async (): Promise<OrderListItem[]> => {
      const response = await http.get('orders')
      return (await response.json()) as OrderListItem[]
    },
    staleTime: 10_000,
  })

  const orders = ordersQuery.data ?? EMPTY_ORDERS
  const { holdingOrders, otherOrders } = useMemo(() => {
    const holding = orders.filter((order) => order.status === 'HOLD')
    const rest = orders.filter((order) => order.status !== 'HOLD')
    return { holdingOrders: holding, otherOrders: rest }
  }, [orders])

  const handleProceedPayment = (order: OrderListItem) => {
    resetOrder()
    setOrder({
      orderId: order.id,
      amount: order.amount,
      status: order.status,
      qty: order.qty,
      eventId: order.eventId,
      eventName: order.eventName,
    })
    navigate('/payment')
  }

  return (
    <CenteredPage>
      <section className="orders-page">
        <div className="orders-page__card">
          <header className="orders-page__header">
            <h1>내 주문 현황</h1>
            <p>결제 대기 중인 주문을 확인하고 결제를 이어서 진행하세요.</p>
          </header>

          {ordersQuery.isLoading && <p className="orders-page__status">주문 정보를 불러오는 중입니다...</p>}
          {ordersQuery.isError && <p className="orders-page__status">주문 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>}

          {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 && (
            <p className="orders-page__empty">아직 생성된 주문이 없습니다.</p>
          )}

          {holdingOrders.length > 0 && (
            <section className="orders-page__section">
              <h2 className="orders-page__section-title">결제 대기 중</h2>
              <ul className="orders-page__list">
                {holdingOrders.map((order) => (
                  <li key={order.id} className="orders-page__item orders-page__item--highlight">
                    <div>
                      <p className="orders-page__event-name">{order.eventName ?? '이벤트'}</p>
                      <p className="orders-page__meta">주문 번호: {order.id}</p>
                      <p className="orders-page__meta">수량: {order.qty}매 · 금액: {order.amount.toLocaleString()} 원</p>
                      <p className="orders-page__meta">생성일시: {formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="orders-page__item-actions">
                      <span className="orders-page__badge orders-page__badge--pending">{getStatusLabel(order.status)}</span>
                      <button
                        type="button"
                        className="orders-page__action-btn"
                        onClick={() => handleProceedPayment(order)}
                      >
                        결제 진행하기
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {otherOrders.length > 0 && (
            <section className="orders-page__section">
              <h2 className="orders-page__section-title">다른 주문</h2>
              <ul className="orders-page__list">
                {otherOrders.map((order) => (
                  <li key={order.id} className="orders-page__item">
                    <div>
                      <p className="orders-page__event-name">{order.eventName ?? '이벤트'}</p>
                      <p className="orders-page__meta">주문 번호: {order.id}</p>
                      <p className="orders-page__meta">수량: {order.qty}매 · 금액: {order.amount.toLocaleString()} 원</p>
                      <p className="orders-page__meta">생성일시: {formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="orders-page__item-actions">
                      <span
                        className={`orders-page__badge ${
                          order.status === 'PAID'
                            ? 'orders-page__badge--success'
                            : 'orders-page__badge--muted'
                        }`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </CenteredPage>
  )
}

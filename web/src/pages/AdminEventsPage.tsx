import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/http'
import { AppLayout } from '../components/AppLayout'
import type { EventSummary } from './LandingPage'

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('ko-KR')
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    DRAFT: '임시저장',
    ONSALE: '판매중',
    CLOSED: '종료',
  }
  return statusMap[status] || status
}

const getStatusClass = (status: string) => {
  const classMap: Record<string, string> = {
    DRAFT: 'admin-events__status--draft',
    ONSALE: 'admin-events__status--active',
    CLOSED: 'admin-events__status--closed',
  }
  return classMap[status] || ''
}

export const AdminEventsPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const eventsQuery = useQuery({
    queryKey: ['events', 'admin', 'all'],
    queryFn: async (): Promise<EventSummary[]> => {
      const response = await http.get('events/admin/all')
      return (await response.json()) as EventSummary[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await http.delete(`events/${eventId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setDeleteConfirm(null)
    },
  })

  const events = eventsQuery.data ?? []

  const handleDelete = (eventId: string) => {
    if (deleteConfirm === eventId) {
      deleteMutation.mutate(eventId)
    } else {
      setDeleteConfirm(eventId)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  return (
    <AppLayout>
      <section className="admin-events">
        <div className="admin-events__container">
          <header className="admin-events__header">
            <div>
              <h1>이벤트 관리</h1>
              <p>모든 이벤트를 조회하고 수정/삭제할 수 있습니다.</p>
            </div>
            <div className="admin-events__actions">
              <button type="button" className="admin-events__create" onClick={() => navigate('/admin/events/new')}>
                새 이벤트 만들기
              </button>
              <button type="button" className="admin-events__back" onClick={() => navigate('/')}>
                홈으로
              </button>
            </div>
          </header>

          {eventsQuery.isLoading && <p className="admin-events__loading">이벤트를 불러오는 중...</p>}
          {eventsQuery.isError && <p className="admin-events__error">이벤트 목록을 불러올 수 없습니다.</p>}

          {events.length > 0 ? (
            <div className="admin-events__table-wrapper">
              <table className="admin-events__table">
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>이벤트명</th>
                    <th>판매 기간</th>
                    <th>재고</th>
                    <th>가격</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <span className={`admin-events__status ${getStatusClass(event.status)}`}>
                          {getStatusText(event.status)}
                        </span>
                      </td>
                      <td className="admin-events__name">{event.name}</td>
                      <td className="admin-events__date">
                        <div>{formatDate(event.startsAt)}</div>
                        <div>{formatDate(event.endsAt)}</div>
                      </td>
                      <td>
                        {event.soldQty} / {event.totalQty}
                      </td>
                      <td>{event.price.toLocaleString()}원</td>
                      <td>
                        <div className="admin-events__buttons">
                          <button
                            type="button"
                            className="admin-events__edit"
                            onClick={() => navigate(`/admin/events/${event.id}/edit`)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className={`admin-events__delete ${deleteConfirm === event.id ? 'admin-events__delete--confirm' : ''}`}
                            onClick={() => handleDelete(event.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteConfirm === event.id ? '정말 삭제?' : '삭제'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !eventsQuery.isLoading && <p className="admin-events__empty">등록된 이벤트가 없습니다.</p>
          )}
        </div>
      </section>
    </AppLayout>
  )
}

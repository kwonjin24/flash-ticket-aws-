import { useNavigate } from 'react-router-dom'
import type { UserRole } from '../store/auth'

type NavigationProps = {
  userId: string
  role: UserRole
  onLogout: () => void
}

export const Navigation = ({ userId, role, onLogout }: NavigationProps) => {
  const navigate = useNavigate()

  return (
    <header className="app-nav">
      <h1 className="app-nav__brand" onClick={() => navigate('/')}>
        Flash Tickets
      </h1>
      <nav className="app-nav__menu">
        {role === 'ADMIN' && (
          <div className="app-nav__admin-btns">
            <button type="button" className="app-nav__admin-btn" onClick={() => navigate('/admin/events')}>
              이벤트 관리
            </button>
            <button type="button" className="app-nav__admin-btn" onClick={() => navigate('/admin/events/new')}>
              이벤트 등록
            </button>
          </div>
        )}
        <span className="app-nav__user">@{userId}</span>
        <button type="button" className="app-nav__logout" onClick={onLogout}>
          로그아웃
        </button>
      </nav>
    </header>
  )
}

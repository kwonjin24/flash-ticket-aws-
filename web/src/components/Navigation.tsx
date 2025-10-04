import { Link } from 'react-router-dom'
import type { UserRole } from '../store/auth'

type NavigationProps = {
  userId: string
  role: UserRole
  onLogout: () => void
}

export const Navigation = ({ userId, role, onLogout }: NavigationProps) => {
  return (
    <header className="app-nav">
      <h1 className="app-nav__brand">
        <Link to="/" className="app-nav__brand-link">
          Flash Tickets
        </Link>
      </h1>
      <nav className="app-nav__menu">
        {role === 'ADMIN' && (
          <div className="app-nav__admin-btns">
            <Link to="/admin/events" className="app-nav__admin-btn">
              이벤트 관리
            </Link>
            <Link to="/admin/events/new" className="app-nav__admin-btn">
              이벤트 등록
            </Link>
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

import { Link } from 'react-router-dom'
import type { UserRole } from '../store/auth'

type NavigationProps = {
  userId: string
  role: UserRole
  onLogout: () => void
}

export const Navigation = ({ userId, role, onLogout }: NavigationProps) => {
  return (
    <div className="navbar">
      <div className="nav-left">
        <Link to="/" className="navbar__brand">
          Flash Tickets
        </Link>
      </div>
      <div className="nav-right">
        <div className="nav-actions">
          <Link to="/orders" className="btn btn-ghost">
            내 주문
          </Link>
          {role === 'ADMIN' && (
            <>
              <Link to="/admin/events" className="btn btn-ghost">
                이벤트 관리
              </Link>
              <Link to="/admin/events/new" className="btn btn-primary">
                이벤트 등록
              </Link>
            </>
          )}
        </div>
        <span className="username">@{userId}</span>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          로그아웃
        </button>
      </div>
    </div>
  )
}

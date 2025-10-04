import { Link } from 'react-router-dom'
import type { UserRole } from '../store/auth'

export const LandingPage = ({ userId, role, onLogout }: { userId: string; role: UserRole; onLogout: () => void }) => (
  <div className="landing">
    <div className="landing__container">
      <header className="landing__nav">
        <div className="landing__brand">Flash Tickets</div>
        <nav className="landing__links" aria-label="메뉴">
          <Link className="landing__nav-btn link" to="/queue">
            대기열
          </Link>
          <button type="button" className="landing__nav-btn" disabled>
            주문내역
          </button>
        </nav>
        <div className="landing__profile">
          {role === 'ADMIN' && (
            <Link className="landing__admin-link" to="/admin/events/new">
              이벤트 등록하기
            </Link>
          )}
          <span className="landing__user">@{userId}</span>
          <button type="button" className="landing__logout" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="landing__main">
        <section className="landing__card">
          <h2>환영합니다, {userId}님!</h2>
          <p>
            Flash Tickets 대기열에 합류하고, 원하는 이벤트를 누구보다 빠르게 예약하세요. 실시간 게이트 토큰, 안전한
            주문 처리, 결제 플로우가 곧 준비될 예정입니다.
          </p>
          <div className="landing__actions">
            <Link className="landing__primary link" to="/queue">
              대기열 참여하기
            </Link>
            <button type="button" className="landing__secondary" disabled>
              내 주문 확인 (준비 중)
            </button>
          </div>
        </section>
      </main>

      <footer className="landing__footer">© {new Date().getFullYear()} Flash Tickets. All rights reserved.</footer>
    </div>
  </div>
)

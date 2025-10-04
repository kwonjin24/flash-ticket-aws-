import { Outlet, useNavigate } from 'react-router-dom'
import { Footer } from './Footer'
import { Navigation } from './Navigation'
import { useAuthStore } from '../store/auth'
import { useOrderStore } from '../store/order'
import { useQueueStore } from '../store/queue'

export const AppLayout = () => {
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.userId) ?? ''
  const role = useAuthStore((state) => state.role) ?? 'USER'
  const clearSession = useAuthStore((state) => state.clear)
  const resetQueue = useQueueStore((state) => state.reset)
  const resetOrder = useOrderStore((state) => state.reset)

  const handleLogout = () => {
    clearSession()
    resetQueue()
    resetOrder()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="site-header fixed-header">
        <Navigation userId={userId} role={role} onLogout={handleLogout} />
      </header>
      <main className="site-main site-main--with-offset">
        <div className="site-main__inner">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer fixed-footer">
        <Footer />
      </footer>
    </div>
  )
}

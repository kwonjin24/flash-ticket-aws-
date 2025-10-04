import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footer } from './Footer'
import { Navigation } from './Navigation'
import { useAuthStore } from '../store/auth'
import { useOrderStore } from '../store/order'
import { useQueueStore } from '../store/queue'

interface AppLayoutProps {
  children: ReactNode
}

export const AppLayout = ({ children }: AppLayoutProps) => {
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
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <Navigation userId={userId} role={role} onLogout={handleLogout} />
      <main className="app-shell__content">
        <div className="app-shell__inner">{children}</div>
      </main>
      <Footer />
    </div>
  )
}

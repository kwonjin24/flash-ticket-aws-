import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { http } from './api/http'
import { useAuthStore } from './store/auth'
import { useQueueStore } from './store/queue'
import { useOrderStore } from './store/order'
import type { LoginCredentials, RegisterCredentials, TokenDto } from './types'
import { decodeToken } from './utils'
import {
  AdminEventPage,
  AdminEventsPage,
  AdminEventEditPage,
  LandingPage,
  LoginPage,
  QueuePage,
  RegisterPage,
  TicketPage,
  PurchasePage,
  PaymentPage,
  ResultPage,
} from './pages'
import './App.css'

type RequireAuthProps = {
  children: ReactNode
  allowRoles?: ('ADMIN' | 'USER')[]
}

type RequireGateProps = {
  children: ReactNode
}

const RequireGate = ({ children }: RequireGateProps) => {
  const gateToken = useQueueStore((state) => state.gateToken)
  const queueState = useQueueStore((state) => state.state)
  if (!gateToken || queueState !== 'READY') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const RequireAuth = ({ children, allowRoles }: RequireAuthProps) => {
  const accessToken = useAuthStore((state) => state.accessToken)
  const userId = useAuthStore((state) => state.userId)
  const role = useAuthStore((state) => state.role)

  if (!accessToken || !userId) {
    return <Navigate to="/login" replace />
  }

  if (allowRoles && (!role || !allowRoles.includes(role))) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const { accessToken, userId, role, setSession, clear: clearSession } = useAuthStore()
  const resetQueue = useQueueStore((state) => state.reset)
  const resetOrder = useOrderStore((state) => state.reset)

  const login = async (credentials: LoginCredentials) => {
    const response = await http.post('auth/login', { json: credentials }).json<TokenDto>()
    const { userId, role } = decodeToken(response.accessToken)
    if (!userId) {
      throw new Error('토큰에서 사용자 정보를 추출할 수 없습니다.')
    }
    setSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken ?? null,
      userId,
      role,
    })
  }

  const register = async (credentials: RegisterCredentials) => {
    if (credentials.isAdmin) {
      await http.post('auth/register/admin', {
        json: { userId: credentials.userId, password: credentials.password, adminSecret: credentials.adminSecret },
      })
    } else {
      await http.post('auth/register', {
        json: { userId: credentials.userId, password: credentials.password },
      })
    }
    await login({ userId: credentials.userId, password: credentials.password })
  }

  const logout = () => {
    clearSession()
    resetQueue()
    resetOrder()
  }

  const isAuthenticated = Boolean(accessToken && userId)

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={login} />} />
      <Route path="/register" element={<RegisterPage onRegister={register} />} />

      <Route
        path="/"
        element={
          isAuthenticated && userId ? (
            <LandingPage userId={userId} role={role} onLogout={logout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/queue"
        element={
          <RequireAuth>
            <QueuePage />
          </RequireAuth>
        }
      />

      <Route
        path="/ticket"
        element={
          <RequireAuth>
            <RequireGate>
              <TicketPage onLogout={logout} />
            </RequireGate>
          </RequireAuth>
        }
      />

      <Route
        path="/purchase"
        element={
          <RequireAuth>
            <PurchasePage onLogout={logout} />
          </RequireAuth>
        }
      />

      <Route
        path="/payment"
        element={
          <RequireAuth>
            <PaymentPage onLogout={logout} />
          </RequireAuth>
        }
      />

      <Route
        path="/result/:orderId"
        element={
          <RequireAuth>
            <ResultPage onLogout={logout} />
          </RequireAuth>
        }
      />

      <Route
        path="/admin/events"
        element={
          <RequireAuth allowRoles={['ADMIN']}>
            <AdminEventsPage />
          </RequireAuth>
        }
      />

      <Route
        path="/admin/events/new"
        element={
          <RequireAuth allowRoles={['ADMIN']}>
            <AdminEventPage />
          </RequireAuth>
        }
      />

      <Route
        path="/admin/events/:eventId/edit"
        element={
          <RequireAuth allowRoles={['ADMIN']}>
            <AdminEventEditPage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  )
}

export default App

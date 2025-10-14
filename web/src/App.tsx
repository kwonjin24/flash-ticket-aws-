import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { http } from './api/http'
import { AppLayout } from './components/AppLayout'
import { AuthLayout } from './components/AuthLayout'
import { useAuthStore } from './store/auth'
import { useQueueStore } from './store/queue'
import type { LoginCredentials, RegisterCredentials, TokenDto } from './types'
import { decodeToken } from './utils'
import {
  AdminEventPage,
  AdminEventsPage,
  AdminEventEditPage,
  AdminMonitoringPage,
  LandingPage,
  LoginPage,
  QueuePage,
  RegisterPage,
  TicketPage,
  PurchasePage,
  PaymentPage,
  ResultPage,
  MyOrdersPage,
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
  if (!gateToken || (queueState !== 'READY' && queueState !== 'ORDER_PENDING')) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const RequireAuth = ({ children, allowRoles }: RequireAuthProps) => {
  const accessToken = useAuthStore((state) => state.accessToken)
  const userUuid = useAuthStore((state) => state.userUuid)
  const role = useAuthStore((state) => state.role)

  if (!accessToken || !userUuid) {
    return <Navigate to="/auth/login" replace />
  }

  if (allowRoles && (!role || !allowRoles.includes(role))) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const { accessToken, userUuid, setSession } = useAuthStore()

  const login = async (credentials: LoginCredentials) => {
    const response = await http.post('auth/login', { json: credentials }).json<TokenDto>()
    const { userId, userUuid, role } = decodeToken(response.accessToken)
    if (!userUuid) {
      throw new Error('토큰에서 사용자 정보를 추출할 수 없습니다.')
    }
    setSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken ?? null,
      userId,
      userUuid,
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

  const isAuthenticated = Boolean(accessToken && userUuid)

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <RequireAuth>
              <LandingPage />
            </RequireAuth>
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
                <TicketPage />
              </RequireGate>
            </RequireAuth>
          }
        />

        <Route
          path="/purchase"
          element={
            <RequireAuth>
              <PurchasePage />
            </RequireAuth>
          }
        />

        <Route
          path="/orders"
          element={
            <RequireAuth>
              <MyOrdersPage />
            </RequireAuth>
          }
        />

        <Route
          path="/payment"
          element={
            <RequireAuth>
              <PaymentPage />
            </RequireAuth>
          }
        />

        <Route
          path="/result/:orderId"
          element={
            <RequireAuth>
              <ResultPage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin/monitoring"
          element={
            <RequireAuth allowRoles={['ADMIN']}>
              <AdminMonitoringPage />
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
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/auth/login" element={<LoginPage onLogin={login} />} />
        <Route path="/auth/register" element={<RegisterPage onRegister={register} />} />
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/auth/login'} replace />} />
    </Routes>
  )
}

export default App

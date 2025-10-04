import { Outlet } from 'react-router-dom'

export const AuthLayout = () => {
  return (
    <div className="app-shell">
      <main className="site-main site-main--auth">
        <div className="site-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

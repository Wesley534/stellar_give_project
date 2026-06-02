import { NavLink, Outlet } from 'react-router-dom'

export function AppShell() {
  const appName = import.meta.env.VITE_APP_NAME ?? 'GIVE Invoice Finance'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>{appName}</h1>
          <p>Starter workspace for the financing MVP</p>
        </div>

        <nav aria-label="Primary">
          <NavLink to="/" end>
            Login
          </NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
        </nav>
      </header>

      <main className="page-card">
        <Outlet />
      </main>
    </div>
  )
}

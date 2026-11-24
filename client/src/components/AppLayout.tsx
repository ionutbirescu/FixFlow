import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../auth/roles'

/** The frame around every signed-in page. Only rendered under RequireAuth, so a session always exists. */
export function AppLayout() {
  const { session, logout } = useAuth()
  if (!session) return null
  const isManager = session.role === 'MANAGER'

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          FixFlow
        </Link>
        <nav className="app-nav" aria-label="Main">
          <NavLink to="/reports" end>
            Reports
          </NavLink>
          <NavLink to="/reports/new">New report</NavLink>
          <NavLink to="/machines">Machines</NavLink>
          {isManager && <NavLink to="/users/new">Add user</NavLink>}
        </nav>
        <div className="app-user">
          <span className="app-user-name">{session.username ?? 'Signed in'}</span>
          <span className="badge">{ROLE_LABELS[session.role]}</span>
          <button className="button button-small" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../auth/roles'
import { Clock } from './Clock'
import { ThemeSwitch } from './ThemeSwitch'

/** The frame around every signed-in page. Only rendered under RequireAuth, so a session always exists. */
export function AppLayout() {
  const { session, logout } = useAuth()
  if (!session) return null
  const isManager = session.role === 'MANAGER'

  return (
    // data-role picks the role's colour, used on the menu tabs and the role tag
    <div className="app" data-role={session.role}>
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
          <div className="app-player">
            <span className="app-user-name">{session.username ?? 'Signed in'}</span>
            <Clock className="app-clock" />
          </div>
          <span className="badge">{ROLE_LABELS[session.role]}</span>
          <button className="button button-small" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="panel app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <ThemeSwitch />
      </footer>
    </div>
  )
}

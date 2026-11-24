// Layout routes that gate their children. They only decide what the browser shows: S1 and S2 enforce the
// same rules on every request, so hiding a page is a convenience, not the security boundary.
import { Navigate, Outlet, useLocation } from 'react-router'
import type { Role } from '../api/types'
import { ForbiddenPage } from '../pages/ForbiddenPage'
import { useAuth } from './AuthContext'

/** State the guards pass to /login, so it can return the user to the page they asked for. */
export interface LoginLocationState {
  from?: { pathname: string; search: string; hash: string }
}

/** Renders the child routes for a signed-in user; sends anyone else to /login. */
export function RequireAuth() {
  const { session, endReason } = useAuth()
  const location = useLocation()

  if (!session) {
    // After signing out, the next sign-in starts on the home page instead of the last user's page.
    const state: LoginLocationState | undefined = endReason === 'logout' ? undefined : { from: location }
    return <Navigate to="/login" replace state={state} />
  }
  return <Outlet />
}

/** Renders the child routes only for the given roles; other signed-in users get a 403 page. */
export function RequireRole({ roles }: { roles: readonly Role[] }) {
  const { session } = useAuth()

  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes(session.role)) return <ForbiddenPage allowed={roles} />
  return <Outlet />
}

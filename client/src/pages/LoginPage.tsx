import { type FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { errorMessage, isApiError, isNetworkError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import type { LoginLocationState } from '../auth/guards'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { DEV_AGAINST_BACKEND, S1_URL, SHOW_DEMO_LOGINS } from '../config'

export function LoginPage() {
  const { session, endReason, login } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  // The dev server against a backend that isn't running: say how to get going without one
  const [noBackend, setNoBackend] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Already signed in, or just signed in: go where the guard sent us from.
  if (session) return <Navigate to={returnPath(location.state)} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    setNoBackend(false)
    try {
      await login({
        username: String(form.get('username') ?? '').trim(),
        password: String(form.get('password') ?? ''),
      })
    } catch (err) {
      setError(isApiError(err, 401) ? 'Wrong username or password.' : errorMessage(err))
      setNoBackend(DEV_AGAINST_BACKEND && isNetworkError(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <div className="login-title">
        <p className="brand">FixFlow</p>
        <p className="login-tagline">Maintenance reports</p>
      </div>
      <form className="panel login-panel" onSubmit={handleSubmit} aria-labelledby="login-title">
        <h1 id="login-title">Sign in</h1>

        {endReason === 'expired' && !error && (
          <p className="notice" role="status">
            Your session has expired. Sign in again to continue.
          </p>
        )}
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {DEV_AGAINST_BACKEND && noBackend && (
          <p className="notice">
            Dev server: nothing answers at <code>{S1_URL}</code>. Start S1 and S2, or stop this server and run{' '}
            <code>npm run dev:mock</code> to use the mock API instead.
          </p>
        )}

        <label className="field">
          <span>Username</span>
          <input name="username" autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        {SHOW_DEMO_LOGINS && (
          <p className="hint">
            Demo logins: <code>tech1</code> (technician) or <code>manager1</code> (manager), both with the password{' '}
            <code>fixflow</code>.
          </p>
        )}
      </form>

      <ThemeSwitch />
    </main>
  )
}

function returnPath(state: unknown): string {
  const from = (state as LoginLocationState | null)?.from
  if (!from || typeof from.pathname !== 'string' || from.pathname === '/login') return '/'
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}

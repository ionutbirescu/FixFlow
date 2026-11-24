import { type FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { errorMessage, isApiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import type { LoginLocationState } from '../auth/guards'
import { API_MOCKING } from '../config'

export function LoginPage() {
  const { session, endReason, login } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already signed in, or just signed in: go where the guard sent us from.
  if (session) return <Navigate to={returnPath(location.state)} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      await login({
        username: String(form.get('username') ?? '').trim(),
        password: String(form.get('password') ?? ''),
      })
    } catch (err) {
      setError(isApiError(err, 401) ? 'Wrong username or password.' : errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={handleSubmit} aria-labelledby="login-title">
        <p className="brand">FixFlow</p>
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

        {API_MOCKING && (
          <p className="hint">
            Mock API: sign in as <code>tech1</code> or <code>manager1</code>, password <code>fixflow</code>.
          </p>
        )}
      </form>
    </main>
  )
}

function returnPath(state: unknown): string {
  const from = (state as LoginLocationState | null)?.from
  if (!from || typeof from.pathname !== 'string' || from.pathname === '/login') return '/'
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}

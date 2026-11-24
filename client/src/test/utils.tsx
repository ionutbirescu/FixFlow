import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from '../auth/AuthProvider'
import { type Session, sessionStore } from '../auth/session'
import { getDb } from '../mocks/db'
import { createMockToken } from '../mocks/jwt'
import { routes } from '../routes'

/** Renders the whole app (real routes, guards and auth) at `path`. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return { router, user }
}

/** Starts a session for a seeded mock user, as if they had signed in. */
export function signInAs(username: 'tech1' | 'manager1', { ttlSeconds }: { ttlSeconds?: number } = {}): Session {
  const account = getDb().users.find((candidate) => candidate.username === username)
  if (!account) throw new Error(`No mock user ${username}`)
  return sessionStore.start({ token: createMockToken(account, { ttlSeconds }), role: account.role })
}

// The signed-in user's token, kept outside React so the Axios interceptors (api/http.ts) can read and
// end it. AuthProvider subscribes to it; components use useAuth() rather than this module.
import type { LoginResponse, Role } from '../api/types'
import { ROLES } from '../api/types'
import { decodeJwt } from './jwt'

export interface Session {
  token: string
  role: Role
  /** The token's `sub` claim, or `null` if it can't be read */
  username: string | null
  /** When the token expires, in ms since the epoch (`exp` claim), or `null` if it doesn't say */
  expiresAt: number | null
}

/**
 * Why the last session ended:
 * - `expired`: S1 or S2 answered 401, or the stored token had run out. After signing in again,
 *   the user goes back to the page they were on.
 * - `logout`: the user signed out in this tab. The next sign-in starts on the home page.
 *
 * A sign-out in another tab arrives through `syncFromStorage()` and leaves `endReason` at `null`.
 */
export type EndReason = 'expired' | 'logout'

export interface SessionState {
  session: Session | null
  /** `null` until a session ends during this page load */
  endReason: EndReason | null
}

export interface SessionStore {
  getState(): SessionState
  subscribe(listener: () => void): () => void
  start(login: LoginResponse): Session
  end(reason: EndReason): void
  /** Re-reads the stored session, e.g. after another tab signed in or out. */
  syncFromStorage(): void
}

export const STORAGE_KEY = 'fixflow.session'

/** Kept in storage; the username and expiry are re-read from the token on load. */
interface StoredSession {
  token: string
  role: Role
}

export function createSessionStore(storage: Storage | null, now: () => number = Date.now): SessionStore {
  const listeners = new Set<() => void>()
  let state = load()

  function load(): SessionState {
    const stored = read()
    if (!stored) return { session: null, endReason: null }
    const session = toSession(stored)
    if (session.expiresAt !== null && session.expiresAt <= now()) {
      write(null)
      return { session: null, endReason: 'expired' }
    }
    return { session, endReason: null }
  }

  function read(): StoredSession | null {
    try {
      const raw = storage?.getItem(STORAGE_KEY)
      if (!raw) return null
      const value: unknown = JSON.parse(raw)
      if (typeof value !== 'object' || value === null) return null
      const { token, role } = value as Record<string, unknown>
      if (typeof token !== 'string' || !ROLES.includes(role as Role)) return null
      return { token, role: role as Role }
    } catch {
      return null
    }
  }

  function write(stored: StoredSession | null) {
    try {
      if (stored) storage?.setItem(STORAGE_KEY, JSON.stringify(stored))
      else storage?.removeItem(STORAGE_KEY)
    } catch {
      // Storage can be full or blocked (private windows). The session still lives in memory for this tab.
    }
  }

  function setState(next: SessionState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    start({ token, role }) {
      const session = toSession({ token, role })
      write({ token, role })
      setState({ session, endReason: null })
      return session
    },

    end(reason) {
      if (!state.session) return
      write(null)
      setState({ session: null, endReason: reason })
    },

    syncFromStorage() {
      const next = load()
      const sameToken = next.session?.token === state.session?.token
      if (sameToken && next.endReason === state.endReason) return
      setState(sameToken ? { ...next, session: state.session } : next)
    },
  }
}

function toSession({ token, role }: StoredSession): Session {
  const claims = decodeJwt(token)
  return {
    token,
    role,
    username: claims?.sub ?? null,
    expiresAt: claims?.exp !== undefined ? claims.exp * 1000 : null,
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const sessionStore = createSessionStore(browserStorage())

// Signing in or out in one tab does the same in the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) sessionStore.syncFromStorage()
  })
}

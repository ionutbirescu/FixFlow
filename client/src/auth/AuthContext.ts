import { createContext, useContext } from 'react'
import type { LoginRequest } from '../api/types'
import type { EndReason, Session } from './session'

export interface AuthContextValue {
  /** The signed-in user, or `null` */
  session: Session | null
  /** Why the last session ended during this page load (see `EndReason`), or `null` */
  endReason: EndReason | null
  /** Calls `POST /auth/login` and starts the session. Rejects with the Axios error on failure. */
  login(credentials: LoginRequest): Promise<Session>
  logout(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth() must be called inside <AuthProvider>')
  return value
}

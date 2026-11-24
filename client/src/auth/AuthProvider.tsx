import { type ReactNode, useMemo, useSyncExternalStore } from 'react'
import * as authApi from '../api/auth'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { sessionStore } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, endReason } = useSyncExternalStore(sessionStore.subscribe, sessionStore.getState)

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      endReason,
      login: async (credentials) => sessionStore.start(await authApi.login(credentials)),
      logout: () => sessionStore.end('logout'),
    }),
    [session, endReason],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

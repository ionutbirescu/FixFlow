import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { sessionStore } from '../auth/session'
import { mockSettings, resetDb } from '../mocks/db'
import { server } from '../mocks/server'

// Every test talks to the same MSW handlers as `npm run dev:mock`. A request with no handler fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

beforeEach(() => {
  // New reports finish on their first read, unless a test sets a delay
  mockSettings.processingMs = 0
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetDb()
  globalThis.localStorage?.clear()
  sessionStore.syncFromStorage()
})

afterAll(() => server.close())

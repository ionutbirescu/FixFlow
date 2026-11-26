import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { sessionStore } from '../auth/session'
import { mockSettings, resetDb } from '../mocks/db'
import { server } from '../mocks/server'

// jsdom has no object URLs, which the pages use to show picked and downloaded photos. Hand out fake ones:
// jsdom never loads images anyway.
if (typeof URL.createObjectURL !== 'function') {
  Object.assign(URL, {
    createObjectURL: () => `blob:http://localhost:3000/${crypto.randomUUID()}`,
    revokeObjectURL: () => {},
  })
}

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

// The same handlers for Vitest, which runs in Node (src/test/setup.ts starts it).
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

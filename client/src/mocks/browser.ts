// The service worker behind `npm run dev:mock`. Vite's msw plugin serves its script (vite.config.ts).
import { type UnhandledFrameHandle } from 'msw'
import { setupWorker } from 'msw/browser'
import { S1_URL, S2_URL } from '../config'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

const API_ORIGINS = new Set([new URL(S1_URL).origin, new URL(S2_URL).origin])

/** Warns about S1/S2 calls with no handler; Vite's own requests pass through quietly. */
export const onUnhandledFrame: UnhandledFrameHandle = ({ frame, defaults }) => {
  if (frame.protocol !== 'http') return
  const { request } = frame.data as { request: Request }
  if (API_ORIGINS.has(new URL(request.url).origin)) defaults.warn()
}

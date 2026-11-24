import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // `npm run dev:mock` only: serves MSW's service worker script. No other build contains it.
    mode === 'mock' && msw({ mode: 'worker-only' }),
  ],
  // Port 3000 is the agreed client port (CORS on S1 and S2 allows it)
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}))

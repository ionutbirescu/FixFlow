import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// `npm run dev:mock` answers S1 and S2 from src/mocks in the browser, before the app makes its first call.
// The check is inline on purpose: Vite replaces it with a constant, so other builds drop the import.
async function startMocking() {
  if (import.meta.env.MODE !== 'mock') return
  const { worker, onUnhandledFrame } = await import('./mocks/browser.ts')
  await worker.start({ onUnhandledFrame })
}

startMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

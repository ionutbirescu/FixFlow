import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Port 3000 is the agreed client port (CORS on S2 allows it)
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
})

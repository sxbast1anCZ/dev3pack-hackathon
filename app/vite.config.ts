import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app lives in app/. The Vercel functions live in api/ at the repository root.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
})

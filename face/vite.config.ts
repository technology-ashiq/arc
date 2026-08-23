import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The door is localhost + bearer token with ZERO CORS (ADR-1312), so the browser must never
// make a cross-origin request to it. Proxying /api through the dev server keeps every call
// same-origin and lets the door keep its posture unchanged -- the alternative is loosening
// the door for a development convenience, which is how a security property quietly dies.
const DOOR = process.env.ARC_DASH_ORIGIN ?? 'http://127.0.0.1:8317'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: DOOR,
        changeOrigin: false, // the door checks Host; rewriting it is what the DNS-rebinding fixture exists to catch
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
})

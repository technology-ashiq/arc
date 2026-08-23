import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The door is localhost + bearer token with ZERO CORS (ADR-1312), so the browser must never
// make a cross-origin request to it. Proxying /api through the dev server keeps every call
// same-origin and lets the door keep its posture unchanged -- the alternative is loosening
// the door for a development convenience, which is how a security property quietly dies.
const DOOR = process.env.ARC_DASH_ORIGIN ?? 'http://127.0.0.1:8317'
const DOOR_HOST = new URL(DOOR).host

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: DOOR,

        // Host MUST be rewritten to the door's own.
        //
        // The first version of this file set `changeOrigin: false`, reasoning that rewriting
        // Host is what the door's DNS-rebinding fixture exists to catch. That reasoning was
        // wrong, and the page 403'd on every read until it was tested in a browser.
        //
        // The rebinding attack is a REMOTE page whose Host is attacker.com arriving at a
        // loopback port. This is a same-machine proxy hop rewriting Host to the door's real
        // host, which is the one case the guard is not about. The door accepts
        // 127.0.0.1:<port>, localhost:<port> and [::1]:<port> -- and the dev server's own
        // host is localhost:5180, which is none of them.
        changeOrigin: true,

        configure(proxy) {
          // Origin has to move too, and `changeOrigin` does not touch it.
          //
          // A same-origin GET carries no Origin at all, so reads survived on Host alone --
          // but the Fetch spec sets Origin on any method that is not GET/HEAD, and the door
          // REQUIRES a self-origin on its one mutating route. Left alone, every read would
          // work and every stamp would 403: the worst possible split, because the product
          // looks entirely healthy right up to the single irreversible act.
          proxy.on('proxyReq', (proxyReq) => {
            if (proxyReq.getHeader('origin') !== undefined) proxyReq.setHeader('origin', DOOR)
            proxyReq.setHeader('host', DOOR_HOST)
          })
        },
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
})

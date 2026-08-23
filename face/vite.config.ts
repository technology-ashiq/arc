import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The door is localhost + bearer token with ZERO CORS (ADR-1312), so the browser must never
// make a cross-origin request to it. Proxying /api through the dev server keeps every call
// same-origin and lets the door keep its posture unchanged -- the alternative is loosening
// the door for a development convenience, which is how a security property quietly dies.
const DOOR = process.env.ARC_DASH_ORIGIN ?? 'http://127.0.0.1:8317'

// NORMALISED, both of them, from the same URL object.
//
// The first cut sent the raw env string as Origin while deriving Host with `new URL().host`.
// Two of the four plausible spellings of the same door then broke it: a trailing slash
// (`http://127.0.0.1:8318/`) and an uppercase host both make the door answer BAD_ORIGIN,
// while Host stayed correct — which reproduces exactly the split this file's own comment
// warns about, every read working and every stamp 403ing. `.origin` has no trailing slash
// and lower-cases the host, so the two halves cannot disagree.
const DOOR_ORIGIN = new URL(DOOR).origin
const DOOR_HOST = new URL(DOOR).host

// The dev server's own origins, which are the ONLY ones whose Origin may be rewritten.
// A browser on the dev server sends one of these; anything else is a cross-origin request
// and the door is supposed to refuse it.
const SELF_ORIGINS = new Set([
  `http://localhost:${5180}`,
  `http://127.0.0.1:${5180}`,
  `http://[::1]:${5180}`,
])

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
          proxy.on('proxyReq', (proxyReq, req) => {
            // ONLY OUR OWN ORIGIN IS REWRITTEN. Everything else is passed through unchanged
            // so the door can refuse it.
            //
            // The first cut rewrote Origin whenever one was present, and an adversarial pass
            // showed what that costs: a POST to /api/decide carrying `Origin: https://evil.com`
            // arrived at the door byte-identical to a legitimate same-origin stamp. Direct, the
            // door answers BAD_ORIGIN; through the proxy it reached the decision handler and was
            // stopped only by a deliberately malformed verdict. With a real ULID it would have
            // executed the irreversible write.
            //
            // The comment above this block claimed the proxy "lets the door keep its posture
            // unchanged". It did the opposite, on the one route the door singles out as needing
            // Origin as a deliberate control. Passing a foreign Origin through is what actually
            // keeps that posture.
            const origin = req.headers.origin
            if (typeof origin === 'string' && SELF_ORIGINS.has(origin)) {
              proxyReq.setHeader('origin', DOOR_ORIGIN)
            }
            // Host is rewritten unconditionally, and that is correct: this hop IS the door's
            // own host by definition, and vite's `allowedHosts` has already refused any Host
            // it does not recognise before the request reaches here.
            proxyReq.setHeader('host', DOOR_HOST)
          })
        },
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
})

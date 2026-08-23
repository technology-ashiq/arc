import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// ── real-spine dev API (READ-ONLY) ─────────────────────────────
// Set ARC_SPINE_DIR in .env.local to the folder holding your real
// spine JSONL files (e.g. E:\...\arc\.claude\state\hq\events).
// The dev server then serves GET /api/spine — it only ever reads.
// Nothing is written anywhere, and nothing ships to the browser
// unless you run `npm run dev` on this machine.
function spineApi(env) {
  return {
    name: 'arc-spine-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/spine', (req, res) => {
        res.setHeader('content-type', 'application/json')
        const dir = env.ARC_SPINE_DIR
        if (!dir) {
          res.end(JSON.stringify({ configured: false }))
          return
        }
        try {
          const files = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.jsonl'))
            .sort()
            .slice(-14)
          const events = []
          for (const f of files) {
            const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n')
            for (const line of lines) {
              const s = line.trim()
              if (!s) continue
              try {
                events.push(JSON.parse(s))
              } catch {
                events.push({ kind: 'note.logged', summary: '[unparseable line — shown honestly]', raw: s.slice(0, 200) })
              }
            }
          }
          res.end(JSON.stringify({ configured: true, dir, files, events: events.slice(-500) }))
        } catch (e) {
          res.end(JSON.stringify({ configured: true, dir, error: String(e.message || e), events: [] }))
        }
      })
    },
  }
}

// base './' → the built dist/index.html also opens directly from disk
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    plugins: [react(), tailwindcss(), spineApi(env)],
  }
})

# `face/` — L3, the arc face

The surface the owner runs the company from. Three layers (ADR-1301): L1 is the spine, L2
is the `arc dash` door in `.claude/scripts/hq/arc-dash.mjs`, and this is L3.

It lives here rather than in its own repo — **ADR-1316**, and the reason is narrow: this
session cannot author `.github/workflows/**`, so a new repo would be the one layer of the
product with no CI at all. The split back out stays cheap and the ADR lists what keeps it
that way.

## The shape, and why

```
face/
  src/lib/*.mjs      pure logic — dependency-free ESM, no build step
  src/**/*.tsx       React views — thin, no logic worth testing
  src/tokens.css     COPIED from docs/design/system/tokens.css (never hand-edited)
```

**Every decision lives in `src/lib/*.mjs`, and nothing in there imports React, Vite or
three.** That is not tidiness, it is what makes the tests real: CI never runs `npm install`
at the repo root, so anything that needs `node_modules` to be exercised cannot be exercised.
Plain ESM can be imported by `node` directly, which means the L3 logic runs in the same
three-OS matrix that already catches the failures that actually bite here — Windows path
resolution, BSD-vs-GNU `sed`, case folding.

A component that needs a decision asks a `lib` function for it. If a `.tsx` file grows a
branch worth asserting, that branch is in the wrong file.

## Its only contract with arc is HTTP

`face/` imports nothing from `.claude/**`. It talks to the L2 door and to nothing else:

| route | what it gives |
|---|---|
| `GET /api/health` | spine health, quarantine by refusal code, `kindsSeen`, the cursor |
| `GET /api/rooms` | the 33-room registry + each room's live state (ADR-1306) |
| `GET /api/brief` | Today's brief, ≤40 lines |
| `GET /api/inbox` | what is waiting on the owner |
| `GET /api/spine` | the log, cursor-paged |
| `GET /api/board` | the lane board |
| `GET /api/lane/:id` | one lane's header |
| `GET /api/pnl` | money, real and simulated held apart |
| `GET /api/file/:id` | allow-listed files only |
| `POST /api/decide` | **the one write path.** Byte-parity with `arc-inbox` (Phase 03) |
| `POST /api/ask` | proxies the `face-ask` process |

The room list is **served**, never imported from disk. A second spelling of the contract in
a renderer is how a renamed room silently empties a screen.

## Running it

```bash
node .claude/scripts/hq/arc-face.mjs
```

That is the whole thing. It starts the door, installs this app's dependencies the first time
(`npm ci`, from the tracked lockfile), starts the dev server, prints ONE URL with the token
already in it, and opens it. Ctrl-C stops both. Run it from the **main clone** — a worktree
carries no canonical spine, and the launcher says so by name rather than dying oddly.

Flags, all optional: `--port` (door, 8317) · `--app-port` (this app, 5180) · `--spine <dir>`
to drive a fixture instead of the canonical spine · `--no-open` · `--token`. An unknown or
repeated flag is refused with exit 2 rather than quietly taking a default.

<details><summary>the two processes by hand, if you need them separately</summary>

```bash
# 1. the door, from the MAIN clone
node .claude/scripts/hq/arc-dash.mjs            # prints a URL with #token=...

# 2. this app -- and then paste that token into the app's URL fragment yourself
cd face && npm ci && npm run dev
```

This is what the launcher exists to replace. The token is regenerated every boot, so doing it
by hand means hand-copying a 32-character secret into a URL bar before you can look at your
own company — which is the kind of entry fee that gets a product used on day one and skipped
on day three.

</details>

`vite.config.ts` proxies `/api` to the door, so the browser never sees a cross-origin
request and the door keeps its zero-CORS posture (ADR-1312). Its listen port AND its
origin allow-list both come from `ARC_FACE_APP_PORT`, which the launcher sets: they were two
literals once, and moving one without the other made every read work while every stamp 403'd.

## Tokens

`src/tokens.css` is a COPY of `docs/design/system/tokens.css`, written by
`.claude/scripts/core/face-tokens.mjs`. A copy rather than a symlink because a symlink does
not survive a repo split and breaks the Windows leg. `--check` turns a hand-edit into a
named CI failure, the same posture as `face-sections`.

---
description: Scaffold one face module (module.mjs, fold.mjs, ops.mjs, View.tsx) for a room the door serves, and prove it green on face-pure and face-coverage in the same command. Refuses an id /api/rooms does not serve.
argument-hint: "<ring>/<id>"
allowed-tools: Bash(node .claude/scripts/hq/face-module.mjs:*), Bash(node .claude/scripts/core/face-pure.mjs:*), Bash(node .claude/scripts/core/face-coverage.mjs:*), Read, Glob, Grep
---

Scaffold: **$ARGUMENTS** — a `RING/ID`, for example `command/chat-mcp`.

A face room is a module: four files under `face/src/modules/RING/ID/`, and no fifth (ADR-1320).
`module.mjs` is the manifest, `fold.mjs` holds every decision where node can import it with no
install, `ops.mjs` lists the room's verbs (empty until Phase 05's work door), and `View.tsx` renders
what `fold()` returned and decides nothing. The served registry is the only room list: a module
attaches to a room `GET /api/rooms` serves, in the ring it is served in (ADR-1306, ADR-1321).

## 1. Scaffold and prove it, in one command

```bash
node .claude/scripts/hq/face-module.mjs <ring>/<id>
```

The script writes the four files from its template, then runs `face-pure` over the module tree and
`face-coverage`'s module half over the repo. Print its output as-is.

- **`face-module: GREEN ...`** — the module exists and both gates pass. Its View renders
  `NOT SERVED` until `module.mjs` names a door route (ADR-1324).
- **`face-module: REFUSED ...`** — nothing was written. The line says why: the door serves no such
  room, the ring is not the one it is served in, it is the lane template, it is a v0.7 extra room
  whose ADR-1327 exemption row is missing, or the room already has a module. Report the reason; do
  not work around it by editing the registry or the exemption list from here.
- **`face-module: RED ...`** — the module failed a gate, and everything the run wrote was removed.
  The `FAIL` lines above it name the finding.
- **Exit 2** — a bad argument or an unreadable registry; nothing was written.

## 2. What comes next is not this command's

Porting the v0.7 design into the module, declaring its routes, and moving its decisions into
`fold.mjs` are the ring's own work (face v2 Phase 03). The four extra rooms (`factory`, `executor`,
`agents`, `story`) take a module only after their exemption row lands in
`initiatives/face/contracts/module-exemptions.json`, citing ADR-1327.

Run nothing else here: no tests (CI is where they run), no install, no build.

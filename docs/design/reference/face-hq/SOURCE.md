# Source of the reference design — arc face HQ (v0.7, "the workroom")

**Form:** a running Vite + React app — source, not screenshots — with its own smoke and
write-flow harness. The strongest form this directory accepts.

**Where:** `assets/arcface/` · run with `npm install && npm run dev` · verify with the commands in
`assets/arcface/CHANGES-v0.7.md` § Verify.

**What it is:** the owner's v0.7 HQ (2026-09-15) — "the workroom redesign". **36 rooms in arc's
five rings** over one shell (240 px rail, 56 px header, ⌘K palette, a voice dock in the content
column), one shared kit (`src/ui/kit.jsx`, `src/hq/bits.jsx`), two moods (`html.hq` dark ·
`html.hq.hq-light` paper) and `scripts/smoke.mjs` + `scripts/flows.mjs` (36 rooms, 20 write
flows). Canonical since 2026-09-16 by owner ruling (ADR-1318, face v2 Cycle 16).

## How it arrived

Copied 2026-09-17 (Phase 00 slice 01) from the owner's design app at
`E:/Work_Hub/01_Automemory/arc-face-hq2/assets/arcface`: **108 files, every one byte-verified
against the source** by sha256. Not copied: `node_modules/`, `dist/`, `.shots/` (screenshot
output) and `.gstack/` (a browser tool's state). The design-system spec it is polished against
landed beside the token file as `docs/design/system/hq-design-system-v0.7.md`.

**PII scan: clean.** The owner's email, every contact-shaped value in the private LexOS facts,
any email address, any Indian mobile number and common secret-key shapes: 0 hits across the 108
files; `gitleaks` reports no leaks; a planted-PII mutant fails the same scan. Nothing was
excluded for privacy. (The arc repo is public.)

## The rooms, against what arc serves

Measured against `initiatives/face/contracts/rooms.generated.json` — the canonical table is
`initiatives/face/PLAN.md` § Module inventory, and Phase 00 re-derives it into
`initiatives/face/contracts/modules-v2.json`:

- **29** v0.7 room ids equal a served id — including `ops`, `trader`, `discover`, which arc serves as planned (ADR-1328).
- **3** are renames; the module takes the served id: `today` ← overview · `engine-room` ← engine · `council-chamber` ← council.
- **4** exist only in v0.7 and ship labelled, exempted by name: `factory` · `executor` · `agents` · `story` (ADR-1327).
- Served with no v0.7 room: `chat-mcp` (planned, generic) and `lane` (the lane-room template).

## The four corrections on record

The reference is the target; the contract is the law; where they disagree the token file and the
ADRs are where they are made to agree. The owner's drop is not edited.

1. **v0.7 renders violet for council AND for simulated.** Collision #2, already adjudicated for
   v0.4: council renders `--accent-dim`; violet stays the non-real family alone (ADR-1322).
2. **v0.7 adds `--blue` for neutral progress** — a real gap in the token file, where a non-money
   meter had no honest colour. Adopted in Phase 01.
3. **`src/data/arcFacts.js`** (137 KB, generated with `scripts/trim-facts.mjs` from
   `scripts/arc-facts.json`) is a snapshot of repo facts. Its ancestor was stale on arrival. It
   stays here as reference and never enters the product; a module reads the door or renders
   `NOT SERVED` (ADR-1324).
4. **v0.7's brain runs in the browser with a pasted provider key and an `approve`/`reject` action
   protocol.** Not the product's Ask: `POST /api/ask`, zero write tools, `ASK_ACTIONS` =
   `open_room` · `set_speed` · `enter_hq` (ADR-1325). The reasoning is the 2026-08-24 ruling,
   kept verbatim in `assets/arcface-v0.4/SOURCE-v0.4.md`.

## Found at intake — for the phases that consume it

- **Fonts load from Google Fonts** (`index.html`: Anybody, Inter, JetBrains Mono via
  `fonts.googleapis.com`). The product is localhost with no third-party calls (ADR-1312); Phase 01
  decides how the kit gets these faces without a runtime fetch.
- **The harness was written for one machine:** `scripts/smoke.mjs` hardcodes
  `C:/Program Files/Google/Chrome/Application/chrome.exe` and relies on Node's global
  `WebSocket`. Phase 00 ports it per ADR-1335.
- **The flows assert on a browser `localStorage` log** (`arcface.ws.v1`) with 38 event kinds, 29 of
  which arc's spine does not have. Phase 05 binds them to real receipts (ADR-1334).
- The v0.4 collision table (simulated amber, council violet, a green liveness dot, a 3.94:1 faint
  text) was written against v0.4's palette. v0.7 retuned the palette (canvas `#0b0d10`, accent
  `#2dd4bf`, green `#3fb950` real money, amber `#e3b341`, red `#f85149`, violet `#a78bfa`, blue
  `#58a6ff`), so Phase 01 re-checks each collision against v0.7 and computes every ratio again.

## The record before this

`assets/arcface-v0.4/` is the Cycle 15 reference (eleven rooms), kept, with its own
`SOURCE-v0.4.md` (the drop history, the four v0.4 collisions and the 2026-08-24 brain ruling)
and a `SUPERSEDED.md`. `docs/design/explore/face-hq-v{1,2}/` are marked superseded.

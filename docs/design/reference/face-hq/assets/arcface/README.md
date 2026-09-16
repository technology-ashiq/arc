# arc — Speak To The Company (v0.6 · the whole company)

Not a site about arc — **arc, operating**. Two layers over one persistent
particle face (the only element kept from the original concept, by request):

- **landing** — the face at full presence → ENTER HQ
- **hq** — the command room: **36 rooms in arc's five rings** (all 32 of
  arc's `expected-set.json` rooms + 4 of this app's own) over the dimmed
  face, where **everything on screen derives from a live event spine**
  and the face talks with a **real model brain** you plug in.
  `#hq/<room>` deep-links straight into a room.

## Run it

```bash
npm install
npm run dev        # full experience (+ real-spine dev API)
```

Or open `dist/index.html` straight from disk (pre-built; everything works
except the real-spine dev API, which needs the dev server).

## The three "real"s

**1 · Real events, not static panels.** An in-browser spine: append-only
event store + virtual clock (⏸/1×/10×/60× in the top bar). A seeded
simulator streams a virtual arc day — discover hunts, council verdicts,
phases closing, capped outreach, canary sweeps, revenue (labeled
`revenue.simulated`; real ₹ stays 0 and says so), day.closed, next day.
Every panel is a derived view over the log; approving/rejecting/promoting
APPENDS events (`decision.recorded`, `autonomy.changed`) — history is
never mutated. Optionally render **your real spine** (read-only): copy
`.env.example` → `.env.local`, set `ARC_SPINE_DIR`, `npm run dev`,
then Engine room → connect.

**2 · Real brain.** Engine room → pick a driver, paste a key:
**Claude · ChatGPT · Gemini · OpenRouter · any OpenAI-compatible URL**
(z.ai, DeepSeek, ollama, LM Studio…). Streaming answers, spoken sentence
by sentence. The system prompt carries the full arc knowledge base plus a
LIVE STATE snapshot (inbox, KPIs, timeline, ladder, room), so it answers
about *now* — and it can OPERATE the HQ via an action protocol: open
rooms, approve/reject with your voice, change sim speed. Money-touching
and kill decisions are refused by prompt contract (E2 — human
sovereignty). Keys live in localStorage on this machine only; calls go
browser → provider directly. No key → the offline matcher still answers
(including live-state questions), honestly labeled.

**3 · Real interaction.** Approval cards carry the three facts the HQ
design brief demands (council verdict · ₹ at stake · kill-criteria state)
ON the card; approve/reject-with-reason land in a done log with receipt
ids; `j/k` moves between cards, `a` approves, `r` rejects. Every ⌗ opens
the receipt drawer (payload, day, immutability notes). The council room
convenes live sessions; the autonomy room promotes/demotes with evidence;
gates switch profiles; charts hover; the ladder, pipeline and portfolio
all move with the log.

## The rooms — arc's five rings (registry: `src/hq/roomRegistry.js`)

Every room opens with arc's own sentence (room-copy.json) and is a working
module: form → event → derived view. Seeds are repo facts with `src` pointers
(`src/data/arcFacts.js`, generated read-only from the arc repo); your rows are
persisted and labeled YOURS; planned lanes (ops · trader · discover) are
drawn dotted and every write there says REHEARSAL.

| ring | rooms |
| --- | --- |
| command | today · **inbox** (arm-then-stamp, typed reason ≤2000 B, no bulk/undo) · **map** (36 stations, liveness folded from receipts, in-flight dots) · the spine · **board** (appetite bought vs spent, kill distance per lane) · **ask arc** (a brain with no hands — cites ULIDs, cannot stamp) |
| kernel | engine room · **model policy** (4 tiers, router classes, tier changes via the inbox) · **policy** (7 subjects × 8 capabilities, ceiling/cap/effective, two keys; absorbs the ladder) · **scheduler** (closed grammar, idem@slot, heartbeat seals the books) · **memory** (a correction made twice → rule proposal; recall is a fold, ₹0) · **evolve** (champion/challenger, per-arm floor, one pinned verdict, NO PROPOSAL first-class) · bench · absorb |
| factory | council · **develop** (slices → proofs → phase closes on evidence or is refused, with what is missing) · **review · ship** (7 gates, profiles, ledger keyed by HEAD, red code cannot ship) · design studio · **toolbelt** (26 commands · 30 agents · hooks · rules · 29 lints; pin / explain) · factory · executor · agents |
| money | money · growth · leads · legal · **ventures** (kill criteria, ABSENT where not instrumented, kill review → inbox) · **ops** (planned) · **trader** (planned; L0 lock display-only, paper only) · **discover** (planned; hunt → score → top-2 → council → stamp) |
| company | the law · learn · **strategy** (one live plan per lane, 265 ADRs, record an ADR) · **org** (16 lanes: awake / idle / blocked, waiting-on, birth a lane) · **concepts** (107 terms → room · station; ⌘K searches them) · story |

## Verify

```
npx vite build && npx vite preview --port 4173              # then, in another shell:
BASE=http://localhost:4173/ node scripts/smoke.mjs          # renders all 36 rooms + runs 20 write-path flows in headless Chrome
node scripts/shots.mjs                                      # dark + light screenshots (ROOMS=…, SIZES=phone, OPEN=palette, ROOMS=landing)
```
`.shots/report.json` lists every room's sentence check, every flow's result and any console error. `vite preview` binds `localhost`, not `127.0.0.1`.

## Design

The workroom reads one token set (`src/index.css`): `html.hq` is the dark mood, `html.hq.hq-light` the paper mood, and the landing keeps its own neon values on `:root`. The rules, the type scale and the component contract are in `../../docs/superpowers/specs/2026-09-15-hq-design-system.md`; the changelog for the redesign is `CHANGES-v0.7.md`.

## Map

```
src/spine/    kinds · store (event log + clock + actions) · sim (seeded day) · derive (views) · workspace (your persisted log) · registries (v0.6 folds)
src/data/     arcKnowledge (prose facts) · arcFacts (GENERATED repo facts with src pointers — scripts/trim-facts.mjs)
src/brain/    llm (4 wire formats, streaming) · persona (knowledge + live state + action protocol) · brain (hands / no hands) · localBrain
src/hq/       Landing · HQ shell · roomRegistry (36 rooms, rings, sentences, aliases) · bits · rooms/ (36)
scripts/      smoke.mjs + flows.mjs (headless-Chrome verification) · shots.mjs (dark/light screenshots) · trim-facts.mjs (facts generator)
src/face/     FaceStage — the kept particle face, presence-driven, voice-woken
src/lib/      voice (ears+mouth, sentence streaming) · stage · uiBus
src/chapters/ the story room's ten chapters
```

> Design-only concept. Intentionally **not** committed to the arc repo —
> and the real-spine mode only ever READS.

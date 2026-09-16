# Phase 02 — Shell + module frame: the v0.7 shell, the module tree, `face-pure`, the scaffold

**Goal (one line):** REQ-03 — the v0.7 shell reads only the served registry, every module is four files whose decisions run under node, and `face-pure` FAILs drift before a single one of the 36 modules is written (ADR-1320).
**Appetite:** 2 days
**Depends on:** phase-01
**Serves:** REQ-03
**Branch:** `feat/face-v2-02`
**Preconditions (STOP if absent):** Phase 01's PROGRESS row reads ✅ CLOSED via `/arc-phase-done 01` from the main clone.

## Exit criteria (Definition of Done)

- [ ] v0.7 shell ported: 240 px rail · 56 px header · ⌘K palette · the dock in the content column, **text-only** (ADR-1315); rail, palette and map read `/api/rooms` only — no shell file names a room.
- [ ] `face/src/modules/<ring>/` tree; a served room with no module renders through the generic module and is REPORTED by name (ADR-1321).
- [ ] `face/src/lib/registry.mjs` two-way reconcile (served ids ↔ module folders), node-tested in `tests/face/l3-logic.mjs`.
- [ ] `face-pure` (FAIL from birth, `.claude/scripts/core/`): `fold.mjs` may import only relative `.mjs` and node builtins; `View.tsx` may hold no comparison or arithmetic operator, no `if`/`switch`, no nested ternary, and conditions only on boolean fields `fold()` returns. Mutants: a planted branch in a `View.tsx` and a planted React import in a `fold.mjs` both FAIL; files-scanned count asserted > 0.
- [ ] `face-coverage` module half (REQ-04 groundwork): an orphan module folder FAILs; the extra-room exemption mechanism exists and is EMPTY until the factory and company rings add their named rows (ADR-1327).
- [ ] `/arc-face-module <ring>/<id>` (hand-written command + `.claude/scripts/hq/face-module.mjs`): scaffolds the four files from a template, refuses an id `/api/rooms` does not serve, and the scaffolded module is green on `face-pure` + `face-coverage` in 1 command; the new command is homed in `face-coverage`'s commands inventory AND the root `CLAUDE.md` hand-written-command count ("The other 21 commands") is updated in the same PR; `face-module.mjs`'s main-guard realpaths both sides (symlinked-tmpdir mutant).
- [ ] Browser suite green in both moods through the new shell on every Node ≥20.19 leg.
- [ ] Two fresh attackers (lint decision logic · scaffold shell/OS boundary); CI green per job; `/arc-phase-done 02` from the main clone.

## Verification plan

Coarse (refined via `/arc-change` when the phase starts): `face-pure` and `face-coverage` mutant fixtures RED first, then green on CI per job; scaffold demo from the main clone produces a green module in one command.

## Rabbit holes in this phase

- **`face-pure` as a TSX parser** — structural scan only (PLAN rabbit holes); no TypeScript compiler API.
- **Porting v0.7's `HQ.jsx` room switch** — it hard-codes rooms; the shell derives from `/api/rooms` instead (ADR-1306).

## Out of scope for this phase

Any of the 36 modules' content → Phase 03 · `ops.mjs` behaviour → Phase 05 (the file exists, empty, from the scaffold).

## Your-setup / pending

The owner runs the git for `feat/face-v2-02`.

## Non-negotiables (verbatim from PLAN)

<!-- Generated from PLAN.md at kickoff; resynced by /arc-change. Never hand-edited. -->

- The served registry is the only room list: modules attach to served ids, orphans are checked both ways, and the four extra rooms are exempted by name only (ADR-1306, ADR-1321, ADR-1327).
- Tokens have one source, `docs/design/system/tokens.css`; `face/src/tokens.css` is generated and never hand-edited, as `.claude/scripts/core/face-tokens.mjs --check` enforces; no colour literal under `face/src/modules/**`; council renders `--accent-dim` and violet is the non-real family alone (ADR-1308, ADR-1322).
- Every decision lives in a `.mjs` that node imports with no install: `fold.mjs` imports nothing from React, Vite or three, `View.tsx` carries no branch worth asserting, and Tailwind stops at L3 (ADR-1320, ADR-1323).
- `POST /api/decide` stays byte-parity with `arc-inbox`: the parity fixture is green on every PR of this cycle and is a Phase 05 exit criterion (ADR-1302, ADR-1333).
- Zero new spine kinds: every op emits a kind already in `validate.mjs` KINDS, and an op that would need a new one does not ship (ADR-0026, ADR-1334).
- Branch-only writes: a file-touching op writes to a `feat/face-*` branch, shows the diff and stops; `main` is untouchable and merge never exists in the face (ADR-1326).
- The WORK door has no logic of its own: each op shells the same script a hand-run calls, proven per op by a no-second-path fixture; an op without a green fixture ships read-only with an honest badge (ADR-1326).
- The SESSION door starts `arc-run --driver …`, never a harness binary (ADR-1326).
- No provider key in the browser; Ask keeps zero write tools and `ASK_ACTIONS` = `open_room` · `set_speed` · `enter_hq` (ADR-1325).
- No facts bundle under `face/src/**`: a module cites a door route or renders `NOT SERVED` (ADR-1324).
- No new surface outside `.claude/scripts/` this cycle; the layout move belongs to the distribute lane, in one atomic PR (ADR-1319).
- Real vs simulated / rehearsal / planned are never mixed or summed; planned rooms render dotted and every write inside them says REHEARSAL (ADR-1313, ADR-1328).
- Both moods ship together from Phase 01; light is never deferred to a later batch (ADR-1331).
- The reference is the target: v0.7 is the canonical design and the ported harness's frozen strings are the bar (ADR-1318, ADR-1330).
- REQ-10 claims the surface is operable over two real days and never claims the habit holds (ADR-1329).
- Localhost + token; no PII in git, the door or the intake; escaped serializer (ADR-1312).
- Zero product-code writes before explicit owner approval of this plan; each phase lands as its own feat branch + PR, and a phase closes through `/arc-phase-done` from the main clone before the next phase's branch opens (ADR-1332).
- Tests green on CI per job, never run on this box; the browser harness runs on every leg with Node ≥20.19 and Node 18 is a named, counted skip; structural face lints (`face-pure`, colour-literal, facts-bundle) FAIL from birth, heuristic arms start WARN-first; two fresh attackers per new gate (decision logic + shell/OS boundary) carrying the lane's fixed-defect list; assert it RAN before asserting what it printed (ADR-1335, ADR-1336).

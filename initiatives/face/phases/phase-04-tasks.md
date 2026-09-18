# Build Brief — phase 04 · Door read routes: serve what Phase 03 named

spec-hash: sha256:b5fffd13ce79dc72debb3c06f10a74ec67e7a08f25ddeee6396eebcf4ce90e52
lane: face
reqs: REQ-06
adrs: 0026, 1302, 1306, 1308, 1312, 1313, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336
blast-radius: .claude/scripts/, docs/design/system/tokens.css, face/src/**, face/src/modules/**, face/src/tokens.css, initiatives/face/evidence/phase-03/not-served-*.md, initiatives/face/evidence/phase-04/residue.md, tests/face/dash-doors.mjs
no-gos: (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 8

### Non-negotiables

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

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: The route list is derived from `initiatives/face/evidence/phase-03/not-served-*.md`; a route not on those lists is not built.
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: Each route: GET only, on the door's allow-list, inside the existing token + origin + bind posture (ADR-1312); its parser imported from the lint that already reads that file (scheduler, memory, evolve, bench, absorb … PLAN-face-v2 §11), never re-implemented.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: Reader-only lint green; route-enumeration fixture proves no write verb appeared.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `tests/face/dash-doors.mjs` gains ≥1 arm per route, each asserting the fixture LOADED before asserting the payload.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: Modules flip from `NOT SERVED` to live; the residue is 0 or a named, labelled list in `initiatives/face/evidence/phase-04/residue.md`.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: If the union exceeded 22 routes, the Block B reading re-scoped this phase first (assumptions ledger row 5).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: Two fresh attackers (route decision logic · HTTP boundary); CI green per job; `/arc-phase-done 04` from the main clone.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

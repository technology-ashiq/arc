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
proof: unit + contract -- on CI: tests/face/dash-doors.mjs's "P04 route list" arm reads the Phase 03 not-served lists and holds every Phase 04 route inside their union; tests/face/module-frame.mjs's PHASE 04 INPUT arms account for every panel those lists named (at least 40) as served or residue, none dropped
tier: unit
sources: phase-04-spec.md
decision: The 22 route strings of the five lists are the whole input. 18 are served (17 new GET routes plus /api/pnl?by=day on the existing route); the rest are residue named by ADR-1338. No route outside the union was built.
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: Each route: GET only, on the door's allow-list, inside the existing token + origin + bind posture (ADR-1312); its parser imported from the lint that already reads that file (scheduler, memory, evolve, bench, absorb … PLAN-face-v2 §11), never re-implemented.
kind: logic
risk: medium
proof: contract -- on CI, over HTTP against a fixture spine: tests/face/dash-doors.mjs's "P04 posture" arm holds every Phase 04 route at 401 NO_TOKEN without the token and 403 BAD_ORIGIN from a foreign Origin; its "P04 parsers" arm reads each route's served `parser` field and imports every module it names from .claude/scripts, failing when a module is missing, is the door itself, or does not export a name it is cited for; its "P04 route table" arm holds each route GET and on the allow-list once
tier: contract
sources: phase-04-spec.md
decision: Every handler lives in .claude/scripts/hq/lib/face/reads.mjs and lazily imports the owning lane's parser (engine yaml-subset and router-row, policy yaml and reduce, jobs panel, evolve board, memory adapters, bench ceilings, calibrate, develop ledger, absorb registry-ref, leads guard and caps, ledger ventures and kill panel); arc-dash.mjs keeps the one ROUTES table. Where a lane parser exists only inside a lint that exits at import, the panel is residue, never a re-implementation (ADR-1338).
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: Reader-only lint green; route-enumeration fixture proves no write verb appeared.
kind: logic
risk: medium
proof: static + contract -- on CI: tests/spine-reader-lint.bats holds the real tree clean (every spine read goes through spine.mjs); dash-doors' "route enumeration" arm holds POST /api/decide as EXACTLY one mutating route, and its "P04 route table" arm reads `arc-dash.mjs --routes` and holds each Phase 04 route on the table exactly once, GET, `mutates: false`, `spineEffect: none`
tier: contract
sources: phase-04-spec.md
decision: The 18 rows are GET, mutates false, spineEffect none; the write door is untouched.
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `tests/face/dash-doors.mjs` gains ≥1 arm per route, each asserting the fixture LOADED before asserting the payload.
kind: logic
risk: medium
proof: integration -- on CI: dash-doors generates its spine with `--phase04 1` (25 receipts every Phase 04 route folds) and asserts the fixture loaded (base 2000, phase04 25, events 2025) before any arm; one P04 arm per route asserts the payload against that fixture; the suite FAILs below its floor (ran >= 131)
tier: integration
sources: phase-04-spec.md
decision: A route's arm reads the receipts the fixture wrote for it, so an arm over an empty fold cannot pass; the by=day arm asserts the wire shape, and the fixture's own day is proven in phase04-folds, where deriveDaily is handed that day.
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: Modules flip from `NOT SERVED` to live; the residue is 0 or a named, labelled list in `initiatives/face/evidence/phase-04/residue.md`.
kind: logic
risk: medium
proof: unit + e2e-visual -- on CI: module-frame folds all 36 modules and holds evidence/phase-04/served.md (39 tables on 35 panels) and residue.md (15 panels on 10 routes) EQUAL to the folds, the two lists disjoint; tests/face-browser.bats counts the served tables and the residue panels in the rendered page on every leg; tests/face/phase04-folds.mjs pins each fold's decisions over bodies built to kill its mutants
tier: e2e-visual
sources: phase-04-spec.md
decision: 35 of 50 panels are served. The 15 residue panels each name their gap and the lane it is filed to; the owner approved the whole residue (ADR-1338, REQ-06 amended), since most of it is data no file or receipt records.
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: If the union exceeded 22 routes, the Block B reading re-scoped this phase first (assumptions ledger row 5).
kind: logic
risk: medium
proof: static -- the union was measured at the Block B reading before any route was built, from the five Phase 03 not-served lists: 22 route strings (PLAN assumptions row 5, "held: exactly 22"); dash-doors' "P04 route list" arm then keeps every built route inside that union on CI
tier: static
sources: phase-04-spec.md
decision: The union held at exactly 22, so the re-scope half of row 5 did not fire. Its OTHER half, a residue past three routes, did: FIRED 2026-09-18, routed through /arc-change, and REQ-06's bound amended by ADR-1338 on the owner's ruling.
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: Two fresh attackers (route decision logic · HTTP boundary); CI green per job; `/arc-phase-done 04` from the main clone.
kind: logic
risk: medium
proof: verified-real -- two fresh attackers per round (decision logic · HTTP/OS boundary), each carrying initiatives/face/fixed-defects.md; every hole they reproduced is fixed and pinned in phase04-folds, dash-doors or module-frame; CI read per job on the final head; the phase closes through /arc-phase-done 04 from the main clone
tier: verified-real
sources: phase-04-spec.md
decision: Round 1 found 25 holes and the first CI run one red; round 2 found the twins left open one route over, and CI two reds (fixed-defects.md, Phase 04 and its Round 2). A third pair verifies round 2 before the merge.
result: (empty until proven)
commit: (empty until proven)

# Build Brief — phase 03 · The 36 modules, read-side, in five ring PRs

spec-hash: sha256:80797c3bce24e136dea808b900c09f6e10894b8bf7c1592e0e5bfcc0e797bb47
lane: face
reqs: REQ-01, REQ-05
adrs: 0026, 0049, 1302, 1306, 1308, 1312, 1313, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336
blast-radius: , .claude/scripts/, .claude/scripts/core/face-facts.mjs, docs/design/system/tokens.css, face/src, face/src/**, face/src/lib/door.mjs, face/src/lib/registry.mjs, face/src/modules/**, face/src/rooms/, face/src/tokens.css, initiatives/face/archive/evidence-cycle15-2026-09-16/phase-09/room-sweep-by-eye.md, initiatives/face/evidence/phase-00/baseline-shots.json, initiatives/face/evidence/phase-03/not-served-<ring>.md, initiatives/face/evidence/phase-03/shot-review-RING.md, tests/face-browser.bats, tests/face/face-facts.mjs, tests/face/module-frame.mjs
no-gos: (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 20

### Non-negotiables

- The served registry is the only room list: modules attach to served ids, orphans are checked both ways, and the four extra rooms are exempted by name only (ADR-1306, ADR-1321, ADR-1327).
- Tokens have one source, `docs/design/system/tokens.css`; `face/src/tokens.css` is generated and never hand-edited, as `.claude/scripts/core/face-tokens.mjs --check` enforces; no colour literal under `face/src/modules/**`; council renders `--accent-dim` and violet is the non-real family alone (ADR-1308, ADR-1322).
- Every decision lives in a `.mjs` that node imports with no install: `fold.mjs` imports nothing from React, Vite or three, `View.tsx` carries no branch worth asserting, and Tailwind stops at L3 (ADR-1320, ADR-1323).
- `POST /api/decide` stays byte-parity with `arc-inbox`: the parity fixture is green on every PR of this cycle and is a Phase 05 exit criterion (ADR-1302, ADR-1333).
- Zero new spine kinds: every op emits a kind already in `validate.mjs` KINDS, and an op that would need a new one does not ship (ADR-0026, ADR-1334).
- Branch-only writes: a file-touching op writes to a `feat/face-*` branch, shows the diff and stops; `main` is untouchable and merge never exists in the face (ADR-1326).
- The WORK door has no logic of its own: each op shells the same script a hand-run calls, proven per op by a no-second-path fixture; an op without a green fixture ships read-only with an honest badge (ADR-1326).
- The SESSION door starts `arc-run --driver ...`, never a harness binary (ADR-1326).
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

likely-failure-mode: the read host loops or double-loads: a fold returning a fresh `reads` list on every fold re-triggers the load effect, or a fold throws on a payload still loading or refused; the other half is face-pure refusing constructs the v0.7 markup leans on (`+` concatenation, `.filter`/`.slice`, a data-keyed lookup, a ternary on raw data), forcing every one of those into fold.mjs
likely-regression-site: the inbox stamp and the ask when their Cycle 15 renderers are replaced by the v0.7 port: the reason validation, the refusal sentence and the re-read after a stamp now pass through `ctx.onAct` and the host instead of a room-local handler
riskiest-file: face/src/shell/RoomFrame.tsx -- the one host loop every module's data goes through: effects, abort on room change, polling, the as-of scrub and acts
expected-blockers: `tsc --noEmit` on the host's generic payload and read types; the facts-bundle lint's first real-tree run landing a FAIL on a Cycle 15 lib constant rather than on a bundle
expected-proof-failures: the first implementation run shows a face-pure finding on a ported View, and the browser smoke finds a console error from a read the fixture door refuses in sim mode

### Slices

#### slice: 01

title: Every module in the ring is four files (ADR-1320) and green on `face-pure` + `face-coverage`.
kind: logic
risk: high
proof: unit -- on CI for each ring's PR: tests/face/face-pure.mjs holds the real tree at findings=0 with the ring's modules counted; face-coverage's module half reads orphans=0; tests/face/module-frame.mjs's shipped-ring arm holds the ring's folders EQUAL to contracts/modules-v2.json's ids for it, no View importing face/src/rooms/, every declared route in DOOR_ROUTES, every boolean-named fold field a boolean -- red first with the ring listed before its modules are ported
tier: unit
sources: phase-03-spec.md, code:grep-fallback(1279; no .codegraph/), adrs(38), learning(2), retro(28), churn(319)
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: Browser suite: the ring's modules open with 0 console errors and 0 exceptions in both moods on every Node ≥20.19 leg.
kind: logic
risk: medium
proof: e2e-visual -- gh run view --json jobs on each ring PR's head: tests/face-browser.bats green on ubuntu Node 20 + 22, macOS and windows, each log carrying `smoke: opened=N openable=N errors=0` in dark and in light and the render line judged equal to face-coverage's module half; ubuntu Node 18 the counted skip
tier: e2e-visual
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: `initiatives/face/evidence/phase-03/not-served-<ring>.md` names every gap (module · panel · the route it needs) — this list, not PLAN-face-v2 §5.2's table, is what Phase 04 builds.
kind: logic
risk: medium
proof: unit -- tests/face/module-frame.mjs on CI folds every module of each shipped ring with no payloads and requires evidence/phase-03/not-served-RING.md's table (module · panel · route) to EQUAL the notServed entries the folds return, both ways; the smoke prints `smoke: not-served mood=M panels=N` per mood
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `face-dogfood` read and its count recorded in PROGRESS.md as a usage TREND (never counted toward REQ-10) — from the command ring onward.
kind: logic
risk: medium
proof: verified-real -- after each ring merges, `node .claude/scripts/core/face-dogfood.mjs` from the main clone; its summary line copied into PROGRESS.md's usage-trend line with the date, never counted toward REQ-10
tier: verified-real
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: Carried Cycle 15 findings (`initiatives/face/archive/evidence-cycle15-2026-09-16/phase-09/room-sweep-by-eye.md`) closed in their ring: **F1** the ADR band map names lanes, not rooms (the module that renders it) · **F2** the scheduler lede promises only what the module shows (kernel) · **F3** planned `trader` never wears LIVE (money, ADR-1328).
kind: logic
risk: medium
proof: unit -- tests/face/module-frame.mjs on CI: F1 the org fold's ADR band rows name a lane id from the registry and never a room name (company ring); F2 the scheduler fold's lede names only what its panels show and a field the door does not serve is a NOT SERVED panel (kernel ring); F3 the trader fold of a planned room returns isLive false and a REHEARSAL badge (money ring)
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: factory ring adds the named exemptions for `factory` · `executor` · `agents`; company ring adds `story` (ADR-1327) — unless the owner's §13 item 5 ruling gives a room a registry row instead. **Whole phase**
kind: logic
risk: medium
proof: unit -- face-coverage --selftest and tests/face-coverage.bats on CI read `exemptions=3` after the factory ring (factory · executor · agents, each naming ADR-1327) and `exemptions=4` after the company ring (story); the shell draws each extra as a labelled room, and the render line counts it
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: Shot review contract: candidate shots captured on the owner's box with the SAME contract as Phase 00's baseline (1440×1000, both moods, Chrome version recorded, `initiatives/face/evidence/phase-00/baseline-shots.json`); per ring, the `design-critic` agent — fresh, never the ring's author — judges each module's candidate against its baseline and writes `initiatives/face/evidence/phase-03/shot-review-RING.md`, one line per module × mood classed VIOLATION / BELOW-BAR / WEAKNESS / POLISH; a VIOLATION or BELOW-BAR blocks that ring's merge.
kind: logic
risk: medium
proof: verified-real -- per ring, `harness-run.mjs --shots DIR` from the branch build (1440x1000, both moods, Chrome version in the shots manifest); a fresh design-critic agent reads each candidate PNG beside its Phase 00 baseline PNG and writes evidence/phase-03/shot-review-RING.md, one line per module x mood; 0 VIOLATION and 0 BELOW-BAR before the ring's merge
tier: verified-real
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: 36/36 in both moods on CI; a fresh agent reviews per-module shots against the v0.7 baseline with 0 VIOLATION and 0 BELOW-BAR (ADR-0049; ADR-1322's council colour is a declared delta).
kind: logic
risk: medium
proof: e2e-visual -- after the company ring: the smoke on every Node >=20.19 leg opens the 36 modules and the generic chat-mcp room in both moods with 0 errors, and all five shot reviews read 0 VIOLATION and 0 BELOW-BAR
tier: e2e-visual
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: Facts-bundle lint (FAIL from birth) refuses a planted facts module under `face/src/**`.
kind: logic
risk: medium
proof: unit -- tests/face/face-facts.mjs on CI: each structural arm planted FAILs by kind (data file, link, import outside, ?raw import, JSON attribute, glob beyond code, asset URL, env value, static fetch, blob, JSON.parse of a literal, data mass, v0.7's bundle by name, unscannable), v0.7's arcFacts shape planted under face/src/lib FAILs, each heuristic arm WARNs with exit 0, and `face-facts.mjs` on the real tree prints fail=0 with files counted; red first on ERR_MODULE_NOT_FOUND
tier: unit
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: Block B tripwire reading (day 5 of 10, after command + kernel) recorded in PROGRESS.md; if 14 modules are not green → cut the remaining bespoke folds to generic renders.
kind: logic
risk: medium
proof: verified-real -- after the kernel ring merges: PROGRESS.md records the Block B reading with the green module count (command 6 + kernel 8) read off that PR's CI run, and the cut-or-continue ruling
tier: verified-real
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: The Phase 00 baseline list of throwing v1 rooms is empty.
kind: logic
risk: medium
proof: e2e-visual -- every ring PR's smoke line reads `excluded-errors=0` with no --exclude passed, on every configuration that builds L3; evidence/phase-00/delta-report.md's list stays MEASURED EMPTY
tier: e2e-visual
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: Two fresh attackers (facts-bundle lint decision logic · module/browser shell-OS boundary), each carrying the lane's fixed-defect list, run against the ring PR that SHIPS the facts-bundle lint — not deferred to the phase close (retro-log 2026-08-02: bind the attack to the PR that ships the gate); holes fixed and pinned.
kind: logic
risk: medium
proof: verified-real -- two fresh general-purpose agents on the command ring PR (decision logic: face-facts, the read host's registry decisions; shell/OS boundary: face-facts walk, the host loop, the shots capture), each in a private scratch directory with fixed-defects.md; every confirmed hole fixed, pinned and appended to fixed-defects.md; reports in evidence/phase-03/attacker-reports.md
tier: verified-real
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: `/arc-phase-done 03` once, after the company ring merges.
kind: logic
risk: medium
proof: verified-real -- /arc-phase-done 03 from the main clone after the company ring merges and main is re-verified by dispatch
tier: verified-real
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

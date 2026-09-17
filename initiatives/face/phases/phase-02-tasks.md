# Build Brief — phase 02 · Shell + module frame: the v0.7 shell, the module tree, `face-pure`, the scaffold

spec-hash: sha256:2b659e3af357a030b68b31ff87b500056c68d67cec53d8b6957d41b9d55ae0ad
lane: face
reqs: REQ-03
adrs: 0026, 1302, 1306, 1308, 1312, 1313, 1315, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336
blast-radius: .claude/scripts/, .claude/scripts/core/, .claude/scripts/hq/face-module.mjs, CLAUDE.md, docs/design/system/tokens.css, face/src/**, face/src/lib/registry.mjs, face/src/modules/**, face/src/modules/<ring>/, face/src/tokens.css, tests/face/l3-logic.mjs
no-gos: (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 12

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

likely-failure-mode: face-pure's structural View scan is wrong in one of two directions -- it flags a construct a real View needs (a type annotation, an `export ... from`, an arrow parameter list, a negative literal) or it misses a branch hidden in JSX that no operator token shows (a lookup keyed by data, a call such as `.filter`, a `??` default)
likely-regression-site: the browser smoke through the new shell: the fixed 240 px rail and 56 px header move `section[data-room]` and the scroll container, and `tsc --noEmit` joins the build step for the first time over Cycle 15 room code that CI has never typechecked
riskiest-file: .claude/scripts/core/face-pure.mjs -- a hand-written TSX lexer has to tell a JSX `<` from a comparison, a regex from a division, and a statement break from a continued expression without the TypeScript compiler
expected-blockers: the first `tsc --noEmit` on CI is red on pre-existing Cycle 15 room code; product-lint and the sync golden stop every job for the new synced files (face-pure.mjs, face-module.mjs, the command file) if either registration is missed
expected-proof-failures: the first implementation run shows face-pure findings on the carried module Views or the scaffold template, and at least one windows-only failure in the scaffold suite (a path separator in a module key, or the symlinked main-guard arm)

### Slices

#### slice: 01

title: v0.7 shell ported: 240 px rail · 56 px header · ⌘K palette · the dock in the content column, **text-only** (ADR-1315); rail, palette and map read `/api/rooms` only — no shell file names a room.
kind: logic
risk: high
proof: e2e-visual -- on CI, tests/face/module-frame.mjs finds no served room id as a quoted literal in any shell file (App.tsx, main.tsx, shell/**, lib/shell.mjs, lib/registry.mjs) and the same scan FAILs a planted one; the rail groups follow the served `rings`, home is the first openable room in them, and `g` resolves home from the registry; tests/face-browser.bats runs `tsc --noEmit` before `vite build` and, on every Node >=20.19 leg, prints both mood summaries clean through the new shell
tier: e2e-visual
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: `face/src/modules/<ring>/` tree; a served room with no module renders through the generic module and is REPORTED by name (ADR-1321).
kind: logic
risk: medium
proof: integration -- on CI the browser smoke reads `data-render` off every room and prints `smoke: render mood=M module=N generic=G unmarked=0 generic-rooms=...` in both moods, where the bats verdict requires N to equal the module folders on disk and N+G to equal openable (a mutant line with module=0 FAILs); face-coverage on the real tree prints the same generic rooms BY NAME and exits 0
tier: integration
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: `face/src/lib/registry.mjs` two-way reconcile (served ids ↔ module folders), node-tested in `tests/face/l3-logic.mjs`.
kind: logic
risk: medium
proof: unit -- tests/face/module-frame.mjs (run beside l3-logic from tests/face-l3.bats) on CI: attachModules names an orphan folder, a served room with no module, a misplaced ring, a manifest whose id or ring disagrees with its folder, a template folder, one id in two rings and a malformed glob key; on the real tree it attaches every folder and its generic set EQUALS face-coverage's module half; red first on ERR_MODULE_NOT_FOUND before registry.mjs exists
tier: unit
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `face-pure` (FAIL from birth, `.claude/scripts/core/`): `fold.mjs` may import only relative `.mjs` and node builtins; `View.tsx` may hold no comparison or arithmetic operator, no `if`/`switch`, no nested ternary, and conditions only on boolean fields `fold()` returns. Mutants: a planted branch in a `View.tsx` and a planted React import in a `fold.mjs` both FAIL; files-scanned count asserted > 0.
kind: logic
risk: medium
proof: unit -- tests/face/face-pure.mjs on CI: the real tree prints `face-pure: modules=N folds=N views=N` with N>0 and findings=0; the CLI exits 1 on a planted branch in a View.tsx and on a planted React import in a fold.mjs, each named by kind and line; every JSX-hidden branch in the assumptions ledger (`{x > 0 && <X/>}`, a ternary on raw data, a comparison inside a template literal) FAILs while a condition on an is/has/can/should/show field passes; every module's fold.mjs, module.mjs and ops.mjs is imported by node with no install and the boolean-named fields fold returns are booleans; red first on ERR_MODULE_NOT_FOUND
tier: unit
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: `face-coverage` module half (REQ-04 groundwork): an orphan module folder FAILs; the extra-room exemption mechanism exists and is EMPTY until the factory and company rings add their named rows (ADR-1327).
kind: logic
risk: medium
proof: unit -- `face-coverage --selftest` on CI prints PASS by name for: an orphan module folder, a misplaced ring, a template folder, an ADR-1327 extra exempted by name passes, an exemption for a room that is not an extra (the unnamed fifth), an exemption citing another ADR, an exemption for a served room, an unreadable module tree; and an exit-1 arm for the orphan; tests/face-coverage.bats reads `exemptions=0` and `orphans=0` off the real tree
tier: unit
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: `/arc-face-module <ring>/<id>` (hand-written command + `.claude/scripts/hq/face-module.mjs`): scaffolds the four files from a template, refuses an id `/api/rooms` does not serve, and the scaffolded module is green on `face-pure` + `face-coverage` in 1 command; the new command is homed in `face-coverage`'s commands inventory AND the root `CLAUDE.md` hand-written-command count ("The other 21 commands") is updated in the same PR; `face-module.mjs`'s main-guard realpaths both sides (symlinked-tmpdir mutant).
kind: logic
risk: medium
proof: integration -- tests/face/face-module.mjs on CI scaffolds a served room with no module into a scratch copy in one command that exits 0 and prints GREEN on face-pure and face-coverage's module half; it refuses an unserved id, the served ring's mismatch, the lane template, an unexempted extra, an existing module, a bad ring/id grammar and an unknown or `--flag=value` argument; a red verdict removes what it wrote; the script run through a symlink in a temp dir still runs (a counted skip only where the OS cannot make a symlink); expected-set.json homes the command and root CLAUDE.md's hand-written count equals the command files minus the generated ones
tier: integration
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: Browser suite green in both moods through the new shell on every Node ≥20.19 leg.
kind: logic
risk: medium
proof: e2e-visual -- gh run view --json jobs on the PR head SHA: tests/face-browser.bats green on ubuntu Node 20 + 22, macOS and windows, each job's log carrying `smoke: opened=33 openable=33 errors=0 ... mood=dark mood-miss=0`, the same line in light, and a render line per mood; ubuntu Node 18 a counted skip
tier: e2e-visual
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: Two fresh attackers (lint decision logic · scaffold shell/OS boundary); CI green per job; `/arc-phase-done 02` from the main clone.
kind: logic
risk: medium
proof: verified-real -- two fresh agents (decision logic: face-pure, registry reconcile, face-coverage module half; shell/OS boundary: face-module scaffold, lint walks, the browser render arm) each given fixed-defects.md; every confirmed hole fixed, pinned and appended to fixed-defects.md, reports in evidence/phase-02/attacker-reports.md; gh run view --json jobs on the PR head reads every job success (evidence/phase-02/ci-jobs.json); /arc-phase-done 02 from the main clone
tier: verified-real
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

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

### Prediction scores

likely-failure-mode: hit — the scan MISSED branches no operator token shows, in exactly the named direction: a lookup after an object literal and a computed key, a keyword spelled as a property opening a JSX element, and two whitespace/line-terminator classes that hid an import or a keyword (decision-logic attacker H1, H3, M2; shell/OS H3); the spec-fidelity pass added a boolean-named binding the View made itself; the other direction (a construct a real View needs flagged) never fired on the nine carried Views or the template (evidence/phase-02/attacker-reports.md, spec-fidelity.md)
likely-regression-site: hit — the typecheck half: `tsc --noEmit` joining the build found a pre-existing implicit any in face/src/lib/mood.mjs on the red-first run 35221247877 and the untyped ops lists on run 35224182573; the smoke through the new shell was green in both moods on every leg on its first implementation run (35224182573), so the rail/header half did not fire
riskiest-file: hit — .claude/scripts/core/face-pure.mjs carried more confirmed holes than any other file (4 HIGH decision-logic findings, the line-terminator HIGH, M2 and three LOW, then the spec-fidelity naming finding), all fixed in b29c0404 and 7718ae00
expected-blockers: hit — the first `tsc --noEmit` on CI was red on pre-existing Cycle 15 code (mood.mjs, run 35221247877); the second clause did not fire: product-lint and the sync golden were registered before the first push and stopped no job
expected-proof-failures: miss — the first implementation run (35224182573) showed no face-pure finding on the carried Views or the template and no windows-only failure in the scaffold suite; its one red was the untyped ops lists under the new typecheck, which nobody predicted

### Slices

#### slice: 01

title: v0.7 shell ported: 240 px rail · 56 px header · ⌘K palette · the dock in the content column, **text-only** (ADR-1315); rail, palette and map read `/api/rooms` only — no shell file names a room.
kind: logic
risk: high
proof: e2e-visual -- on CI, tests/face/module-frame.mjs finds no served room id as a quoted literal in any shell file (App.tsx, main.tsx, shell/**, lib/shell.mjs, lib/registry.mjs) and the same scan FAILs a planted one; the rail groups follow the served `rings`, home is the first openable room in them, and `g` resolves home from the registry; tests/face-browser.bats runs `tsc --noEmit` before `vite build` and, on every Node >=20.19 leg, prints both mood summaries clean through the new shell
tier: e2e-visual
sources: phase-02-spec.md
decision: App.tsx is the v0.7 shell (Rail 240 px, Header 56 px with the as-of scrub in the day player's place, Palette in v0.7's shape without its write intents, a text-only Dock asking through ask.mjs's read-only handle); rings, order and home come from the served registry (registry.mjs railGroups/homeRoom, byRing takes the served order), `g` returns room-home instead of spelling HOME, and the inbox chip opens the room that homes approval.requested; the face stage leaves the workroom in both moods as v0.7 has it (debt row paid) and keeps a WebGL guard; decisions the header and dock carried moved into registry.mjs (inboxChip, modeChip dot, citationLine) after the spec-fidelity pass; the shell-name scan is derived over every non-room file under face/src
result: arc-ci run 35230101361 on PR head 7718ae00 (19/19 jobs success, read per job; evidence/phase-02/ci-jobs.json): `face-browser: tsc --noEmit exit 0` then `npm ci and vite build` ok on ubuntu Node 20 and 22, macOS and windows; `smoke: opened=33 openable=33 errors=0 ... mood=dark mood-miss=0` and the same in light on each; tests/face/module-frame.mjs ok on all 5 configurations, including "no served room is named in face/src/App.tsx" over the derived shell scan, "MUTANT: a planted onOpen('money') is found", "the rail follows the served ring order, not a constant" and "g asks for home and names no room"; red first on run 35221247877 (ERR_MODULE_NOT_FOUND for registry.mjs, FAIL g goes home)
commit: 7718ae00

#### slice: 02

title: `face/src/modules/<ring>/` tree; a served room with no module renders through the generic module and is REPORTED by name (ADR-1321).
kind: logic
risk: medium
proof: integration -- on CI the browser smoke reads `data-render` off every room and prints `smoke: render mood=M module=N generic=G unmarked=0 generic-rooms=...` in both moods, where the bats verdict requires N to equal the module folders on disk and N+G to equal openable (a mutant line with module=0 FAILs); face-coverage on the real tree prints the same generic rooms BY NAME and exits 0
tier: integration
sources: phase-02-spec.md
decision: a module folder is face/src/modules/RING/ID; the nine rooms App.tsx used to switch on by id attach as CARRIED modules whose View mounts the Cycle 15 renderer until Phase 03 ports v0.7 (debt row); a served room with no module draws through RoomFrame's generic module, which prints a report line naming the room id above GenericRoom or IndexRoom (chosen by the registry's render field); section[data-room] carries data-render, smoke.mjs reads it per room and prints a render line per mood, and the bats render verdict requires the browser's module count and generic rooms to EQUAL face-coverage's module half
result: arc-ci run 35230101361 on PR head 7718ae00 (19/19 jobs success, read per job; evidence/phase-02/ci-jobs.json): `smoke: render mood=dark module=9 generic=24 unmarked=0 generic-rooms=engine-room,model-policy,...` and the same in light on ubuntu Node 20 and 22, macOS and windows, judged EQUAL to face-coverage's module-half line by render_verdict; the render MUTANT CONTROL ok on every configuration; face-coverage on the real tree prints `module half folders=9 served=33 generic=24 orphans=0 exemptions=0 generic-rooms=...`
commit: 7718ae00

#### slice: 03

title: `face/src/lib/registry.mjs` two-way reconcile (served ids ↔ module folders), node-tested in `tests/face/l3-logic.mjs`.
kind: logic
risk: medium
proof: unit -- tests/face/module-frame.mjs (run beside l3-logic from tests/face-l3.bats) on CI: attachModules names an orphan folder, a served room with no module, a misplaced ring, a manifest whose id or ring disagrees with its folder, a template folder, one id in two rings and a malformed glob key; on the real tree it attaches every folder and its generic set EQUALS face-coverage's module half; red first on ERR_MODULE_NOT_FOUND before registry.mjs exists
tier: unit
sources: phase-02-spec.md
decision: registry.mjs parses glob keys (./modules/RING/ID/FILE only), collects whole modules (missing file, no fold, no ops list, no default component, manifest id/ring/routes/asOf) and attaches them to the served registry both ways (orphan, template, misplaced ring, duplicate id), with a null-prototype map and Object.hasOwn after the attack found `constructor`, and a third argument for ADR-1327 exempted ids so browser and gate agree; tests in tests/face/module-frame.mjs beside l3-logic (declared in the spec-fidelity evidence), crossing the real tree with face-coverage's module half
result: arc-ci run 35230101361 on PR head 7718ae00 (19/19 jobs success, read per job; evidence/phase-02/ci-jobs.json): tests/face-l3.bats "the module frame attaches both ways, agrees with face-coverage, and no shell file names a room" ok on all 5 configurations (arms by name: ORPHAN, MISPLACED, the gate/browser generic equality, EXEMPTION AGREEMENT with and without a row, PROTOTYPE KEYS); red first on run 35221247877 (ERR_MODULE_NOT_FOUND)
commit: 7718ae00

#### slice: 04

title: `face-pure` (FAIL from birth, `.claude/scripts/core/`): `fold.mjs` may import only relative `.mjs` and node builtins; `View.tsx` may hold no comparison or arithmetic operator, no `if`/`switch`, no nested ternary, and conditions only on boolean fields `fold()` returns. Mutants: a planted branch in a `View.tsx` and a planted React import in a `fold.mjs` both FAIL; files-scanned count asserted > 0.
kind: logic
risk: medium
proof: unit -- tests/face/face-pure.mjs on CI: the real tree prints `face-pure: modules=N folds=N views=N` with N>0 and findings=0; the CLI exits 1 on a planted branch in a View.tsx and on a planted React import in a fold.mjs, each named by kind and line; every JSX-hidden branch in the assumptions ledger (`{x > 0 && <X/>}`, a ternary on raw data, a comparison inside a template literal) FAILs while a condition on an is/has/can/should/show field passes; every module's fold.mjs, module.mjs and ops.mjs is imported by node with no install and the boolean-named fields fold returns are booleans; red first on ERR_MODULE_NOT_FOUND
tier: unit
sources: phase-02-spec.md
decision: a hand-written lexer rather than a TypeScript parser (PLAN rabbit hole): JSX vs comparison and regex vs division by the token before, JavaScript's own whitespace and identifier classes, every line terminator, properties spelled like keywords; View rules for operators, keywords, calls (only .map, event methods, React's hooks from react, onX through ctx/props, local setX), lookups (after a name, a bracket, an object literal, and computed keys), defaults, nested ternaries, regexes, and conditions that must be a property read of fold's output named is/has/can/should/show, with any boolean-named binding the View makes itself a finding; imports of module.mjs/fold.mjs/ops.mjs followed transitively, relative .mjs inside face/src spelled exactly, node builtins except code loaders, no percent, query, fragment, require, import.meta, eval or Function; the four-file shape; every finding and name one line; FAIL from birth
result: arc-ci run 35230101361 on PR head 7718ae00 (19/19 jobs success, read per job; evidence/phase-02/ci-jobs.json): tests/face-l3.bats "face-pure FAILs a planted branch in a View and a planted React import in a fold, and the tree is pure" ok on all 5 configurations, arms by name including PLANTED branch and React import, the three JSX-hidden branches of the assumptions ledger, a condition on a boolean field passes, LINE TERMINATOR, UNICODE SPACE and PERCENT; the real tree `face-pure: modules=9 folds=9 views=9 files=36 findings=0`; forged-line arm ran on ubuntu and macOS; red first on run 35221247877 (ERR_MODULE_NOT_FOUND for face-pure.mjs)
commit: 7718ae00

#### slice: 05

title: `face-coverage` module half (REQ-04 groundwork): an orphan module folder FAILs; the extra-room exemption mechanism exists and is EMPTY until the factory and company rings add their named rows (ADR-1327).
kind: logic
risk: medium
proof: unit -- `face-coverage --selftest` on CI prints PASS by name for: an orphan module folder, a misplaced ring, a template folder, an ADR-1327 extra exempted by name passes, an exemption for a room that is not an extra (the unnamed fifth), an exemption citing another ADR, an exemption for a served room, an unreadable module tree; and an exit-1 arm for the orphan; tests/face-coverage.bats reads `exemptions=0` and `orphans=0` off the real tree
tier: unit
sources: phase-02-spec.md
decision: the module half lives in face-coverage.mjs (treeModules, moduleFindings) rather than a new gate, reads the served registry, modules-v2.json's extra class and initiatives/face/contracts/module-exemptions.json (created EMPTY), FAILs orphan, misplaced, template, duplicate and stray folders and every exemption that is not a named ADR-1327 extra with its folder, REPORTS generic rooms by id; eight selftest arms plus an exit arm and a wiring arm across gather; the walk never throws (UNREADABLE), and the entry uses process.exitCode
result: arc-ci run 35230101361 on PR head 7718ae00 (19/19 jobs success, read per job; evidence/phase-02/ci-jobs.json): tests/face-coverage.bats "face-coverage's module half FAILs an orphan and an unnamed exemption, and the exemption list is EMPTY" ok on all 5 configurations (eight mutant arms and the orphan exit arm by name, the modules wiring arm); the real tree `orphans=0 exemptions=0` with folders derived by find; red first on run 35221247877 ("module arm missing or failed: an orphan module folder")
commit: 7718ae00

#### slice: 06

title: `/arc-face-module <ring>/<id>` (hand-written command + `.claude/scripts/hq/face-module.mjs`): scaffolds the four files from a template, refuses an id `/api/rooms` does not serve, and the scaffolded module is green on `face-pure` + `face-coverage` in 1 command; the new command is homed in `face-coverage`'s commands inventory AND the root `CLAUDE.md` hand-written-command count ("The other 21 commands") is updated in the same PR; `face-module.mjs`'s main-guard realpaths both sides (symlinked-tmpdir mutant).
kind: logic
risk: medium
proof: integration -- tests/face/face-module.mjs on CI scaffolds a served room with no module into a scratch copy in one command that exits 0 and prints GREEN on face-pure and face-coverage's module half; it refuses an unserved id, the served ring's mismatch, the lane template, an unexempted extra, an existing module, a bad ring/id grammar and an unknown or `--flag=value` argument; a red verdict removes what it wrote; the script run through a symlink in a temp dir still runs (a counted skip only where the OS cannot make a symlink); expected-set.json homes the command and root CLAUDE.md's hand-written count equals the command files minus the generated ones
tier: integration
sources: phase-02-spec.md
decision: face-module.mjs refuses before writing (unserved, misplaced, template, unexempted extra, existing module in any ring, a link on the way down, unreadable contracts), writes the four files from an inline template with wx, proves face-pure over the modules tree and face-coverage's module half (declared: not the whole gate, debt row), and on RED or any throw rolls back exactly the folders it created, naming anything it could not remove; the command is homed in design-studio (expected-set.json, rooms.generated.json regenerated by face-sections), products/hq carries the command and script, products/core carries face-pure, root CLAUDE.md counts 24 hand-written commands (27 files minus 3 generated)
result: arc-ci run 35230101361 on PR head 7718ae00 (19/19 jobs success, read per job; evidence/phase-02/ci-jobs.json): tests/face-l3.bats "/arc-face-module scaffolds a module green on face-pure + face-coverage, and refuses what it must" ok on all 5 configurations, the log line `face-module: link-arm=ran posix-arms=ran symlink-arm=ran` on ubuntu and macOS; face-coverage on the real tree counts 27 commands, all homed; red first on run 35221247877 (FAIL the scaffold script exists)
commit: 7718ae00

#### slice: 07

title: Browser suite green in both moods through the new shell on every Node ≥20.19 leg.
kind: logic
risk: medium
proof: e2e-visual -- gh run view --json jobs on the PR head SHA: tests/face-browser.bats green on ubuntu Node 20 + 22, macOS and windows, each job's log carrying `smoke: opened=33 openable=33 errors=0 ... mood=dark mood-miss=0`, the same line in light, and a render line per mood; ubuntu Node 18 a counted skip
tier: e2e-visual
sources: phase-02-spec.md
decision: the browser suite runs tsc --noEmit before vite build (the typecheck debt row, which found mood.mjs and then the untyped ops lists), opens every openable room in both moods through the new shell, and judges a render line per mood against face-coverage's module half; a mutant control refuses a shell that attached nothing, an unmarked room, a short count, reordered generic rooms, and a missing gate line
result: arc-ci run 35230101361 on PR head 7718ae00 (19/19 jobs success, read per job; evidence/phase-02/ci-jobs.json): tests/face-browser.bats all 10 tests ok on ubuntu Node 20 and 22 (job 105231638919), windows shard 1/12 (105231638951) and macOS shard 1/3 (105231639067), both moods and both render lines each; ubuntu Node 18 (105231639058) the counted skip `SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19`
commit: 7718ae00

#### slice: 08

title: Two fresh attackers (lint decision logic · scaffold shell/OS boundary); CI green per job; `/arc-phase-done 02` from the main clone.
kind: logic
risk: medium
proof: verified-real -- two fresh agents (decision logic: face-pure, registry reconcile, face-coverage module half; shell/OS boundary: face-module scaffold, lint walks, the browser render arm) each given fixed-defects.md; every confirmed hole fixed, pinned and appended to fixed-defects.md, reports in evidence/phase-02/attacker-reports.md; gh run view --json jobs on the PR head reads every job success (evidence/phase-02/ci-jobs.json); /arc-phase-done 02 from the main clone
tier: verified-real
sources: phase-02-spec.md
decision: two general-purpose agents launched together on 335e4d28, each in a private scratch directory with fixed-defects.md: decision logic found 10 (4 HIGH), shell/OS boundary found 11 (3 HIGH); all 21 dispositioned in evidence/phase-02/attacker-reports.md, 20 FIXED and pinned (one partly SCOPE: string concatenation in the shell-name scan), 21 lines appended to fixed-defects.md; the spec-fidelity pass found drift, dispositioned in evidence/phase-02/spec-fidelity.md with its fixes pinned
result: attacker pair launched together on 335e4d28, dispositions in evidence/phase-02/attacker-reports.md (decision logic 10: 4 HIGH; shell/OS 11: 3 HIGH; 21 lines in fixed-defects.md); spec-fidelity FIDELITY: drift found, dispositions in evidence/phase-02/spec-fidelity.md; gh run view --json jobs read per job: PR #237 head 7718ae00 run 35230101361 19/19, merged d76657d1 (#237), main re-verified by workflow_dispatch run 35232834235 19/19 with the full suite 1..3409 and 0 not ok on ubuntu Node 20 (evidence/phase-02/ci-jobs.json); /arc-phase-done 02 from the main clone at d76657d1: kickoff-lint clean, live demo on the canonical spine 33/33 rooms (9 module, 24 generic) in both moods with 0 console errors, the scaffold demo GREEN in one command, receipts phase.closed 01M2QWMG3CSBD1B4JFSAKWEXYX and approval.requested 01M2QWMGM3FBKW5BMBAVAMZGKE
commit: d76657d1

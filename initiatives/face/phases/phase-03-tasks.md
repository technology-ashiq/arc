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

### Prediction scores

likely-failure-mode: hit — the second half fired in every ring: face-pure pushed the v0.7 markup's constructs into the folds (the money View's nested ternary became the fold's `hatch`, the law View's length comparisons became `isAmendmentEmpty`/`isTeethEmpty`, each on the ring's own lint run); the first half fired as a stale read, not a loop -- after a stamp the room sat on "reading" and a poll in flight brought the stamped approval back (command ring attack, RoomFrame's read epoch)
likely-regression-site: hit — the inbox stamp through the host: the command ring's shell attacker showed the stamped approval coming back from an in-flight poll and an as-of change hiding a stamp that had landed; fixed in the host (fixed-defects.md, command ring)
riskiest-file: miss — RoomFrame.tsx carried one race class; the files with the most confirmed holes were face-facts.mjs (command ring) and the shared readers built later -- lane-room.mjs (factory and money rings) and company-room.mjs (company ring, 13 logic holes)
expected-blockers: hit — the first clause fired: typecheck errors on the host's types reached CI (door.mjs untyped default, a never[] union, an unknown argument; run 35241805573); the second did not -- the lint's first real-tree red was macOS's /var realpath, not a Cycle 15 constant
expected-proof-failures: miss — no face-pure finding reached CI on a ported View (each was caught locally before the push), and no console error came from a refused read; the only console errors CI saw were the Windows runner's socket-buffer class (net::ERR_NO_BUFFER_SPACE), which nobody predicted and the money ring counted on its own line

### Slices

#### slice: 01

title: Every module in the ring is four files (ADR-1320) and green on `face-pure` + `face-coverage`.
kind: logic
risk: high
proof: unit -- on CI for each ring's PR: tests/face/face-pure.mjs holds the real tree at findings=0 with the ring's modules counted; face-coverage's module half reads orphans=0; tests/face/module-frame.mjs's shipped-ring arm holds the ring's folders EQUAL to contracts/modules-v2.json's ids for it, no View importing face/src/rooms/, every declared route in DOOR_ROUTES, every boolean-named fold field a boolean -- red first with the ring listed before its modules are ported
tier: unit
sources: phase-03-spec.md, code:grep-fallback(1279; no .codegraph/), adrs(38), learning(2), retro(28), churn(319)
decision: Every module is face/src/modules/RING/ID with module.mjs, fold.mjs, ops.mjs and View.tsx; decisions live in the fold, the View branches only on boolean fields the fold returns. The ring is held by tests/face/module-frame.mjs's shipped-ring arm (folders EQUAL to modules-v2.json's ids for the ring, an ADR-1327 extra counted only with its exemption row).
result: command 81dcf814 (#239, run 35248578768 on f8e43338) · kernel bee88cce (#240, run 35263610481 on 62e9ba44) · factory 98f405f5 (#242, run 35272310975 on 09090743) · money 969d9634 (#244, run 35323854485 on e562bed7) · company d8386216 (#246, run 35334544298 on f08e04a6, code head ca2d5352 run 35334146777), each 19/19 read per job. After the company ring: `face-pure: modules=36 folds=36 views=36 files=144 findings=0`; face-coverage's module half `orphans=0 exemptions=2` (executor, agents -- the owner's section 13 item 5 ruling gave story and factory registry rows, ADR-1337); module-frame's SHIPPED RING arms green for command, kernel, factory, money and company.
commit: d8386216

#### slice: 02

title: Browser suite: the ring's modules open with 0 console errors and 0 exceptions in both moods on every Node ≥20.19 leg.
kind: logic
risk: medium
proof: e2e-visual -- gh run view --json jobs on each ring PR's head: tests/face-browser.bats green on ubuntu Node 20 + 22, macOS and windows, each log carrying `smoke: opened=N openable=N errors=0` in dark and in light and the render line judged equal to face-coverage's module half; ubuntu Node 18 the counted skip
tier: e2e-visual
sources: phase-03-spec.md
decision: The browser smoke opens every openable served room and, from the company ring, the two exempted extras from the contract file, in both moods; the bats verdicts read each mood's own lines.
result: command 81dcf814 (#239, run 35248578768 on f8e43338) · kernel bee88cce (#240, run 35263610481 on 62e9ba44) · factory 98f405f5 (#242, run 35272310975 on 09090743) · money 969d9634 (#244, run 35323854485 on e562bed7) · company d8386216 (#246, run 35334544298 on f08e04a6, code head ca2d5352 run 35334146777), each 19/19 read per job. Final head, every L3 leg (ubuntu Node 20 and 22, macOS, windows): `smoke: opened=35 openable=35 errors=0 ... unsettled=0 expected=35 ... mood-miss=0` in dark and light, `render module=34 generic=1 generic-rooms=chat-mcp`, `extras expected=2 opened=2 errors=0 rooms=agents,executor`; ubuntu Node 18 the counted skip. main re-verified by dispatch: run 35336492657, 19/19 on d8386216.
commit: d8386216

#### slice: 03

title: `initiatives/face/evidence/phase-03/not-served-<ring>.md` names every gap (module · panel · the route it needs) — this list, not PLAN-face-v2 §5.2's table, is what Phase 04 builds.
kind: logic
risk: medium
proof: unit -- tests/face/module-frame.mjs on CI folds every module of each shipped ring with no payloads and requires evidence/phase-03/not-served-RING.md's table (module · panel · route) to EQUAL the notServed entries the folds return, both ways; the smoke prints `smoke: not-served mood=M panels=N` per mood
tier: unit
sources: phase-03-spec.md
decision: notServed(panel, route, sentence) in the folds; the lists are derived from the folds, never typed, and held EQUAL both ways as multisets, including the sentence, with a trailing newline and no stray list for an unshipped ring.
result: evidence/phase-03/not-served-{command,kernel,factory,money,company}.md; the browser counts the same panels per room per mood (company head: `not-served mood=dark panels=48`, EQUAL per room to the five lists). These lists, not PLAN-face-v2 section 5.2, are Phase 04's work.
commit: d8386216

#### slice: 04

title: `face-dogfood` read and its count recorded in PROGRESS.md as a usage TREND (never counted toward REQ-10) — from the command ring onward.
kind: logic
risk: medium
proof: verified-real -- after each ring merges, `node .claude/scripts/core/face-dogfood.mjs` from the main clone; its summary line copied into PROGRESS.md's usage-trend line with the date, never counted toward REQ-10
tier: verified-real
sources: phase-03-spec.md
decision: `face-dogfood` from the main clone after each ring merges; the summary copied into PROGRESS.md's usage-trend line as a TREND, never counted toward REQ-10 (ADR-1329).
result: Five readings, every one 6 matched · 55 decided outside the face · 1 of 5 days: command 2026-09-17, kernel, factory (98f405f5), money (969d9634) and company (d8386216) 2026-09-18. The surface has not yet been where a decision was made; Phase 07's two-day bar has to move it.
commit: d8386216

#### slice: 05

title: Carried Cycle 15 findings (`initiatives/face/archive/evidence-cycle15-2026-09-16/phase-09/room-sweep-by-eye.md`) closed in their ring: **F1** the ADR band map names lanes, not rooms (the module that renders it) · **F2** the scheduler lede promises only what the module shows (kernel) · **F3** planned `trader` never wears LIVE (money, ADR-1328).
kind: logic
risk: medium
proof: unit -- tests/face/module-frame.mjs on CI: F1 the org fold's ADR band rows name a lane id from the registry and never a room name (company ring); F2 the scheduler fold's lede names only what its panels show and a field the door does not serve is a NOT SERVED panel (kernel ring); F3 the trader fold of a planned room returns isLive false and a REHEARSAL badge (money ring)
tier: unit
sources: phase-03-spec.md
decision: F2 in the kernel ring (the scheduler's lede promises only what the room shows; next fire and last outcome are NOT SERVED panels), F3 in the money ring (planned rooms from planned-rooms.json, dotted, every flow REHEARSAL, stateBadge 'planned' first, a pill-shaped LIVE refused by room id in both moods), F1 in the company ring -- org's band map reads PORTFOLIO.md's band table, so each century names the LANE, held against the board's lanes (a declared delta from this slice's proof, which said 'a lane id from the registry': the registry homes bands to ROOMS, which was F1's cause).
result: F2: module-frame's F2 arm, kernel run 35263610481. F3: `smoke: planned rooms=4 expected=4 live=0` in both moods, money run 35323854485. F1: tests/face/company-ring.mjs 'F1: the face band 1300-1399 names the lane face, not the room toolbelt' and its Cycle 15 mutant ('bands homed to ROOMS fails the same lane check'), company run 35334146777; the fresh shot re-read saw every band name a lane.
commit: d8386216

#### slice: 06

title: factory ring adds the named exemptions for `factory` · `executor` · `agents`; company ring adds `story` (ADR-1327) — unless the owner's §13 item 5 ruling gives a room a registry row instead. **Whole phase**
kind: logic
risk: medium
proof: unit -- face-coverage --selftest and tests/face-coverage.bats on CI read `exemptions=3` after the factory ring (factory · executor · agents, each naming ADR-1327) and `exemptions=4` after the company ring (story); the shell draws each extra as a labelled room, and the render line counts it
tier: unit
sources: phase-03-spec.md
decision: The owner ruled PLAN-face-v2 section 13 item 5 on 2026-09-18, asked before the company ring as PROGRESS required: 'Both registry row'. ADR-1337: story and factory get served-registry rows (written through face-sections); executor and agents stay ADR-1327 exemptions whose rows carry their room facts, served on the door's allow-list, drawn in the rail with an extra label only where their module lives.
result: face-coverage module half `orphans=0 exemptions=2`; face-coverage.bats 'names exactly the two exempt extras' and the selftest's exemption-row arms (ring, name, sentence) green on company run 35334146777; the shell attaches every real folder through the rows (module-frame), and the smoke's extras line reads `expected=2 opened=2 errors=0` in both moods. The factory ring's three extras shipped in the company ring's PR, after the ruling unblocked them.
commit: d8386216

#### slice: 07

title: Shot review contract: candidate shots captured on the owner's box with the SAME contract as Phase 00's baseline (1440×1000, both moods, Chrome version recorded, `initiatives/face/evidence/phase-00/baseline-shots.json`); per ring, the `design-critic` agent — fresh, never the ring's author — judges each module's candidate against its baseline and writes `initiatives/face/evidence/phase-03/shot-review-RING.md`, one line per module × mood classed VIOLATION / BELOW-BAR / WEAKNESS / POLISH; a VIOLATION or BELOW-BAR blocks that ring's merge.
kind: logic
risk: medium
proof: verified-real -- per ring, `harness-run.mjs --shots DIR` from the branch build (1440x1000, both moods, Chrome version in the shots manifest); a fresh design-critic agent reads each candidate PNG beside its Phase 00 baseline PNG and writes evidence/phase-03/shot-review-RING.md, one line per module x mood; 0 VIOLATION and 0 BELOW-BAR before the ring's merge
tier: verified-real
sources: phase-03-spec.md
decision: `harness-run.mjs --shots` from each ring's branch build (1440x1000, both moods, the Chrome version in the manifest, shots pinned by sha256); a fresh design-critic per ring, never the ring's author, and the author looks at the PNGs before carrying a verdict.
result: evidence/phase-03/shots-{command,kernel,factory,money,company}.json and shot-review-{command,kernel,factory,money,company}.md, each 0 VIOLATION and 0 BELOW-BAR before its merge. Two reviews needed a re-read: money (its WEAKNESS rows paid in the PR, then re-read RESOLVED) and company (its first read quoted baseline pixels as candidate findings; the author's crops and a fresh re-read told to quote only named candidate files ruled them not present).
commit: d8386216

#### slice: 08

title: 36/36 in both moods on CI; a fresh agent reviews per-module shots against the v0.7 baseline with 0 VIOLATION and 0 BELOW-BAR (ADR-0049; ADR-1322's council colour is a declared delta).
kind: logic
risk: medium
proof: e2e-visual -- after the company ring: the smoke on every Node >=20.19 leg opens the 36 modules and the generic chat-mcp room in both moods with 0 errors, and all five shot reviews read 0 VIOLATION and 0 BELOW-BAR
tier: e2e-visual
sources: phase-03-spec.md
decision: 36 modules: 29 same-id + 3 renamed + 2 extras with registry rows + 2 exempt extras; chat-mcp stays the generic planned room.
result: Company head, every L3 leg: `heading rings=command,kernel,factory,money,company checked=36 miss=0` in both moods (34 served module rooms + 2 extras, each opening with the contract's frozen sentence), 0 errors, 0 exceptions; all five shot reviews 0 VIOLATION and 0 BELOW-BAR. main re-verified by dispatch: run 35336492657, 19/19 on d8386216.
commit: d8386216

#### slice: 09

title: Facts-bundle lint (FAIL from birth) refuses a planted facts module under `face/src/**`.
kind: logic
risk: medium
proof: unit -- tests/face/face-facts.mjs on CI: each structural arm planted FAILs by kind (data file, link, import outside, ?raw import, JSON attribute, glob beyond code, asset URL, env value, static fetch, blob, JSON.parse of a literal, data mass, v0.7's bundle by name, unscannable), v0.7's arcFacts shape planted under face/src/lib FAILs, each heuristic arm WARNs with exit 0, and `face-facts.mjs` on the real tree prints fail=0 with files counted; red first on ERR_MODULE_NOT_FOUND
tier: unit
sources: phase-03-spec.md
decision: `.claude/scripts/core/face-facts.mjs` over face/src: structural arms FAIL from birth, heuristic arms WARN; shipped in the command ring PR.
result: tests/face/face-facts.mjs green on command run 35248578768 and every ring after; the lint on the final tree `face-facts: files=178 ... fail=0 warn=0` (company ring, local, the same command CI runs).
commit: 81dcf814

#### slice: 10

title: Block B tripwire reading (day 5 of 10, after command + kernel) recorded in PROGRESS.md; if 14 modules are not green → cut the remaining bespoke folds to generic renders.
kind: logic
risk: medium
proof: verified-real -- after the kernel ring merges: PROGRESS.md records the Block B reading with the green module count (command 6 + kernel 8) read off that PR's CI run, and the cut-or-continue ruling
tier: verified-real
sources: phase-03-spec.md
decision: After the kernel ring: 14 modules green (command 6 + kernel 8) is the clause's bar.
result: Recorded in PROGRESS.md 2026-09-18: GREEN, no cut -- run 35263610481, 19/19 on 62e9ba44, carrying `heading rings=command,kernel checked=14 miss=0`; the last three rings stayed bespoke folds.
commit: be832ac7

#### slice: 11

title: The Phase 00 baseline list of throwing v1 rooms is empty.
kind: logic
risk: medium
proof: e2e-visual -- every ring PR's smoke line reads `excluded-errors=0` with no --exclude passed, on every configuration that builds L3; evidence/phase-00/delta-report.md's list stays MEASURED EMPTY
tier: e2e-visual
sources: phase-03-spec.md
decision: The throwing-room baseline stays MEASURED EMPTY: the harness passes no --exclude, so the 0-exceptions assertion excludes nothing.
result: Every ring head's smoke line reads `excluded-errors=0` with 0 exceptions on every L3 leg; evidence/phase-00/delta-report.md's list is still '— none —'.
commit: d8386216

#### slice: 12

title: Two fresh attackers (facts-bundle lint decision logic · module/browser shell-OS boundary), each carrying the lane's fixed-defect list, run against the ring PR that SHIPS the facts-bundle lint — not deferred to the phase close (retro-log 2026-08-02: bind the attack to the PR that ships the gate); holes fixed and pinned.
kind: logic
risk: medium
proof: verified-real -- two fresh general-purpose agents on the command ring PR (decision logic: face-facts, the read host's registry decisions; shell/OS boundary: face-facts walk, the host loop, the shots capture), each in a private scratch directory with fixed-defects.md; every confirmed hole fixed, pinned and appended to fixed-defects.md; reports in evidence/phase-03/attacker-reports.md
tier: verified-real
sources: phase-03-spec.md
decision: Two fresh attackers against the PR that SHIPS each new gate -- the command ring (face-facts, the read host), and again in every later ring for its own new decision logic and shell surface; each carried fixed-defects.md, each in a private scratch directory.
result: Command ring: evidence/phase-03/attacker-reports.md, every hole fixed and pinned. Kernel, factory, money and company rings: the same pass per ring, recorded in fixed-defects.md (company ring: 23 holes, 13 logic and 10 shell/OS, every one fixed and pinned in tests/face/company-ring.mjs's ATTACK checks, cdp-client and the browser suite's mutant controls).
commit: 81dcf814

#### slice: 13

title: `/arc-phase-done 03` once, after the company ring merges.
kind: logic
risk: medium
proof: verified-real -- /arc-phase-done 03 from the main clone after the company ring merges and main is re-verified by dispatch
tier: verified-real
sources: phase-03-spec.md
decision: Closed once, after the company ring merged and main was re-verified by dispatch; the receipts come from the main clone.
result: The company ring merged as d8386216 (#246); main re-verified by dispatch: run 35336492657, 19/19 on d8386216. This close is the phase's last PR.
commit: d8386216

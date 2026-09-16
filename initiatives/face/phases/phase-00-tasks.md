# Build Brief — phase 00 · Harness steel thread: v0.7 in, L3 built on CI, the ported smoke opening today's rooms

spec-hash: sha256:1f13a280c599b0507b09a89f257dc0f827d3b4f92320694ef9224b8afedbb78c
lane: face
reqs: REQ-01, REQ-09
adrs: 0026, 1302, 1306, 1308, 1312, 1313, 1318, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331, 1332, 1333, 1334, 1335, 1336
blast-radius: .claude/rules/lanes.md, .claude/scripts/, .gitignore, .playwright-mcp/, docs/design/explore/face-hq-v{1,2}/, docs/design/reference/face-hq/SOURCE.md, docs/design/reference/face-hq/assets/arcface-v0.4/, docs/design/reference/face-hq/assets/arcface/, docs/design/system/hq-design-system-v0.7.md, docs/design/system/tokens.css, docs/retro-log.md, docs/superpowers/specs/2026-09-15-hq-design-system.md, face/, face/package-lock.json, face/scripts/*, face/scripts/cdp.mjs, face/scripts/smoke.mjs, face/src/**, face/src/modules/**, face/src/tokens.css, initiatives/face/archive/**, initiatives/face/contracts/modules-v2.json, initiatives/face/evidence/phase-00/, initiatives/face/evidence/phase-00/baseline-shots.json, initiatives/face/evidence/phase-00/delta-report.md, initiatives/face/fixed-defects.md, tests/embedded-program-probe.mjs, tests/face-browser.bats, tests/face/cdp-client.mjs, tests/face/dash-doors.mjs, tests/face/fake-cdp.mjs, tests/fixtures/face/gen-spine.mjs, tests/shard-timings.json
no-gos: (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 37

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

likely-failure-mode: the offline lockfile platform check FAILs on ubuntu and macOS, because face/package-lock.json was generated on Windows and lacks the non-Windows native bindings Vite 8 needs, forcing a lockfile regeneration inside this phase
likely-regression-site: CI shard balance in tests/shard-timings.json — npm ci + vite build + a Chrome run land a multi-minute cost on one windows shard and one macOS shard
riskiest-file: tests/face-browser.bats — three child processes (door, vite preview, Chrome) started and torn down across three OSes, with Windows process cleanup the likeliest leak
expected-blockers: Chrome launch failing on macos-latest (macOS 26 arm64) on the first CI run, and vite preview not forwarding /api to the door without an explicit preview.proxy
expected-proof-failures: the first CI run of tests/face-browser.bats is red on at least one of the windows or macOS configurations

### Slices

#### slice: 01

title: v0.7 source copied from `E:/Work_Hub/01_Automemory/arc-face-hq2/assets/arcface` to `docs/design/reference/face-hq/assets/arcface/`, **excluding** `node_modules/`, `dist/`, `.shots/`; the v0.4 tree moves to `docs/design/reference/face-hq/assets/arcface-v0.4/` with a `SUPERSEDED.md`; `docs/design/explore/face-hq-v{1,2}/` gain a superseded note — nothing deleted.
kind: logic
risk: high
proof: scratchpad verify-intake.mjs hashes every file of the owner's v0.7 source (minus node_modules, dist, .shots, .gstack) against the copy — missing, extra and differing counts must all be 0 with source files > 0; git ls-files counts 70 files under arcface-v0.4 and 108 under arcface
tier: static
sources: phase-00-spec.md, code:grep-fallback(1368; no .codegraph/), adrs(37), learning(3), retro(22), churn(352)
decision: v0.4 moved with git mv, v0.7 copied with tar excluding four directories — `.gstack/` (a tool-state dir the spec did not name) excluded too; the three code comments and the tokens.css provenance line that cited the v0.4 path now cite arcface-v0.4, the token copy regenerated (face-tokens --check exit 0); SUPERSEDED.md in arcface-v0.4 and both explore rounds
result: `source files=108 copied files=108 missing=0 extra=0 differ=0 excluded-dirs-present=0` (exit 0) · `git ls-files …/arcface-v0.4 | wc -l` = 70 · `git ls-files …/arcface | wc -l` = 108 · `face-tokens: face/src/tokens.css matches docs/design/system/tokens.css (14282 bytes)`
commit: 7e428de6

#### slice: 02

title: PII grep of the whole intake (owner email, phone numbers, LexOS contact values held in `~/.arc-private/legal/lexos`) is clean; any file that carries them is excluded and named in `SOURCE.md`. The arc repo is public.
kind: logic
risk: medium
proof: scratchpad pii-scan.mjs over the 108 intake files — the owner email, every contact-shaped value in ~/.arc-private/legal/lexos/*.yaml, any email, any Indian mobile number and common secret-key shapes must all count 0, with files scanned > 0 and private values loaded > 0; a planted-PII mutant must exit 1; gitleaks dir over the same tree must report no leaks
tier: static
sources: phase-00-spec.md, code:grep-fallback(1481; no .codegraph/), adrs(37), learning(3), retro(20), churn(461)
decision: counts and file names only, never a matched value, so the proof itself cannot leak; nothing needed excluding — SOURCE.md (slice 03) records the clean result
result: `scanned files=108 private contact values loaded=8` · `literal: 0 file(s)` · `email: 0 file(s)` · `indianPhone: 0 file(s)` · `secret: 0 file(s)` (exit 0) · mutant: `literal: 1 … email: 1 … indianPhone: 1 … secret: 1` MUTANT_EXIT=1 · gitleaks: `scanned ~1337810 bytes (1.34 MB)` `no leaks found` (exit 0)
commit: e0b61682

#### slice: 03

title: `docs/design/reference/face-hq/SOURCE.md` rewritten against v0.7 — form · where · what — and the four corrections on record (PLAN-face-v2 §1): **(1)** v0.7 renders violet for council AND simulated; the token law keeps council `--accent-dim` (ADR-1322) · **(2)** v0.7's `--blue` (neutral progress) is adopted · **(3)** `src/data/arcFacts.js` (137 KB facts snapshot) never enters the product (ADR-1324) · **(4)** v0.7's browser-side brain with a pasted key and `approve`/`reject` actions is not the product's Ask (ADR-1325).
kind: logic
risk: medium
proof: grep counts over the new SOURCE.md for each required element (v0.7, 108 files, ADR-1322, --blue, ADR-1324, ADR-1325, PII scan: clean, SOURCE-v0.4.md, Google Fonts) must each be >= 1, and assets/arcface-v0.4/SOURCE-v0.4.md must exist and still hold the Decided 2026-08-24 ruling
tier: static
sources: phase-00-spec.md, code:grep-fallback(1482; no .codegraph/), adrs(37), learning(3), retro(22), churn(462)
decision: the v0.4 SOURCE.md moves to assets/arcface-v0.4/SOURCE-v0.4.md with git mv instead of being overwritten, so its drop history, collision table and the 2026-08-24 brain ruling (cited by ADR-1325) survive; two intake findings recorded for later phases: Google Fonts fetched at runtime (Phase 01 vs ADR-1312) and the v0.4 collision table needing a re-check against the retuned v0.7 palette (Phase 01)
result: `v0.7=12 108 files=1 ADR-1322=1 --blue=1 ADR-1324=1 ADR-1325=1 PII scan: clean=1 SOURCE-v0.4.md=2 Google Fonts=1` · SOURCE-v0.4.md present, `Decided 2026-08-24` count=1 · first ledger fill attempt (inline node -e) silently matched nothing — refilled from a file
commit: 9c1a52de

#### slice: 04

title: `docs/design/system/hq-design-system-v0.7.md` copied from `E:/Work_Hub/01_Automemory/arc-face-hq2/docs/superpowers/specs/2026-09-15-hq-design-system.md`. **Contract**
kind: logic
risk: medium
proof: sha256 of the owner's E:/Work_Hub/01_Automemory/arc-face-hq2/docs/superpowers/specs/2026-09-15-hq-design-system.md and of docs/design/system/hq-design-system-v0.7.md must be one unique value (uniq count 1), and the copy must be non-empty
tier: static
sources: phase-00-spec.md
decision: copied byte-for-byte, not rewritten; its first line already names itself v0.7 and says rooms are polished against it, which is the role ADR-1318 gives it
result: `sha256sum SRC DST | awk print-1 | uniq | wc -l` = 1 · `wc -l` = 78 · head: `# arc HQ design system (v0.7) — the workroom`
commit: (empty until proven)

#### slice: 05

title: `initiatives/face/contracts/modules-v2.json`, derived by a script from `src/hq/roomRegistry.js` + `rooms.generated.json`, never typed by hand: one row per module — `id` (always the SERVED id) · `alias` (the v0.7 id when it differs) · `ring` (read from `rooms.generated.json` for served ids and from `roomRegistry.js` for extras; both carry it and agree today — on disagreement the served ring wins and the delta report names it) · `class` (`served` | `served-planned` | `extra`) · v0.7 `reads` — plus the served entries that get no module (`chat-mcp` generic, `lane` template). Expected per PLAN § Module inventory: 36 modules = 29 same-id + 3 renamed + 4 extra; if the script disagrees, its output wins and the delta report says why.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: `initiatives/face/evidence/phase-00/delta-report.md` names every renamed id (`today`←overview · `engine-room`←engine · `council-chamber`←council), every extra (ADR-1327), the served-planned rooms (ADR-1328), and the served entries with no v0.7 design.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: `initiatives/face/fixed-defects.md` seeded — the lane's running list of already-fixed defects that every attacker prompt this cycle carries: each Cycle 15 hole recorded in `initiatives/face/archive/**` and the arc-face rows of `docs/retro-log.md`, one line each (defect · file it was fixed in · the pattern to check elsewhere). Every attacker pass this cycle appends to it.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: v0.7 baseline shots for REQ-01: the reference's own `scripts/shots.mjs` on the owner's box, 1440×1000, both moods, one shot per v0.7 room; PNGs stay local and gitignored (Cycle 15's `.playwright-mcp/` precedent); `initiatives/face/evidence/phase-00/baseline-shots.json` commits room id · mood · sha256 · viewport · Chrome version. **Harness thread (ADR-1330, ADR-1335)**
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: `face/scripts/cdp.mjs` — dependency-free RFC 6455 client (text frames, client masking) + CDP calls (launch, navigate, evaluate, console + exception stream). No `WebSocket` global.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: `tests/face/fake-cdp.mjs` + `tests/face/cdp-client.mjs` — the client proven against a scripted fake on all 5 CI configurations (no Chrome, no install).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: `face/scripts/smoke.mjs` ported from v0.7: Chrome discovery per ADR-1335 (`CHROME_BIN` only if set · Windows `App Paths` registry key then `%ProgramFiles%` · macOS `/Applications` · Linux `command -v google-chrome`) → FAIL naming every place tried; prints the runner image name; `--no-sandbox` on Linux; room ids read from `/api/rooms`, never a hand list; per-room console errors + exceptions; a JSON report printed to stdout.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: `tests/face-browser.bats`: (1) prints `node -v` and the runner image; Node <20.19 → prints `SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19` and the skip is asserted as a skip — and a SKIP on any leg other than the Node 18 leg FAILs, so a Node-20 leg pinned below 20.19 can never pass silently; (2) offline lockfile platform check FAILs if `face/package-lock.json` lacks the native optional entries this OS needs for what the lockfile holds TODAY (Vite 8's native bindings) — Phase 01 extends the same check to `@tailwindcss/oxide-*`; (3) `npm ci --include=optional` in `face/`; (4) `vite build`; (5) door started `--spine` over a fixture from `tests/fixtures/face/gen-spine.mjs` (exists — `tests/face/dash-doors.mjs` uses it); (6) `vite preview` with `ARC_DASH_ORIGIN` and a check that `/api/health` answers through the preview proxy; (7) smoke opens every OPENABLE room `/api/rooms` serves — 34 entries today, 33 openable; each `template` entry (today only `lane`) is printed by name as not opened, never silently dropped; (8) every executing job prints `face-browser: RAN leg=OS/NODE` — the file is picked up by the CI sharder (`shard-tests.mjs` refuses a file that lands in no shard), and the evidence lists that line per job, so "added a bats file" is never mistaken for "the gate ran".
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: Vacuous-pass guard, BOTH directions: the suite asserts `opened == openable > 0` (openable = `/api/rooms` entries whose `status` is not `template` — 33 today; PLAN § Module inventory) BEFORE asserting 0 console errors and 0 exceptions (a stub smoke that never navigates is kept as the mutant control and FAILs); AND a planted page that throws a real console error is opened over REAL Chrome — not `fake-cdp.mjs` — and the suite FAILs on it, proving the real socket path detects an error (retro-log 2026-08-17: a fake whose right answer equals the failure's answer proves nothing).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 14

title: No inline program strings: `tests/face-browser.bats` and `face/scripts/*` run no `node -e` / `bash -c` program text; every program is its own file (CLAUDE.md shell-string rule), and `tests/embedded-program-probe.mjs` — the existing automated half of that rule — scans the new files (its `scanned=` count rises), extended if it does not already reach them.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 15

title: `cdp.mjs` and `smoke.mjs` main-guards realpath BOTH `argv[1]` and `import.meta.url`; a symlinked-tmpdir mutant is the fixture (retro-log 2026-08-19, the fourth recurrence).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 16

title: A v1 room that throws is fixed only if the fix is one line; otherwise it goes on a named baseline list in the delta report that can only shrink, its Phase 03 module must empty it, and the suite's 0-exceptions assertion excludes exactly the ids on that list — never a global relaxation.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 17

title: A measured shard weight for `tests/face-browser.bats` is committed to `tests/shard-timings.json`, the table the CI sharder reads — never the 16 s default; before editing that shared table, `git log origin/main --oneline -5 -- tests/shard-timings.json` runs per `.claude/rules/lanes.md` § Shared files, and a collision is resolved by re-measuring on the merged tree, never by keeping the earlier number. **Close**
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 18

title: CI green per job on the PR head SHA (`gh run view <id> --json jobs`, head SHA = local HEAD): the browser arm EXECUTED on ubuntu Node 20 + 22, macOS and windows; the counted SKIP on ubuntu Node 18.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 19

title: Two fresh attackers — one on the smoke/CDP decision logic, one on the bats suite's shell/OS boundary — each carrying the lane's fixed-defect list; holes fixed and pinned as fixtures.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 20

title: `/arc-phase-done 00` from the main clone; PROGRESS row ✅ + done-log.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

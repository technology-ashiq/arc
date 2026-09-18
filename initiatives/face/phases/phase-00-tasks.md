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

likely-failure-mode: the offline lockfile platform check FAILs on ubuntu and macOS, because face/package-lock.json was generated on Windows and lacks the non-Windows native bindings Vite 8 needs, forcing a lockfile regeneration inside this phase
likely-regression-site: CI shard balance in tests/shard-timings.json — npm ci + vite build + a Chrome run land a multi-minute cost on one windows shard and one macOS shard
riskiest-file: tests/face-browser.bats — three child processes (door, vite preview, Chrome) started and torn down across three OSes, with Windows process cleanup the likeliest leak
expected-blockers: Chrome launch failing on macos-latest (macOS 26 arm64) on the first CI run, and vite preview not forwarding /api to the door without an explicit preview.proxy
expected-proof-failures: the first CI run of tests/face-browser.bats is red on at least one of the windows or macOS configurations

### Prediction scores

likely-failure-mode: miss — face/package-lock.json is unchanged on this branch (`git diff origin/main..HEAD -- face/package-lock.json` is empty) and the lockfile arm passed on ubuntu and macOS from its first run; what failed was the CHECK's own logic (presence without a version match, CI run 35150543730, fixed in f9805720) and, unforeseen, a settle gate measuring macOS runner weather (runs 35150543730 and 35183482747, fixed in 1af154f6)
likely-regression-site: hit — face-browser.bats measured 350 s as the first file of windows shard 1/12 and 314 s on macOS shard 1/3 (run 35184948635), now the heaviest file in tests/shard-timings.json; weight and re-derived `_floor` in 65e6ec05
riskiest-file: miss — tests/face-browser.bats carried real defects (the fd 3 guard and greedy extractions the attackers found, 78b65cb3 and ca6e26b6; no evidence on green jobs, 65e6ec05) but no Windows cleanup leak ever showed on CI; the file that took the most CI rounds was face/scripts/smoke.mjs (loaderId scoping 78b65cb3, twin filter and evidence f9805720, the 30 s cap 1af154f6), and face/scripts/proc.mjs's unref()ed awaited timers crashed the client suite (fixed 1af154f6)
expected-blockers: miss — Chrome launched on macos-latest on the first run; the macOS blocker was no WebGL (THREE.WebGLRenderer context failure, 0 of 33 rooms opened, run 35147618663), answered with SwiftShader in 78b65cb3; the preview proxy already existed and /api/health answered through it from the first run — the preview blocker was its port not matching the origin allow-list, so every stamp got a 403 (fixed in 78b65cb3)
expected-proof-failures: hit — the first CI runs of tests/face-browser.bats were red on macOS (no WebGL, 0 of 33 rooms opened) and on windows (every room after the first never settled), run 35147618663, fixed in 78b65cb3

### Slices

#### slice: 01

title: v0.7 source copied from `E:/Work_Hub/01_Automemory/arc-face-hq2/assets/arcface` to `docs/design/reference/face-hq/assets/arcface/`, **excluding** `node_modules/`, `dist/`, `.shots/`; the v0.4 tree moves to `docs/design/reference/face-hq/assets/arcface-v0.4/` with a `SUPERSEDED.md`; `docs/design/explore/face-hq-v{1,2}/` gain a superseded note — nothing deleted.
kind: logic
risk: high
proof: static — scratchpad verify-intake.mjs hashes every file of the owner's v0.7 source (minus node_modules, dist, .shots, .gstack) against the copy — missing, extra and differing counts must all be 0 with source files > 0; git ls-files counts 70 files under arcface-v0.4 and 108 under arcface
tier: static
sources: phase-00-spec.md, code:grep-fallback(1368; no .codegraph/), adrs(37), learning(3), retro(22), churn(352)
decision: v0.4 moved with git mv, v0.7 copied with tar excluding four directories — `.gstack/` (a tool-state dir the spec did not name) excluded too; the three code comments and the tokens.css provenance line that cited the v0.4 path now cite arcface-v0.4, the token copy regenerated (face-tokens --check exit 0); SUPERSEDED.md in arcface-v0.4 and both explore rounds
result: `source files=108 copied files=108 missing=0 extra=0 differ=0 excluded-dirs-present=0` (exit 0) · `git ls-files .../arcface-v0.4 | wc -l` = 70 · `git ls-files .../arcface | wc -l` = 108 · `face-tokens: face/src/tokens.css matches docs/design/system/tokens.css (14282 bytes)`
commit: 7e428de6

#### slice: 02

title: PII grep of the whole intake (owner email, phone numbers, LexOS contact values held in `~/.arc-private/legal/lexos`) is clean; any file that carries them is excluded and named in `SOURCE.md`. The arc repo is public.
kind: logic
risk: medium
proof: static — scratchpad pii-scan.mjs over the 108 intake files — the owner email, every contact-shaped value in ~/.arc-private/legal/lexos/*.yaml, any email, any Indian mobile number and common secret-key shapes must all count 0, with files scanned > 0 and private values loaded > 0; a planted-PII mutant must exit 1; gitleaks dir over the same tree must report no leaks
tier: static
sources: phase-00-spec.md, code:grep-fallback(1481; no .codegraph/), adrs(37), learning(3), retro(20), churn(461)
decision: counts and file names only, never a matched value, so the proof itself cannot leak; nothing needed excluding — SOURCE.md (slice 03) records the clean result
result: `scanned files=108 private contact values loaded=8` · `literal: 0 file(s)` · `email: 0 file(s)` · `indianPhone: 0 file(s)` · `secret: 0 file(s)` (exit 0) · mutant: `literal: 1 ... email: 1 ... indianPhone: 1 ... secret: 1` MUTANT_EXIT=1 · gitleaks: `scanned ~1337810 bytes (1.34 MB)` `no leaks found` (exit 0)
commit: e0b61682

#### slice: 03

title: `docs/design/reference/face-hq/SOURCE.md` rewritten against v0.7 — form · where · what — and the four corrections on record (PLAN-face-v2 §1): **(1)** v0.7 renders violet for council AND simulated; the token law keeps council `--accent-dim` (ADR-1322) · **(2)** v0.7's `--blue` (neutral progress) is adopted · **(3)** `src/data/arcFacts.js` (137 KB facts snapshot) never enters the product (ADR-1324) · **(4)** v0.7's browser-side brain with a pasted key and `approve`/`reject` actions is not the product's Ask (ADR-1325).
kind: logic
risk: medium
proof: static — grep counts over the new SOURCE.md for each required element (v0.7, 108 files, ADR-1322, --blue, ADR-1324, ADR-1325, PII scan: clean, SOURCE-v0.4.md, Google Fonts) must each be >= 1, and assets/arcface-v0.4/SOURCE-v0.4.md must exist and still hold the Decided 2026-08-24 ruling
tier: static
sources: phase-00-spec.md, code:grep-fallback(1482; no .codegraph/), adrs(37), learning(3), retro(22), churn(462)
decision: the v0.4 SOURCE.md moves to assets/arcface-v0.4/SOURCE-v0.4.md with git mv instead of being overwritten, so its drop history, collision table and the 2026-08-24 brain ruling (cited by ADR-1325) survive; two intake findings recorded for later phases: Google Fonts fetched at runtime (Phase 01 vs ADR-1312) and the v0.4 collision table needing a re-check against the retuned v0.7 palette (Phase 01)
result: `v0.7=12 108 files=1 ADR-1322=1 --blue=1 ADR-1324=1 ADR-1325=1 PII scan: clean=1 SOURCE-v0.4.md=2 Google Fonts=1` · SOURCE-v0.4.md present, `Decided 2026-08-24` count=1 · first ledger fill attempt (inline node -e) silently matched nothing — refilled from a file
commit: 9c1a52de

#### slice: 04

title: `docs/design/system/hq-design-system-v0.7.md` copied from `E:/Work_Hub/01_Automemory/arc-face-hq2/docs/superpowers/specs/2026-09-15-hq-design-system.md`. **Contract**
kind: logic
risk: medium
proof: static — sha256 of the owner's E:/Work_Hub/01_Automemory/arc-face-hq2/docs/superpowers/specs/2026-09-15-hq-design-system.md and of docs/design/system/hq-design-system-v0.7.md must be one unique value (uniq count 1), and the copy must be non-empty
tier: static
sources: phase-00-spec.md
decision: copied byte-for-byte, not rewritten; its first line already names itself v0.7 and says rooms are polished against it, which is the role ADR-1318 gives it
result: `sha256sum SRC DST | awk print-1 | uniq | wc -l` = 1 · `wc -l` = 78 · head: `# arc HQ design system (v0.7) — the workroom`
commit: f063dfb6

#### slice: 05

title: `initiatives/face/contracts/modules-v2.json`, derived by a script from `src/hq/roomRegistry.js` + `rooms.generated.json`, never typed by hand: one row per module — `id` (always the SERVED id) · `alias` (the v0.7 id when it differs) · `ring` (read from `rooms.generated.json` for served ids and from `roomRegistry.js` for extras; both carry it and agree today — on disagreement the served ring wins and the delta report names it) · `class` (`served` | `served-planned` | `extra`) · v0.7 `reads` — plus the served entries that get no module (`chat-mcp` generic, `lane` template). Expected per PLAN § Module inventory: 36 modules = 29 same-id + 3 renamed + 4 extra; if the script disagrees, its output wins and the delta report says why.
kind: logic
risk: medium
proof: `node .claude/scripts/hq/face-modules-contract.mjs` writes the contract and `--check` exits 0 with the derived counts; the same --check against a scratch copy must exit 1 for a hand-edited ring (DRIFT) and 1 for an unserved, unaliased, non-extra room (ORPHAN naming it), 0 for the untouched control, 2 for missing inputs; the pair is committed as two face-l3.bats tests so CI replays it on every configuration
tier: contract
sources: phase-00-spec.md, code:grep-fallback(1485; no .codegraph/), adrs(37), learning(3), retro(21), churn(463)
decision: the derivation lives at .claude/scripts/hq/face-modules-contract.mjs (ADR-1319: no new surface outside .claude/scripts); it reads roomRegistry.js as TEXT because the file imports phosphor icons and node cannot import it with no install; renames come from the registry's own ROOM_ALIASES (an alias key that is a served id), not a hand list; reads come from PLAN-face-v2 section 5.2's tables; output is deterministic (no timestamp) so --check can compare bytes, CRLF-normalised for the windows checkout; the main-guard realpaths both sides
result: `wrote initiatives/face/contracts/modules-v2.json -- 36 modules = 29 same-id + 3 renamed + 4 extra (3 served-planned) · 34 served, 2 without a module · 0 ring conflict(s)` · renames `today<-overview engine-room<-engine council-chamber<-council` · extras `factory executor agents story` · no module `chat-mcp:generic module, reported lane:not a room module` · hand replay: control exit=0 · drift exit=1 (DRIFT) · orphan exit=1 (`ORPHAN ... ghost-room`) · bad-root exit=2 · missing-inputs exit=2 · face-coverage all covered · embedded-program probe failures=0
commit: 62e25b6d

#### slice: 06

title: `initiatives/face/evidence/phase-00/delta-report.md` names every renamed id (`today`←overview · `engine-room`←engine · `council-chamber`←council), every extra (ADR-1327), the served-planned rooms (ADR-1328), and the served entries with no v0.7 design.
kind: logic
risk: medium
proof: grep counts over delta-report.md: every renamed id and its v0.7 alias, every extra, every served-planned room and both served entries without a module must each appear >= 1; the counts line quoted in the report must equal what `face-modules-contract.mjs --check` prints on the same tree
tier: static
sources: phase-00-spec.md, code:grep-fallback(1487; no .codegraph/), adrs(37), learning(3), retro(28), churn(465)
decision: every figure is computed from the generated contract, never typed; section 5.2's own tables name 19 distinct new routes where its prose says 17 — recorded as a correction, still inside assumptions row 5's band; the throwing-v1-rooms baseline table is explicitly UNMEASURED until the browser suite's first CI run fills it, so an empty table cannot read as a clean result
result: `today=3 overview=2 engine-room=2 council-chamber=2 factory=5 executor=3 agents=3 story=2 ops=2 trader=2 discover=2 chat-mcp=1 lane=3` · `--check`: `in sync -- 36 modules = 29 same-id + 3 renamed + 4 extra` (matches the quoted line) · `19 distinct` present
commit: 001683aa

#### slice: 07

title: `initiatives/face/fixed-defects.md` seeded — the lane's running list of already-fixed defects that every attacker prompt this cycle carries: each Cycle 15 hole recorded in `initiatives/face/archive/**` and the arc-face rows of `docs/retro-log.md`, one line each (defect · file it was fixed in · the pattern to check elsewhere). Every attacker pass this cycle appends to it.
kind: logic
risk: medium
proof: every commit SHA the list cites must resolve (`git cat-file -e SHA^{commit}`), the list must carry >= 20 defect lines and the check-every-OTHER-file instruction; then the list is applied to the one script this phase has shipped so far — any line it violates is fixed in the same slice
tier: static
sources: phase-00-spec.md, code:grep-fallback(1488; no .codegraph/), adrs(37), learning(3), retro(28), churn(466)
decision: Cycle 15 stated the rule but never kept the file, so the seed comes from its nine attacker-fix commit bodies plus four more fix commits and the arc-face retro rows, grouped as process/CLI · HTTP door · gates/parsers · fixtures; applying it at once caught face-modules-contract.mjs (slice 05) refusing no unknown flag and silently ignoring `--root=DIR` — fixed, and two arms added to the slice-05 mutant test
result: 13 cited SHAs: `13 ok`, 0 missing · `defect lines=34` · instruction present=1 · twin fix: `--chek` exit=2 `unknown argument` · `--root=.` exit=2 · `--root` with no value exit=2 · `--root . --check` exit=0 `in sync -- 36 modules`
commit: 21a5651e

#### slice: 08

title: v0.7 baseline shots for REQ-01: the reference's own `scripts/shots.mjs` on the owner's box, 1440×1000, both moods, one shot per v0.7 room; PNGs stay local and gitignored (Cycle 15's `.playwright-mcp/` precedent); `initiatives/face/evidence/phase-00/baseline-shots.json` commits room id · mood · sha256 · viewport · Chrome version. **Harness thread (ADR-1330, ADR-1335)**
kind: logic
risk: medium
proof: the reference's own scripts/shots.mjs, run over its built dist with the 36 v0.7 room ids from modules-v2.json in both moods at 1440x1000, must print one `shot` line per room x mood with no mood-mismatch warning; the manifest script must find 36 x 2 = 72 PNGs with 0 missing and 0 unexpected; all 72 sha256 values must be distinct (a repeated hash would mean a blank or stuck page); two shots opened by eye; the PNG folder must be git-ignored in the main clone
tier: e2e-visual
sources: phase-00-spec.md, code:grep-fallback(1490; no .codegraph/), adrs(37), learning(3), retro(30), churn(467)
decision: captured from the owner's design app over its existing dist (no source newer than dist/index.html) so the owner's folder is only read, with output in the main clone's gitignored .playwright-mcp/ (Cycle 15 precedent) — a session scratchpad would not survive to Phase 03; ROOMS comes from the generated contract, not a hand list; Chrome version read from the binary's file metadata (running chrome.exe --version on Windows opens a browser window instead)
result: shots.mjs EXIT=0 · `shot` lines=72 · warnings/failures=0 · `baseline-shots: modules=36 shots=72 missing=0 unexpected=0` · `72 unique hashes; min bytes 154510` · IGNORED_IN_MAIN · by eye: dark-engine.png (Engine room, kernel, dark) and light-overview.png (Today, light) render as the v0.7 design · Chrome 152.0.7977.83
commit: b77d27fb

#### slice: 09

title: `face/scripts/cdp.mjs` — dependency-free RFC 6455 client (text frames, client masking) + CDP calls (launch, navigate, evaluate, console + exception stream). No `WebSocket` global.
kind: logic
risk: medium
proof: contract — `node tests/face/cdp-client.mjs` drives cdp.mjs against the scripted `tests/face/fake-cdp.mjs` (frames of 0/125/126/65535/65536 bytes, client masking on the wire, one-byte feeds, the RFC 6455 accept key, CDP errors and close) on all 5 CI configurations; the same client then drives real Chrome in `tests/face-browser.bats`
tier: contract
sources: phase-00-spec.md, code:grep-fallback(1491; no .codegraph/), adrs(37), learning(3), retro(26), churn(468)
decision: its own RFC 6455 client over node:http — no `WebSocket` global, no dependency — so it runs on Node 18 with no install; Chrome found in ADR-1335's order with every place tried named on a miss; cdp.mjs is a library with no CLI, so slice 15's main-guard item applies to the four scripts that have a main
result: run 35184948635 (1af154f6): `face v2: the browser harness client logic runs with no install and no Chrome` ok on every configuration; in run 35186922293 the same client opened 33/33 rooms over real Chrome on linux/v20.20.2, linux/v22.23.2, darwin/v20.20.2 and win32/v20.20.2
commit: 1af154f6

#### slice: 10

title: `tests/face/fake-cdp.mjs` + `tests/face/cdp-client.mjs` — the client proven against a scripted fake on all 5 CI configurations (no Chrome, no install).
kind: logic
risk: medium
proof: contract — `node tests/face/cdp-client.mjs`, run by `tests/face-l3.bats` on every CI configuration including Node 18; it prints `RAN: <n> checks, <f> failed` and exits non-zero below 60 checks
tier: contract
sources: phase-00-spec.md
decision: the fake answers the protocol, never the verdict (retro-log 2026-08-17); the suite also holds the pure halves of smoke, harness-run, lockfile-platforms and proc so every decision rule is proven with no Chrome. A crashed suite read like a failing one: proc.mjs unref()ed an awaited timer, node exited mid-file with code 13 and no `RAN:` line, hidden behind run D's lockfile FAIL — now pinned from outside by the child fixture `tests/fixtures/face/await-timers.mjs`
result: run 35183482747 (f9805720): output stops after the stopTree check on every configuration, no `RAN:` · run 35184948635 (1af154f6): ok on all 19 jobs · run 35186922293 (65e6ec05): ok on ubuntu 18/20/22, macOS and windows
commit: 1af154f6

#### slice: 11

title: `face/scripts/smoke.mjs` ported from v0.7: Chrome discovery per ADR-1335 (`CHROME_BIN` only if set · Windows `App Paths` registry key then `%ProgramFiles%` · macOS `/Applications` · Linux `command -v google-chrome`) → FAIL naming every place tried; prints the runner image name; `--no-sandbox` on Linux; room ids read from `/api/rooms`, never a hand list; per-room console errors + exceptions; a JSON report printed to stdout.
kind: logic
risk: medium
proof: integration — `tests/face-browser.bats` runs `face/scripts/harness-run.mjs` (fixture spine → `arc-dash --spine` → `vite preview` over a built copy → `smoke.mjs`) over real Chrome on ubuntu Node 20 + 22, macos-latest and windows-latest, asserting opened == openable == expected and unsettled == 0 before errors == 0
tier: integration
sources: phase-00-spec.md
decision: ported, not reinvented (ADR-1330): v0.7's three error sources, its THREE.Clock filter verbatim, a fresh navigation per room; what the environment forced is declared in the header. The settle rule is ours (v0.7 slept 900 ms) and took three CI rounds: loaderId scoping (windows), evidence at the cap, then — from that evidence, a Google Fonts download and late CDP events on a macOS cold load while warm rooms settle in ~0.9 s, and a different room each run (map, today, engine-room) — FAIL only past 30 s, the 10–30 s band printed SLOW with what the network held at 10 s
result: run 35183482747 macOS: `XX today (never settled; late-settle-ms=11220 at-cap={... Font /s/anybody/v13/....woff2 ageMs 6377 ...})`, every other room settle-ms 912–936 · run 35186922293 (65e6ec05): `smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane` on all four L3 legs; macOS `smoke: WARN slow-settle engine-room=12662ms`
commit: 65e6ec05

#### slice: 12

title: `tests/face-browser.bats`: (1) prints `node -v` and the runner image; Node <20.19 → prints `SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19` and the skip is asserted as a skip — and a SKIP on any leg other than the Node 18 leg FAILs, so a Node-20 leg pinned below 20.19 can never pass silently; (2) offline lockfile platform check FAILs if `face/package-lock.json` lacks the native optional entries this OS needs for what the lockfile holds TODAY (Vite 8's native bindings) — Phase 01 extends the same check to `@tailwindcss/oxide-*`; (3) `npm ci --include=optional` in `face/`; (4) `vite build`; (5) door started `--spine` over a fixture from `tests/fixtures/face/gen-spine.mjs` (exists — `tests/face/dash-doors.mjs` uses it); (6) `vite preview` with `ARC_DASH_ORIGIN` and a check that `/api/health` answers through the preview proxy; (7) smoke opens every OPENABLE room `/api/rooms` serves — 34 entries today, 33 openable; each `template` entry (today only `lane`) is printed by name as not opened, never silently dropped; (8) every executing job prints `face-browser: RAN leg=OS/NODE` — the file is picked up by the CI sharder (`shard-tests.mjs` refuses a file that lands in no shard), and the evidence lists that line per job, so "added a bats file" is never mistaken for "the gate ran".
kind: logic
risk: medium
proof: integration — `bats tests/face-browser.bats` in arc-ci: node floor (only Node 18 may skip), offline lockfile arm, planted error over real Chrome, `npm ci --include=optional` + `vite build` in a copy, door + preview + smoke, no inline program text, every test registered
tier: integration
sources: phase-00-spec.md
decision: cheap checks gate the install; fd 3 closed on every long-lived child; the build runs in a copy under BATS_FILE_TMPDIR; every extraction anchored at its position in the line (two greedy ones found by the shell/OS attacker); bats prints `$output` only on failure, so a green job writes its RAN, summary and SLOW lines to fd 3 (found reading run 35184948635, which was green and showed none of them)
result: run 35186922293 (65e6ec05): `face-browser: RAN leg=linux/v20.20.2 image=ubuntu24@20260907.300.1` · `leg=linux/v22.23.2 image=ubuntu24@20260907.300.1` · `leg=darwin/v20.20.2 image=macos26@20260907.0351.1` · `leg=win32/v20.20.2 image=win25-vs2026@20260907.229.1`, each with 7/7 tests ok; ubuntu Node 18: tests 1, 4, 5 `# skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19`, lockfile + planted-error + registration ok
commit: 65e6ec05

#### slice: 13

title: Vacuous-pass guard, BOTH directions: the suite asserts `opened == openable > 0` (openable = `/api/rooms` entries whose `status` is not `template` — 33 today; PLAN § Module inventory) BEFORE asserting 0 console errors and 0 exceptions (a stub smoke that never navigates is kept as the mutant control and FAILs); AND a planted page that throws a real console error is opened over REAL Chrome — not `fake-cdp.mjs` — and the suite FAILs on it, proving the real socket path detects an error (retro-log 2026-08-17: a fake whose right answer equals the failure's answer proves nothing).
kind: logic
risk: medium
proof: integration — the suite asserts openable > 0, expected == openable, opened == openable and unsettled == 0 BEFORE errors == 0; `smoke.judge` FAILs the committed stub `tests/fixtures/face/smoke-stub-report.json` in `tests/face/cdp-client.mjs`; `smoke.mjs --probe-file tests/fixtures/face/planted-error.html` must report the planted console error and exception over REAL Chrome
tier: integration
sources: phase-00-spec.md
decision: both directions, as the spec asks: the stub control proves the verdict can FAIL with no browser, and the planted page proves the real socket path detects an error — a fake whose right answer equals the failure's answer proves nothing (retro-log 2026-08-17)
result: run 35186922293 (65e6ec05): `a planted console error and exception are seen over REAL Chrome` ok on all 5 configurations, Node 18 included; `the verdict FAILS the stub report of a smoke that never navigated` ok in the client suite on every configuration
commit: 65e6ec05

#### slice: 14

title: No inline program strings: `tests/face-browser.bats` and `face/scripts/*` run no `node -e` / `bash -c` program text; every program is its own file (CLAUDE.md shell-string rule), and `tests/embedded-program-probe.mjs` — the existing automated half of that rule — scans the new files (its `scanned=` count rises), extended if it does not already reach them.
kind: logic
risk: medium
proof: static — face-browser.bats test 6 greps the suite for `node|bash|sh|python -e/--eval/-c`, then runs `node tests/embedded-program-probe.mjs` over the suite and `face/scripts/*.mjs` handed BY NAME; `scanned=` must equal the files handed over (7) and the run must end `EMBEDDED_PROGRAMS_INTACT`
tier: static
sources: phase-00-spec.md
decision: the probe's walk takes only .sh, so it never reached a .bats or .mjs; rather than widen that walk for every lane — a new .mjs scan of .claude/scripts could red another lane's guard — the face files are passed by name and the scanned count is asserted, so a file that was never looked at cannot pass
result: run 35186922293 (65e6ec05): `face-browser: this file runs no inline program text` ok on all 5 configurations
commit: 65e6ec05

#### slice: 15

title: `cdp.mjs` and `smoke.mjs` main-guards realpath BOTH `argv[1]` and `import.meta.url`; a symlinked-tmpdir mutant is the fixture (retro-log 2026-08-19, the fourth recurrence).
kind: logic
risk: medium
proof: contract — `tests/face/cdp-client.mjs` runs smoke, harness-run, lockfile-platforms and node-floor through a LINKED scripts dir (a junction on windows) with `--no-such-flag`; each must exit 2 naming itself. CONTROL: a naive `argv[1] === fileURLToPath(import.meta.url)` guard exits 2 when called directly and 0 through the same link
tier: contract
sources: phase-00-spec.md
decision: cdp.mjs is a library with no main; the four CLIs that have one realpath both sides. The control is what makes the fixture a mutant test: it proves the link defeats a guard without realpath on that OS. The temp dir is realpathed (macOS tmpdir sits behind /var) and every link is removed before the recursive delete, with a check that face/scripts is intact
result: run 35186922293 (65e6ec05): the client suite, which carries these checks and fails below its `RAN:` floor, ok on ubuntu 18/20/22, macOS and windows
commit: 65e6ec05

#### slice: 16

title: A v1 room that throws is fixed only if the fix is one line; otherwise it goes on a named baseline list in the delta report that can only shrink, its Phase 03 module must empty it, and the suite's 0-exceptions assertion excludes exactly the ids on that list — never a global relaxation.
kind: logic
risk: medium
proof: integration — the smoke's errors == 0 assertion over 33/33 rooms on ubuntu Node 20 + 22, macOS and windows, with `harness-run.mjs` passing no `--exclude`, read from the `smoke: ... excluded-errors=` field each job prints
tier: integration
sources: phase-00-spec.md
decision: measured, not assumed: the baseline list is EMPTY, so the suite excludes nothing and there is nothing for a Phase 03 module to shrink; the one throwing path seen (the stage with no WebGL on macOS, run 35147618663) was the runner, answered in the harness with SwiftShader, and its product guard is a Phase 02 debt row — recorded in delta-report.md
result: run 35186922293 (65e6ec05): `errors=0 excluded-errors=0` on all four L3 legs · delta-report.md baseline table: `— none —`
commit: 65e6ec05

#### slice: 17

title: A measured shard weight for `tests/face-browser.bats` is committed to `tests/shard-timings.json`, the table the CI sharder reads — never the 16 s default; before editing that shared table, `git log origin/main --oneline -5 -- tests/shard-timings.json` runs per `.claude/rules/lanes.md` § Shared files, and a collision is resolved by re-measuring on the merged tree, never by keeping the earlier number. **Close**
kind: logic
risk: medium
proof: integration — `git log origin/main --oneline -5 -- tests/shard-timings.json` (last touched 833ae45e, #223 — no collision), then the windows-latest shard 1/12 log of run 35184948635, where face-browser.bats is the FIRST file: `shard-timing: files tests/face-browser.bats ...` at 05:28:08, `ok 7 face-browser:` at 05:33:58
tier: integration
sources: phase-00-spec.md
decision: 350 replaces the provisional 200 and makes face-browser.bats the heaviest file in the table, so `_floor` is re-derived in the same commit (face-browser 350, sync 195, portfolio-board 139) and `_known_gap` restated; 169 of 169 discovered .bats files carry an entry
result: `"face-browser.bats": 350` · windows 350 s, macOS 314 s · run 35186922293 (65e6ec05): the sharder's own suite ok and all 12 windows shards green
commit: 65e6ec05

#### slice: 18

title: CI green per job on the PR head SHA (`gh run view <id> --json jobs`, head SHA = local HEAD): the browser arm EXECUTED on ubuntu Node 20 + 22, macOS and windows; the counted SKIP on ubuntu Node 18.
kind: logic
risk: medium
proof: integration — `gh run view 35186922293 --json headSha,conclusion,jobs`: headSha 65e6ec05 = local HEAD at dispatch, conclusion success, every job's conclusion read one by one
tier: integration
sources: phase-00-spec.md
decision: the branch has no PR yet, so the run is a workflow_dispatch on the branch head (arc-ci runs on PR and dispatch only); per-job conclusions read, never the watcher's exit code; the browser arm counted as EXECUTED only where its fd 3 RAN line appears in that job's log
result: 19/19 jobs success on 65e6ec05; browser arm EXECUTED on ubuntu Node 20 (1279 ok) and 22 (1279 ok), macos shard 1/3 (5 ok) and windows shard 1/12 (5 ok), each with its `face-browser: RAN leg=` line; counted SKIP on ubuntu Node 18
commit: 65e6ec05

#### slice: 19

title: Two fresh attackers — one on the smoke/CDP decision logic, one on the bats suite's shell/OS boundary — each carrying the lane's fixed-defect list; holes fixed and pinned as fixtures.
kind: logic
risk: medium
proof: contract — two passes, each two fresh general-purpose agents with different surfaces (decision logic; shell/OS boundary), each handed `initiatives/face/fixed-defects.md`; every hole reproduced by a probe or a surviving mutant, fixed, and pinned in `tests/face/cdp-client.mjs` or `tests/face-browser.bats`
tier: contract
sources: phase-00-spec.md
decision: pass 1 attacked the first harness (22 holes, 78b65cb3); pass 2 attacked the fixes for run D (f9805720) and attacked the TESTS as well as the rules: 7 mutants survived the checks and each now dies to a named check. The two surfaces shared no findings, as the rule predicts
result: pass 1: decision logic 12 + shell/OS 10 holes, fixed in 78b65cb3 · pass 2: decision logic 7 holes + 7 surviving mutants, shell/OS 3 holes, fixed in ca6e26b6 · fixed-defects.md 68 lines · run 35184948635 and run 35186922293 green on all 19 jobs with every pin in place
commit: ca6e26b6

#### slice: 20

title: `/arc-phase-done 00` from the main clone; PROGRESS row ✅ + done-log.
kind: logic
risk: medium
proof: verified-real — `/arc-phase-done 00` from the main clone: `main` re-verified by `workflow_dispatch` (run 35194579928, 19/19 jobs, head a0e8ee1f), the live demo through `node .claude/scripts/hq/arc-face.mjs`, `kickoff-lint` clean, assumptions and ADR triggers adjudicated, and both receipts found in the canonical spine file
tier: verified-real
sources: phase-00-spec.md
decision: closed from the main clone after the merge, because receipts cannot be emitted from a worktree; the tracker change rides its own close branch and PR, never a commit on main; the evidence bundle script applies from Phase 02 (ADR-0002), so this phase's evidence is the lane pack
result: `phase.closed` 01M2Q5HZ5REDYHQ0AY8T1PKJA4 and `approval.requested{gate: phase-done}` 01M2Q5HZJRBMN98HNR9YA5FR77 landed in `.claude/state/hq/events/2026-09-17.jsonl` · full suite `1..3400` · live demo 33/33 rooms opened with a heading and a non-empty body, 0 console errors · PROGRESS row 00 ✅, Now moved to Phase 01
commit: a0e8ee1f

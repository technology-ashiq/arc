# Handoff pack — phase 00 · lane face

19/20 slices proven.

## Prediction calibration

2 hit · 3 miss · 0 unforeseen

- **likely-failure-mode** — miss — face/package-lock.json is unchanged on this branch (`git diff origin/main..HEAD -- face/package-lock.json` is empty) and the lockfile arm passed on ubuntu and macOS from its first run; what failed was the CHECK's own logic (presence without a version match, CI run 35150543730, fixed in f9805720) and, unforeseen, a settle gate measuring macOS runner weather (runs 35150543730 and 35183482747, fixed in 1af154f6)
- **likely-regression-site** — hit — face-browser.bats measured 350 s as the first file of windows shard 1/12 and 314 s on macOS shard 1/3 (run 35184948635), now the heaviest file in tests/shard-timings.json; weight and re-derived `_floor` in 65e6ec05
- **riskiest-file** — miss — tests/face-browser.bats carried real defects (the fd 3 guard and greedy extractions the attackers found, 78b65cb3 and ca6e26b6; no evidence on green jobs, 65e6ec05) but no Windows cleanup leak ever showed on CI; the file that took the most CI rounds was face/scripts/smoke.mjs (loaderId scoping 78b65cb3, twin filter and evidence f9805720, the 30 s cap 1af154f6), and face/scripts/proc.mjs's unref()ed awaited timers crashed the client suite (fixed 1af154f6)
- **expected-blockers** — miss — Chrome launched on macos-latest on the first run; the macOS blocker was no WebGL (THREE.WebGLRenderer context failure, 0 of 33 rooms opened, run 35147618663), answered with SwiftShader in 78b65cb3; the preview proxy already existed and /api/health answered through it from the first run — the preview blocker was its port not matching the origin allow-list, so every stamp got a 403 (fixed in 78b65cb3)
- **expected-proof-failures** — hit — the first CI runs of tests/face-browser.bats were red on macOS (no WebGL, 0 of 33 rooms opened) and on windows (every room after the first never settled), run 35147618663, fixed in 78b65cb3

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | static | static — scratchpad verify-intake.mjs hashes every file of the owner's v0.7 source (minus node_modules, dist, .shots, .gstack) against the copy — missing, extra and differing counts must all be 0 with source files > 0; git ls-files counts 70 files under arcface-v0.4 and 108 under arcface | 7e428de6 |
| 02 | static | static — scratchpad pii-scan.mjs over the 108 intake files — the owner email, every contact-shaped value in ~/.arc-private/legal/lexos/*.yaml, any email, any Indian mobile number and common secret-key shapes must all count 0, with files scanned > 0 and private values loaded > 0; a planted-PII mutant must exit 1; gitleaks dir over the same tree must report no leaks | e0b61682 |
| 03 | static | static — grep counts over the new SOURCE.md for each required element (v0.7, 108 files, ADR-1322, --blue, ADR-1324, ADR-1325, PII scan: clean, SOURCE-v0.4.md, Google Fonts) must each be >= 1, and assets/arcface-v0.4/SOURCE-v0.4.md must exist and still hold the Decided 2026-08-24 ruling | 9c1a52de |
| 04 | static | static — sha256 of the owner's E:/Work_Hub/01_Automemory/arc-face-hq2/docs/superpowers/specs/2026-09-15-hq-design-system.md and of docs/design/system/hq-design-system-v0.7.md must be one unique value (uniq count 1), and the copy must be non-empty | f063dfb6 |
| 05 | contract | `node .claude/scripts/hq/face-modules-contract.mjs` writes the contract and `--check` exits 0 with the derived counts; the same --check against a scratch copy must exit 1 for a hand-edited ring (DRIFT) and 1 for an unserved, unaliased, non-extra room (ORPHAN naming it), 0 for the untouched control, 2 for missing inputs; the pair is committed as two face-l3.bats tests so CI replays it on every configuration | 62e25b6d |
| 06 | static | grep counts over delta-report.md: every renamed id and its v0.7 alias, every extra, every served-planned room and both served entries without a module must each appear >= 1; the counts line quoted in the report must equal what `face-modules-contract.mjs --check` prints on the same tree | 001683aa |
| 07 | static | every commit SHA the list cites must resolve (`git cat-file -e SHA^{commit}`), the list must carry >= 20 defect lines and the check-every-OTHER-file instruction; then the list is applied to the one script this phase has shipped so far — any line it violates is fixed in the same slice | 21a5651e |
| 08 | e2e-visual | the reference's own scripts/shots.mjs, run over its built dist with the 36 v0.7 room ids from modules-v2.json in both moods at 1440x1000, must print one `shot` line per room x mood with no mood-mismatch warning; the manifest script must find 36 x 2 = 72 PNGs with 0 missing and 0 unexpected; all 72 sha256 values must be distinct (a repeated hash would mean a blank or stuck page); two shots opened by eye; the PNG folder must be git-ignored in the main clone | b77d27fb |
| 09 | contract | contract — `node tests/face/cdp-client.mjs` drives cdp.mjs against the scripted `tests/face/fake-cdp.mjs` (frames of 0/125/126/65535/65536 bytes, client masking on the wire, one-byte feeds, the RFC 6455 accept key, CDP errors and close) on all 5 CI configurations; the same client then drives real Chrome in `tests/face-browser.bats` | 1af154f6 |
| 10 | contract | contract — `node tests/face/cdp-client.mjs`, run by `tests/face-l3.bats` on every CI configuration including Node 18; it prints `RAN: <n> checks, <f> failed` and exits non-zero below 60 checks | 1af154f6 |
| 11 | integration | integration — `tests/face-browser.bats` runs `face/scripts/harness-run.mjs` (fixture spine → `arc-dash --spine` → `vite preview` over a built copy → `smoke.mjs`) over real Chrome on ubuntu Node 20 + 22, macos-latest and windows-latest, asserting opened == openable == expected and unsettled == 0 before errors == 0 | 65e6ec05 |
| 12 | integration | integration — `bats tests/face-browser.bats` in arc-ci: node floor (only Node 18 may skip), offline lockfile arm, planted error over real Chrome, `npm ci --include=optional` + `vite build` in a copy, door + preview + smoke, no inline program text, every test registered | 65e6ec05 |
| 13 | integration | integration — the suite asserts openable > 0, expected == openable, opened == openable and unsettled == 0 BEFORE errors == 0; `smoke.judge` FAILs the committed stub `tests/fixtures/face/smoke-stub-report.json` in `tests/face/cdp-client.mjs`; `smoke.mjs --probe-file tests/fixtures/face/planted-error.html` must report the planted console error and exception over REAL Chrome | 65e6ec05 |
| 14 | static | static — face-browser.bats test 6 greps the suite for `node\|bash\|sh\|python -e/--eval/-c`, then runs `node tests/embedded-program-probe.mjs` over the suite and `face/scripts/*.mjs` handed BY NAME; `scanned=` must equal the files handed over (7) and the run must end `EMBEDDED_PROGRAMS_INTACT` | 65e6ec05 |
| 15 | contract | contract — `tests/face/cdp-client.mjs` runs smoke, harness-run, lockfile-platforms and node-floor through a LINKED scripts dir (a junction on windows) with `--no-such-flag`; each must exit 2 naming itself. CONTROL: a naive `argv[1] === fileURLToPath(import.meta.url)` guard exits 2 when called directly and 0 through the same link | 65e6ec05 |
| 16 | integration | integration — the smoke's errors == 0 assertion over 33/33 rooms on ubuntu Node 20 + 22, macOS and windows, with `harness-run.mjs` passing no `--exclude`, read from the `smoke: ... excluded-errors=` field each job prints | 65e6ec05 |
| 17 | integration | integration — `git log origin/main --oneline -5 -- tests/shard-timings.json` (last touched 833ae45e, #223 — no collision), then the windows-latest shard 1/12 log of run 35184948635, where face-browser.bats is the FIRST file: `shard-timing: files tests/face-browser.bats ...` at 05:28:08, `ok 7 face-browser:` at 05:33:58 | 65e6ec05 |
| 18 | integration | integration — `gh run view 35186922293 --json headSha,conclusion,jobs`: headSha 65e6ec05 = local HEAD at dispatch, conclusion success, every job's conclusion read one by one | 65e6ec05 |
| 19 | contract | contract — two passes, each two fresh general-purpose agents with different surfaces (decision logic; shell/OS boundary), each handed `initiatives/face/fixed-defects.md`; every hole reproduced by a probe or a surviving mutant, fixed, and pinned in `tests/face/cdp-client.mjs` or `tests/face-browser.bats` | ca6e26b6 |
| 20 | (empty until proven) | (empty until proven) | (empty until proven) |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

The report is filed verbatim at `spec-fidelity.md` (over `c5dabfbc23..8542dc02`). Its verdict line
is `FIDELITY: drift found`, and it stands as filed: the drift it names was real at `8542dc02`.
Every finding's disposition:

| finding | disposition | where |
|---|---|---|
| 3a stub control proven only at `judge()` | **FIXED** — the bats summary extraction and ordering are one function (`smoke_summary_verdict`) called by the real run AND a new MUTANT CONTROL test, which runs `tests/fixtures/face/stub-smoke.mjs` (exits 0, opened nothing, openable and expected derived from the contract) and must be refused `opened 0 of 33` | `a14af51a` |
| 3a planted page runs the probe path, not the room path | **DEBT** — both paths share `collectErrors` and the socket; the room path's refusal is proven by the stub control; a served throwing fixture room lands with Phase 05's flows | `debt-ledger.md` row 7 |
| 3b probe never extended | **DEBT (pre-existing)** — files handed by name with the scanned count asserted; extending the company gate is routed through `/arc-change` before Phase 03 | `debt-ledger.md` row 1 |
| 3c SwiftShader for every room | **DECLARED** — the runner had no GPU; the assertion was not loosened and no id is excluded; the product guard is Phase 02 | `delta-report.md` baseline section · `debt-ledger.md` row 3 |
| 3d `reads` parsed from PLAN-face-v2 § 5.2 | **DECLARED** — slice 05's recorded decision; § 5.2's tables are the v0.7 modules' reads mapped to door routes, and the delta report records the 19-vs-17 route correction | `phase-00-tasks.md` slice 05 · `delta-report.md` |
| 3e "opened" weaker than v0.7's `h1` check | **DEBT** — v0.7's sentences belong to modules that ship in Phase 03; each ring adds its frozen sentences to the opened check | `debt-ledger.md` row 5 |
| 3f per-job evidence missing | **FIXED** — `ci-jobs.json` and `smoke-log-excerpts.md` from the PR's CI run; attacker reports filed as `attacker-reports.md` | this pack |
| 3g runner image not printed on the Node 18 job | **FIXED** — test 1 prints the floor line and the image on every job | `a14af51a` |
| 3g Node 18 skip keyed on the major, not the matrix entry | **DEBT** — bats cannot see the matrix entry and `.github/` is not writable from this lane; a Node-20 leg below 20.19 still FAILs | `debt-ledger.md` row 6 |
| 3g `SMOKE_REPORT` omits `rooms` and `errors` | **DECLARED** — per-room lines and the first 20 error lines print beside it; the JSON line stays one parseable line | `face/scripts/smoke.mjs` |
| 3g Chrome lookup broader than ADR-1335; a set-but-wrong `CHROME_BIN` falls through | **DECLARED** — ADR-1335 says `CHROME_BIN` is "never relied on"; the extra locations only widen a lookup that still FAILs naming every place tried | `face/scripts/cdp.mjs` |
| 3g debt row 4 stale | **FIXED** — marked PAID with the measured 350 s | `a14af51a` |
| 1 `arcface/.shots/` not ignored | **FIXED** — ignored at the repo root (the intake copy stays byte-identical); the root `.gitignore`'s last line, written as UTF-16 by #228 and so never matching, repaired in the same edit | this commit |
| 4 approval ULID not in the diff | **ON RECORD** — `decision.recorded` `01M2NS8Y48Y91RFZJVA32VNH17` answering `approval.requested` `01M2NS0AK4KN8JR10QDT2F72HP`; kickoff merged `c5dabfbc` at 00:43, first Phase 00 commit `7e428de6` at 01:34; restored to PROGRESS `## Now` | `PROGRESS.md` |
| 4 tokens.css regenerated or typed | **ON RECORD** — slice 01 regenerated the copy (`face-tokens --check` exit 0) | `phase-00-tasks.md` slice 01 |
| 4 extras accepted by `extra: true`, not by name; a served room with no module does not fail | **CARRIED** — Phase 02's `face-coverage` module half makes the extra-room exemption a NAMED, empty-until-filled list and FAILs an orphan module folder; REQ-04 in Phase 05 FAILs a served room with no module | `phase-02-spec.md` · PLAN REQ-04 |
| 2 scope: the network-settle gate | **DECLARED** — v0.7's fixed 900 ms sleep races slow runners; the rule, its three CI rounds and what its 30 s cap gives up are in the `smoke.mjs` header and slice 11 | `phase-00-tasks.md` slice 11 |
| 2 scope: `vite preview` port | **DECLARED** — a plain `npm run preview` 403'd every stamp because the origin allow-list follows APP_PORT; one config line | `fixed-defects.md` |

# PROGRESS.md — Cycle 16 · arc-face v2 "The Workroom"

status: LIVE
cycle: arc-face v2 (Cycle 16, opened 2026-09-16)
phase: 06
appetite: 24d
burn: 7d
blocked-on: —
depends-on: —

> Tracker for the cycle planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done` from the
> main clone (tests green on CI per job + live demo + exit criteria + evidence). This cycle claims
> **ADR 1318–1339** from the face band 1300–1399; before writing them the claim was swept across
> all 25 sibling worktrees and every `origin/*` branch on 2026-09-16 — none held an ADR ≥1318 (1337 swept
> again on 2026-09-18, when the owner's §13 item 5 ruling needed it; 1339 swept across every `origin/*` branch and
> sibling worktree on 2026-09-19 for the item 4 ruling -- none held it).
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at root
> (ADR-0053); evidence is lane-scoped at `initiatives/face/evidence/phase-NN/` (ADR-0055).
> **Cycle 15's record** — PLAN, PROGRESS, its nine phase specs and its evidence bundles — lives at
> `initiatives/face/archive/*-cycle15-2026-09-16` (ADR-1332). Design source:
> `docs/strategy/plans/PLAN-face-v2.md` v1.0 (the decision record, not the cycle).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Harness steel thread — v0.7 intake + contract + delta report; `npm ci` + build on every Node ≥20.19 leg; ported smoke opens all 34 served rooms | 2d | ✅ **CLOSED 2026-09-17** — 1d of 2d; 33/33 rooms, 0 errors on every L3 leg; merged `a0e8ee1f` (#233), `main` re-verified 19/19 (run 35194579928); receipts `01M2Q5HZ5REDYHQ0AY8T1PKJA4` · `01M2Q5HZJRBMN98HNR9YA5FR77` |
| 01 | Tokens + kit — two moods, computed contrast, generated copy, kit on Tailwind v4, 9 bespoke rooms × 2 moods (REQ-02) | 2d | ✅ **CLOSED 2026-09-17** — 0.5d of 2d; both moods on every L3 leg, 33/33 rooms, 0 errors; merged `4fcb53db` (#235), `main` re-verified 19/19 (run 35211136090, attempt 2); owner read "render aagudhu"; receipts `01M2QGWHBAX0329SNCX8Q2CPAX` · `01M2QGWHNYEBPAC97EEMV55JDH` |
| 02 | Shell + module frame — v0.7 shell, `face/src/modules/`, two-way reconcile, `face-pure`, `/arc-face-module` (REQ-03) | 2d | ✅ **CLOSED 2026-09-17** — 0.5d of 2d; the v0.7 shell names no room, 9 carried modules + 24 generic rooms reported by id, both moods 33/33 with 0 errors on every L3 leg; merged `d76657d1` (#237), `main` re-verified 19/19 (run 35232834235); receipts `01M2QWMG3CSBD1B4JFSAKWEXYX` · `01M2QWMGM3FBKW5BMBAVAMZGKE` |
| 03 | The 36 modules read-side — five ring PRs, each with its `NOT SERVED` list (REQ-01, REQ-05) | 7d | ✅ **CLOSED 2026-09-18** — 1.5d of 7d; 36/36 modules in both moods on every L3 leg (34 served module rooms + the 2 exempt extras, headings 36 checked, 0 errors); five ring PRs merged — command `81dcf814` (#239) · kernel `bee88cce` (#240) · factory `98f405f5` (#242) · money `969d9634` (#244) · company `d8386216` (#246); `main` re-verified 19/19 (run 35336492657), suite 1..3414; receipts `01M2T38JEG2AWDY61X7QAARNYF` · `01M2T38JSWD6QSHTYA7S0M1R1W` |
| 04 | Door read routes — what Phase 03's lists name (REQ-06) | 3d | ✅ **CLOSED 2026-09-18** — 0.5d of 3d; 18 routes served, 35 of 50 panels (39 tables), residue 15 panels on 10 routes approved by the owner (ADR-1338); four attacker rounds, `phase04-folds` 141 checks; merged `0a4cb262` (#248), PR head 19/19 (run 35367884908), `main` re-verified 19/19 (run 35369459599), suite 1..3415; live door 19 of 19 routes 200; receipts `01M2TPXZ16FDQ07K3SWBJ6V44M` · `01M2TPXZGPTN08BN98G6TCRZ5J` |
| 05 | Work door + every work verb + live rooms + flows in CI + coverage op-side (REQ-04, REQ-07, REQ-09, REQ-11) | 10d | ✅ **CLOSED 2026-09-23** — 3d of 10d; 31 of 31 work verbs ship as ops, residue none (`residue.md`, held both ways by `tests/face/work-door.mjs`); eight PRs (#252 · #253 · #254 · #255 · #257 · #258 · #259 · #261) + the close's #262/#263, 20 attacker rounds, 175 fixed-defect rows; final tree `2fba48f7` 19/19 (run 35870851639), suite 1..3427; live door from the main clone, one real apply receipted (`01M37CDRK7E03P67E45Y1BDT4E`); spec-fidelity drift dispositioned; receipts `01M37D0KHFPXBDBWQRYPMEXVT8` · `01M37D0M5F55KH2D8A5ZWJG6TA` |
| 06 | Session door — click-started, streamed, receipted; every SESSION verb (15) (REQ-08, ADR-1339) | 5d | 🔨 OPEN 2026-09-24 — verification plan refined |
| 07 | Dogfood 2 real days on the final surface + retro (REQ-10) | 2d | spec'd |

**Appetite burn: 7d of 24d.** Blocks: A · look (00–02) 2/6d — **closed, 4d banked forward** · B · rooms + truth (03–04) 2/10d — **closed** ·
C · verbs (05–06) 3/15d — **Phase 05 CLOSED at 3d of its 10d** (worked 2026-09-19, -20 and -23) — **re-banked 2026-09-19: 6d + 9 of the 12 banked days (ADR-1339)** · dogfood (07) 0/2d ·
3d unallocated. Tripwires: Block A day 3 · Block B day 5 · Block C at Phase 05 day 5 (burn 9d) · 50% of total
at 12d. **Block A, first clause read at day 1: Phase 00's browser suite is GREEN on CI** (run
35194579928, every L3 leg) — token work may start; the clause on the 9 rooms in both moods is read at
Phase 01's exit. **Block A, read on 2026-09-17 during Phase 01 (burn 1d, before the day-3 mark):
clause 1 still GREEN; clause 2 — the 9 bespoke rooms render on the new kit in both moods — is GREEN
on CI** (run 35207463369 on `0b51ea17`, 19/19 jobs: `opened=33 ... mood=dark mood-miss=0` and
`mood=light mood-miss=0` on ubuntu Node 20 + 22, macOS and windows) — no STOP. The owner's by-eye
read of the 9 rooms × 2 moods is Phase 01's exit gate and is recorded at `/arc-phase-done 01`.
**Block A, Phase 01 exit clause: GREEN** — the owner read the 9 rooms in both moods on 2026-09-17:
"Render aagudhu — close pannu". No STOP; the kit port is not re-scoped.
**Block A closed at Phase 02 (2026-09-17): 2d of its 6d.** `face-pure` FAILs from birth before any of
the 36 modules is written (the precondition PLAN's pre-mortem row 4 rests on), and the 4 unspent days
bank forward to Block B, whose day-5 reading after the command and kernel rings gates all work-door spend.

**Usage trend (read at every Phase 03 ring close, never counted toward REQ-10):**
**2026-09-17, command ring** — `face-dogfood`: 6 matched · 55 decisions recorded on the spine with no
journal line (decided outside the face) · 1 of 5 days carried a decision through the face.
**2026-09-18, kernel ring** — unchanged: 6 · 55 · 1 of 5. Nothing was decided through the face on
either day, which is the number Phase 07's two-day bar has to move; it is a TREND here and is never
counted toward REQ-10 (ADR-1329).
**2026-09-18, factory ring** — unchanged: 6 · 55 · 1 of 5, read from the main clone at `98f405f5`
(the only day through the face is still 2026-08-24). Three rings in, the surface has not yet been the
place a decision was made; the trend stays flat until the owner decides from it.
**2026-09-18, money ring** — unchanged: 6 · 55 · 1 of 5, read from the main clone at `969d9634`. The
money rooms are now on the door, and still no decision has gone through them.
**2026-09-18, company ring (the Phase 03 close)** — unchanged: 6 · 55 · 1 of 5, read from the main clone at
`d8386216`. All 36 modules are on the door and the surface has still not been where a decision was made; the
trend is Phase 07's to move (REQ-10, ADR-1329).

**Block B tripwire (day 5 of 10), read on 2026-09-18 after the command and kernel rings: GREEN — no
cut.** The clause is "if 14 modules are not green → cut the remaining bespoke folds to generic
renders". 14 modules are green: the command ring's six (`today`, `inbox`, `map`, `spine`, `board`,
`ask-arc`) and the kernel ring's eight (`engine-room`, `model-policy`, `policy`, `scheduler`,
`memory`, `evolve`, `bench`, `absorb`), each rendering from door routes in both moods with 0 console
errors on ubuntu Node 20 + 22, macOS and windows — run **35263610481** (19/19 jobs on `62e9ba44`,
merged as `bee88cce`), carrying `smoke: heading rings=command,kernel checked=14 miss=0`,
`not-served panels=18` and `verbs-pending cards=10`, each matched per room against the derived
evidence lists. Block B has spent 1d of its 10d for two of five rings, so the remaining three rings
stay bespoke folds.

## Inherited from Cycle 15

- REQ-10 (dogfood) → this cycle's Phase 07 at a two-day bar (ADR-1329).
- Room sweep findings F1 (ADR band map names rooms, not lanes) · F2 (scheduler lede over-promises) · F3 (planned `trader` wears LIVE) → Phase 03 rings (`initiatives/face/archive/evidence-cycle15-2026-09-16/phase-09/room-sweep-by-eye.md`).
- ADR-1315's voice trigger — the v0.7 dock ports text-only; the question is asked at the Phase 07 retro.
- Cycle 15 assumption row 5 (timing vs Inbox shape) → PLAN assumptions ledger row 7.
- `approval.requested{gate: phase-done}` `01M2NJ5F736X7PNRD68H5DVYPG` for Cycle 15's Phase 09 close is still waiting on the owner's stamp.
- Not this lane's work, recorded so it is not lost: the approved `[phase-orphan]` kickoff-lint group (its own `/arc-change` PR, `docs/trial-ledger.md` 2026-09-16) · the vacuous `tests/portfolio-board.bats` archive assertion (portfolio lane, ADR-1332).

## Done log

- **2026-09-16 — Cycle 16 kickoff (`/arc-kickoff --lane face`).** Cycle 15 archived in-lane
  (ADR-1332). 19 ADRs written: 1318–1331 record FV2-A…N as LOCKED; 1332–1336 are the kickoff's own
  forks. Owner rulings at kickoff: appetite **24 days → Tier L**; **P06 kept** (REQ-08 "stamp
  survives" becomes a Non-negotiable + Phase 05 exit, the freed REQ measures the session door);
  **browser tests on every Node ≥20.19 leg**, Node 18 a counted skip. Found while planning: v0.7's
  flows assert 29 event kinds arc does not have (ADR-1334); CI has never built L3 and Node 18 cannot
  (ADR-1335) — so the harness moved into Phase 00 as the steel thread (ADR-1336); ADR-1308's text
  does not contain the generated-token rule the cycle cites it for (noted in ADR-1318).
  **Gates.** `kickoff-lint` passes (one honest WARN: phase appetites = 100% of 24d). Attack panel ×3
  returned 19 findings: A 7 · B 5 · C 7 — applied (several reworded to fit): real-Chrome error
  control, a named throwing-room baseline, a Node-20-below-20.19 skip that FAILs, concurrent
  idempotent `apply`, REQ-01 BELOW-BAR, attacker time inside phase days, a Phase 05 day-1 CLI probe,
  the shard-table collision protocol, REQ-08 covering all three sessions, the CLAUDE.md command count,
  Preconditions lines in every spec, facts-bundle attackers bound to the shipping ring PR, a
  `face-pure` JSX-branch assumption, realpath main-guards, and a Standing-decisions list.
  Re-verification: Vite 8 and Node `WebSocket` claims VERIFIED; the Chrome claim PARTLY WRONG
  (`windows-latest` = Server 2025, `macos-latest` = macOS 26 arm64, `CHROME_BIN` contested) —
  ADR-1335's lookup no longer depends on it. Second opinion (Codex CLI 0.147.0): **DISAGREE** on a
  36-vs-41 room count; resolved by measuring the inventory (PLAN § Module inventory) and all 10
  findings applied (`docs/reviews/2026-09-17-second-opinion-face-v2-kickoff.md`). **Simulation gate:
  round 1 = 5 blockers, round 2 = 2 blockers** (smoke compared against served incl. the `lane`
  template; no id→ring source). Both fixed from measured data — ring from the served registry,
  "openable" = non-template entries (33) — but **not re-verified by a third run**: two non-zero rounds
  make this the owner's call, raised with the approval.
  REJECTED: exempt `--accent-dim` from the Phase 01 contrast gate — unsupported
  REJECTED: a new quoting lint for the harness scripts — already-covered
  REJECTED: the Node-patch check as a replacement for assumptions row 7 — already-covered
  REJECTED: cut absorb read and hire certification from Phase 06 — already-covered
  REJECTED: other lanes' CLIs as an External-dependencies row — already-covered
  REJECTED: pre-existing ADRs appended into the Key decisions index — non-actionable
  Receipts (main clone spine): `kickoff.done` `01M2NS0A8Y7SPQW8NNJ19Y7AZZ` ·
  `approval.requested{gate: kickoff}` `01M2NS0AK4KN8JR10QDT2F72HP`.
- **2026-09-17 — Phase 00 CLOSED (`/arc-phase-done 00` from the main clone).** Harness steel thread:
  the v0.7 reference taken in (108 files, PII clean, v0.4 kept), `modules-v2.json` derived by script
  (36 = 29 + 3 + 4), the delta report, the fixed-defects list (68 lines), 72 baseline shots by hash;
  and the browser harness — a dependency-free CDP client, the v0.7 smoke ported, fixture spine → door
  → `vite preview` → real Chrome — building L3 and opening **33/33 served rooms with 0 errors on
  ubuntu Node 20 + 22, macOS and windows**, Node 18 a counted skip. Merged as `a0e8ee1f` (#233).
  **Tests:** the merged tree re-verified by `workflow_dispatch` on `main`, run `35194579928`, 19/19
  jobs read per job, head `a0e8ee1f`; full suite `1..3400` on the ubuntu Node 20 job.
  **Live demo:** from the main clone, `node .claude/scripts/hq/arc-face.mjs` (live mode) — 34 served,
  33 openable, 33 opened, every room with its opening sentence and a non-empty body, 0 console errors
  (2 warnings, both v0.7's own THREE.Clock notice); the Map room opened and looked at by eye; the
  launcher stopped and ports 8317/5180 confirmed free. The per-OS log lines the spec asks the owner
  to read are in `evidence/phase-00/smoke-log-excerpts.md`.
  **What the phase actually cost:** 1d of its 2d appetite; 11 CI runs on the branch (6 red, 5 green), plus the red-first run and the `main` verification. Four findings that mattered,
  each pinned: a settle gate that measured macOS runner weather (a Google Fonts download on a cold
  load, a different room each run) → FAIL only past 30 s, SLOW printed with its evidence; an
  `unref()`ed awaited timer that crashed the client suite mid-file while a lockfile FAIL hid it; a
  lockfile check that accepted a binding by presence rather than by version; and three exit items
  claimed but unproven until a green run was READ (no RAN line on green jobs, a probe that never
  scanned the new files, no symlinked main-guard fixture). Two attack passes: 32 holes and 7
  surviving mutants, fixed and pinned. Spec-fidelity: **drift found**, every finding dispositioned
  in `evidence/phase-00/handoff.md` (stub-smoke mutant control moved to the bats layer, per-job
  evidence, image on every job, `.shots/` ignored; three new debt rows). Predictions: 2 hit · 3 miss.
  **Assumptions adjudicated by measurement:** Chrome findable by ADR-1335's lookup — HELD (found on
  all three images every run). `gen-spine.mjs` makes every room non-empty in sim mode — **NOT
  EVALUABLE in Phase 00**: the smoke measures opened + errors, not panels, and the `NOT SERVED`
  label the trigger names ships with REQ-05; carried to Phase 03, where each ring's module renders
  panels or `NOT SERVED`. **ADR revisit triggers:** ADR-1335's condition (one OS leg red for a
  reason outside the product in 2 consecutive runs) WAS met mid-phase on macOS (runs `35147618663` →
  `35150543730` → `35183482747`: no WebGL, then runner-speed settle misses) and was answered in the
  harness, not by dropping the leg; the leg has been green on every run since — raised to the owner
  with this close, no ADR change proposed. ADR-1336 (2-day cap) not reached. No ADR DEFERRED.
  Evidence bundle: `arc-evidence.sh` applies from Phase 02 (ADR-0002); this phase's evidence is the
  lane pack `initiatives/face/evidence/phase-00/`.
  amendments: 0 · reopened: n · t-to-phase0: 1d.
  Receipts (main clone spine, landed in `2026-09-17.jsonl`): `phase.closed`
  `01M2Q5HZ5REDYHQ0AY8T1PKJA4` · `approval.requested{gate: phase-done}` `01M2Q5HZJRBMN98HNR9YA5FR77`
  — the second waits on the owner's stamp.
- **2026-09-17 — Phase 01 CLOSED (`/arc-phase-done 01` from the main clone).** Tokens + kit:
  `docs/design/system/tokens.css` keeps `:root` byte-identical and adds `html.hq` and
  `html.hq.hq-light` with v0.7's values; every text/surface, chip, fill and UI ratio is computed by
  `tests/face/tokens-contrast.mjs` and written into the header by it; the generated copy; Tailwind v4 +
  phosphor in L3 only (lockfile carries linux-x64-gnu, darwin-arm64 and win32-x64-msvc bindings of
  oxide, both lightningcss families and rolldown); the v0.7 kit (`ui/kit.tsx`, `ui/bits.tsx`) with
  `ui/legacy.tsx` keeping the v1 renderers' props; the 9 bespoke rooms opening with `RoomHead` and
  drawing their cards with `HPanel`; a mood toggle, the mood on `<html>` before the first render;
  the colour-literal lint FAIL from birth; the browser harness judging every room in dark AND light.
  Merged as `4fcb53db` (#235).
  **Tests:** red first on run `35201425258` (the spec's four expected messages, nothing else red);
  the PR's run `35209617606` 19/19 read per job on head `efcd4def`; the merged tree re-verified by
  `workflow_dispatch` on `main`, run `35211136090`: attempt 1 18/19 — windows shard 1/12's first
  Chrome launch wrote no DevToolsActivePort within 30 s, same runner image and tree green in three
  earlier runs — attempt 2 re-ran that job, 19/19; full suite `1..3404` on ubuntu Node 20
  (`evidence/phase-01/ci-jobs.json`).
  **Live demo:** from the main clone, `npm ci` then `node .claude/scripts/hq/arc-face.mjs --no-open`
  on the canonical spine; 9 rooms × 2 moods navigated at 1440×1000 with the mood confirmed on
  `<html>`, 18 screenshots (git-ignored, the live spine is on them), **0 console errors** (only v0.7's
  THREE.Clock notice); five opened by eye before asking; launcher stopped, ports 8317/5180 free.
  **Owner's by-eye read (2026-09-17), verbatim:** "Render aagudhu — close pannu"; on the AA
  adjustments to v0.7's colours, "AA-adjusted values vechukko"; on the face stage in the dark mood
  only, "Dark-la mattum, Phase 02 decide" (`evidence/phase-01/owner-read-9-rooms-2-moods.md`).
  **Standing ruling this sets for later phases:** a v0.7 value under the computed AA floor moves along
  its own hue to the first step that clears, and is listed in the tokens.css header — a permitted
  delta alongside ADR-1322's council rule.
  **What the phase actually cost:** 0.5d of its 2d appetite; 6 CI runs on the branch (the red-first,
  one stopped at product-lint before any test for an unregistered synced script, three green) plus the
  PR run and the `main` verification. Two fresh attackers found 23 holes — 9 HIGH in the contrast gate
  and the lint (a token re-declared outside the three exact mood selectors applied in Chrome and
  passed; laws compared against the file under test; aliases, fills and the focus ring never measured;
  Tailwind's `_` separator hid literals; a newline in a page error forged a mood summary line) and a
  generator that wrote through a directory link onto its own source; 20 fixed and pinned, 3 to debt.
  Measuring the full pair set moved five light hues one more step and dark `--on-red` to `--bg-0`.
  Spec-fidelity: **drift found**, every finding dispositioned in `evidence/phase-01/handoff.md`.
  Predictions: 2 hit · 3 miss. `face-browser.bats` re-measured at 470 s (two moods).
  **Assumptions adjudicated by measurement:** the generated `tokens.css` copy feeds Tailwind v4 with
  no `@import`/`@theme` ordering failure — HELD (the build passed on ubuntu, macOS and windows from
  the first implementation run, `35204281571`). **ADR revisit triggers:** none met. ADR-1323's
  (`npm ci` failing twice for a missing binding) — not met, `npm ci` green on every run; ADR-1331's
  (a batch unable to reach 0 errors in `hq-light`) — not met; ADR-1322's (owner scores council below
  the reference on colour) — not met, the owner read it and closed; ADR-1335's (one leg red for a
  reason outside the product in 2 consecutive runs) — one occurrence (the windows Chrome launch
  miss above), not two; counted here so the next one is. No ADR DEFERRED. Evidence bundle:
  `arc-evidence.sh` applies from Phase 02 (ADR-0002); this phase's evidence is the lane pack
  `initiatives/face/evidence/phase-01/`.
  amendments: 0 · reopened: n.
  Receipts (main clone spine, landed in `2026-09-17.jsonl`): `phase.closed`
  `01M2QGWHBAX0329SNCX8Q2CPAX` · `approval.requested{gate: phase-done}` `01M2QGWHNYEBPAC97EEMV55JDH`
  — the second waits on the owner's stamp.

- **2026-09-17 — Phase 02 CLOSED (`/arc-phase-done 02` from the main clone).** Shell + module frame:
  v0.7's 240 px rail, 56 px header, ⌘K palette and a text-only dock (ADR-1315) in `face/src/App.tsx` and
  `face/src/shell/`; rings, order and home read from `/api/rooms` and no shell file names a room (a
  scan derived over every non-room file under face/src, with its own mutant); `face/src/modules/RING/ID/`
  four files each, the nine bespoke rooms attached as CARRIED modules and the other 24 served rooms drawn
  through the generic module with a report line naming the id; `face/src/lib/registry.mjs` attaching
  folders to served rooms both ways; `face-pure` (FAIL from birth) over the four-file shape, fold/module/
  ops imports followed transitively and every branch in a View; face-coverage's module half with the
  EMPTY ADR-1327 exemption list; `/arc-face-module` scaffolding a module and proving it green in one
  command or rolling back; the smoke's render line judged EQUAL to the gate's; `tsc --noEmit` in the build.
  The face stage left the workroom in both moods, as v0.7 has it, WebGL-guarded and unmounted.
  Merged as `d76657d1` (#237).
  **Tests:** red first on run `35221247877` (every new suite red for its missing module, plus two reds
  nobody planned: the typecheck's first run found an implicit any in `mood.mjs`, and the binary-byte
  guard caught a literal NUL in the red-first suite itself — `evidence/phase-02/red-first.md`); the PR's
  run `35230101361` 19/19 read per job on head `7718ae00`; the merged tree re-verified by
  `workflow_dispatch` on `main`, run `35232834235`, 19/19, full suite `1..3409` with 0 not ok on ubuntu
  Node 20 (`evidence/phase-02/ci-jobs.json`). Every L3 leg: `smoke: opened=33 openable=33 errors=0` and
  `smoke: render mood=M module=9 generic=24 unmarked=0` in dark and in light.
  **Live demo:** from the main clone at `d76657d1`, `node .claude/scripts/hq/arc-face.mjs --no-open` on the
  canonical spine: all 33 openable rooms opened in the browser, 9 through their module and 24 through the
  generic module, both moods, `<html>` classes confirmed, **0 console errors**; the Map and Today looked at
  by eye; launcher stopped, ports 8317/5180 free. The scaffold from the main clone into a scratch copy:
  `face-module.mjs kernel/engine-room` → `face-module: GREEN on face-pure and face-coverage` in one command.
  **What the phase actually cost:** 0.5d of its 2d appetite; 5 CI runs (the red-first, the implementation
  run red only on the untyped `ops` lists under the new typecheck, the attacker-fix run red only on
  `spine-concurrency` — a spine lock timeout on windows shard 7 in files this phase never touched, green
  on the next run — and two green) plus the `main` verification. Two fresh attackers found 21 holes —
  7 HIGH: the lint's whitespace and line terminators narrower than node's (`import<EM SPACE>React`,
  `// x<U+2028>import`), a percent-encoded specifier node and the lint resolved to different files, a
  lookup after an object literal, the gate and the browser disagreeing on an exempted extra, a throw that
  skipped the scaffold's rollback, a rollback that crashed on a locked file; all fixed and pinned, 21
  lines in fixed-defects.md (`evidence/phase-02/attacker-reports.md`). Spec-fidelity: **drift found**, every
  finding dispositioned (`evidence/phase-02/spec-fidelity.md`), the naming loophole in "a boolean field
  fold() returns" and three shell decisions fixed. Predictions: 4 hit · 1 miss.
  **Assumptions adjudicated by measurement:** `face-pure`'s structural scan catches a branch hidden in JSX
  (`{x > 0 && <X/>}`, a ternary on raw data, a comparison in a template literal) while a condition on a
  boolean field stays legal — **HELD, after the attack**: all three FAIL by name on every CI configuration;
  the attackers found constructs the first cut missed, each now a pinned check, and the condition rule
  was tightened from a name to a property read of fold's output. **ADR revisit triggers:** none met.
  ADR-1320's (face-pure exempting more than 2 modules by name) — 0 exemptions exist; ADR-1321's (a served
  room blank in a smoke, or an unserved folder no gate FAILed) — not met, the render verdict equals the
  gate's; ADR-1327's (a registry-row ruling for story/factory) — no ruling yet, list EMPTY; ADR-1335's —
  no windows Chrome launch miss this phase, the counter stays at one. No ADR DEFERRED.
  **Decided in this phase, for the owner's read:** the face stage leaves the workroom in both moods (v0.7:
  "the HQ is a clean room, the face belongs to the front door"); the dock ports text-only without v0.7's
  room-keyed chips; the palette finds and opens and writes nothing until Phase 05; the header's day
  player is the as-of scrub and the brain chip is NOT SERVED — each a debt row, none re-lays a room.
  Evidence: `initiatives/face/evidence/phase-02/` (handoff, red-first, attacker reports, spec-fidelity,
  ci-jobs) with its sha256 manifest from `arc-evidence.sh bundle 02 --lane face`.
  amendments: 0 · reopened: n.
  Receipts (main clone spine, landed in `2026-09-17.jsonl`): `phase.closed` `01M2QWMG3CSBD1B4JFSAKWEXYX` ·
  `approval.requested{gate: phase-done}` `01M2QWMGM3FBKW5BMBAVAMZGKE` — the second waits on the owner's stamp.
- **2026-09-18 — Phase 03 CLOSED (`/arc-phase-done 03` from the main clone).** The 36 modules read-side, in
  five ring PRs: command (6), kernel (8), factory (5, then its three extras), money (8) and company (6); every
  served room now draws through a v0.7 module on the door, and chat-mcp stays the generic planned room. A module
  is four files and decides nothing in its View; it declares the door routes it reads, and a panel no route fills
  is a `NOT SERVED` panel naming the route -- five derived lists, 50 panels, 22 distinct route strings, which are
  Phase 04's work, and five verbs-pending lists, which are Phase 05's. **F1** (org's ADR band map names lanes,
  from PORTFOLIO.md, held against the board), **F2** (the scheduler's promises each drawn or named) and **F3** (a
  planned room never wears LIVE, judged by room id) closed in their rings. The last two Cycle 15 renderers are
  deleted. The owner's section 13 item 5 ruling (ADR-1337): story and factory earned served-registry rows,
  executor and agents stay exemptions drawn from rows the door serves. Merged as `81dcf814` (#239), `bee88cce`
  (#240), `98f405f5` (#242), `969d9634` (#244) and `d8386216` (#246).
  **Tests:** red first on every ring (`evidence/phase-03/red-first.md`); each ring PR's head 19/19 read per job
  (command run 35248578768 on `f8e43338`; kernel 35263610481; factory 35272310975; money 35323854485; company
  35334544298, code head 35334146777); `main` re-verified by dispatch after every ring, the last run 35336492657,
  19/19, full suite `1..3414` with 0 not ok on ubuntu Node 20 (`evidence/phase-03/ci-jobs.json`). Every L3 leg:
  `opened=35 openable=35 errors=0` and `heading rings=command,kernel,factory,money,company checked=36 miss=0` in
  both moods, `extras expected=2 opened=2`, `planned rooms=4 expected=4 live=0`; the Windows runner's
  socket-buffer class counted on its own line (a debt row, never folded into a zero).
  **Attackers:** two fresh agents per ring (decision logic · shell/OS), every hole fixed and pinned
  (`fixed-defects.md`; the company ring alone 23). **Shot reviews:** five, each 0 VIOLATION and 0 BELOW-BAR on
  the pixels that merged; two needed a re-read (money after its WEAKNESS rows were paid; company after its first
  read quoted baseline pixels as candidate findings, ruled not present by crops and a fresh re-read).
  **Spec-fidelity: drift found**, every finding dispositioned (`evidence/phase-03/spec-fidelity.md`): typed
  numbers and names in folds FIXED at this close, with four twins found by grepping the pattern (the board's "1 in
  4" among them -- now a NOT SERVED base rate); the shell's two-source room list DECLARED in ADR-1337; the runner
  ceiling DEBT. **Predictions:** 3 hit · 2 miss (`evidence/phase-03/handoff.md`).
  **Assumptions adjudicated by measurement:** the route gap "~17 ±5" -- 22 distinct route strings, at the bound,
  NOT fired (the trigger is more than 22); Phase 04 re-measures its appetite against the parsers first. Cycle
  15's open question (the owner decided in the CLI because the surface arrived late) -- not yet evaluable: no
  decision has gone through the face on any day since the command ring. **ADR revisit triggers:** ADR-1327's
  (the owner rules on story/factory) MET and answered in the same change by ADR-1337, as the trigger requires;
  1320 (0 face-pure exemptions), 1321 (no blank room, no ungated folder), 1331 (0 errors in light every ring) and
  1335 (no leg red for a reason outside the product) not met; 1324 and 1337 are evaluable only after Phase 04 and
  a whole cycle. No ADR DEFERRED.
  Evidence: `initiatives/face/evidence/phase-03/` (handoff, spec-fidelity, red-first, attacker reports, the five
  shot reviews and shot manifests, the derived lists, ci-jobs) with its sha256 manifest from
  `arc-evidence.sh bundle 03 --lane face`.
  amendments: 1 (the 2026-09-17 verification-plan refinement, trivial) · reopened: n.
  Receipts (main clone spine, landed in `2026-09-18.jsonl`): `phase.closed` `01M2T38JEG2AWDY61X7QAARNYF` ·
  `approval.requested{gate: phase-done}` `01M2T38JSWD6QSHTYA7S0M1R1W` — the second waits on the owner's stamp.

- **2026-09-18 — Phase 04 CLOSED (`/arc-phase-done 04` from the main clone).** Door read routes: the union of Phase
  03's five NOT SERVED lists -- 22 route strings, 50 panels -- is served where a parser exists to import. **18 routes**
  (17 new GET routes in `.claude/scripts/hq/lib/face/reads.mjs`, each lazily importing its lane's own parser; and
  `/api/pnl?by=day` from an additive `deriveDaily` in the ledger's `pnl.mjs`); **35 of 50 panels served** (39 tables,
  `evidence/phase-04/served.md`); **15 panels on 10 routes are residue** (`residue.md`), each gap named with its lane.
  That was over REQ-06's three-route bound, so the owner ruled: "un recommand A pannu machi" -- ADR-1338 amends
  REQ-06, and assumption row 5 is recorded FIRED. Merged as `0a4cb262` (#248).
  **Tests:** PR head `d62ea4b6` 19/19 read per job (run 35367884908); `main` re-verified by dispatch 19/19 (run
  35369459599), full suite `1..3415` with 0 not ok on ubuntu Node 20 (`evidence/phase-04/ci-jobs.json`);
  `tests/face/phase04-folds.mjs` 141 checks on every leg. One Windows shard on an earlier head hit the spine lock's
  documented `LOCK_TIMEOUT` flake and passed on re-run; its second occurrence on the same emit index is recorded in
  `tests/spine-concurrency.bats` and filed to the spine lane.
  **Live demo (the real place):** the door in live mode from the main clone at `0a4cb262`, over the canonical spine
  (1,359 events): 19 of 19 Phase 04 routes answered 200 (`evidence/phase-04/live-demo.md`).
  **Attackers:** four rounds, a fresh decision-logic + HTTP/OS-boundary pair each, every one carrying
  `fixed-defects.md`; every reproduced hole fixed and pinned or a debt row with its trigger
  (`evidence/phase-04/attackers.md`). Round 3 found the Phase 04 defect classes on the door's older routes (closed as
  a current-phase note, ADR-1312 being door-wide); round 4 found a round-3 fix in a helper no room called (deleted;
  the room is tested). The round-4 fixes were not attacked again -- recorded, not implied away.
  **Spec-fidelity: drift found**, every item dispositioned (`evidence/phase-04/spec-fidelity.md`) and written into
  the spec as a current-phase note for the owner: three receipt joins folded in the door (DEBT); two additive exports
  in owning lanes, `deriveDaily` and absorb's `judgeRegistry`, against ADR-1338's residue for three lints' inline
  parsers (DECLARED, the owner may rule); the reader and panel changes the attacks drove (DECLARED).
  **Predictions:** none were written before the build, so none is scored (`evidence/phase-04/handoff.md`). The
  verification plan was still the coarse one-liner and was refined at the close.
  **Assumptions and triggers:** row 5 FIRED and routed (ADR-1338); no other trigger fired; no ADR DEFERRED.
  Evidence: `initiatives/face/evidence/phase-04/` (served, residue, live-demo, spec-fidelity, attackers, handoff,
  ci-jobs) with its sha256 manifest from `arc-evidence.sh bundle 04 --lane face`.
  amendments: 3 (ADR-1338's residue ruling; the round-3 current-phase note; the spec-fidelity note) · reopened: n.
  Receipts (main clone spine, landed in `2026-09-18.jsonl`): `phase.closed` `01M2TPXZ16FDQ07K3SWBJ6V44M` ·
  `approval.requested{gate: phase-done}` `01M2TPXZGPTN08BN98G6TCRZ5J` — the second waits on the owner's stamp.
- **2026-09-19 — main red on face-coverage, fixed (#251).** `docs/strategy/plans/PLAN-docs.md` reached `main` as a
  direct push (`5c85573f`, no PR, so no CI) with no room in the contract: `FAIL [plan] "PLAN-docs"`, face-coverage
  exit 1 in the main clone. Homed in the strategy room, `rooms.generated.json` regenerated by `face-sections.mjs`;
  PR head 19/19 (run 35422908768), merged `0b2ec0cb`, `main` re-verified 19/19 (run 35423596554). The same gap as
  #226/#227 on 2026-09-16, by a route no PR-side guard sees.
- **2026-09-19 — §13 item 4 ruled, and the scope widened (`/arc-change --lane face`, ADR-1339).** The owner: "A pannu
  machi, enaku ella products realtime la work aganum machi ... engine la koda check pannen like readonly maari tha
  iruku, enaku full working product venum machi". Option A fixes the flagship six (`bench-a-model` · `close month` ·
  `growth publish` · `ledger criteria` · `capture-idea` · `develop checkpoint`); the rest of the message makes every
  §5.2 verb Phase 05's or Phase 06's, and the rooms live. Measured first: 0 of 36 modules declare an op, 31 of 36 read
  once and never again (5 poll every 45 s), and the day-1 probe of all 46 verbs (`evidence/phase-05/cli-probe.md`,
  three read-only agents, nine claims re-read by hand) found **2 READY · 15 SMALL-GAP · 14 BIG-GAP · 15 SESSION ·
  0 NEEDS-KIND**. Assumptions row 6 **FIRED** — four of the six lacked a plan mode or a receipt as they stand — and is
  routed by ADR-1339: gaps close additively in the owning lanes, each change pinned by a fixture first. REQ-07 and
  REQ-08 amended to every verb, REQ-11 (live rooms) added — 6 active of 10. Block C re-banked: Phase 05 4d → 10d,
  Phase 06 2d → 5d, from the 12d Blocks A and B left; the closed specs now state their actual spend, so the plan sums
  to 21d of 24d. A Block C tripwire added at Phase 05 day 5 (burn 9d). The legal `propose` bug (it prints a script
  that does not exist) was found by the probe and is PR 5's.

- **2026-09-23 — Phase 05 CLOSED (`/arc-phase-done 05` from the main clone).** The work door: every one of the 31 work
  verbs in the day-1 probe runs from its room -- plan (command, diff, ₹), confirm, apply, receipt -- through the real
  tool, each proven to call what a hand-run calls. **Residue none** (`evidence/phase-05/residue.md`, the 31 mapped
  one-to-one and held equal to the registry both ways by `tests/face/work-door.mjs`). Live rooms re-read on the door's
  pulse (922 ms measured in Chrome). Eight PRs: door + six `56ba17b0` (#252) · live rooms `600a94d1` (#253) · kernel
  `b4c38038` (#254) + `d8e25f8e` (#255) · factory `536d3b2b` (#257) · money `106e6219` (#258) · company `6c34f7ee`
  (#259) · live lanes `aa797081` (#261); the close added the tracker (#262) and two fixtures (#263).
  **Tests:** final tree `2fba48f7` 19/19 read per job (run 35870851639, attempt 2 -- one Node 18 leg's Chrome handshake
  timed out and passed on the re-run, the Chrome-flake debt row), full suite `1..3427`, 0 not ok on ubuntu Node 20
  (`evidence/phase-05/ci-jobs.json`); `face-coverage --selftest` 117 arms, now asserted > 93 in bats.
  **Live demo (the real place):** the door in live mode from the main clone at `2fba48f7` over the canonical spine
  (1,379 events): 31 ops served, five plans read back at ₹0, one tool refusal shown in its own words, ONE real apply --
  `idea.captured` `01M37CDRK7E03P67E45Y1BDT4E` -- read back off the spine, and the pulse moved with it
  (`evidence/phase-05/live-demo.md`).
  **Attackers:** 20 rounds across eight PRs, a fresh decision-logic + shell/OS pair each, carrying `fixed-defects.md`;
  175 fixed-defect rows; round 2 of PR 5c found two HIGH (a forged decision file published; the send digest did not
  bind the recipient), both fixed and ADR-1344 amended (`evidence/phase-05/attackers.md`).
  **Spec-fidelity: drift found**, every item dispositioned (`evidence/phase-05/spec-fidelity.md` and the spec's close
  note): FIXED at the close -- all four human-run ops held to the click under their real ids, and > 93 arms asserted;
  DECLARED for the owner -- `develop.slice` writes its ledger in place (ADR-1341, PLAN's non-negotiable not resynced),
  legal's and evolve's pinning fixtures rewritten (ADR-1344; an attacker-proven math fix), five CLIs thicker than
  "thin"; NARROWER THAN WRITTEN -- four debt rows (no-second-path for CI-refusing ops, refusal first line, frozen
  strings, receipt-in-room timing and the browser mutant host). Six DoD rows are ticked with that marker in the spec.
  **Predictions:** none were written before the build, so none is scored (`evidence/phase-05/handoff.md`).
  **Assumptions and triggers:** row 6 FIRED and routed (ADR-1339); no other trigger fired; no ADR DEFERRED.
  REQ-04 · REQ-07 · REQ-09 · REQ-11 validated (9 of 11). Evidence: `initiatives/face/evidence/phase-05/` with its sha256
  manifest from `arc-evidence.sh bundle 05 --lane face`.
  amendments: 5 (ADR-1339's widening; ADR-1340 for the kernel ring; ADRs 1341-1343 for the factory, money and company
  rings; ADR-1344 and its round-2 amendment; the close note) · reopened: n.
  Receipts (main clone spine, landed in `2026-09-23.jsonl`): `phase.closed` `01M37D0KHFPXBDBWQRYPMEXVT8` ·
  `approval.requested{gate: phase-done}` `01M37D0M5F55KH2D8A5ZWJG6TA` — the second waits on the owner's stamp.

## Now

**RESUME HERE (2026-09-26):** Phase 06 IN PROGRESS. Open: #267 (Windows proposal race) and the residue PR. No
running session, no local-only branch holds work.
- **Merged 2026-09-26:** #282 (squash 3b85a8c8) -- `develop-proof` (develop room, `slice.done`: `develop.mjs prove`
  writes result + commit, the commit must be an ancestor of origin/main) and `adr-record` (strategy room, now with a
  lane field, `note.logged`: `hq/adr-record.mjs` numbers inside the lane's century, skipping every branch and sibling
  worktree claim). Both new writers approved by the owner; hq.policy.yaml rows appended by the owner. Shared
  `withGitReader` now in core/proposal-branch.mjs.
- **Session verbs:** 7 of 15 built (council convene, log lesson, promote rule, develop proof, record ADR; review,
  adopt plan, lane birth already had process files); dispatch is the door itself.
- **Residue decided (owner, 2026-09-26): "All six to residue.md".** `evidence/phase-06/residue.md` holds 9 shipped
  verbs and 6 residue rows (ship, qa, close phase, hire, absorb adopt, growth draft), each with the door's refusal
  code, the missing piece and the lane it is filed to (engine · develop · absorb · growth). The owner's stamp at
  `/arc-phase-done 06` approves the list as a whole.
- **Next:** slice 06 -- the attackers' reading for the phase, CI per job, `/arc-phase-done 06` from the main clone.
- **Owner's optional one-liner:** the hq.policy.yaml comment on `process:adr-record` still says `plan/adr-record.mjs`
  (the script moved to hq during the attack fixes): `! sed -i 's|plan/adr-record.mjs|hq/adr-record.mjs|' hq.policy.yaml`.
- **How the owner wants it worked (2026-09-25):** LEAN. Report every step; no live demo (paid opus runs) without
  asking; one attack round per PR; one push per PR; no new mechanism without asking. Every new process needs its
  `hq.policy.yaml` row, which only the owner can append: prepare the rows as one file and hand over a single
  `! cat <file> >> hq.policy.yaml` line.
- **Known:** the logic attacker never runs (free trial model answers 429 -- the owner can set a paid
  `ARC_ATTACK_TRIAL_MODEL`); Windows shards flake on bench.run-model's CDP timeout, the proposal-branch three-writer race
  (#267 open) and face-browser's ERR_NO_BUFFER_SPACE -- re-run only the failed jobs. A shared file (docs/wiki,
  sync golden) touched by the docs lane conflicts: regenerate the wiki, verify the golden row by row.
- **On resume, check open PRs and sibling worktrees first:** this `## Now` only sees merged work.

**Earlier (2026-09-23):** **Phase 05 is CLOSED** (done log, 2026-09-23): all 31 work verbs run from the face,
residue none, receipts `01M37D0KHFPXBDBWQRYPMEXVT8` · `01M37D0M5F55KH2D8A5ZWJG6TA` (the second waits on the owner's
stamp). **Phase 06 is next -- the session door** (REQ-08, 5d): council convene, absorb read, hire certification and the
15 SESSION verbs in `evidence/phase-05/cli-probe.md`, each started only by a click, streamed, and landed as a receipt of
an existing kind. Burn 7d of 24d; the plan's remaining phases (06 5d, 07 2d) fit.
**2026-09-24: Phase 06 OPEN** on `feat/face-v2-06` -- its verification plan refined through `/arc-change --lane face`
(check per exit criterion, the 15 SESSION verbs as a table with process file and receipt kind; 3 of 15 have a process
file today, the rest come from the engine lane additively, and each new process needs its `hq.policy.yaml` row or
kickoff-lint's birth-rule fails).
**Next:** Phase 06's first PR: the session door's start / stream / attach beside the work door, with the no-click and
driver-only fixtures RED first; then the council payload fix in the council lane before the convene demo.

**Approval on record:** Cycle 16 is approved by the owner's `decision.recorded`
`01M2NS8Y48Y91RFZJVA32VNH17` (verdict approve, reason "Face V2 Kickoff approved"), answering
`approval.requested{gate: kickoff}` `01M2NS0AK4KN8JR10QDT2F72HP`; the kickoff merged as `c5dabfbc`
(#232) before the first Phase 00 commit. Standing instruction from the owner (2026-09-17): build
every phase through to the end without waiting, push and merge per phase on green CI, run nothing
locally, and ask only at owner-only gates. **Owner, 2026-09-18: "entha cut panna kodathu, fulla work
pannanum"** — nothing in Phase 03 was cut; every ring shipped in full, with its debts paid where the
ledger said. **Owner ruling, 2026-09-18 — PLAN-face-v2 §13 item 5: "Both registry row"** (ADR-1337): `story`
and `factory` are served rooms; `executor` and `agents` stay labelled exemptions.

**Waiting on the owner:** the stamps on `approval.requested{gate: phase-done}`
`01M2TPXZGPTN08BN98G6TCRZ5J` (Phase 04), `01M2T38JSWD6QSHTYA7S0M1R1W` (Phase 03), `01M2QWMGM3FBKW5BMBAVAMZGKE` (Phase 02),
`01M2QGWHNYEBPAC97EEMV55JDH` (Phase 01), `01M2Q5HZJRBMN98HNR9YA5FR77` (Phase 00) and
`01M2NJ5F736X7PNRD68H5DVYPG` (Cycle 15 Phase 09), and now `01M37D0M5F55KH2D8A5ZWJG6TA` (Phase 05) — from the main clone,
`node .claude/scripts/hq/arc-inbox.mjs approve <ULID> --reason "..."`, or from the face's inbox room.

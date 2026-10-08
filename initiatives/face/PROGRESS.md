# PROGRESS.md — Cycle 16 · arc-face v2 "The Workroom"

status: LIVE
cycle: arc-face v2 (Cycle 16, opened 2026-09-16)
phase: 14
appetite: 49d
burn: 18d
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
| 06 | Session door — click-started, streamed, receipted; every SESSION verb (15) (REQ-08, ADR-1339) | 5d | ✅ **CLOSED 2026-09-26** — 3d of 5d; of 15 SESSION verbs 5 ship with the receipt read back (the live council convene among them), 4 start with the read-back owed, 6 residue filed to their lanes (`residue.md`, held to the registry by `tests/face/session-door.mjs`); PRs #269 · #270 · #271 · #272 · #273 · #274 · #276 · #278 · #282 + the close #285/#286; 13 boundary rounds, 118 fixed-defect rows, the logic surface never ran (debt row); `main` `465f5b82` 19/19 (run 36225129900), suite 1..3545; spec-fidelity drift dispositioned; receipts `01M3EBD91R95PZD0EPQ1QB4TS2` · `01M3EBDGQ70ETM8PXDHNKHSZXJ` |
| 07 | Reference room — the docs wiki inside the face, a Reference link from every room (REQ-12, ADR-1346) | 10.5d | ✅ **CLOSED 2026-09-30** — 5d of 10.5d (worked 09-26, -27, -28, -29, -30); REQ-12 validated. The room, a Reference link from every room, page shape v1, 34 pages rewritten and accepted, and the owner-key proof. Two DoD rows ticked narrower than written (see the done log) |
| 09 | Front door — the face at `/`, ENTER HQ with the warp, WebGL guard, a named surface (REQ-13, ADR-1349); runs BEFORE 08 | 1.5d | ✅ **CLOSED 2026-10-01** — 1d of 1.5d (built 10-01); REQ-13 validated. The face at `/`, ENTER HQ with the warp both ways, the WebGL guard, a named surface in coverage, the lint reading the stage; the owner read it against his design ("design ithu"). One DoD row ticked narrower than written: only the boundary attacker ran (see the done log) |
| 10 | The face talks — any question, the owner's model added in the face, arc answers cited, general labelled, voice (REQ-14, ADR-1350); runs BEFORE 08 | 4d | ✅ **CLOSED 2026-10-02** — 1d of 4d (built 10-01..10-02); REQ-14 validated. The owner adds a model from HQ Settings, the key never returns, arc answers cited, general answers labelled, every model answer receipted, a neon ask bar on `/`, voice behind one switch, a fake provider in CI; the owner read it ("okay va iruku"). One DoD row ticked narrower than written: only the boundary attacker ran (see the done log) |
| 11 | One Settings page — Models with Test (ok/why, seconds, last test kept) and Voice (pick, speed, preview) (REQ-15, ADR-1350 Amendments 1 and 2); runs BEFORE 08 | 2d | ✅ **CLOSED 2026-10-07** — 2d of 2d (built 10-03..10-06); REQ-15 validated. The Settings page (header, rail, ⌘K) with Models (Test, Edit, a declared cost, used by, the remove guard) and Voice; five PRs (#319 #324 #328 #332 #346). One DoD row ticked narrower than written: the remove guard and Test were proven on CI, not pressed by the owner (see the done log) |
| 12 | The owner's keys — a Keys section on the Settings page (any `NAME : value`, never returned), read by arc's `generic-api` driver (REQ-16, ADR-1351); runs BEFORE 08 | 2d | ✅ **CLOSED 2026-10-06** — 1d of 2d (built 10-05..10-06); REQ-16 validated. A Keys tab on the Settings page (any `NAME : value`, never returned), the store outside the repo, the environment first and the store second, and the `generic-api` driver reading through it; the owner set his OpenRouter key there. One DoD row ticked narrower than written: the logic attacker answered 0 findings in 5 s (see the done log) |
| 13 | Who fills each role — the Org room shows every role's binds or says it is vacant, and `org.seat-assign` reassigns one seat on a proposal branch through `org-own.mjs` (REQ-17, ADR-1352); runs BEFORE 08 | 2.5d | ✅ **CLOSED 2026-10-08** — 1d of 2.5d (built 10-07); REQ-17 validated. The Org room names who sits each role from its binds and says so when no one does; `org.seat-assign` plans a seat change and applies it on a proposal branch through `org-own.mjs --assign`, with the tier derived and never typed; one PR (#361). One DoD row ticked narrower than written: the owner read the seats but his words do not cover planning a seat change (see the done log) |
| 14 | Plan-bound audit — every write verb listed with plan-bound yes/no, CI fails an unbound one off the allowlist; read-only (REQ-18, ADR-1353); runs BEFORE 08 | 0.5d | spec'd — ADR-1353 accepted 2026-10-07 |
| 15 | Five-state availability — one `Availability` enum, a failed source is `unknown` never 0, `FIELD_UNKNOWN` on the listed verbs (REQ-19, ADR-1354); runs BEFORE 08 | 1.5d | spec'd — ADR-1354 accepted 2026-10-07 |
| 16 | Approval bindings — `bound_to` · `depends_on` · `decision_key`, the inbox folds STALE / WAITING / DUPLICATE_OF (REQ-20, ADR-1355); depends on 15; runs BEFORE 08 | 2d | spec'd — ADR-1355 accepted 2026-10-07 |
| 17 | The discover room goes live — `GET /api/discover` reads discover's own receipts, `money/discover` drops its planned markings, the contract and its pins flip in one PR (REQ-21, ADR-1356); depends on 16; runs BEFORE 08 | 1.5d | spec'd — ADR-1356 accepted 2026-10-08 |
| 08 | Dogfood 2 real days on the final surface + retro (REQ-10) | 2d | spec'd |

**Appetite burn (2026-10-08: 18d of 49d (37%) after Phase 13 closed at 1d of 2.5d; 2026-10-07: 17d of 49d (35%) after ADR-1356 added Phase 17's 1.5d; 17d of 47.5d (36%) after ADR-1353..1355 added Phases 14-16's 4d; 17d of 43.5d (39%) after ADR-1352 added Phase 13's 2.5d; 17d of 41d (41%) after Phase 11 closed at 2d of 2d; 2026-10-06: 15d of 41d (37%) after Phase 12 closed at 1d of 2d; total 41d after ADR-1350 Amendment 4 added 0.5d to Phase 11; 40.5d after ADR-1351 added Phase 12's 2d on 2026-10-05; 38.5d after ADR-1350 Amendment 1 added Phase 11's 1.5d on 2026-10-03): 14d of 40.5d (Phase 10 closed 2026-10-02: 1d of 4d; Phase 09 closed 2026-10-01: 1d of 1.5d; 33d until ADR-1350 added Phase 10's 4d on 2026-10-01; 31.5d (Phase 07 closed 2026-09-30: 5d worked of 10.5d).** Blocks: A · look (00–02) 2/6d — **closed, 4d banked forward** · B · rooms + truth (03–04) 2/10d — **closed** ·
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

- **2026-09-26 — Phase 06 CLOSED (`/arc-phase-done 06`; receipts from the main clone).** The session door: a room's
  Start click runs `arc-run --process <file> --driver`, and nothing else. The session streams, can be reattached after
  a door restart, and ends on a receipt the door reads back off the spine. Of the 15 SESSION verbs, **5 ship with the
  receipt read back** (council convene, develop proof, log lesson, promote rule, record ADR). **4 start** from a click,
  but the read-back is owed (review, dispatch, adopt plan, lane birth; each one's process emits its kind, and a debt
  row covers the read-back). **6 are residue**, filed to their lanes by the owner's ruling (ship, qa, hire → engine;
  close phase → develop; absorb adopt → absorb; growth draft → growth). Everything is in
  `evidence/phase-06/residue.md`, and `tests/face/session-door.mjs` holds that file to the registry both ways. The
  Engine room shows driver, model and health with no key. PRs: door `4e759e16` (#269) · dock `44e3f283` (#270) ·
  Engine room `26daeec2` (#271) · council shape `bcc0d880` (#272) · council-convene `5f373111` (#273) · streaming
  `b4c443b8` (#274) · the live convene's fixes `ecbb3e29` (#276) · memory ring `ab425ac6` (#278) · develop-proof and
  adr-record `3b85a8c8` (#282). The close added the residue file (#285) and its fixture (#286).
  **Tests:** the merged tree `465f5b82` passed the main dispatch 19/19 (run 36225129900). The close fixture `ea347dfc`
  passed 19/19 (run 36227021580) with suite `1..3545`, declared equal to executed, 0 not ok
  (`evidence/phase-06/ci-jobs.json`). Its first run was red on every OS with a TypeError in the new residue check
  (a row's receipt is `{ kind }`); that was fixed in the same PR.
  **Live demo (the real place):** council convene from the face, on attempt 4. It was clicked, streamed for 28 min,
  and `council.verdict` `01M3C89E89QA9XZQW56VA804ZJ` was credited by the door and read back off the spine by id
  (`evidence/phase-06/live-demo.md`). Attempts 1-3 each found a defect the fixtures had not.
  **Attackers:** 13 boundary rounds across 8 PRs, with 175 findings (12 high, 96 medium, 67 low) and 118
  fixed-defect rows. **The logic surface never ran**: the free trial model answered 429. That is a debt row, and it
  is DECLARED at the stamp (`evidence/phase-06/attackers.md`).
  **Spec-fidelity: drift found**, and every item is dispositioned (`evidence/phase-06/spec-fidelity.md`, plus the
  spec's close note):
  - FIXED at the close: four verbs moved out of "ships" into the start-only table, with an emits check.
  - DECLARED: the read-backs, the logic attacker, one PR for four registry rows, and `ship`'s confirm stop enforced
    as a refusal.
  - Two DoD rows are ticked NARROWER than written.
  **Predictions:** left empty in `phase-06-tasks.md`, so none is scored (`evidence/phase-06/handoff.md`).
  **Assumptions and triggers:** no new trigger fired, and no ADR is DEFERRED. REQ-08 is validated (10 of 11). Evidence:
  `initiatives/face/evidence/phase-06/`, with its sha256 manifest from `arc-evidence.sh bundle 06 --lane face` (20
  artifacts, verified).
  amendments: 3 (the 2026-09-24 verification-plan refinement; ADR-1345 for the council payload; the 2026-09-26 residue
  ruling) · reopened: n.
  Receipts (main clone spine, landed in `2026-09-26.jsonl`): `phase.closed` `01M3EBD91R95PZD0EPQ1QB4TS2` ·
  `approval.requested{gate: phase-done}` `01M3EBDGQ70ETM8PXDHNKHSZXJ`. The second waits on the owner's stamp, which
  also approves `residue.md` as a whole.

- **Phase 07 — Reference room, page shape v1, the 34 pages and the owner proof. CLOSED 2026-09-30.**
  **What shipped.** The docs wiki inside the face: `GET /api/reference` (one extract, GET-only, no live facts), the Reference
  room (index, type, entity; five sections; both moods), a Reference link from every served room, page shape v1 (kit parts and
  our own `flow` and `loop` Diagram), and **all 34 product and lane pages rewritten and accepted**, explanation debt 0 of
  119. The accept step became authentication: `--accept` needs an owner-approved request (Amendment 1), and now a signature
  per page made with the owner's passphrase-sealed key and checked on CI against the committed public key (Amendment 2). PRs:
  door #291 · room #294 · links #295 · change routing #296 · render and gate #297 · harness #298 · first 34 pages #299 (the
  owner rejected them) · page shape v1 and the rewrite #300 (`9979a266`) · owner key #303 (`525042e7`).
  **What the phase cost.** 5d of its 10.5d appetite. The first 34 pages cost about 40% of a week's tokens and were thrown
  away; the rewrite on Sonnet 5.5 cost about 3.5M tokens (29 pages at ~110k each), and the attack and fix rounds on the
  proof code about 1.2M more.
  **Tests:** CI green per job, 19 of 19: PR #300 head `0c411f80` (run 36618313972) and PR #303 head `5c8cbf13` (run
  36658433718). The owner-key PR was red twice first, for causes CI alone could see: a sandbox that copies a hand-kept file
  list (`owner-sig.mjs` missing), and, on #300, the sync golden, the docs-scripts no-spawn rule, a missing PLAN-org room and a
  stale `rooms.generated.json`. Each is a fixed-defect row. Log: `evidence/phase-07/test-output.log`.
  **Live demo:** the door was run from the MAIN clone on the canonical spine (`evidence/phase-07/live-door-main-clone.txt`):
  GET 200, POST 404, no token 401, 34 narratives, debt 0, no fingerprint line, no script tag. **The room UI in a browser was
  read by the owner in a sim door from a worktree on 2026-09-29, not from the main clone**; the UI is covered on every CI leg
  by the browser harness. Declared.
  **Attackers:** boundary ran on every PR of the phase (rounds under `evidence/phase-07/attack-*.json`). On PR #300:
  boundary 4 and 7 findings, logic 7 (GLM); on PR #303: boundary 13 and 10, all fixed, each with a fixed-defect row.
  **The logic surface did NOT run on the owner-key code** (GLM timed out on every attempt, deepseek answered empty), and did not
  run its second round on #300: a debt row, DECLARED at the stamp.
  **Spec-fidelity:** not run for this phase. Declared.
  **What the owner proof does and does not prove** (ADR-1514 Amendment 2, corrected before the build): invented ULIDs,
  hand-edited entries, a bare `--accept`, a fake spine and a copied signature all fail; a deliberate swap of the public key
  does not fail but is a loud WARN. What stops a swap is a GitHub CODEOWNERS review on `.claude/owner-key.pub`,
  `narrative-anchors.mjs` and `narrative-proof.mjs`, a repository setting only the owner can turn on. Not turned on yet.
  **Debt rows opened:** the logic surface unrun on the owner-key code; the owner public key is synced to consumer repos; the
  self-test takes over two minutes (scrypt cost); a shallow CI checkout leaves the key-swap check to CODEOWNERS.
  **Assumptions and triggers:** no ledger row fired; no ADR is DEFERRED; ADR-1514's revisit trigger (a false claim passing
  the drift check) has not fired. REQ-12 is validated (11 of 12). Evidence: `initiatives/face/evidence/phase-07/`, sha256
  manifest from `arc-evidence.sh bundle 07 --lane face` (verified).
  amendments: 5 (2026-09-26 Reference room; 09-27 rich narrative; 09-27 page shape; 09-29 owner proof; 09-30 owner key) ·
  reopened: n.
  Receipts (main clone spine, `2026-09-30.jsonl`): `phase.closed` `01M3R3P1PJXDA0JZ8FJZ9NR217` ·
  `approval.requested{gate: phase-done}` `01M3R3P3XF2CXK3S695N61EX1E`. The second waits on the owner's stamp, which also
  accepts the two declared gaps above.

- **Phase 13 — Who fills each role. CLOSED 2026-10-08.** The Org room lists each role's binds (agents, skills, scripts, process, tier) from `GET /api/org`. A vacant role reads "no one sits this role", and a staffed seat with empty binds is named as a disagreement (`whoSits` in `fold.mjs`). `org-own.mjs` gains `--assign` (no new script): it rewrites one card's `seat`, `binds.agents` and `binds.tier` on a proposal branch `feat/face-org-seat-<role>`, re-renders `org/CHART.md` and `chart.json`, and emits one `approval.requested` (gate `org-seat`). The tier is derived from the agents and never typed. It refuses an unknown agent, a duplicated id, a seat/binds disagreement, an agent left in no role, agents on two tiers and a model-like name, each before any file or event. The face op `org.seat-assign` plans and applies through it. One PR: #361 (`d61bf260`), which also carried #364's PLAN-distribute room row (#364 closed as superseded).
  **Tests:** CI only, per job: PR #361 head `6145114a` (main merged in), run 37553735013, 19 of 19 green; suite 1..4251.
  **Attack:** one round on `a0bc939`. Boundary returned 4 (B1, B2 medium, fixed; B3 low, fixed; B4 low, the spawnSync timeout kills only node, kept as debt). **Logic returned 0 findings**: recorded as run, not as a deep read.
  **Live demo:** from the MAIN clone (`evidence/phase-13/owner-demo.md`): "org seats pathen ok now".
  **Ticked narrower than written:** the owner's words cover reading who sits each seat. They do not say he planned a seat change, and no seat change was applied (no `feat/face-org-seat-*` branch, no `org-seat` approval on the spine). The plan, the apply on a branch and the three refusals are asserted on every CI leg by the org fixtures and the smoke.
  **Metrics:** amendments: 0 · reopened: n. 1d of 2.5d (built 10-07, read 10-08).
  **Assumptions and triggers:** no ledger row fired; no ADR DEFERRED; ADR-1352's revisit trigger did not fire.
- **Phase 11 — One Settings page. CLOSED 2026-10-07.** Settings is a page in the workroom (`#/lane&view=settings`, `#hq&view=settings`), opened from HQ's header, the rail's foot and ⌘K, never from the front door. Models: add, **Test** (one probe through `arc-run --process face-ask`, ok or `providerFault`'s plain cause plus seconds, the last test kept while the door runs), **Edit** in place (the key kept, replaced or cleared, never returned), a declared **cost** per million tokens (`cost_source: declared`), a **used by** line inverted from `GET /api/model-policy`, and a **remove guard** that refuses to remove or rename a record `engine/router.yaml` names, naming the rows, through `router-row.mjs`'s `profileRef`. Voice: the browser's voices, 0.75x to 1.5x, Preview. Five PRs: #319, #324, #328 (`48652117`, the page), #332, #346 (`5fb80422`, Amendment 4).
  **Tests:** CI only, per job: PR #346 head `fbc2462c` (main merged in), run 37461161623, 19 of 19 green; suite 1..4185.
  **Attack:** logic on `8b23b40` (11 findings, L1-L11 fixed or LOW debt), both surfaces on `12a0307` and `61af78b`, boundary on `0087028`; on `61af78b` logic answered 0 and boundary 4 (B1 high: the router read now comes before the load; B2, B3 medium: a wrong-shaped router refuses, every driver's pin counts; B4 low: names compare as the store does, Unicode-case residue kept as LOW debt).
  **Live demo:** from the MAIN clone (`evidence/phase-11/owner-demo.md`): "edit ok, voice ok", "ama cost add panra option iruku", "\"used by: no router class\" varuthu". A private door showed 0 router rows naming a profile, so his line is the true answer.
  **Ticked narrower than written:** the remove guard and Test were not pressed by hand -- no router row names his models, so a refusal cannot be shown on his real router and wiring one in for a demo is a tier change (ADR-0069); both are asserted on every CI leg by `tests/face/talk.mjs` and the smoke.
  **Metrics:** amendments: 3 (ADR-1350 Amendments 2, 3, 4; Amendment 1 opened the phase) · reopened: n. 2d of 2d (built 10-03..10-06, read 10-07).
  **Assumptions and triggers:** no ledger row fired; no ADR DEFERRED; ADR-1350's revisit trigger (an unlabelled general answer, a key read back) did not fire.
- **Phase 12 — The owner's keys. CLOSED 2026-10-06.** A Keys tab on HQ's Settings page adds, replaces and removes any `NAME : value`; after a save the page shows only "…abcd" or "set", never the value. The store is `~/.arc-private/keys/keys.json` (or an absolute `ARC_KEYS_FILE`, refused inside the repo), written atomically with a bounded Windows rename retry; an empty file is an empty store and a torn one is named, never read as empty. `resolveKey`/`explainKey` read the environment first and the store second, and the engine's `generic-api` driver takes its key through them (`ARC_LLM_KEY_NAME` picks a stored name). One PR, #335 (`fb78f260`), after the tracker change (`docs(face): /arc-change -- the owner's keys`), CI 19/19 on the merged tree (run 37414198527, suite 1..4128). One attack round (13c0c77): boundary 9 -- 5 medium fixed or recorded (B6, plaintext at rest, in ADR-1351's consequences), 4 low (B7 fixed, B4 B8 B9 in the debt ledger); **the logic surface answered 0 findings in 5 s on deepseek-v4-flash, recorded as run but too quick to count as a deep read -- the DoD row is ticked narrower than written.** CI found three things a diff attacker could not: a test that spawned arc-run with spawnSync against a provider in its own event loop, a board row left at 38.5d, and the Keys tab's first read holding the add button's busy flag; all fixed and in `fixed-defects.md`. The owner's read (`evidence/phase-12/owner-demo.md`): "OPENROUTER_API_KEY face la add panniten"; the stored value, read with the environment removed, was accepted by OpenRouter's key-info endpoint (200). 1d of 2d. Metrics: `amendments: 0` · `reopened: n`.
- **Phase 10 — The face talks. CLOSED 2026-10-02.** The owner adds a model (any OpenAI-compatible endpoint, free or paid) from HQ's header (Settings), never from the ask bar; the key is written to `~/.arc-private/face/models.json` and every door response returns only its last four characters; arc questions stay deterministic first and a citation that does not resolve marks the answer unverified; a general question is answered and labelled "general — not from arc's record"; every model answer runs through `arc-run --process face-ask` and its receipt names the model and the lane; the front door has its own neon ask bar with no settings control, sharing one brain with the workroom dock; voice in and out sits behind one switch, off by default, absent where the browser has no speech API; a provider's refusal (a 429) reaches the face as one sentence with the next step. Four PRs: #307 (`4c8a0407`), #308 (`c6eece01`, the owner's correction at the demo), #309 (`41b0e365`, the raw 429), #310 (`2ce32323`, the demo read).
  **Tests:** CI only, per job: `main` `2ce32323` run 37001289342 (workflow_dispatch), 19 of 19 green on the first attempt; suite 1..3885, the face-talk fixture is ok 1702. PR #310's run met the front-door `space-key-unmount` flake once on macOS dark (already debt row 107) and was green on rerun.
  **Live demo:** from the MAIN clone at `41b0e365` (`arc-face.mjs`), the owner checked the talking face and said "check pannen, okay va iruku" (`evidence/phase-10/owner-demo.md`). He did not say which model or questions, so the file does not claim voice or either label was exercised by hand; both are asserted on every CI leg.
  **Ticked narrower than written:** "Two fresh attackers (logic · boundary)" -- only the boundary surface attacked this code (two rounds, 8 + 10 findings, fixed or carried as debt rows 108-109); the logic surface never ran (the free trial model returned an empty envelope). The second Phase in a row without a logic run; the next logic-surface run on the lane carries both.
  **Metrics:** amendments: 1 (the owner's 2026-10-01 correction: Settings to HQ, the door's own ask bar) · reopened: n.
  **Assumptions and triggers:** no ledger row fired; no ADR is DEFERRED; ADR-1350's revisit trigger (an unlabelled general answer, a verified answer on a citation that does not resolve, a key read back, voice mishearing arc's words) did not fire. REQ-14 is validated (13 of 14). Evidence: `initiatives/face/evidence/phase-10/`, sha256 manifest from `arc-evidence.sh bundle 10 --lane face` (verified).
- **Phase 09 — The front door. CLOSED 2026-10-01.** `/` draws the owner's neon face at full presence with one message and one ENTER HQ control; ENTER HQ by pointer, Enter or Space runs the warp in and lands on `#hq`, the exit runs it back; the workroom never mounts the stage in either mood; with WebGL refused, or a stage that throws, the door shows a fallback line and ENTER HQ still opens the workroom; the front door is one named surface in `expected-set.json` and `face-coverage` FAILs a second; the colour lint reads `face/src/face` and `face/src/frontdoor` with the neon palette allowed in one file; Ctrl+K opens the palette on the door. One PR, #305 (`ad83b34f`), PR head 19 of 19.
  **Tests:** CI only, per job: `main` `ad83b34f` run 36858931483, 19 of 19 green after one rerun of Windows shard 1/12 (Chrome failed to start, `EBUSY` on `DevToolsActivePort`, the same flake #305 met; now a debt row); suite 1..3829.
  **Live demo:** from the MAIN clone (`arc-face.mjs --port 8327`), the owner opened `/`, entered HQ and came back, and read it against his design: "design ithu machi, nalla iruka simple ah sleek ah" (`evidence/phase-09/owner-demo.md`). In the same message he asked for the face to talk; that is new capability, routed as ADR-1350 / REQ-14 / Phase 10, not a reopening of REQ-13.
  **Ticked narrower than written:** "Two fresh attackers (logic · boundary)" -- only the boundary surface attacked this code (two rounds, 5 + 12 findings, every medium fixed, six LOW rows in the debt ledger); the logic surface never ran (round 1 was refused before sending: the model id carried a `~`). Recorded in the debt ledger's Phase 09 row, to be carried by the next logic-surface run on the lane.
  **Assumptions and triggers:** no ledger row fired; no ADR is DEFERRED; ADR-1349's revisit trigger (the owner asks for the story sections, or finds the warp or presence wrong) did not fire; ADR-1315's fired early and is routed by ADR-1350. REQ-13 is validated (12 of 14). Evidence: `initiatives/face/evidence/phase-09/`, sha256 manifest from `arc-evidence.sh bundle 09 --lane face` (verified).
  amendments: 1 (2026-09-30 the front door, ADR-1349) · reopened: n.
  Receipts (main clone spine, `2026-10-01.jsonl`): `phase.closed` `01M3VR2HF2DYNZZ9N3JP6YES8G` · `approval.requested{gate: phase-done}` `01M3VR2JTVMM5XRTK66QQ25SYY`. The second waits on the owner's stamp, which also accepts the narrower attacker row.

## Now

**PHASE 14 BUILT (2026-10-09, `feat/face-v2-14-plan-bound-audit`, owner: "next ella phase pannu ... don't wait for me"):** `node .claude/scripts/core/plan-bound-audit.mjs` lists **87 write verbs** under `.claude/scripts`: **17 plan-bound** and **70 allowlisted** in `core/plan-bound-allowlist.json`, each with a `why` and a class. The classes are `writer` (IS the mechanism, or derived output CI regenerates with `--check`), `lane-tool` (a lane's hand-run tool, not a face op: that lane's debt, visible) and `door-gap`. The gate runs from `tests/plan-bound-audit.bats` on every leg, asserting it RAN before what it printed. The mutants: no `--expect`, write-before-check, emit-before-guard, an empty or missing `why`, a stale row and a row for a now-bound verb, and each one FAILs. No verb's code changed. ADR-1356 flipped to accepted (owner, 2026-10-08) in this PR, as he asked. Assumptions ledger: nothing fired.

**GAPS FILED (2026-10-09, `/arc-change --lane face`, from the Phase 14 audit; each is its own change, carried on the allowlist until it lands):** five face door ops the audit cannot show bound to a plan, all classed **bug against REQ-07** (the door's plan-then-apply contract) and routed **after Phase 16**, so each fix rests on Phase 15's availability and Phase 16's bindings, not on this phase:
1. `hq/arc-jobs`: `scheduler.register-job` applies `arc-jobs register --receipt` with no `--expect`, and its `note.logged` is written with no digest checked first. Fix: plan-bind the register (owner: the scheduler lane's script).
2. `develop/develop` (`develop.slice`), 3. `engine/arc-bench` (`bench.propose`; `bench.run-model` applies a run with no plan by design), 4. `leads/arc-leads` (`leads.daily-send`), 5. `legal/arc-legal` (`legal.full-read`): each applies with `--expect`, but its write sits in a helper the guard is not in, so the audit reads `unknown`. Fix: either move the guard into the writing declaration, or teach the audit one call hop. Each becomes its own slice and attack, and the allowlist row goes the day it lands (the audit FAILs a row for a verb that is now bound).
Appetite: none spent on fixes in this phase (ADR-1353 option C rejected). Phase 14 burn: about 0.5d.

**PHASE 13 CLOSED (2026-10-08, `/arc-phase-done 13 --lane face`):** who fills each role. REQ-17 is validated, and the owner read the Org room's seats ("org seats pathen ok now"). Planning a seat change is proven on CI only, as the done log declares. **RESUME HERE: Phase 14 is next**, the plan-bound audit (REQ-18, ADR-1353, `phases/phase-14-spec.md`, branch `feat/face-v2-14-plan-bound-audit`). After it come 15, 16 and 17 (ADR-1356 is still proposed and waits on the owner's ok), then Phase 08, the owner's two dogfood days. Assumptions ledger: nothing fired.

**CHANGE ROUTED (2026-10-07, `/arc-change --lane face`, the owner pasted the discover lane's handoff `initiatives/discover/handoffs/face-discover-room.md`: "ithayum serthuka"):** `money/discover` becomes a live room. A read-only door route, `GET /api/discover`, reads discover's captures (`idea.captured`), its last `hunt` and `judge` (`run.completed`, process `discover@x.y.z`), and each `discover-winner` request with the decision that decides it, selecting events only through discover's own `PROCESS` and `WINNER_GATE`. In the same PR the `discover` row leaves `planned-rooms.json` and `plannedRooms.map`, the four discover index rows (`products.discover`, `lanes.discover`, `adrs.1900`, `commands.arc-hunt`) move from `lane` to the room, `face-sections` is regenerated, F3 pins only `ops` and `trader`, and discover-birth's two room tests flip. Classified as **new capability**: **REQ-21 / Phase 17** (1.5d), placed after Phase 16 so the room is born on Phase 15's `Availability` enum, and before the dogfood (Phase 08). Decision recorded as **ADR-1356** (proposed; one new GET route, `spineEffect: none`, no write op, no new spine kind; amends ADR-1328 for discover only; closes ADR-1914's handoff). Active REQs: 6 (REQ-10, REQ-17..21) of a cap of 10. Appetite: total 47.5d to **49d** (+1.5d); burn 17d (35%), under the 50% line, no tripwire near (all block tripwires are in closed blocks). Assumptions ledger: nothing fired. ADR-1328's revisit trigger fired for discover (the lane was born 2026-10-06) and is routed here. Load-bearing (a new door route): waits for the owner's "ok" on ADR-1356. Branch `feat/face-v2-17-discover-room`, stacked on #373.

**CHANGE ROUTED (2026-10-07, `/arc-change --lane face`, the owner pasted "three honesty gaps in the face, one phase, three ordered slices"):** (1) every write verb is measured plan-bound or not, (2) "not served" becomes a five-state `Availability`, (3) an approval knows what it waits on and what it is bound to, and the inbox folds the derived states. Classified as **new capability**, filed as **three phases, one REQ each** (ADR-1333's "one phase each"; the owner allowed either shape so long as the order and the 15 → 16 dependency hold): **Phase 14 / REQ-18** plan-bound audit, 0.5d, read-only, each gap found becomes its own `/arc-change` (**ADR-1353**); **Phase 15 / REQ-19** five-state availability, 1.5d, amends ADR-1324 (**ADR-1354**); **Phase 16 / REQ-20** approval bindings, 2d, three optional fields on `approval.requested` validated as a profile, `decision.recorded` untouched, the inbox a reader-only fold (**ADR-1355**). All three run before the dogfood (Phase 08), in the order 14 → 15 → 16, each closing on a two-surface `/arc-attack` before the next opens. Zero new spine kinds. Premises checked in code: `plan-expect.mjs` holds `spineRefusal` / `staleReason` / `planDigest`; ADR-1916 is the open-payload precedent; `validate.mjs`'s last change on main is 2026-09-30 (`525042e7`), not 2026-10-06 as the request said -- read again before Phase 16's first edit. ADR numbers 1353-1355 swept across every `origin/*` branch and sibling worktree on 2026-10-07: free. Active REQs: 5 (REQ-10, REQ-17, REQ-18, REQ-19, REQ-20) of a cap of 10. Appetite: total 43.5d to **47.5d** (+4d); burn 17d (36%), under the 50% line, no tripwire near (all block tripwires are in closed blocks). Assumptions ledger: nothing fired. **Load-bearing** (three new phases, a profile change on a shared validator, a new CI gate, a new refusal code): **the owner said "ok" (2026-10-07); ADRs 1353-1355 accepted.** Phase 14 opens after Phase 13 closes (ADR-1332). Branch `feat/face-v2-14-honesty` (tracker only), stacked on #361.

**CHANGE ROUTED (2026-10-07, `/arc-change --lane face`, from the org session; owner chose scope A+B, "ituhum pananum new req"):** the Org room shows who fills each role -- `GET /api/org` passes each card's `binds` (agents, skills, scripts, process, tier) through, the room lists them and a vacant role says so in words (A) -- and the owner reassigns a seat from the face with a new op, `org.seat-assign`, that plans with `--dry-run` and applies through `org/org-own.mjs` (extended with an assign mode, not a new script): only `seat` and `binds` of ONE card change, on a new proposal branch with one `approval.requested`, never `main` or his checkout, and it refuses an unknown agent, a duplicated card id and seat/binds that disagree before any file or event (B). `binds.tier` is derived from the agents, never typed, so a seat edit is not an ADR-0069 tier change. Classified as **new capability**: **REQ-17 / Phase 13** (2.5d), placed before the dogfood (Phase 08) as 09-12 were; decision recorded as **ADR-1352** (proposed; edits the org lane's `org-own.mjs` under ADR-1601/1629; no new spine kind). Active REQs: 2 (REQ-10, REQ-17) of a cap of 10. Appetite: total 41d to **43.5d** (+2.5d); burn 17d (39%), under the 50% line, no tripwire near (all block tripwires are in closed blocks). Assumptions ledger: nothing fired. Load-bearing (a new door op that writes a branch, an edit to another lane's script): the owner said "ok" (2026-10-07); ADR-1352 accepted. Branch `feat/face-v2-13-org-seats`, stacked on #358.

**PHASE 11 CLOSED (2026-10-07, `/arc-phase-done 11 --lane face`):** one Settings page -- REQ-15 validated; the owner read the edit, the voice, the cost field and the used-by line ("used by: no router class", true: no router row names his models). The remove guard is proven on CI only, declared in the done log. **RESUME HERE: Phase 08 is next, and it is the owner's two real days** on the final surface (REQ-10, `phases/phase-08-spec.md`): from the MAIN clone, `node .claude/scripts/hq/arc-face.mjs` (from Git Bash), every decision through the face and at least one op a day; `face-dogfood` reads each day. Then the cycle retro, the HISTORY row and `/arc-phase-done 08`. Assumptions ledger: nothing fired.

**PHASE 12 CLOSED (2026-10-06, `/arc-phase-done 12 --lane face`):** the owner's keys -- REQ-16 validated; the owner set his OpenRouter key in the face. **Next: Phase 11's close**, after PR #346 (a model's declared cost, who uses it, the remove guard; ADR-1350 Amendment 4) merges and the owner reads those three on the page -- he has already read the edit and the voice ("edit ok, voice ok", 2026-10-06). Then Phase 08, his two dogfood days. Assumptions ledger: nothing fired; ADR-1351's revisit trigger (a key value in a response, the tree, the spine or a transcript; a tool running on a stored key while its variable was set) did not fire.

**CHANGE ROUTED (2026-10-06, `/arc-change --lane face`, the owner pasted model-policy's handoff, ADR-1803; "itha complete pannitu ... athum pannu"):** Settings -> Models gains a declared **cost** per million tokens (`cost_source: declared`, never measured, ADR-0069 block b), a **used by** list of the router tiers and classes that reach each record (inverted from `GET /api/model-policy`), and a **remove guard**: removing or renaming a record `engine/router.yaml` names is refused, naming the rows, through `router-row.mjs`'s grammar. Classified as **in-scope for Phase 11** (still open; the Models section's own completeness, as the edit was), recorded as **ADR-1350 Amendment 4**; REQ-15's acceptance gains the three items. The cost field is a schema change to the owner's private store (`models.json`, outside the repo): additive and optional, so every existing file still loads. Active REQs: 3 of 10. Appetite: Phase 11 1.5d to 2d, total 40.5d to **41d**; burn 14d (34%) before Phases 11 and 12 are counted, no tripwire near. Assumptions ledger: nothing fired. Branch `feat/face-v2-11-model-profiles`, stacked on #335 (same files).

**DEFECT ROUTED (2026-10-06, `/arc-change --lane face`, owner: "ellame neeye pannu ... ethathu theva iruntha mattum kelu"):** the front-door smoke's `pointer-unmount` / `enter-key-unmount` / `space-key-unmount` checks failed on the macOS leg on nearly every PR of 2026-10-04..05 (#319, #324, main's dispatch, #332), each costing a rerun, always `held=NaN` with the page taking the workroom surface 6-10.8 s after the address changed. Classified as a **bug against REQ-13** (validated; its browser smoke reported a stage that does leave as one that does not): the harness counted the unmount window from the address while the app's timer starts at the page's own surface change. Fixed through the fix-issue flow on `feat/face-v2-smoke-unmount-clock` -- `unmountWaitOver` in `face/scripts/smoke.mjs` counts the window on the page's clock from its `hq@` trail entry, capped at 30 s of harness time; `tests/face/front-door.mjs` section F pins it with the address-clock rule as the mutant. Appetite: about 0.25d; burn unchanged, no tripwire near. Assumptions ledger: nothing fired.

**CHANGE ROUTED (2026-10-05, `/arc-change --lane face`, owner: "athe maari API keys la add pannalama, ovvoru timeum session la kodukura mari iruku, ella API's add panra maari pannalama?"; chose "Yes, build it"; then "Dynamic add panra maari vai machi ... key : value"):** a Keys section on the Settings page -- any `NAME : value`, add / replace / remove, never returned, stored at `~/.arc-private/keys/keys.json` -- and one resolver arc's tools read (the environment first, the store second), first wired into the `generic-api` driver so the attack's logic model stops asking him for the OpenRouter key. Classified as **new capability**: **REQ-16 / Phase 12** (2d), placed after Phase 11 and before the dogfood (Phase 08), the same way 09, 10 and 11 went; decision recorded as **ADR-1351** (two new door routes, `spineEffect: none`, no new spine kind). Active REQs: 3 (REQ-10, REQ-15, REQ-16) of a cap of 10. Appetite: total 38.5d to **40.5d** (+2d); burn 14d of 40.5d (35%) before Phases 11 and 12 are counted, no tripwire near (all block tripwires are in closed blocks). Assumptions ledger: nothing fired. Load-bearing (secrets, a cross-lane reader): the owner approved the design before any code. Other lanes' tools (launch adapters) adopt the resolver as their own change. Branch `feat/face-v2-12-keys`, after Phase 11's PR #332 merges.

**CHANGE ROUTED (2026-10-05, `/arc-change --lane face`, owner on the Settings page: "page seperate ah nalla iruku, but page la list of profiles kodu edit panra maari kodu"):** the page is accepted as a page; each model in its list gets **Edit** in place (name, base URL, model id; the key field empty keeps the key, a typed one replaces it, "remove key" clears it). Classified as **in-scope for Phase 11** (still open; the Models section's own completeness, no new REQ), recorded as **ADR-1350 Amendment 3** (one more op on the existing `POST /api/models`, `edit`; no key ever returned; an edit forgets the model's last test). REQ-15's acceptance gains "edited in place". Active REQs: 2 of 10. Appetite: about 0.5d inside Phase 11's 1.5d; total stays 38.5d, burn 14d (36%) before Phase 11 is counted, no tripwire near. Assumptions ledger: nothing fired. The owner pre-approved building every remaining phase. Branch `feat/face-v2-11-model-edit`.

**CHANGE ROUTED (2026-10-05, `/arc-change --lane face`, owner at the Phase 11 live read: voice works, then "sari thaniya irunthalum, seperate page ah vaikalama ?"):** Settings becomes its own page in the workroom instead of a popup -- `#/lane&view=settings` over the lane room, `#hq&view=settings` over the home, opened from the header, ⌘K and (his next ask the same hour, "menu laye add pannirlaama", choosing a link in the left menu) a Settings link at the foot of the rail; not a room, leaving it returns to the room that was open; the contents are unchanged. Classified as **in-scope for Phase 11** (still open; its own exit criterion changes shape, not the capability), recorded as **ADR-1350 Amendment 2**, REQ-15's acceptance amended from "one menu" to "one Settings page". Active REQs: 2 (REQ-10, REQ-15) of a cap of 10. Appetite: about 0.5d inside Phase 11's 1.5d; total stays 38.5d, burn 14d (36%) before this phase is counted, no tripwire near. Assumptions ledger: nothing fired. Not load-bearing (no new phase, route, dependency, schema, money or auth); the owner pre-approved building every remaining phase (2026-10-03, again 2026-10-05). Branch `feat/face-v2-11-settings-page`. The owner's live read restarts on the page.

**PHASE 11 LOGIC ATTACK (2026-10-05, owner: "next ella phase pannu ... don't wait for me"; model his pick, z-ai/glm-5.3-flash, after `:batch` proved chat-incompatible on OpenRouter itself):** the logic surface Phase 11 owed ran on `8b23b40`: 11 findings, 0 critical, 0 high, 4 medium, 7 low (`evidence/phase-11/attack-8b23b40-r1-logic.json`). L1, L2, L3, L8 were already closed by `07693fd8`; L4 (Settings kept off the door only by a comment) becomes `paletteFor` in `lib/shell.mjs`, held by `tests/face/l3-logic.mjs` with a mutant; L5, L6 (the Test's pre-check) and L11 (testLine crossed with `formatIst`) fixed; L7, L9, L10 kept as LOW in the debt ledger. One round, per the owner's rule. Branch `feat/face-v2-11-logicfix`. Still owed for the close: the owner's live read (`evidence/phase-11/owner-demo.md`), then `/arc-phase-done 11` from the main clone. Assumptions ledger: nothing fired.

**CHANGE ROUTED (2026-10-03, `/arc-change --lane face`, owner: "work aguthu response slow ah iruku, yen settings thaniya vacha, atha oru menu la add pannalam la simple ah models add verify and test apdi, then voice la change panna mudiyatha?"; chose "Now, before dogfood"; then "complete all phase machi ... local tests panna venam ellame CI la than"):** after #314 the face answers from PowerShell, but slowly. The spine showed `z-ai/glm-5.3-flash` at 3.3-7.7 s on the night of 10-02 and 36-37 s on the afternoon of 10-03, and `gemma-4-26b-a4b-it` refused twice in under a second: the provider's load, which the face gave him no way to see before asking. Classified as **new capability**: **REQ-15 / Phase 11** (one Settings menu; a Test per model with ok-or-why and seconds, the last test kept; the voice picked, its speed, a preview), placed before the dogfood (Phase 08), the same way 09 and 10 went. Decision recorded as **ADR-1350 Amendment 1** (a new door route, `POST /api/models/test`, receipted through `face-ask`; no new spine kind). Active REQs: 2 (REQ-10, REQ-15) of a cap of 10. Appetite: total 37d to **38.5d** (+1.5d); burn 14d (36%), no tripwire near (all block tripwires are in closed blocks). Assumptions ledger: nothing fired. The owner pre-approved building it and every remaining phase without waiting (2026-10-03); Phase 08's two days stay his.

**DEFECT ROUTED (2026-10-03, `/arc-change --lane face`, owner: "pannu unakuk theriyum la ethum venum nu"):** after the askfix merge (#313) the owner still saw every model answer fail as "The model could not answer this time", with no `run.completed` on the spine. Root cause, reproduced under his real Machine+User PATH: started from PowerShell, `bash` resolves to `C:\Windows\system32\bash.exe` (WSL, which has no `/bin/bash`), so `arc-run` cannot emit the run's receipt through `arc-event.sh`, exits non-zero, and the door shows its catch-all. Classified as a **bug against REQ-14** (validated; "a non-arc question returns the model's answer" did not hold when HQ starts from PowerShell), not a new REQ: fixed through the fix-issue flow on `feat/face-v2-08-gitbash` -- the launcher (`arc-face.mjs`) puts Git for Windows' `bin` first on the door's PATH on win32 (`gitBashEnv`, armed in its `--selftest`), and the door names a receipt that could not be written instead of the generic text (`providerFault`, pinned in `tests/face/talk.mjs`). Appetite: about 0.25d; burn stays 14d of 37d (38%), no tripwire near. Assumptions ledger: nothing fired. Phase 08's dogfood days start on the fixed launcher.

**DEFECT ROUTED (2026-10-02, `/arc-change --lane face`, owner: "machi arc ethathu general questions keta ans pannala yen?", then "ok pannu"):** after the Phase 10 close the owner found general questions answered as arc. The deterministic reader (`ask-offline.mjs`) matched bare substrings ("learn" held "earn", "blog" held "log", "keyboard" held "board", "deliver" held "live") and everyday words ("status", "send"), so 8 of 14 general questions never reached his model. Classified as a **bug against REQ-14** (validated; its acceptance "a non-arc question returns the model's answer labelled general" did not hold in real use), not a new REQ: fixed through the fix-issue flow on `feat/face-v2-10-askfix` -- whole-word matching, and a word that also means something outside arc answers only beside an arc word or a lane name; `tests/face/ask-golden.mjs` pins 13 general questions with a mutant that strips both. Appetite: about 0.25d inside Phase 10's unspent 3d; burn stays 14d of 37d (38%), no tripwire near. Assumptions ledger: nothing fired; ADR-1350's revisit trigger (an unlabelled general answer) did not fire -- these were deterministic arc answers, not model answers shown unlabelled.

**RESUME HERE (2026-10-02):** **Phase 10 is CLOSED** (done log). **Phase 08 is next, and it is the owner's two real days** on a face that talks (REQ-10, `phases/phase-08-spec.md`): from the MAIN clone, `node .claude/scripts/hq/arc-face.mjs`, every decision through the face and at least one op a day; `face-dogfood` reads each day. Then the retro, the HISTORY row and `/arc-phase-done 08`. Owner steps open: the stamp on the Phase 10 sign-off request, `01M3VR2JTVMM5XRTK66QQ25SYY` and `01M3R3P3XF2CXK3S695N61EX1E`. Debt carried: the logic attacker has not run on Phases 09 or 10; `arc-run` drops its transcript on a 429.

**OWNER DEMO READ (2026-10-02, main clone at `41b0e365`):** "check pannen, okay va iruku" -- the Phase 10 owner criterion is ticked (`evidence/phase-10/owner-demo.md`; it records only his words, not which model or questions, and says so). Next: `/arc-phase-done 10` from the main clone, then Phase 08, the dogfood days. Assumptions ledger: nothing fired.

**OWNER CORRECTION (2026-10-01, at the Phase 10 live demo, in-scope -- no new REQ):** "configuration ah ask panel la add panniruka, athu hq ulla thana varaunm ... design la white background ask panel la ethathu panatha ... sleek ah awesome ah oru ask bar vai". PR #307 put the models panel behind a gear on the ask bar and reused the workroom's dock on the door (a white panel in the light mood). Fixed on `feat/face-v2-10b`: the door gets its own neon glass ask bar (`frontdoor/FrontDoorAsk.tsx`), models and voice move to HQ's header (Settings), one shared brain (`shell/useAsk.ts`), and the smoke's new `door-no-settings` check holds the ruling (front-door checks 24). Phase 10 stays open until the owner's demo read.

**RESUME HERE (2026-10-01):** **Phase 09 is CLOSED** (done log). **Phase 10 is next: the face talks** (REQ-14, ADR-1350 accepted, `phases/phase-10-spec.md`, branch `feat/face-v2-10`), then Phase 08, the owner's two dogfood days on a face that talks. Owner steps open: the stamp on `01M3VR2JTVMM5XRTK66QQ25SYY` (and the older `01M3R3P3XF2CXK3S695N61EX1E`).

**CHANGE ROUTED (2026-10-01, `/arc-change --lane face`, owner: "arc face athoda product la ethathu keta ellame proper ah ans pannanum, arc ku oru llm connect pannuvom, ui la add panra maari irukanum, en istathuku na atha add pannuven, free/paid model ethunalaum, genral ah ketalum ans pannanum, arc ah pathi ketalum correct ah ans pannanum"):** at the Phase 09 live demo the owner accepted the front door ("design ithu machi, nalla iruka simple ah sleek ah") and asked where the talking was. **ADR-1350** (decision, proposed): a model the owner adds in the face (any OpenAI-compatible endpoint, free or paid, the key kept on the door at `~/.arc-private/face/models.json` and never returned), two labelled answer lanes (arc: cited and verified, ADR-1325 kept; general: "not from arc's record"), every model answer receipted through `arc-run`, voice as a setting (amends ADR-1315 and ADR-1325, lifts two no-gos). Filed as **REQ-14 / Phase 10** (new capability, 3 active REQs of a cap of 10), placed after 09 and before the dogfood (Phase 08), so the dogfood runs on a face that talks. Appetite: total 33d to **37d** (+4d); burn 12d (32%), projected about 17.5d at Phase 10's close (47%), under the 50% line; all block tripwires are in closed blocks. Assumptions ledger: nothing fired (ADR-1315's revisit trigger fired early, routed here). ADR-1350 status: accepted (its own Status line, 2026-10-01). Phase 09 still closes first, from the main clone.

**OWNER CHOSE A (2026-10-01, during `/arc-resume --lane face`):** ADR-1349 is accepted with option A, the hero; option B stays his
next question. Phase 09 is building on `feat/face-v2-09` (renamed from `feat/face-front-door`, carrying `c399aab2`): `lib/mode.mjs`
(the surface decision and the warp timeline), the warp ported into `FaceStage.tsx`, `face/src/frontdoor/` (the hero, the neon file,
the stage boundary), the rail and header brands back as v0.7's exit, and the gates, harness and `tests/face/front-door.mjs`.
Assumptions ledger: nothing fired.

**CHANGE ROUTED (2026-09-30, `/arc-change --lane face`, owner: "home la face irunthathu, ithula varatha, plan pannalaya"):** the owner's design has a FRONT
DOOR (the Landing: neon particle face, a message, ENTER HQ with a warp) and a clean-room workroom. The v2 plan ported only the workroom
and never listed the front door; on 2026-09-17 a session unmounted `FaceStage.tsx` on its own reading of v0.7 ("the product has no front
door") **without asking the owner**. **ADR-1349** (decision, proposed) names the front door as a surface (not a room), and offers two sizes:
**A, the hero** (the face at `/`, one ENTER HQ, the warp, a WebGL guard; **1.5d**) and **B, the faithful landing** (sections S1..S6 and chapters
C01..C09 with live spine panels; about 2,700 lines of design JSX, an effort of 5 to 8 days that is a guess, not a measure). This change files A as
**REQ-13 / Phase 09**, placed before the dogfood days (Phase 08 waits on it), and leaves B as the owner's next question. Classified as new capability
(REQ-13, 1 active REQ of a cap of 10). Appetite: burn 12d of 33d (36%, from 31.5d: +1.5d); with B instead the total would pass 38d and burn 18d (about 55%),
which is the scope-cut conversation the plan requires, so B is not filed. Kill-criteria tripwires are all in the closed blocks. Assumptions ledger: nothing
fired. **Waiting on the owner's OK before any code** (a new surface and the face back in the product). Branch `feat/face-front-door`.

**RESUME HERE (2026-09-30):** **Phase 07 is CLOSED** (done log). **Phase 08 is next, and it is the owner's two real days**
(REQ-10, plan in `phases/phase-08-spec.md`): from the MAIN clone, `node .claude/scripts/hq/arc-face.mjs`, every decision through
the face and at least one op a day; `face-dogfood` reads each day. Then the retro, the HISTORY row and `/arc-phase-done 08`.
Owner steps still open: the stamp on `01M3R3P3XF2CXK3S695N61EX1E`, and GitHub CODEOWNERS review on the three owner-key files.

**PHASE 08 PLAN REFINED (2026-09-30, `/arc-change --lane face`, owner: "complete everything, all phases, don't stop for anything"):**
its coarse one-line verification plan is now a table with one exact check per exit criterion, an evidence file each, and who does
it (`phases/phase-08-spec.md`). Tracker only, no code. The two real days are the owner's and no session can run them for him;
Phase 08 opens after `/arc-phase-done 07` (now closed). Assumptions ledger: nothing fired.

**CHANGE ROUTED (2026-09-30, `/arc-change --lane face`, owner: "owner-token first"):** PR #300 merged (`9979a266`). Its round-3
attack (boundary B1, B2) showed the accept proof is a deliberate step, not authentication: CI cannot re-verify the ULID, and a
shell in the main clone can write both events. **ADR-1514 Amendment 2** (decision, proposed) makes it authentication: an
Ed25519 owner key sealed by a passphrase, `arc-inbox approve` on `gate: narrative-accept` needs a terminal and writes a `sig`,
the validator requires it for that gate only, the public key is committed and the gate verifies every entry against it. New
exit criterion "Owner-authenticated" under Phase 07. Classified as a decision plus in-scope build (no new REQ). Assumptions
ledger: nothing fired; Amendment 1 had named the limit. Estimate 1.5d, charged to Phase 07 and booked at the next burn update
(10d booked, plus 0.75d for Amendment 1 not yet booked, of 31.5d; no tripwire near). **BUILT and merged as #303 (`525042e7`).**
The owner ran `owner-key init` and approved the batch with his passphrase; the 34 entries carry one signature each. The build
changed from this note in one way: the decision carries `sigs` (one per page) so CI can rebuild each message without the spine.

**CHANGE ROUTED (2026-09-29, `/arc-change --lane face`, owner: "a pannu, debt vachu poga thaa"):** the round-2 attack (B6, medium)
found that `narrative-anchors --accept` stamps `by: "owner"` for whoever runs it, so an agent could self-accept every page and
drive awaiting-owner to 0. The owner chose option A: **`--accept` needs an `arc-inbox` approval** and it is not parked as debt.
**ADR-1514 Amendment 1** carries the decision; a new exit criterion ("Owner-proved") sits under Phase 07. Classified as a
decision plus in-scope build (no new REQ: it is how REQ-12's owner-read gate becomes true). Assumptions ledger: nothing fired,
but ADR-1514 section 4 assumed that only the owner runs `--accept`, and that premise was false. Estimate 0.75d, charged to Phase 07
and booked at the next burn update (10d of 31.5d today, no tripwire near). **BUILT the same day (owner: "OK, A build pannu"):**
`--request-accept` and `--accept --approval <ULID>` in `narrative-anchors` (self-test 17 to 41 arms, no hq file touched: the
gate string needed no validator row). The owner approved ONE batch request for all 34 pages himself through `arc-inbox`
(`approval.requested` `01M3PX6YZJVB1D7M0CYGRPGMTV`, decided from the main clone) and the 34 entries were re-stamped under it.
Known limit, stated in the Amendment: CI cannot re-check the ULID (the spine is gitignored), and anything that can run
`arc-event` from the main clone could still forge a request; this closes the casual `--accept`, not that.

**OUT-OF-PHASE BUG (2026-09-24, `/arc-change --lane face`, owner: "neeye pannu"):** the proposal-branch
"three writers of one plan at once" check is red on Windows, intermittently. It hit three PRs on 2026-09-19 and
the main dispatch 35959814088 on 2026-09-24, which passed when the shard was re-run. **Root cause, reproduced on
the owner's Windows box (2 of 80 rounds):** the failure comes from `git hash-object -w`, not from `update-ref`. It
fails with `unable to write file .git/objects/..: Permission denied`: three writers of identical content write ONE
loose object at once, and Windows refuses the second open. PR #255's lock-wait fixed the wrong step. **Fix:** retry
the two content-addressed, idempotent object writes (`hash-object -w`, `write-tree`), bounded, and make the check
print each writer's message. Assumptions ledger: nothing fired. Estimate 0.25d, charged to this cycle and booked
at the next burn update so the header and the board row move together (7 to 7.25 of 24d, no tripwire). Branch `feat/face-proposal-race-fix`. Phase 06 is untouched.

**RESUME HERE (2026-09-28, night):** PR C is committed on `feat/face-v2-07-page-shape` (`fce8b311`) and **not pushed**: page shape v1 (kit parts, `diagram.mjs` flow/loop, generated sections, door text unescaped), gate per ADR-1514, and qa rewritten with three figures. The owner saw qa in the room and said it is good (not yet recorded with `--accept`). Open decision: the other 33 pages through **improved plan B**, one Opus subagent per page with a pre-built source bundle and about 6 calls (roughly 200k cached reads per page), first batch 4 pages with real token counts measured, then his OK for the rest. He asked about secondary models (a Sonnet/DeepSeek bake-off was offered, not decided). Before push: one `/arc-attack` round (paid, needs his OK), then a background ci-digest watch.

**CHANGE ROUTED (2026-09-27, second pass, `/arc-change --lane face`, owner: "seri, vazhi 1 pannu"):** the owner read the 34 slice-3 pages (#299) in the room and rejected them -- unreadable, not the page shape of `arc-wiki-engine_1.html`, 40% of a week's tokens spent. **ADR-1348** (face): the room draws page shape v1 -- kit parts on face tokens (React, the owner's pick over embedding), generated sections from the extract, and our own `Diagram` (`flow` + `loop`) from a spec (vazhi 1, no library). **ADR-1514** (docs, amends ADR-1513 §1-2): facts live in generated blocks; a narrative is drift-checked and owner-accepted against its hash; the per-block verifier becomes advisory. Phase 07 8.5d -> 10.5d, total 29.5d -> 31.5d. Next: PR C on `feat/face-v2-07-page-shape` (parts + Diagram + fold + gate change + the qa sample); the other 33 only after the owner accepts qa. Assumptions ledger: nothing fired. Stale slice-3 drafts from arc-face-3 are parked on local branch `backup/face-3-stale-0927` (never pushed).

**RESUME HERE (2026-09-26, evening):** **Phase 06 is CLOSED** (done log, 2026-09-26) and stamped by the owner.
**Phase 07 is next: the Reference room** (REQ-12, 3d), then Phase 08, dogfood (REQ-10, 2d). Open: #267 (the Windows
proposal race: a face PR whose attack round, review and CI read never ran; it needs a rebase onto #282) and this
`/arc-change` PR. The Phase 06 logic-attacker pay-down runs from detached worktrees `wt-logic-60c13e9` and
`wt-logic-1f95807` (not branches).
- **Closed today:** #284 (handoff), #285 (the residue file and the CLAUDE.md background CI-watch rule), #286 (the
  residue fixture, attackers.md, spec-fidelity.md, two debt rows), and the close PR (spec ticks, tracker, board,
  ci-jobs.json, handoff.md, manifest). Receipts from the main clone: `phase.closed` `01M3EBD91R95PZD0EPQ1QB4TS2` ·
  `approval.requested{gate: phase-done}` `01M3EBDGQ70ETM8PXDHNKHSZXJ`.
- **The owner's stamp on `01M3EBDGQ70ETM8PXDHNKHSZXJ` decides three things at once:** `residue.md` as a whole (5
  ship, 4 start-only, 6 residue), the logic-attacker debt row, and the four read-backs debt row.
- **Change routed (2026-09-26, `/arc-change --lane face`):** a Reference room -- the docs wiki inside the face, and a
  Reference link from every room -- is **Phase 07** (REQ-12, ADR-1346, 3d: the days ADR-1339 left unallocated). Dogfood
  moves to **Phase 08** and stays last, on the final surface. Waiting on the owner's OK before any code.
- **SLICE 3 DONE (2026-09-27): all 34 product and lane pages written, source-anchored and verified** -- `narrative-anchors`: narratives=34 verified=34 fail=0, explanation debt 0 of 119 (every product, lane, command, agent, process, gate and rule in arc is explained somewhere). Drafted by Claude agents, judged block by block by deepseek-v4-flash (another family), fixed up to three rounds by fresh agents (well over a hundred CONTRADICTED claims corrected -- real errors reading would not have caught), then what still failed was pruned (~50 blocks of ~2,800). #297 (render + gate), #298 (the harness: excerpted chunks, carried verdicts, prune; ADR-1513 Amendment 1) merged. **Next: the owner reads the pages in the Reference room; each read is recorded with `narrative-verify.mjs --accept` (awaiting-owner 34 -> 0), then the live demo and `/arc-phase-done 07`.**
- **CHANGE ROUTED (2026-09-27, `/arc-change --lane face`, owner: option A + "tags + verifier" + "extend"):** at the live demo the owner found the room without the content it exists for -- 31 of 34 product and lane pages "narrative pending", the other 3 two flat paragraphs. **ADR-1347** widens REQ-12: every product and lane explained the way `arc-wiki-engine_1.html` explains engine (plain words, why, arc words → normal words, job flow, stages, life of a run, every feature), rendered with headings/lists/tables, explanation debt on screen. **ADR-1513** (docs lane, amends ADR-1508) is the verification method: every factual block source-anchored + a gate, an independent-family verifier receipt per page hash, the owner reads each batch for understanding. Phase 07 3d → 8.5d, total 24d → 29.5d. Slices: (1) rich render · (2) `narrative-anchors` + verifier harness · (3) 34 narratives in ~6 batches. Assumptions ledger: nothing fired. B1 (#294) and B2 (#295) merged 2026-09-27.
- **Phase 07 progress (2026-09-27):** PR A merged (#291, `GET /api/reference`). PR B1 builds the room itself -- born by the birth rule (company ring, an index room over products), the module drawing index → type → entity with the design's Start here · The bigger loop · Reference · Evidence · Meta, the cross-links from wiki-build's own exported `relationsOf` (so the room and the markdown cannot disagree; `wiki-build --check` proves the pages byte-identical). PR B2 is next: the per-room Reference link (the shell's hash carries the entity; the header draws the link once, for every room).
- **Then dogfood (Phase 08, the owner's days):** opens on `feat/face-v2-08`. Its verification plan is still
  the coarse one-liner, so the first step is `/arc-change --lane face` to refine it. Then two real days from the MAIN
  clone (`node .claude/scripts/hq/arc-face.mjs`): every decision goes through the face, and at least one op a day
  runs from it. `face-dogfood` reads each day. Then the retro, the HISTORY row, and `/arc-phase-done 07`.
- **Before the dogfood days (debt-row triggers):** the four start-only read-backs, as mock-driver fixtures (face). The
  logic pass over Phase 06's diff runs when the owner sets a paid `ARC_ATTACK_TRIAL_MODEL`.
- **How the owner wants it worked (2026-09-25):** LEAN. Report every step; no live demo (paid opus runs) without
  asking; one attack round per PR; one push per PR; no new mechanism without asking. After every push, watch CI with a
  background `ci-digest` loop (CLAUDE.md, 2026-09-26). Never ask the owner whether CI finished.
- **Owner's optional one-liner** (still owed): `! sed -i 's|plan/adr-record.mjs|hq/adr-record.mjs|' hq.policy.yaml`.
- **Known:** Windows shards flake on bench.run-model's CDP timeout, the proposal-branch three-writer race (#267), and
  face-browser's ERR_NO_BUFFER_SPACE. Re-run only the failed jobs.
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

**Waiting on the owner:** the stamp on `approval.requested{gate: phase-done}` `01M3EBDGQ70ETM8PXDHNKHSZXJ` (Phase 06).
Every earlier one (Phases 00-05 and Cycle 15's Phase 09) has a `decision.recorded` on the main clone's spine, checked
2026-09-26. Stamp it from the main clone with `node .claude/scripts/hq/arc-inbox.mjs approve <ULID> --reason "..."`,
or from the face's inbox room.

# PROGRESS.md — Cycle 16 · arc-face v2 "The Workroom"

status: LIVE
cycle: arc-face v2 (Cycle 16, opened 2026-09-16)
phase: 00
appetite: 24d
burn: 1d
blocked-on: —
depends-on: —

> Tracker for the cycle planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done` from the
> main clone (tests green on CI per job + live demo + exit criteria + evidence). This cycle claims
> **ADR 1318–1336** from the face band 1300–1399; before writing them the claim was swept across
> all 25 sibling worktrees and every `origin/*` branch on 2026-09-16 — none held an ADR ≥1318.
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at root
> (ADR-0053); evidence is lane-scoped at `initiatives/face/evidence/phase-NN/` (ADR-0055).
> **Cycle 15's record** — PLAN, PROGRESS, its nine phase specs and its evidence bundles — lives at
> `initiatives/face/archive/*-cycle15-2026-09-16` (ADR-1332). Design source:
> `docs/strategy/plans/PLAN-face-v2.md` v1.0 (the decision record, not the cycle).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Harness steel thread — v0.7 intake + contract + delta report; `npm ci` + build on every Node ≥20.19 leg; ported smoke opens all 34 served rooms | 2d | building — slices 01-19 proven, CI green per job on 65e6ec05; handoff next |
| 01 | Tokens + kit — two moods, computed contrast, generated copy, kit on Tailwind v4, 9 bespoke rooms × 2 moods (REQ-02) | 2d | spec'd |
| 02 | Shell + module frame — v0.7 shell, `face/src/modules/`, two-way reconcile, `face-pure`, `/arc-face-module` (REQ-03) | 2d | spec'd |
| 03 | The 36 modules read-side — five ring PRs, each with its `NOT SERVED` list (REQ-01, REQ-05) | 7d | spec'd |
| 04 | Door read routes — what Phase 03's lists name (REQ-06) | 3d | spec'd |
| 05 | Work door + verbs + flows in CI + coverage op-side (REQ-04, REQ-07, REQ-09) | 4d | spec'd — needs owner rulings §13 items 4, 5 |
| 06 | Session door — click-started, streamed, receipted (REQ-08) | 2d | spec'd |
| 07 | Dogfood 2 real days on the final surface + retro (REQ-10) | 2d | spec'd |

**Appetite burn: 0d of 24d.** Blocks: A · look (00–02) 0/6d · B · rooms + truth (03–04) 0/10d ·
C · verbs (05–06) 0/6d · dogfood (07) 0/2d. Tripwires: Block A day 3 · Block B day 5 · 50% of total
at 12d.

**Usage trend (read at every Phase 03 ring close, never counted toward REQ-10):** — not started.

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

## Now

**RESUME HERE (2026-09-17):** branch `feat/face-v2-00`, worktree `arc-face-v2`. Phase 00's slices
01-19 are proven and written in `phases/phase-00-tasks.md` (develop-lint clean, three trial WARNs);
slice 20 is the close. CI run `35186922293` on `65e6ec05` is **green on all 19 jobs**, with the
browser arm EXECUTED and printing its `face-browser: RAN leg=` line on ubuntu Node 20 + 22,
macos-latest and windows-latest (33/33 rooms, `errors=0 excluded-errors=0 unsettled=0`), and the
counted SKIP on ubuntu Node 18. The docs commit after it (this tracker, the tasks ledger, the
delta report's measured-empty baseline, the SLOW room line on fd 3) needs its own green run on the
new head before handoff.

What the 2026-09-17 session found and closed, each pinned in `fixed-defects.md` (68 lines):
- **Run D's two failures:** the lockfile check now requires the resolved binding's VERSION to
  satisfy the parent's pin; the macOS settle miss was measured, not guessed — a Google Fonts
  download and late CDP events on a cold macOS load, a different room each run (map, today,
  engine-room) while warm rooms settle in ~0.9 s — so a room FAILS only past a 30 s cap and the
  10-30 s band prints SLOW with what it held at 10 s (`smoke.mjs` header says what that gives up).
- **A crash hiding behind a FAIL:** `proc.mjs` unref()ed awaited timers, so the client suite exited
  mid-file with code 13 and no `RAN:` line; awaited timers now hold the process, races clear
  theirs, pinned by a child fixture.
- **Attack pass 2** on `f9805720` (decision logic 7 holes + 7 surviving mutants; shell/OS 3 holes),
  fixed in `ca6e26b6`.
- **Exit items that were claimed but unproven:** green jobs printed no RAN line (fd 3 now); the
  embedded-program probe never scanned this suite or `face/scripts` (handed by name, count
  asserted); no symlinked main-guard fixture existed (added, with a naive-guard control).
- **Shard weight:** `face-browser.bats` measured at 350 s on windows (first file of shard 1/12),
  now the heaviest file; `_floor` re-derived.

Open, not this phase's: `spine-concurrency.bats` hit LOCK_TIMEOUT once on windows shard 2/12 (run
`35183482747`) and passed on the next two runs — another lane's suite, recorded here only.
Google Fonts at runtime stays the Phase 01 intake finding (`delta-report.md`). Debts:
`debt-ledger.md`.

**Next step:** dispatch arc-ci on the docs head and read it per job; green → `/arc-develop handoff
00` (spec-fidelity check, open the PR); then `/arc-phase-done 00` from the main clone after merge
(receipts cannot be emitted from a worktree).

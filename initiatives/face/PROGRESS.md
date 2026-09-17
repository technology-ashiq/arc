# PROGRESS.md — Cycle 16 · arc-face v2 "The Workroom"

status: LIVE
cycle: arc-face v2 (Cycle 16, opened 2026-09-16)
phase: 02
appetite: 24d
burn: 1.5d
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
| 00 | Harness steel thread — v0.7 intake + contract + delta report; `npm ci` + build on every Node ≥20.19 leg; ported smoke opens all 34 served rooms | 2d | ✅ **CLOSED 2026-09-17** — 1d of 2d; 33/33 rooms, 0 errors on every L3 leg; merged `a0e8ee1f` (#233), `main` re-verified 19/19 (run 35194579928); receipts `01M2Q5HZ5REDYHQ0AY8T1PKJA4` · `01M2Q5HZJRBMN98HNR9YA5FR77` |
| 01 | Tokens + kit — two moods, computed contrast, generated copy, kit on Tailwind v4, 9 bespoke rooms × 2 moods (REQ-02) | 2d | ✅ **CLOSED 2026-09-17** — 0.5d of 2d; both moods on every L3 leg, 33/33 rooms, 0 errors; merged `4fcb53db` (#235), `main` re-verified 19/19 (run 35211136090, attempt 2); owner read "render aagudhu"; receipts `01M2QGWHBAX0329SNCX8Q2CPAX` · `01M2QGWHNYEBPAC97EEMV55JDH` |
| 02 | Shell + module frame — v0.7 shell, `face/src/modules/`, two-way reconcile, `face-pure`, `/arc-face-module` (REQ-03) | 2d | spec'd |
| 03 | The 36 modules read-side — five ring PRs, each with its `NOT SERVED` list (REQ-01, REQ-05) | 7d | spec'd |
| 04 | Door read routes — what Phase 03's lists name (REQ-06) | 3d | spec'd |
| 05 | Work door + verbs + flows in CI + coverage op-side (REQ-04, REQ-07, REQ-09) | 4d | spec'd — needs owner rulings §13 items 4, 5 |
| 06 | Session door — click-started, streamed, receipted (REQ-08) | 2d | spec'd |
| 07 | Dogfood 2 real days on the final surface + retro (REQ-10) | 2d | spec'd |

**Appetite burn: 1.5d of 24d.** Blocks: A · look (00–02) 1.5/6d · B · rooms + truth (03–04) 0/10d ·
C · verbs (05–06) 0/6d · dogfood (07) 0/2d. Tripwires: Block A day 3 · Block B day 5 · 50% of total
at 12d. **Block A, first clause read at day 1: Phase 00's browser suite is GREEN on CI** (run
35194579928, every L3 leg) — token work may start; the clause on the 9 rooms in both moods is read at
Phase 01's exit. **Block A, read on 2026-09-17 during Phase 01 (burn 1d, before the day-3 mark):
clause 1 still GREEN; clause 2 — the 9 bespoke rooms render on the new kit in both moods — is GREEN
on CI** (run 35207463369 on `0b51ea17`, 19/19 jobs: `opened=33 ... mood=dark mood-miss=0` and
`mood=light mood-miss=0` on ubuntu Node 20 + 22, macOS and windows) — no STOP. The owner's by-eye
read of the 9 rooms × 2 moods is Phase 01's exit gate and is recorded at `/arc-phase-done 01`.
**Block A, Phase 01 exit clause: GREEN** — the owner read the 9 rooms in both moods on 2026-09-17:
"Render aagudhu — close pannu". No STOP; the kit port is not re-scoped.

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

## Now

**RESUME HERE (2026-09-17):** **Phase 01 is CLOSED** (done log, 2026-09-17). The next phase is
**Phase 02 — shell + module frame** (`phases/phase-02-spec.md`, REQ-03, 2d appetite), and the owner
asked for it to start in a fresh session. Its Preconditions line is satisfied by the Phase 01 row
above once this close merges.

**Approval on record:** Cycle 16 is approved by the owner's `decision.recorded`
`01M2NS8Y48Y91RFZJVA32VNH17` (verdict approve, reason "Face V2 Kickoff approved"), answering
`approval.requested{gate: kickoff}` `01M2NS0AK4KN8JR10QDT2F72HP`; the kickoff merged as `c5dabfbc`
(#232) before the first Phase 00 commit. Standing instruction from the owner (2026-09-17): build
every phase through to the end without waiting, push and merge per phase on green CI, run nothing
locally, and ask only at owner-only gates.

**Waiting on the owner, none of it blocking Phase 02:** the stamps on
`approval.requested{gate: phase-done}` `01M2QGWHNYEBPAC97EEMV55JDH` (Phase 01),
`01M2Q5HZJRBMN98HNR9YA5FR77` (Phase 00) and `01M2NJ5F736X7PNRD68H5DVYPG` (Cycle 15 Phase 09) — from
the main clone, `node .claude/scripts/hq/arc-inbox.mjs approve <ULID> --reason "..."`.

**What Phase 02 inherits:** the face stage's WebGL guard AND its place in both moods (owner ruling:
dark-only until this phase decides); the typecheck joining the browser suite before any module is
written; the ported shell living under a colour-literal-linted root, and the stage's particle palette
behind tokens or named in the lint; `KpiStrip`, `PickRow`, `Meter` and `Empty` shipped with no reader
yet; the owner's standing ruling on AA floor corrections (done log); ADR-1335's counter at one windows
Chrome launch miss; debts in `debt-ledger.md`. The spec's setup line: the owner runs the git for
`feat/face-v2-02` — under the standing instruction the session cuts it from `main`.

**Next step:** in a new session, `/arc-resume --lane face`, then `/arc-develop start 02 --lane face`
on `feat/face-v2-02` cut from `main` after this close merges. Tests first per the spec's Verification
plan, on CI only.

# PROGRESS.md — Cycle 17 · arc-face v3 "Hands First"

status: LIVE
cycle: arc-face v3 (Cycle 17, opened 2026-10-21)
phase: 00
appetite: 7.5d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the cycle planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done` from the
> main clone (tests green on CI per job + live demo + exit criteria + evidence). This cycle claims
> **ADR 1357–1369** from the face band 1300–1399; before writing them the claim was swept on
> 2026-10-21 across all 326 `origin/*` branches, the owner's 208 local branches and the four
> registered worktrees' branches — none held an ADR ≥1357 (the worktrees' uncommitted files live
> on C:, outside the mounted folder, and were not readable — named, not assumed clean).
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at root
> (ADR-0053); evidence is lane-scoped at `initiatives/face/evidence/phase-NN/` (ADR-0055).
> **Cycle 16's record** — PLAN, PROGRESS, its 18 phase specs and its evidence bundles — lives at
> `initiatives/face/archive/*-cycle16-2026-10-21` (ADR-1332's pattern). Design source:
> `docs/strategy/plans/PLAN-face-v3.md` v1.0 (the decision record, not the cycle).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Hands First part 1, recorded — PR #449 closed on its evidence (REQ-01, ADR-1357…1364) | 0.5d | ⏳ built before kickoff (merged `6012c36`, CI 19/19 run 39551997252); closes by `/arc-phase-done 00` after the kickoff stamp |
| 01 | Records tab + pickers + the first-verb CI gate + the logic attacker (REQ-02…05, ADR-1365, 1368, 1369) | 2d | ⬜ not started |
| 02 | `qa-run` + `ship-run` — review → QA → Prepare ship from the face (REQ-06, ADR-1366) | 2d | ⬜ not started |
| 03 | Agent tiers on `/api/roster` + the discover hunt op (REQ-08, REQ-09, ADR-1367, ADR-1369) | 1d | ⬜ not started |
| 04 | Debt: the logic surface owed (debt #D95, debt #D96, debt #D99, debt #D106) + harness children (debt #D23) + v3 residue (debt #D113) (REQ-07) | 1.5d | ⬜ not started |
| 05 | Retro + HISTORY — the cycle closes on the record (REQ-10) | 0.5d | ⬜ not started |

**Appetite burn:** 0d of 7.5d (0%). Phase appetites sum to the full 7.5d — zero slack, stated. 50% tripwire at 3.75d (PLAN § Appetite).

## Done log

- **2026-10-21 — Cycle 17 kickoff (`/arc-kickoff --lane face`).** Cycle 16 archived in-lane
  (ADR-1332's pattern; three readers of its live contract lists follow the move). 13 ADRs written:
  1357–1364 record FV3-A…H, built and merged as PR #449 (`6012c36`) BEFORE this kickoff — the
  owner's 30-minute timebox; the order deviation is stated in PLAN and in Phase 00's spec, and Phase
  00 closes on evidence, never rebuilt. 1365–1369 are the kickoff's forks. Owner rulings at kickoff:
  appetite **6 days + the 1.5-day Debt phase the debt budget requires (112 open rows) = 7.5 days → Tier M**; Records = **one generic frame table each fold declares** (ADR-1365);
  Ship = **Prepare ship only** (ADR-1366); agent tier **implied by `model:`** (ADR-1367); logic
  attacker = **DeepSeek via OpenRouter** at the fork, then **`z-ai/glm-5.3-flash` via OpenRouter** by the owner's ruling the same day (ADR-1368 amended, before the kickoff stamp); spine receipts emitted on the owner's main
  clone by the session. **Kernel freeze:** `kickoff-lint` refused this kickoff under the owner's
  2026-10-18 ruling `01M5741NXKQ4GVDDRWZKTCYJ0Y` (no kernel-lane kickoff before the first
  `revenue.received`); the owner chose to exempt face Cycle 17, emitted as the superseding
  owner-ruling `01M5ER722G87D19PFDR7KFD48H` (same text, `face Cycle 17` added to the exempt list,
  parsed by `kickoff-gates.mjs` before emit) — awaiting his stamp.
  **Attack panel (×3):** 21 findings (A 7 · B 7 · C 7); 18 applied as mutations (REQ-02, 03, 04, 05,
  06, 07, 09, 10 sharpened; kill criteria gained the REQ-05 dead-end cut, a per-area Phase 04 cap and a
  pre-authorized 75% cut order; pre-mortem rows 4 and 5 replaced; ADR-1368's trigger moved to the Phase
  05 retro; a GitHub dependency row; Phase 02 verification written; #449 joins the Debt phase).
  REJECTED: hunt-flags assumption row — already-covered
  REJECTED: Phase 01 `Depends on` as prose — non-actionable
  REJECTED: a pass/fail dogfood calibration day before Phase 01 closes — out-of-appetite
  Auto-decided (two-way): pickers name existing things, and the hunt is a
  work-door op — it calls no model — superseding ADR-1356 decision 2 (ADR-1369).
  **Plan-simulator:** round 1 — 7 blockers (order of steps, the PR head SHA, CI on `main`, who runs
  phase-done, attack-file location, the order-deviation wording, receipts), all fixed; round 2 — 3
  blockers (audit counts beyond the first verb, the audit's topology, the CI-log evidence command),
  all fixed: `audit.cjs` now prints the org, not-ready and op-plan counts and was dry-run against a
  live door on `6012c36` + a spine copy (23/23 · 71/10/24 · 6 named · 32/32, 0 console errors).
  Two non-zero rounds → by rule a human call; per the Cycle 16 precedent the round-2 fixes are NOT
  re-simulated and are on the table at the owner's kickoff approval.

## Now

**CYCLE 17 PLANNED (2026-10-21) — waiting on the owner's two stamps:** the owner-ruling
`01M5ER722G87D19PFDR7KFD48H` (the freeze exemption) and the kickoff approval
`01M5ESEN589HQAJAS7VZ4NPXMT` (`kickoff.done` = `01M5ESEMSQN7HH05QZ2W6J3SA2`), both on the canonical spine; then `/arc-phase-done 00` from the main clone
on #449's evidence; then Phase 01 on `feat/face-v3-01-records-pickers`. Owner step before Phase 01's
attack: the three values are saved in the face's Keys tab (2026-10-21); the owner corrects `ARC_LLM_ENDPOINT` there to the full `https://openrouter.ai/api/v1/chat/completions` (ADR-1368).

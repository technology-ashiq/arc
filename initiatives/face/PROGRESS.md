# PROGRESS.md — Cycle 17 · arc-face v3 "Hands First"

status: LIVE
cycle: arc-face v3 (Cycle 17, opened 2026-10-21)
phase: 01
appetite: 7.5d
burn: 2d
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
| 00 | Hands First part 1, recorded — PR #449 closed on its evidence (REQ-01, ADR-1357…1364) | 0.5d | ✅ closed 2026-10-22 (merged `6012c36`, CI 19/19 run 39551997252; `phase.closed` `01M5GTM184F5RQMBA742QMMATZ`) |
| 01 | Records tab + pickers + the first-verb CI gate + the logic attacker (REQ-02…05, ADR-1365, 1368, 1369) | 2d | 🟡 built + merged #452 `75a8fa51` (CI green per job); closes after the owner reads ventures, money, story and org in the face |
| 02 | `qa-run` + `ship-run` — review → QA → Prepare ship from the face (REQ-06, ADR-1366) | 2d | 🟡 built + merged #453 `ba702637` (CI green per job); closes after the owner's QA → Prepare ship run lands two receipts |
| 03 | Agent tiers on `/api/roster` + the discover hunt op (REQ-08, REQ-09, ADR-1367, ADR-1369) | 1d | 🟡 built + merged #454 `b97dcc00` (CI green per job); closes after the owner runs one hunt from the face |
| 04 | Debt: the logic surface owed (debt #D95, debt #D96, debt #D99, debt #D106) + harness children (debt #D23) + v3 residue (debt #D113) (REQ-07) | 1.5d | ✅ closed 2026-10-22 (merged #455 `8199ab57`, CI 19/19 run 39712523040; `phase.closed` `01M5GTM2B4M8ZE64ATFZZ800QW`) |
| 05 | Retro + HISTORY — the cycle closes on the record (REQ-10) | 0.5d | ⬜ not started |

**Appetite burn:** 2d of 7.5d (27%) — under the 3.75d tripwire. Phase appetites sum to the full 7.5d — zero slack, stated. 50% tripwire at 3.75d (PLAN § Appetite).

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

- **2026-10-22 — Phase 00 CLOSED (`/arc-phase-done 00 --lane face`, main clone).** PR #449 (`6012c36`)
  closed on its recorded evidence, never rebuilt: `audit-3fda79d.md`, `ci-d8f03de.md` (19/19 run
  39551997252), `owner-demo.md`, two boundary rounds; bundle + `manifest.json` verified. Both owner stamps
  read approved on the spine before the close (kickoff `01M5F1B1AB5K1P74TB0ZQNJZYG`, freeze exemption
  `01M5F1BVH3X5KW2KGQ1YAKRRFK`). Receipts: `phase.closed` `01M5GTM184F5RQMBA742QMMATZ`, approval
  `01M5GTM3AGDHS0CV160WMKDEBS` (his). A second `phase.closed` for 00, `01M5GTMZNNPQA1ZJKP35HHZTH4`, same
  payload, was emitted by a retry after an output filter hid the first id — a duplicate, not a second
  close. REQ-01 validated. Metrics: amendments: 0 · reopened: n · t-to-phase0: 1 day.
- **2026-10-22 — Phases 01, 02, 03 built and merged, not closed.** #452 `75a8fa51`, #453 `ba702637`,
  #454 `b97dcc00`, each green per job on the exact merged head (`--match-head-commit`); two attack
  surfaces each (logic on `deepseek/deepseek-v4-flash-0731`, glm the fallback, ADR-1368). Each spec's
  live demo is the owner's: Phase 01 reads the four rooms, Phase 02 runs QA → Prepare ship, Phase 03 runs
  one hunt. The rows stay 🟡 until he does.
- **2026-10-22 — Phase 04 CLOSED (`/arc-phase-done 04 --lane face`, main clone).** #455 `8199ab57`, CI
  19/19 run 39712523040. Logic debt paid on five areas (D95a, D95b, D96, D99, D106 + PR449, bases in
  `attack-bases.md`), the harness ends its children's whole tree (D23, mutant on POSIX, win32 SKIP with
  its reason), v3 residue (D113: one ops + sessions read per room, org strings capped, `parseSaved`
  capped). Six debt rows marked PAID. Bundle (20 artifacts) verified. Receipts: `phase.closed`
  `01M5GTM2B4M8ZE64ATFZZ800QW`, approval `01M5GTM43MWXAAWX2XHYC7G0GT` (his). REQ-07 validated. Metrics:
  amendments: 0 · reopened: n.

## Now

**Phases 00 and 04 CLOSED; 01–03 merged and waiting on the owner's live runs (2026-10-22).** All four
Cycle 17 PRs are on `main` (#452–#455). His three runs, each in the face on the main clone after a
pull: (1) open `#/ventures`, `#/money`, `#/story`, `#/org` and read the Records tab → closes 01;
(2) review-ship room → QA → Prepare ship; the inbox shows the deploy gate, nothing deploys → closes 02;
(3) discover room → Hunt → Plan → Apply → closes 03. Then `/arc-phase-done 01..03`, then Phase 05
(retro + HISTORY, lane IDLE). His stamps: approvals `01M5GTM3AGDHS0CV160WMKDEBS` (00) and
`01M5GTM43MWXAAWX2XHYC7G0GT` (04).

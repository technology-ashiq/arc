# Phase 05 — Retro and HISTORY: the cycle closes on the record

**Goal (one line):** REQ-10 — `/arc-retro --lane face` closes Cycle 17; the retro-log and HISTORY carry it; PROGRESS reads IDLE and PORTFOLIO derives.
**Appetite:** 0.5 days
**Depends on:** phase-02, phase-03, phase-04
**Serves:** REQ-10
**Branch:** `feat/face-v3-05-close`

## Exit criteria (Definition of Done)
- [ ] 5/5 prior phases closed through `/arc-phase-done` (spine receipts present, not only tracker ticks).
- [ ] `/arc-retro --lane face` run, recording the face-vs-terminal count for the verbs Phases 01–03 added beside what shipped, and deciding ADR-1368's trigger (keep the logic attacker as a trial, or file the ADR-0069 amendment as the next cycle's first slice); `docs/retro-log.md` gains Cycle 17 rows (repeated corrections → setup upgrades); `docs/HISTORY.md` gains the Cycle 17 entry.
- [ ] PROGRESS `status: IDLE`, `phase: 05 (cycle closed)`; `board-lint` green with no hand edit to PORTFOLIO.md; CI per job; `/arc-phase-done 05`.

## Verification plan
Refined when the phase starts: `board-lint`, `kickoff-lint`, CI per job, the retro receipt.

## Rabbit holes in this phase
Re-opening shipped decisions in the retro (they become a next-cycle plan, not edits).

## Out of scope for this phase
Any product code.

## Your-setup / pending
Read and stamp the retro.

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.

# PROGRESS.md — distribute Cycle 2 "arc's loop under OpenCode on a non-Anthropic model"

status: LIVE
cycle: arc-distribute (Cycle 2, opened 2026-10-13)
phase: 05
appetite: 3d
burn: 0d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/distribute/evidence/phase-NN/`.
Cycle 1 is archived at `archive/PLAN-cycle1-2026-10-13.md` + `archive/PROGRESS-cycle1-2026-10-13.md`; its 9 validated
REQs and phases 00–04 stand. ADR century 2000–2099; Cycle 2 writes ADR-2019..2021. The owner opened and approved this
cycle in chat on 2026-10-13 ("REQ-03 cycle", model `deepseek/deepseek-v4-flash-0731`, cap $0.50, "complete all phase …
don't wait for me … merge ellam phases complete aana apram"). Every phase is built on `feat/distribute-c2-req03` and
merged once at cycle end; each phase closes from the main clone after that merge.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — parked, shipped in Cycle 1 | — | ✅ |
| 05 | Capped wrapper + transcript + harness/evidence stamp + one live `arc-commit` smoke receipt — 50% tripwire (REQ-11, 12) | 1d | 🔨 in progress |
| 06 | `arc-ship` runnable in arc: package scripts, `ci-digest --wait`, no-deploy branch, goldens (REQ-13) | 0.75d | ⬜ |
| 07 | The real run: commit → review → push → ship, 3 negatives, PR merged after checks, transcripts, retro + seal (REQ-03) | 1d | ⬜ |

## Done-log

- **Kickoff 2026-10-13** (receipts `kickoff.done` 01M4RWTWG6GANBZE4YQA7TKW1R, `approval.requested` 01M4RWTX3STGAQNY4KE5XXKHCR; the owner pre-approved building in chat, the stamp stays theirs): PLAN (tier S, 4 REQs), phase specs 05–07, ADR-2019..2021. Survey facts that shaped it:
  nothing in code sets `harness` on a receipt; `arc-ship` cannot run in arc (no scripts, no deploy target);
  `core.hooksPath` is unset; no USD cap exists for a foreign harness. Cycle 1's stale "owner items" line is
  corrected here: all 6 distribute approvals (kickoff + P00..P04 move-on) were decided `approve` on the spine
  between 2026-10-07 and 2026-10-09; `arc-inbox inbox` shows none open.

---
## Now

**Current position: Phase 05 open** (kickoff 2026-10-13) — building the capped wrapper and the harness stamp on `feat/distribute-c2-req03`.
**Next step:** write `tests/distribute-opencode-session.bats` red first, then `opencode-session.mjs`; then the stamp and its suite; push once, read CI per job, then the live `arc-commit` smoke (≤ $0.10, the 50% tripwire).

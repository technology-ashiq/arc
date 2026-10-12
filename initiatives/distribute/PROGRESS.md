# PROGRESS.md — distribute Cycle 2 "arc's loop under OpenCode on a non-Anthropic model"

status: LIVE
cycle: arc-distribute (Cycle 2, opened 2026-10-13)
phase: 05
appetite: 3d
burn: 1.25d
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
| 05 | Capped wrapper + transcript + harness/evidence stamp + one live `arc-commit` smoke receipt — 50% tripwire (REQ-11, 12) | 1d | 🔨 built, tripwire YES, CI pending |
| 06 | `arc-ship` runnable in arc: package scripts, `ci-digest --wait`, no-deploy branch, goldens (REQ-13) | 0.75d | 🔨 built, CI pending |
| 07 | The real run: commit → review → push → ship, 3 negatives, PR merged after checks, transcripts, retro + seal (REQ-03) | 1d | ⬜ |

## Done-log

- **Kickoff 2026-10-13** (receipts `kickoff.done` 01M4RWTWG6GANBZE4YQA7TKW1R, `approval.requested` 01M4RWTX3STGAQNY4KE5XXKHCR; the owner pre-approved building in chat, the stamp stays theirs): PLAN (tier S, 4 REQs), phase specs 05–07, ADR-2019..2021. Survey facts that shaped it:
  nothing in code sets `harness` on a receipt; `arc-ship` cannot run in arc (no scripts, no deploy target);
  `core.hooksPath` is unset; no USD cap exists for a foreign harness. Cycle 1's stale "owner items" line is
  corrected here: all 6 distribute approvals (kickoff + P00..P04 move-on) were decided `approve` on the spine
  between 2026-10-07 and 2026-10-09; `arc-inbox inbox` shows none open.

- **P05 2026-10-13**: wrapper + stamp built; attack r1 (logic 15, boundary 10) and r2 (logic 0, boundary 12) fixed or
  ledgered. Four live smokes and three probes measured two OpenCode facts the plan did not know: a subagent's `ask`
  hangs a headless run (fences now deny) and subagent spend is not in the stream (now read by `opencode export`),
  ADR-2022. **50% tripwire: YES** — receipt `01M4S4V92YACPXF1V08XXWR04B` (`commit.done`, `harness: opencode`) on the
  main spine for $0.0019 (`evidence/phase-05/smoke.md`). Cycle spend $0.035 of $0.50.
- **P06 2026-10-13**: package scripts, `ci-digest --wait`, the no-deploy `arc-ship` branch; attack r1 fixed or ledgered.

---
## Now

**Current position: P05 and P06 built on `feat/distribute-c2-req03` (PR #412, draft); P05's tripwire answered YES.**
**Next step:** push, read CI per job; then P07: the full loop run (commit → review → push → ship) and the three negatives.

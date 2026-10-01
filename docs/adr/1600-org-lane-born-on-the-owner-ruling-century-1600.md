# ADR 1600 — The org lane is born on the owner ruling of 2026-09-29 and holds century 1600

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** Another lane is found holding an ADR in 1600-1699 on any branch or worktree -> the unmerged lane moves (ledger tie-break: first merged keeps the band).

## Context
The owner ruled on 2026-09-29: *"Oru new idea vantha antha product ah create panni, deploy panni, SEO panni, sales panni, support panra — full-time company maari — ovvoru task kum oru separate skilled agent."* The design source `docs/strategy/plans/PLAN-org.md` was landed (PR #301) and cut into this lane at kickoff. The lane needs an ADR century. PORTFOLIO lists 1600–1699 as "next lane to be born", and that board has been stale five times before. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Claim 1600 after a sweep of every worktree and remote branch** — the only check that has caught a collision before.
2. **Claim 1600 from the board alone** — cheap, and wrong four times out of five historically.

## Decision
Claim **1600–1699**. The sweep on 2026-09-29 covered 13 worktrees and every `origin/*` branch: none holds an ADR ≥ 1600. Side finding: `1514` exists in two docs-lane worktrees while the board reads "1500–1512 taken" — the sixth stale-band-row, recorded on the board row, not fixed here. The ruling is **not yet on the spine**; recording it as a `decision.recorded` is Phase 00's first act, and every ADR in this band cites it.

## Consequences
Easier: every lane-local number is collision-checked. Harder: nothing. Revisit only on a collision.

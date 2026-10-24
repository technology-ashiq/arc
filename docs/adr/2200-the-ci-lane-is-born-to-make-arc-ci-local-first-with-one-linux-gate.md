# ADR 2200 — The `ci` lane is born to make arc's CI local-first with one Linux gate

**Status:** accepted
**Date:** 2026-10-24
**Product:** `ci`
**Reversibility:** two-way
**Revisit trigger:** the §11 kill line in `initiatives/ci/PLAN.md` fires at Phase 02 exit. The Phase 00–01 pipeline is then kept and the migration is re-planned.

## Context

GitHub's free private-repo minutes ran out, and the owner made arc public to keep CI running. A push costs ~1,070 billed minutes and 35 min of wall clock (run 39736016311), because 19 jobs run on three OSes. The owner ruled on 2026-10-23: *"Enaku industry standard CI/CD venum… na oru devops architect."* The design source is `docs/strategy/plans/PLAN-ci.md` v1.0, merged in #458. It locks CI-A…L and CI-O…S, and leaves CI-M and CI-N to the owner.

## Options considered

1. **Tune the matrix in place.** Fewer shards cut minutes but keep macOS at 10x and Windows at 2x, plus the "never test locally" rule that makes every fix a push.
2. **A new lane following the design source.** One ubuntu gate, the box as the first gate, and `node:test` lane by lane.

## Decision

Option 2. ADR-2201..2211 record the locked letters. CI-M (ADR-2206) and CI-N (ADR-2207) were answered by the owner at kickoff on 2026-10-24.

## Consequences

ADR century 2200–2299 is claimed. `social` takes 2100–2199 at its own kickoff (design source header). The Phase 00 PR re-sweeps every worktree and remote branch before the band row is written.

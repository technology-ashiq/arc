# ADR 2206 — CI-M: GitHub Pro, private repo, branch protection kept

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** two-way
**Revisit trigger:** Pro's price changes, or private-runner minutes (2 vCPU) push a PR run past 15 min of wall clock.

## Context

GitHub Free gives protected branches to public repos only. arc is the owner's private HQ, and it was made public only to escape the minutes cap.

## Options considered

1. **GitHub Pro (~US$4/month; verify at checkout).** Private repo, protection kept, 3,000 minutes.
2. **Stay public.** Free and protected, but every commit stays public.
3. **Private on Free.** No protection; only hooks and discipline guard `main`.

## Decision

Option 1, chosen by the owner at kickoff on 2026-10-24. The flip happens only after the Phase 00 merge and the verify run on `main` (§5 step 5).

## Consequences

Private runners have 2 vCPU instead of 4. REQ-03 is measured again after the flip. The Phase 00 owner prep includes the purchase.

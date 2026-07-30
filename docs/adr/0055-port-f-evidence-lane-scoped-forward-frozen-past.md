# ADR 0055 — PORT-F: evidence is lane-scoped going forward; the past stays frozen

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** one-way
**Revisit trigger:** any need to restructure `docs/evidence/**` — that is a history rewrite and requires its own ADR with owner sign-off, not a lane decision.

## Context

`docs/evidence/` already interleaves Cycle-2 and Cycle-3 bundles under flat `phase-NN`
names; moving them would rewrite history (manifests record paths and hashes). New lanes
need evidence that lives with the lane. Source pack:
`docs/strategy/plans/PLAN-portfolio.md` §5 PORT-F, §9 migration inventory.

## Options considered

- Migrate old evidence into lanes — rejected: rewrites history; manifest hashes and
  cross-refs point at the old paths.
- Freeze old, lane-scope new — accepted.

## Decision

New evidence lands at `initiatives/<lane>/evidence/phase-NN/` (via `arc-evidence.sh`,
whose `--out` seam already exists). Existing `docs/evidence/**` is **FROZEN in place as
the sole canonical copy**, with a one-line pointer README. Same for `docs/archive/**`.

## Consequences

- One-way for new evidence: once bundles start landing lane-scoped, the flat namespace
  is closed for new cycles.
- Frozen paths are load-bearing for old manifests — no script may write there again
  except the pointer README added once in Phase 1.

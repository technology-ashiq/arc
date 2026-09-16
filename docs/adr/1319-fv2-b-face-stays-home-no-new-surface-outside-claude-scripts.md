# ADR 1319 — FV2-B: `face/` stays the home, and no new surface is born outside `.claude/scripts/` this cycle

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the distribute lane lands its atomic layout-move PR → the ops registry and door follow that move in the same PR; or `.github/workflows/**` becomes writable → ADR-1316's split option reopens.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-B — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff.

## Context

ADR-1316 moved L3 in-repo because a new repo would have no CI. v0.7 is a separate Vite app
on the owner's disk; bringing it in could mean a second app, a new repo, or a new top-level
directory for the work door's ops registry. Separately, arc's real layout problem — product
code and the spine living inside a vendor's `.claude/` folder — is visible and tempting to
fix in the same cycle.

## Options considered

1. **`face/` stays the one L3 home; the ops registry lands beside the door in `.claude/scripts/hq/`** — no second convention.
2. **Ship the design app inside the product as a second app** — two builds, two token copies.
3. **Split the tree now (move product code out of `.claude/`)** — two path conventions live for weeks; a directory move costs references, not files.

## Decision

Option 1. No new repo, no second app, no design app shipped inside the product. The ops
registry lands beside the door it serves. The layout move is the **distribute lane's** work:
one atomic `git mv` PR with a compat shim, a lint that fails new references to the old
path, and a `migrate-layout` command.

## Consequences

- Easier: CI keeps testing L3 through the existing matrix; the module boundary keeps a later split cheap.
- Harder: every new door file adds references under `.claude/scripts/hq/` that the distribute move must carry.

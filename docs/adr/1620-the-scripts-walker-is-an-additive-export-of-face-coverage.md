# ADR 1620 — The scripts walker `org-coverage` needs is added as an additive export of `face-coverage.mjs`, landed in org's Phase 00 change

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The face session objects to the export or has a conflicting change in flight -> it lands in a face-lane PR first and org Phase 00 waits on it.

## Context
ORG-J forbids a local walker, and `face-coverage.mjs` exports no scripts walker today. The face lane is LIVE and owns that file. The docs lane faced the same shape and added `treeWorld` additively in its own Phase 00 (ADR-1501). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **(a) Additive export in org's Phase 00 PR**, face session told through a paste-ready prompt.
2. **(b) Local walker** — breaks ORG-J.
3. **(c) Wait for face** — blocks Phase 00 on another lane's queue.

## Decision
(a). One exported function (`treeScripts(repo)`), no change to any existing export, no behavior change to face's own gate. Before editing: `git log origin/main --oneline -5 -- .claude/scripts/core/face-coverage.mjs` (lanes.md shared-file rule).

## Consequences
Easier: Phase 00 is not blocked. Harder: a cross-lane touch on a live lane's file — kept additive to stay mergeable.

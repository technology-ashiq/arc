# ADR 0037 — DES-E: exploration diverges by interaction thesis, proven by the IA-difference matrix, in isolated worktrees with per-variant temp tokens

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** two explore runs where the director must reassign theses more than once each — the thesis catalogue or assignment method is wrong.

## Context

Three variants that are one app with three skins waste the whole exploration. Superseded
rows 1 (aesthetic charters), 4 (HTML sketching as normal path), 8 (no tokens during
exploration) and 12 (string-distance checks) all died here.

## Options considered

1. **Interaction theses + IA matrix + isolation** — each composer gets a DIFFERENT product-structure thesis (command center / guided workflow / canvas / narrative / review workspace / ambient assistant); each variant opens "This product wins because the user can ___ without ___"; the 7-dimension IA-difference matrix must materially differ on ≥3 dimensions (lint checks presence; the DIRECTOR judges "materially"); same immutable base SHA; one worktree per composer; per-variant temp token set; ONE shared deterministic render command. Con: infrastructure cost.
2. **Style charters (dense/calm/bold)** — cheap divergence. Con: diverges skins, not concepts.
3. **Freeform "make them different"** — no proof; convergence goes unnoticed.

## Decision

Option 1, exactly as frozen. Real-stack rule: if the product stack exists, variants build
from its real primitives; HTML sketching only greenfield. Winner's temp tokens become the
canonical product tokens (tokens are an OUTPUT of direction).

## Consequences

Easier: the chosen direction survives implementation by construction; comparisons are
real comparisons (same render command). Harder: worktree + token plumbing.
**Time-constrained fallback (pre-decided):** separate variant route namespace instead of
worktrees — decide at Phase-2 open, never mid-phase.

# ADR 1308 — FACE-I: art direction is decided by the design lane's blind exploration

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the owner scores the winner BELOW-BAR twice → stop, bank the brief +
design system, re-explore next cycle (block A kill). Claude Design's role needs the DES-G
"W3+" ruling via `/arc-change` in the design lane before first use — no ruling, no tool.

## Context

The visual answer is a decision, not an assertion — `arc-hq-mockup.html` stays a concept
list, and the July `arcface` prototype is NOT reused (owner ruling 2026-08-18: fresh
design). Cycle 3's 23/100 was five critique rounds on pixels nobody had looked at; the
design lane exists to prevent exactly that.

## Options considered

1. **`design-explore` per the design lane's law** — director assigns three theses +
   4-axis art direction; `ui-composer` ×3 build isolated variants (own dir, own
   `tokens.css`, same base SHA) passing `design-lint`; deterministic renders;
   `design-jury` ×3 rank blind with a world-class reference as the fourth item; owner
   pick + falsifiable PREDICTION as `decision.recorded`. Cons: 3 days of block A.
2. **Straight into Claude Design / a design tool** — cons: beautiful screens for the 8
   obvious surfaces, missing the other 24 rooms, the 46 kinds, the one-write law and the
   honesty classes.

## Decision

Option 1 (REQ-08, Phase 01). Default theses: *command center* / *canvas (map-first)* /
*review workspace (inbox-first)*; direction to beat: **"Ink & Signal"** (ink surfaces,
paper mode, amber reserved for needs-you, money-real green, incident red, one hatched
violet family for every non-real class, humanist sans + monospace tabular numerals, 8-pt
grid, no shadows/gradients); reference bar for the jury: **Linear** (with Vignelli 1972,
Ableton arrangement view, Stripe balance page as art-direction references, not targets).
BELOW-BAR class active; two critique rounds max. **Claude Design's place** (after the
pick, behind the DES-G ruling): taste-iteration canvas and design-system home — variants
and tokens flow **from the repo into** Claude Design (`/design-sync`), never the reverse
as source of truth; any hosted preview is private, deployment-protected, and needs the
owner's explicit OK (publishing rule in CLAUDE.md).

## Consequences

Easier: the thesis is picked blind against a reference, with a prediction the outcome can
score. Harder: three genuinely different variants must clear ≥3/7 IA dimensions and ≥3/4
art axes (assumptions row 4 — one reassignment round, then the fallback).

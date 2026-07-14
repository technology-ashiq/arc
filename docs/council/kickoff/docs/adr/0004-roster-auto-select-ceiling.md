# ADR 0004 — Chair auto-selects the roster inline; domain-expert ceiling of 4

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** real questions routinely need more than 4 genuinely-distinct domain experts, or users ask for a roster-approval step before convening.

## Context
Per question the Chair must pick which domain experts convene. Two sub-questions: (a) does it pause with a
STOP gate for the user to approve the roster, or announce it inline and proceed; (b) how many experts can
convene for a multi-domain question. Both affect the command's step count and per-run cost.

## Options considered
1. **STOP gate to confirm roster** — pros: user control; cons: an interstitial in what should be one ask→answer command; annoying for an advisory tool.
2. **Auto-select + announce inline** — pros: single-command UX (arc reserves STOP gates for real decisions, not routine picks); cons: a mis-classification isn't caught before the run.
3. **Ceiling: uncapped vs a fixed number** — uncapped risks convening all 7 experts on a single-domain question (cost); a fixed ceiling bounds cost.

## Decision
The Chair classifies the question's domain(s), convenes every genuinely-relevant expert **inline with no
STOP gate**, and announces the roster in its intake. A **ceiling of 4** domain experts (plus the 5 core
members + verifier) bounds cost; a truly wider question is noted and the 4 most-relevant are chosen.
Chosen to keep the ask→answer UX while bounding fan-out.

## Consequences
Easier: predictable cost, no mid-run interruptions. Harder: an occasional 5-domain question is trimmed to
4 — the trim is announced, not silent.

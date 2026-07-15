# ADR 0008 — Rebuttal round: final-only ratings + REBUTTAL LOG; no-rubber-stamp grades the first pass

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** one-way
**Revisit trigger:** a calibration review or eval probe shows the REBUTTAL LOG hides a material pre-rebuttal contest (e.g. a flipped rating whose reason line doesn't survive scrutiny), or ≥3 saved v2 sessions prove the two-section shape confuses the review flow.

## Context
v2 adds a bounded rebuttal: after the verifier grades, only Contested/DISPUTED POINT-IDs get one
rebuttal exchange, and the verifier re-grades just those IDs. Saved verdicts are the council's
permanent record and the calibration loop's data source — their shape is a one-way door. Two
questions had to be settled together: (a) does `## VERIFIER RATINGS` show pre- and post-rebuttal
ratings, or final only; (b) which pass must satisfy the no-rubber-stamp invariant (fairness.md #6:
a verifier that contested nothing = invalid run) — because after a successful rebuttal the FINAL
ratings may legitimately contain zero Weak/Contested, which would naively fail the lint.

## Options considered
1. **Final-only ratings + a new `## REBUTTAL LOG` section (pre→post delta per contested ID); no-rubber-stamp checks the FIRST pass** — pros: today's ratings regex untouched, invariant can't be broken by a good rebuttal, delta preserved; cons: two sections to keep consistent.
2. **Pre- and post-rebuttal ratings inline (`S2: Contested→Supported`)** — pros: one section, full transparency; cons: breaks the existing `Pn: <rating>` regex in council-lint and every downstream parser.
3. **Final-only, no-rubber-stamp checks the final pass** — pros: simplest; cons: a successful rebuttal retroactively invalidates the run — punishes the feature for working.

## Decision
Option 1. `## VERIFIER RATINGS` stays in its v1 shape holding FINAL ratings; when a rebuttal ran,
a `## REBUTTAL LOG` section records each contested ID's `pre → post` rating with a one-line reason.
council-lint's no-rubber-stamp check accepts a run as contested if EITHER the final ratings contain
≥1 Weak/Contested OR the REBUTTAL LOG shows ≥1 ID whose first-pass rating was Weak/Contested.
The carrying reason: the fairness invariant is about whether cross-examination HAPPENED, and the
REBUTTAL LOG is durable proof it did.

**Definition (added at attack-panel reconcile, pre-STOP):** the **rebuttal set** = every POINT-ID
rated `Contested` PLUS every ID listed under the verifier's `DISPUTED` section. The Chair rebuts,
and the verifier re-grades, exactly this set; `## UNRESOLVED` renders this set's post-rebuttal
residual (or the pre-rebuttal set when no rebuttal ran). Every "Contested/DISPUTED" phrase in v2
prose resolves to this one definition.

## Consequences
Easier: v1 parsers/lint regex keep working; calibration reads one canonical rating per ID; the
rebuttal's effect is auditable forever. Harder: the lint gains a second evidence path (log-based)
that needs its own red fixture; the Chair template must forbid a REBUTTAL LOG when no rebuttal ran.
If this goes wrong (log abused as a loophole), revisit toward option 2's inline transparency.

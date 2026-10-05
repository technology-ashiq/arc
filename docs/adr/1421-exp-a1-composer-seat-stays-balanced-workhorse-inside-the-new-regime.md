# ADR 1421 — EXP-A1: the composer seat stays balanced-workhorse inside the new regime

**Status:** accepted
**Date:** 2026-10-05
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a later paired run in which high-judgment wins at least 2 of 3 same-thesis
pairs on the owner's blind score AND beats balanced-workhorse's mean by at least 10 points — the
same formula, re-run, not a new one.

## Context

[ADR-0070](0070-composer-seat-stays-balanced-workhorse.md) kept the composer on the
balanced-workhorse tier from a paired run that had two logged deviations: no pre-registered
prediction, and no reference item in the jury. Its revisit trigger named the new regime (eyes,
reference pack, craft-first jury). [ADR-1400](1400-dsv-a-the-composer-seat-changes-only-through-exp-a1.md) and Phase 04 re-ran it
inside that regime, with [ADR-1416](1416-the-exp-a1-prediction-is-session-authored-on-the-owners-delegation.md)'s
prediction sealed first.

## The run (explore `lexos-case-workspace-expa1`, base `17044b62`)

- **Seal:** model-policy's phase-02 bundle (10 files) hashed and ADR-1416's prediction copied at
  2026-10-05T07:16:04Z, before any composer armed. `seal-check` after the run: 10 files match.
  The failing control (one byte flipped in a scratch copy, status read directly) is pinned on CI.
- **Pairs:** three director theses; a->d, b->e, c->f carry byte-identical theses at one commit.
  a/b/c ran the composer's own tier (balanced-workhorse), d/e/f the high-judgment tier as a
  per-invocation override. The composer's `model:` line was never edited.
- **Jury:** N=7 — the six variants plus one pack reference (nicelydone `b7fdffbc4871a0c4`, an
  on-brief status-panel screen). This closes ADR-0070's missing-reference deviation.
- **Owner blind score** (2026-10-05T11:21:12Z, `note.logged` receipt):

| thesis | balanced-workhorse | high-judgment | winner |
|---|---|---|---|
| command center (a/d) | 59 | 58 | balanced-workhorse |
| guided workflow (b/e) | 35 | 48 | high-judgment |
| narrative record (c/f) | 25 | 27 | high-judgment |
| **mean** | **39.7** | **44.3** | gap 4.7 |

Reference: 40.

## Decision

**The composer seat stays balanced-workhorse.** The standing formula's gain half needs
high-judgment to win at least 2 of 3 pairs **and** a mean gap of at least 10 points. It won 2 of
3 with a gap of 4.7: **NOT MET**, so there is no promotion and the owner's cost/time acceptance is
never asked. Two of the three pair gaps (1 and 2 points) are inside any honest noise band; only
the guided-workflow pair moved by more than 10.

**ADR-1416's sealed prediction is a HIT.** It said "balanced-workhorse holds; no material
owner-visible gain; no promotion", at medium confidence. All three clauses held. One hit
calibrates little; it is recorded plainly so the ledger also holds the misses when they come.

## What this does not settle

- **Thesis dominated tier.** The spread between theses (command center 58-59, narrative 25-27)
  is about ten times the spread between tiers on the same thesis. What the owner reacted to was
  structure, not model.
- **Jurors and owner disagree again.** Both blind jurors ranked the high-judgment narrative
  variant (f) first and the reference last; the owner scored f 27 and the reference 40, above
  four of six variants. This is the second run in which agent taste diverged from the owner's
  (Phase 03: variant-b); it is calibration input for the jury, not evidence about tiers.
- **Two jurors, not three.** The high-judgment juror seat (`design-jury-hj`, ADR-1414) was
  refused by the session's permission classifier and was not worked around. The owner's score,
  not the jury, is the instrument this decision reads, so the decision stands; the panel was
  thinner than planned.
- **Best arc 59 against a reference at 40** clears the reference but sits far below the brief's
  bar ("the page a lawyer opens first every morning and trusts on sight").

## Consequences

- No `model:` change; [ADR-0069](0069-balanced-model-policy.md)'s tiers stand as written.
- The question is closed with receipts: the seal, the pairs, the owner score receipt, the
  `exp-a1` output, and this ADR. Re-opening it takes the revisit trigger above, not a new run
  on a hunch.

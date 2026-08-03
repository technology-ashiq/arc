# ADR 0306 — EVO-F: one pinned verdict test, `newcombe-wilson-difference-v1`

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** one-way
**Revisit trigger:** a metric family arrives that is not integer successes over integer trials
(continuous values, ratios, revenue-per-user). That needs a new test id and its own ADR — never a
second formula behind the same id.

## Context

A verdict is the moment evidence becomes a proposal, so the test that produces it is the single
most load-bearing piece of math in the cycle. Two failure modes bracket the choice: a test loose
enough to promote noise, and a test so strict the engine never promotes anything and quietly
becomes inert.

Both arms produce integer successes over integer trials in v1, which narrows the field to
proportion-difference methods.

## Options considered

1. **Naive difference in proportions with a z-test.** Cons: poor coverage at small n and near
   0 or 1 — exactly the regime a young surface sits in.
2. **Sequential / always-valid testing.** Pros: peeking becomes safe. Cons: a second axis of
   complexity, and the no-peeking rule already solves the problem it addresses at v1 scale.
3. **Newcombe's method for the difference of two independent proportions, built from Wilson score
   intervals, evaluated once at a fixed horizon.** Chosen.

## Decision

**`newcombe-wilson-difference-v1`** — a one-sided lower confidence bound on the
direction-adjusted improvement (challenger − champion for `higher-is-better`, inverted
otherwise), with α from the `evals` config.

A verdict exists **iff all** of the following hold:

- **bound ≥ `effect_floor`** (default `0`, i.e. plain superiority), **AND point delta ≥ MDE**
- per-arm floor met on **both** arms
- guardrail not breached
- zero cohort violations
- windows marked `MISSING` excluded **symmetrically from both arms**

**Fixed-horizon, compute-once.** The verdict is computed at most once, when both arms reach the
floor. No sequential peeking — an early compute is refused, with a fixture proving it.

**Why `effect_floor` defaults to 0 rather than MDE.** Per-arm floors are derived at 80% power to
*detect* MDE. Requiring the bound ≥ MDE at that same n promotes roughly 5% of the time even when
the true effect exactly equals MDE — which would make the engine inert and the floor derivation
incoherent. The knob exists, and is hashed, for surfaces that deliberately want the stricter
rule.

**Formula id + version + α + `effect_floor` are mandatory in the config hash**, and **reference
vectors are pinned as fixtures**: counts in → exact bound values out, committed with the
implementation, reproduced bit-for-bit by replay and by any reimplementation.

## Consequences

**Easier.** One test, one id, one set of reference vectors. A verdict carries the hash of the
exact configuration that produced it, so a replay that disagrees is a detectable defect rather
than a difference of opinion.

**Harder.** Everything about the math is now a one-way commitment, and floors are large — a CTR
of 3% → 4.5% at 80% power needs roughly 1,900 units per arm. Thousands, not hundreds. That is
honest physics and it is why the real verdict sits outside the build appetite.

A specific guard against a recorded arc failure: `design-cycle3` (2026-07-30) showed that a pass
condition defined only as an absence lets characterless work through. `bound ≥ effect_floor AND
delta ≥ MDE` is a positive bar — it fails for insufficiency, not merely for rule-breaking — and
the fixture where `delta ≥ MDE` but `bound < effect_floor` yields **no verdict** is the proof
that noise cannot win.

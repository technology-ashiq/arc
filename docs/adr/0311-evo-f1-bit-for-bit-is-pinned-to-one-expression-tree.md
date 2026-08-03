# ADR 0311 — EVO-F1: "reproduced bit-for-bit" is pinned to ONE expression tree, and cross-checked to a tolerance

**Status:** accepted
**Date:** 2026-08-04
**Product:** `evolve`
**Reversibility:** two-way (the pinned tree can change; the vectors are then re-recorded with it)
**Revisit trigger:** a second implementation of the verdict (a different language, a different
runtime) is added and must agree with this one.

## Context

REQ-04 and `phases/phase-02-spec.md` require **pinned reference vectors** for
`newcombe-wilson-difference-v1` — "counts in → exact bound values out, reproduced **bit-for-bit**"
— and the kickoff attack panel strengthened it further: the vectors must be **sourced
independently of this lane's own implementation** and committed **before** any Phase 02 code
exists, because a test whose expected values came from the code under test proves only that the
code agrees with itself.

That independent sourcing was done, twice, before any verdict code was written. Two agents, each
blind to the other and to any implementation, derived the same eight cases from the published
method. They disagreed.

## What the two derivations actually found

They agreed bit-for-bit on **2 of 8 cases**. On the rest they differed by 1–24 ULP, because they
chose two *algebraically identical* ways to write the Wilson interval:

| Form | Expression |
|---|---|
| **F-2np** | `centre = (2np + z²) / (2(n + z²))`, `halfw = z·√(z² + 4np(1−p)) / (2(n + z²))` |
| **F-p** | `centre = (p + z²/2n) / (1 + z²/n)`, `halfw = z·√(p(1−p)/n + z²/4n²) / (1 + z²/n)` |

- Case A `LOWER`: `0.0032658850161879326` vs `0.003265885016187943` — **24 ULP apart**.
- Case C (`x=0` in both arms): F-2np returns `l = 0` exactly; **F-p returns
  `l = −2.16e−19`, a negative probability**.
- Case D (`x=n` in both arms): F-p gives `u = 0.9999999999999998` (so `u < p`), F-2np gives
  `u = 1.0000000000000002` (so `u > 1`). **Both violate `0 ≤ l ≤ p ≤ u ≤ 1`, in opposite
  directions.**

One derivation then checked both forms against a 60-digit exact reference. **Neither form
dominates and neither is correctly rounded** — both sit 5–20 ULP from the true value, because
Newcombe's expression has two cancellation stages (`p − l`, `u − p`) feeding a square-and-add.

Two further traps were found, both of which would silently change a verdict:

1. `p₁ − l₁` and `halfw₁` differ by 1 ULP even where they are algebraically equal. An
   implementation that "optimises" the subtraction away computes a different bound.
2. Even within one form, `4·n·p·(1−p)` and `4·x·(n−x)/n` are not bit-equal.

## Options considered

1. **Keep "bit-for-bit" as written and pick whichever form the first implementation happens to
   use.** Cons: the acceptance criterion would be met by construction and would prove nothing —
   precisely the circularity the attack panel added the independence requirement to prevent.
2. **Drop bit-for-bit and assert a tolerance only.** Cons: loses the regression protection that
   makes a refactor of the verdict math visible. A tolerance-only test passes while the formula
   silently drifts within tolerance, forever.
3. **Pin ONE expression tree; assert bit-for-bit against it AND agreement with an independent
   derivation to a stated tolerance.** Chosen.

## Decision

**The canonical tree is F-2np**, written out literally, with these rules frozen:

- `z` is the literal double `1.6448536269514722`; `z²` is computed as `z*z`, never a literal.
- The half-width uses `4·n·p·(1−p)`, not `4·x·(n−x)/n`.
- `p − l` and `u − p` are computed as literal subtractions, never replaced by the half-width.
- `l` and `u` are clamped into `[0,1]` **after** the roots are computed, so no negative
  probability and no `u > 1` ever reaches the difference step.

F-2np is chosen over F-p for one substantive reason, not taste: at `x = 0` it returns `l = 0`
exactly, where F-p returns a negative probability. A method whose lower bound on "nobody
converted" is below zero is a method that will eventually be asked to explain itself.

**Acceptance for REQ-04 is now two assertions, not one:**

| Assertion | Guards against | Strength |
|---|---|---|
| Every case reproduces the committed vector **bit-for-bit** | a refactor silently changing the math | exact |
| Every case agrees with the **independent** derivation within **64 ULP** | the pinned tree being wrong, not merely different | tolerance |

The two cases where the independent derivations agreed bit-for-bit (**B** and **G**) are marked
`strict: true` in the fixture and are the anchors: they are the only values that are known to be
reproducible by an implementation that shares no code with this one.

**`UPPER` is not clamped to `[−1, 1]`.** Cases E and G legitimately exceed 1
(`1.15032709899936`, `2.0325654775800026`); Newcombe's method does not guarantee containment and
truncating it would be changing the method, not tidying it.

## Consequences

**Easier.** A refactor of the verdict math is caught exactly, and a genuinely wrong formula is
caught by the independent cross-check. Both failure modes have a test, and neither test can be
satisfied by the code agreeing with itself.

**Harder.** The expression tree is now part of the contract: reordering two multiplications is a
reviewed change that re-records the vectors, not a cleanup. And a second implementation in
another language cannot be held to bit-for-bit — it gets the 64-ULP band, which is why that band
is written down here rather than discovered later.

**Sharpest consequence, recorded because it will matter at the first real verdict.** At `n = 1`
(case G) the lower bound and the point estimate are equal in exact arithmetic and one ULP apart
in doubles. Any promote rule keyed on `LOWER` against a threshold near the point estimate is
decided by a rounding bit. This is an argument for the per-arm floor being large, and it is why
`effect_floor = 0` (ADR-0310) is a plain-superiority test rather than a knife-edge comparison.

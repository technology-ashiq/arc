# ADR 1313 — FACE-N: honesty classes — real · simulated · rehearsal · drill · exploratory — never mixed

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** constitutional amendment to E3 only. A new honesty class (a sixth)
is added by ADR, with its own visual treatment, never by reusing an existing one.

## Context

E3: real vs simulated/rehearsal/drill is a labelling law. The tree already carries all
five classes (leads rehearsal funnel, `revenue.simulated`, scheduler fire-drill, trader
EXPLORATORY watermark planned). A dashboard is where such labels traditionally die in a
sum.

## Options considered

1. **One visual family for every non-real class, structurally unsummable** — a single
   hatched violet family distinguishes the classes; panel code has no path that sums
   across classes; a fixture spine with real + simulated + rehearsal rows proves no panel
   sums them. Pros: the eye can never confuse non-real with truth. Cons: none.
2. **Per-panel judgment** — cons: the first quarterly chart sums a drill into revenue.

## Decision

Option 1. Every non-real value renders in the hatched violet family with its class named
(SIMULATED / REHEARSAL / DRILL / EXPLORATORY watermarks); real money is green, incidents
red, needs-you amber — those colours are reserved and appear for nothing else. MISSING ≠
0; ABSENT always carries its reason (ADR-1018 precedent); classes are never summed and
never co-rendered in one figure. The honesty-classes fixture is part of the must-have
manifest and is verified by a fresh agent at Phase 06.

## Consequences

Easier: E3 compliance is a fixture, and the sim mode (ADR-1310) inherits the watermark
for free. Harder: some panels show three small honest numbers where one big dishonest
one would look better — that is the product working.

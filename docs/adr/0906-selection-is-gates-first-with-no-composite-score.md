# ADR 0906 — selection is gates-first with no composite score (BEN-A)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** a real mis-ranking incident where gates-first picks a candidate a human
judges plainly worse — one amendment reopens the composite question with that incident as its
evidence.

## Context

Bench must turn per-fixture numbers into a routing recommendation per task class. A weighted
composite (**70/20/10** quality/cost/latency) was proposed and **rejected on the record**
during owner review round 1 (2026-08-02).

## Options considered

1. **Weighted composite score** — one number, easy to rank, and it mixes units (%, ₹, ms) so
   the normalization choice silently dominates the result, while a blend hides WHICH dimension
   moved.
2. **Hard eligibility gates, then an explainable ranking** — more surface, but every verdict
   decomposes into the check that produced it.

## Decision

**Option 2.** Eligibility gates — **ALL must pass**, else the class reads
`NO PROPOSAL` **carrying its reason**:

1. **Completeness** — every selected fixture in the class finished all K attempts with a
   scoreable outcome (schema/assertion pass or fail). **Any** skip, budget-abort, transport
   failure or timeout disqualifies the class.
2. **No schema regression** vs champion.
3. **Assertion pass-rate ≥ champion − 2pp.**
4. **Fixture coverage ≥ MIN_FIXTURES (5) for that task class** (ADR-0908).
5. **Cost source eligible and comparable** where a cost claim is made (ADR-0904, ADR-0908).
6. **Candidate ran the SAME eval-pack revision as champion** (`pack.json.revision`, ADR-0905).

Among eligible candidates: assertion pass-rate within **±2pp** → **lower median cost wins**;
above **+2pp** → **quality wins**; **p95 latency is reported and is a tiebreak only**.

**Verdicts are per task class. There is never one global average across processes.**

`NO PROPOSAL` is a first-class result, not an error, and it always names which gate failed —
"evidence insufficient (2 of 5 fixtures)" and "candidate lost on assertions (−7pp)" are
different sentences and must never render identically.

## Consequences

**Easier:** every recommendation is auditable back to the gate that produced it, and no
normalization choice can quietly decide a routing question.

**Harder:** more `NO PROPOSAL` outcomes than a composite would ever produce — especially this
cycle, where gate 4 fails by construction on two of three classes (ADR-0905). That is the gate
working.

**Rejected because:** the composite mixes units, lets normalization dominate silently, and
hides which dimension moved — ADR-0049's *"a score needs a visible scale"*. Reopening it costs
one amendment plus the incident that justifies it.

**The trap this closes:** `docs/retro-log.md` 2026-07-30 — a pass condition that is only an
absence cannot detect mediocrity. Gate 1 (completeness) is the specific guard against the
selection-bias leak found in owner review round 2: cheap fixtures run first, so a partial run's
cost medians bias low and would make a truncated run look cheapest.

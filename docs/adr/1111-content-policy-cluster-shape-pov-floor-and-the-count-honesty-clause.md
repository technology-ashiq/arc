# ADR 1111 — Content policy: cluster shape, the POV floor, and the count-honesty clause

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** the first cluster ships and the owner judges the pillar/spoke split wrong for
this subject matter — the shape is a starting structure, not a law.

## Context

GRO-I asks for the content rules to be ratified at kickoff rather than argued per article, and for
the "10 articles" number to gain an explicit honesty clause. Constitution **E3** (Tier E,
unamendable) is the binding law here: *"The system never fakes evidence… a failing result is never
dressed as a passing one."*

## Options considered

1. **Ratify the shape, the POV floor and the count-honesty clause now, as one policy.**
2. Decide per cluster. Con: the first tired evening rewrites the standard downward and nothing
   records that it moved.
3. Drop the count target and ship what ships. Con: removes the only forcing function on volume,
   and "ship whatever" is not a plan either.

## Decision

**Option 1.**

- **Cluster shape:** 1 pillar + ≥5 spokes + 2–3 BOFU pages, every row evidence-linked back to a
  real source URL. Internal links follow the approved cluster; the machine never invents a target.
- **POV floor:** every article carries **≥1 original practitioner insight or stance** — something
  arc learned by doing, not something restated from the sources. Human-judged at the review pack
  (ADR-1110 keeps it out of the lints).
- **E3 applied to content, concretely:** no engagement bait · no fabricated numbers, benchmarks,
  case studies or testimonials · **every claim-of-fact carries a source link** · anything simulated
  is labelled simulated. Arc's own results may be cited **only** where a receipt exists for them.
- **Disclaimer footer:** every article states plainly that it is information, not professional
  advice, and names arc as the author entity.
- **Count honesty (ratified):** if the quality gates force rework past appetite, the cycle ships
  **cluster-complete** — the pillar plus ≥5 spokes — and `PROGRESS.md` records the **honest count**.
  The quality floor outranks the number. A cycle that shipped 7 good articles reports 7; it never
  reports 10 by relaxing the floor, and it never reports "10 planned" as though that were an
  outcome.
- **No cold email anywhere in this module.** Outbound lives in `leads` with its own caps and PII
  law. Growth's audience is people who arrived by search.

**Evidence:** `CONSTITUTION.md:26-29` (E3, Tier E) · design source GRO-I, REQ-02, REQ-09,
non-negotiables, no-gos · `docs/adr/0049-*` (a bar that only measures absence cannot detect
mediocrity — the reason the POV floor is a positive requirement judged by a human rather than
another marker list).
**Confidence:** high on the policy; medium on 1-pillar-plus-5-spokes being the right shape for
arc's subject matter, which is Assumption A-05 and is tested by the first real cluster.
**Rejected because:** option 2 lets the standard drift unrecorded; option 3 removes the forcing
function entirely.

## Consequences

Easier: the review pack asks the same questions every time, and a short cycle reports as a short
cycle. Harder: the honest-count clause means this cycle may close with a number that looks like a
miss — which is the point, and `PROGRESS.md` carries the reason next to the number so it reads as
a decision rather than a shortfall.

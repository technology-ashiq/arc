# ADR 1011 — LEG-K: `payment_model` gains a THIRD value, because LexOS is not a merchant

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** one-way
**Revisit trigger:** a fourth posture appears that none of the three values expresses (a genuine
legal branch, not a wording preference) — the enum is then re-shaped by ADR, and every venture on
the affected template set re-approves via `--bump-templates`.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1000). This ADR is a **kickoff-verification amendment to the locked LEG-A/LEG-B decisions** —
recorded separately, rather than edited into them, so the lock stays visible and the change stays
auditable.

LEG-A locks `payment_model: gateway|mor` as a REQUIRED enum and states on the record that *"client #1
class is gateway-domestic"*. The kickoff LexOS audit falsified that.

Read from `E:/Work_Hub/01_Automemory/Lexos` this session:

- **`docs/adr/0003-razorpay-settle-to-each-firm.md`** (LexOS namespace, status accepted, **one-way**,
  2026-07-24) decides that **each law firm holds its own KYC'd Razorpay merchant account**. LexOS is a
  Razorpay OAuth **Technology Partner** calling the Orders API on the firm's behalf and **never holds
  funds** — deliberately, to stay outside RBI Payment-Aggregator licensing (Directions 2025). Options
  1 (pool-then-distribute) and 2 (Razorpay Route / marketplace split) were both considered and
  rejected there.
- **LexOS's own SaaS subscription** (₹2,999 / ₹5,999 per month) is collected **manually/offline** in
  v1 — LexOS `PLAN.md` assumption A7, with in-app subscription checkout a later phase, stub-only
  today.

So for the money a *customer* pays, LexOS is neither the merchant (`gateway`) nor the
merchant-of-record (`mor`) — it is not in the flow at all. And for its own revenue it is not using a
gateway yet. Forcing either existing value into LexOS's facts file would render refund-to-original-
method wording, gateway processing-day language and provider lines that describe money LexOS never
touches. That is pre-mortem row 1 — false money statements — arriving through the schema rather than
through a typo, on the flagship REQ-08 render.

The question panel independently reached the same fork and classed it **one-way**: the enum shape is
bound into every hash-chained facts file and into the enum→clause map, so retrofitting after any
receipt exists forces a template-set version bump across every venture already on it.

## Options considered

1. **Force LexOS into `gateway`** — no schema change, and the flagship render carries clauses about
   a payment flow that does not exist. Disqualifying.
2. **Leave `payment_model` optional for LexOS** — a required enum made optional is a hole every
   future venture can fall through, and the branch-mismatch lint loses its subject.
3. **Add a third value now, before any receipt exists** — cheapest possible moment, and it matches
   LEG-B's own stated principle that an unfit enum is an authoring signal rather than a post-hoc
   patch.

## Decision

**Option 3. `payment_model: gateway | mor | none`.**

`none` means **the operator collects no customer money through a payment provider on this site** —
either because payment happens outside the product (manual invoicing, bank transfer) or because the
operator facilitates payments it is never party to. It selects a clause branch that:

- states plainly how payment is actually collected, with **no gateway processing-day language and no
  refund-to-original-method wording**;
- where the operator facilitates third-party payments, says so and names who the merchant is —
  because "who are you paying" is the first question a disputing customer has;
- keeps the refund/cancellation obligations that attach to the *service* (which exist regardless of
  how money moves) and drops only the ones that attach to a *provider* the operator does not use.

**A `none` render is a lint FAIL if any provider-specific clause survives it** — the same
branch-mismatch fixture LEG-A already requires, extended to the third branch. Both other branches
keep their existing fixtures.

**And the Razorpay activation checklist is scoped correctly for this posture** (REQ-04): where the
operator is not the merchant, the provider's page requirements bind **the merchant**, not the
operator's site. For LexOS the checklist records the activation rows as `not-applicable (operator is
not the merchant; see LexOS ADR-0003)` and arms them for the operator's own account when in-app
subscription billing lands. The pages themselves are still needed — the live obligations here are the
e-commerce entity disclosures, the grievance route, and the processor clause over privileged client
data, none of which depend on a payment provider.

**Evidence:** LexOS repo read directly this session — `docs/adr/0003-razorpay-settle-to-each-firm.md`
(full text), `PLAN.md` (assumption A7, pricing line), `docs/lexos-idea.md` (subscription flow listed
as a later phase), route tree and `app/page.tsx` (no public site, no footer), `prisma/` (per-firm
client/case/document models). Citation form is `LexOS ADR-0003` with its path, never a bare number —
`arc-model-policy` 2026-08-02 recorded four cross-namespace ADR misresolutions in one cycle.
**Confidence:** high — read from the repo, not inferred from the plan.
**Rejected because:** Option 1 — renders false money statements on the flagship venture. Option 2 —
guts the required-enum discipline that makes branch-mismatch detectable.

## Consequences

Easier: the LexOS facts file can be authored truthfully in Phase 3 without reopening a locked schema
mid-render, and `stores_third_party_client_data: true` (confirmed by the same audit) now sits beside
a payment posture that matches it.

Harder: a third branch is a third set of clauses to author, attack and keep answerable — the scenario
set (ADR-1009) must answer "how do I get a refund" under all three. And the design source's frozen
LEG-A text now disagrees with the built schema in one enum value; the disagreement is recorded here
rather than smoothed over, and the owner's approval of this kickoff is what settles it.

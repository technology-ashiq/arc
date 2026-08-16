# ADR 1001 — LEG-A: the page set is the VERIFIED provider superset — seven pages, not six

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** a re-check at any publish finds the provider's documented list changed again —
the set is data, not doctrine, and the checklist source list moves with it.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1200).

`PLAN-legal-pack.md` LEG-A locks the rule *"the page set is the provider-activation **superset**,
not the brief's three"* and instantiates it as **six** pages: Shipping · Contact us · Pricing ·
T&C · Privacy · Cancellation/Refunds. Its assumptions ledger carries the matching row — *"Razorpay's
six-page activation list is current | kickoff re-check shows a changed list → checklist source list
updated"* — with the response pre-decided.

**The kickoff re-check ran today and that trigger fired.** Razorpay's own docs page carries **two
different lists**, and the plan's six is neither of them:

- **Default activation flow — FIVE pages**, verbatim: *"Terms and Conditions, Privacy Policy,
  Shipping Policy, Contact Us, Cancellation and Refunds"* (Handy Tips callout, "Update
  Website/Mobile App" tab). **No Pricing page.**
- **"Additional Website/Mobile App" tab — SIX pages**, verbatim: *"About us, Contact us, Pricing
  details, Terms and conditions, Privacy policy, and Cancellation/Refund policy"* — explicitly
  gated: *"This feature is available only if your services/products fall under the e-commerce
  business category"*, and scoped to secondary sites (one main + five additional).

The plan's six is a **conflation of the two**: it takes Shipping from the first list and Pricing
from the second, and drops About us, which appears in neither of arc's records. Search-engine
summaries return exactly that conflated six-item string, which does not appear verbatim on the page
— the likeliest origin of the 2026-08-03 reading.

Two further verified items, both correcting claims in the locked text:

- **No digital-goods carve-out exists.** An exhaustive search of the page for *"digital good"*,
  *"physical good"*, *"SaaS"* and shipping-conditionality wording returned zero hits. Shipping
  Policy is unconditional in the default list. arc's digital-delivery wording is arc's own honest
  content for a page the provider requires regardless — not an exemption the provider grants.
- **The "card statement descriptor" claim is UNVERIFIED and is dropped.** What Razorpay actually
  documents is that Business Name must match *"the official or legal name present on your business
  registration certificate or on your business PAN"*. The word "descriptor" appears nowhere in
  either doc page. A module whose entire purpose is refusing invented legal claims does not ship
  one in its own founding decision.

## Options considered

1. **Keep six as locked** — preserves the owner's frozen text, at the cost of a page set that
   matches no documented provider list and a requirement (Pricing) presented as activation-mandatory
   when the primary flow does not ask for it.
2. **Ship the default five** — smallest honest set, but abandons LEG-A's own superset rule and
   leaves a venture that later adds a second site or an e-commerce category re-authoring content.
3. **Ship the verified superset: seven** — five default + Pricing details + About us. Applies LEG-A's
   stated rule to today's evidence instead of to a stale reading of it.

## Decision

**Option 3 — seven pages.** LEG-A's *rule* is unchanged and is what carries the weight: take the
provider-activation superset. Only the *instance* moves, which is exactly what the plan's own ledger
row instructed on this trigger.

**The page set:** `terms` · `privacy` · `refund-cancellation` · `shipping-delivery` · `contact` ·
`pricing` · `about`.

**The launch checklist distinguishes provenance per row** (REQ-04): five rows marked
`provider-required (default activation)`, two rows marked `provider-conditional (additional-site /
e-commerce tab) + independently required by the Consumer Protection (E-Commerce) Rules 2020 entity
disclosures`. A checklist that presents a conditional row as mandatory is the same class of invented
claim as a page that does.

**Branching is unchanged and stays REQUIRED:** `payment_model` selects whole clause branches, and a
branch-mismatch is a lint FAIL (fixture-pinned). The enum itself gains a third value — see ADR-1211,
which the LexOS verification forced.

**The no-tax-math law is unchanged:** posture wording only, a CA owns tax.

**Evidence:** https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details/
(raw HTML fetched and re-read three times; both lists extracted from the page's embedded MDX source;
the conditionality sentence and the absence of any digital-goods carve-out confirmed by direct
search rather than inferred) · https://razorpay.com/docs/payments/account-activation-support/
(business-name matching). Neither page exposes a last-modified date, so *when* the list last changed
cannot be established — only what it says today.
**Confidence:** high (primary source, fetched, absence-checks run)
**Rejected because:** Option 1 — ships a set matching no documented list and mislabels Pricing as
activation-mandatory. Option 2 — abandons the superset rule LEG-A exists to state.

## Consequences

Easier: the page set now traces to a fetched primary source per page, so REQ-02's evidence line for
the checklist is a real link rather than a remembered one; and a venture adding a second site or an
e-commerce category needs no new content.

Harder: two more templates to author (both thin — `about` and `pricing` interpolate operator
identity and one all-inclusive INR figure, and carry no branch logic), and the goal sentence,
north-star and every "six" in the tracker move to seven. The design source's frozen text now
disagrees with the built set in one number; the disagreement is recorded here rather than smoothed
over, and the owner's approval of this kickoff is what settles it.

What we would revisit if this goes wrong: if a real activation review rejects a venture for a page
this set does not contain, the set is wrong and the revisit trigger above fires immediately — the
provider's reviewer is the ground truth, not the docs page.

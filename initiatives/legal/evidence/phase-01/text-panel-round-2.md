# Text attack panel, round 2 — the four pages Phase 00's panel never saw

Phase 00's panel read `terms`, `privacy` and `refund-cancellation`. Phase 01's exit criteria
require the panel to run on the RENDERED bytes of the four pages it added — `about`, `contact`,
`pricing`, `shipping-delivery` — because `pricing` states a binding all-inclusive figure and
`shipping-delivery` carries the one digital-delivery clause, which is the class the panel exists
to stress.

Three fresh stances, none of which saw the others' findings, run over two rendered ventures:

- **A** = `fixture-gateway-gst` — GST-registered, card payments through a gateway
- **B** = `fixture-none-nogst` — no online payments at all, not GST-registered

| stance | findings | verdict |
|---|---|---|
| hostile customer | 7 CRITICAL · 9 MAJOR · 4 MINOR | UNSOUND |
| competitor's lawyer | 10 CRITICAL · 13 MAJOR · 7 MINOR | UNSOUND |
| regulator | 3 CRITICAL · 10 MAJOR · 5 MINOR | UNSOUND |

**68 findings. All three stances returned UNSOUND.**

## The one that fires the kill-criteria path (ADR-1007)

The regulator found a **statement of law that is wrong, in the DPDP clause**, which ADR-1007
names explicitly as the trigger:

> `privacy.mdx`, both ventures: "The DPDP Act **gives you** the option of receiving it in any
> language listed in the Eighth Schedule to the Constitution."

Present indicative. It tells a data principal a statutory option exists **today**. Section 5(3)
commences 13 May 2027. The same page, eight sections earlier, says *"Those provisions have not yet
commenced"* and *"we are not telling you that a legal duty applies to us today when it does not"*.

**So the page denies and asserts the same duty, and the sentence that asserts it is the one the
lane's own non-negotiable was written to prevent.** ADR-1006 is not merely drifted here; a single
sentence escaped it. The regulator was explicit that the surrounding discipline is otherwise a
model of the required disclosure — which is exactly why this survived four earlier reads: it sits
inside the clause everyone had already checked and approved.

This does not need a lint to catch it in future. It needs the one it already has pointed at the
right thing: nothing in this lane compares two clauses on the SAME page for contradiction.

## Also critical, and a genuine schema gap

**The published GSTIN cannot exist.** `33AABCN1234M1Z5` — state code and PAN structure are
well-formed, but the statutory Mod-36 check character computes to `O`, not `5`. The regulator
validated its routine against the canonical reference GSTIN `27AAPFU0939F1ZV` before reporting.

These are invented fixture values, so nothing real is published. The finding that matters is not
the number, it is that **`gstin` is a FORMAT-tier field with no checksum validation**, so a real
venture can put an unverifiable GSTIN on a published pricing page and every gate in this lane will
pass it. A registered recipient relying on it fails GSTR-2A/2B reconciliation and loses input tax
credit. That is a schema fix, and it is the kind a fixture set cannot surface on its own.

## What makes this credible: they converged without seeing each other

Eight findings were raised **independently by both stances that have reported**. Convergence is
the signal worth weighting — a single reader's severity call is taste, two blind readers landing
on the same sentence is a defect.

| # | Finding | Pages | Why it is real |
|---|---|---|---|
| 1 | **Three different price-rise notice periods.** `pricing` says "we tell you before your next payment, and the change applies from the payment after that"; `terms` says "at least 30 days before your next renewal … you may cancel at the old price"; A's refund page adds "at least 7 days before we take the payment". | pricing · terms · refund | These are not three phrasings of one rule, they are three rules, and they resolve to different money. Notice given 5 days out satisfies `pricing` and breaches `terms`. |
| 2 | **`shipping-delivery` grants a refund entitlement the refunds page refuses.** "you are **entitled** to a refund under the Cancellation and Refunds page" — that page grants exactly one right, within 14 days, and expressly forecloses "the unused part of a period you chose to leave early". | shipping-delivery · refund | A geo-blocked customer on day 40 has an entitlement on one page and none on the page cited as its authority. |
| 3 | **Venture B's pricing page describes a checkout that does not exist.** "no per-seat surcharge added at checkout" and "we do not store your full card number" — while B's own terms say "this site will never ask you for card details". | pricing (B) | Gateway wording surviving into the `payment_model: none` branch. It also destroys the anti-phishing value of the terms sentence. |
| 4 | **B promises access "within 1 hour of a successful payment … you do not have to wait for anyone to approve anything by hand"** — on a venture whose only payment route is a bank transfer a human must reconcile. | shipping-delivery (B) | "A successful payment" has no observable moment without a gateway, and the human step the page denies is the only mechanism B has. |
| 5 | **The grievance officer is the proprietor.** B's contact page offers escalation to Priya Nair; the same page says Priya Nair trades as Redkite. The refund page then holds that route out as the *substitute* for chargeback arbitration. | contact · refund (B) | The compensating control is the counterparty. The genuinely independent routes exist but are buried on `privacy`, which a billing complainant never opens. |
| 6 | **`hour(s)` / `day(s)` / `working day(s)` placeholders in published bytes.** | shipping · refund (both) | Documentary proof the pages were generated and published without a human reading them — which is itself the rebuttal to `about`'s "it will be something we can show you evidence for". |
| 7 | **"There is no geographic restriction on access from our side"** stated as present fact. | shipping-delivery | Sanctions screening, the host's regions and (for A) the payment provider's acceptance rules are all "our side" and none are controlled. |
| 8 | **"We reply within 48 hours"**, four times, with no clock definition, no working-hours carve-out, and no consequence. | contact · pricing · shipping · refund | Every other commitment on the site is denominated in working days. An unenforced deadline with no remedy is a marketing claim, and for B it is one person promising 48 clock hours, 365 days a year. |

Findings 3, 4 and 5 were raised by **all three** stances independently.

Two more that two stances found, both statutory:

- **`about` denies intermediary status on a page that describes intermediary conduct.** "We are
  not an intermediary between you and someone else" sits two paragraphs above "This service holds
  records about the people you serve … we act only on your instructions." The second sentence is
  the s.2(1)(w) definition. The denial steers a consumer away from the IT Rules 2021 grievance
  route, whose acknowledgement window is tighter than the 48 hours these pages advertise as "the
  tightest of the windows we have checked". *(regulator · competitor's lawyer)*
- **The grievance officer's DESIGNATION is nowhere on any of the fourteen pages.** Rule 4(5)
  CP(E-Commerce) enumerates name, contact details **and** designation; two of three are supplied.
  *(regulator)*

And one that is simply a bug, found by reading: `privacy` says the erasure route is named in
*"Deleting your data* **below**", and that heading renders **above** the pointer.

## The two that only one stance found, and are worth as much

- **The About page sells the operator as a pure processor while the Privacy page says it decides.**
  `about` says "we act only on your instructions in respect of them"; `privacy` opens "we decide
  what personal data this service collects and why" and its itemised list includes the uploaded
  client records. A buyer in a regulated profession relies on the first when deciding whether it
  may lawfully put clients' data here. *(competitor's lawyer)*
- **Claims about what named third parties are contractually bound to do.** "Our contracts with the
  providers listed further down forbid them doing it either — that is a contractual commitment we
  can show you." AWS, Postmark and Razorpay are onboarded on non-negotiable standard terms at this
  scale, and a payment aggregator processes KYC and AML data as a controller in its own right, not
  "only to provide their part of the service". *(competitor's lawyer)*

## Repair status

Recorded before any repair, then updated. The list above is unedited — a finding is never
rewritten to match what was done to it.

### Closed

| Finding | How |
|---|---|
| DPDP present tense (kill-criteria) | Rewritten to name s.5(3), say it has not commenced, and state the offer is voluntary and ahead of the duty. Grepped the pattern across all seven templates: every other DPDP reference was already future-tense. |
| Price-rise: three rules | One rule, one fact (`commitments.price_notice_days`), stated on both pages — and now enforced by the `consistency` lint (ADR-1013) rather than by care. |
| Shipping grants a refund the refunds page refuses | `REFUND.DELIVERY_FAILURE` added, saying a delivery failure is not a change of mind and the window does not limit it. Shipping points at that clause instead of at a window that excludes it. |
| Venture B told about card storage on a site taking no cards | `PRICING.WHAT_YOU_PAY_WITH` split three ways on `payment_model`. The `none` branch states the real route, that nothing auto-charges, and that a card will never be asked for. |
| B's "1 hour, no human approval" delivery | New `derived.payment_is_automatic`; `DELIVERY.WHEN.OFFLINE` says access opens within one working day of the money landing, and why we cannot see it sooner. |
| "No geographic restriction from our side" | We do not impose them; host, payment provider and sanctions law can, and we do not control those. |
| `hour(s)` / `day(s)` in published bytes | `pluralise-counted-nouns`, a declared transform with its destruction documented. |
| "Deleting your data below" pointing up | One word. |

### Open, and named rather than quietly dropped

- **`about` vs `privacy` on who decides.** The processor-role framing on `about` and "we decide
  what personal data this service collects and why" on `privacy` are both defensible in isolation
  and read as a contradiction together. The honest repair splits the statement — instruction-only
  for uploaded client records, controller for account and billing data — and it is prose work on
  a clause that carries real legal weight, not a wording tweak.
- **Claims about what AWS, Postmark and Razorpay are contractually bound to do.** "Our contracts
  forbid them doing it either — that is a commitment we can show you" asserts a bespoke,
  producible instrument. At this scale these are non-negotiable standard terms, and a payment
  aggregator processes KYC and AML data as a controller in its own right.
- **`gstin` has no checksum.** FORMAT-tier with no Mod-36 validation, so an unverifiable GSTIN
  passes every gate here. The fixture's own number fails the check.
- **Grievance officer designation** is absent on all fourteen pages; rule 4(5) enumerates three
  items and two are supplied. Needs a new facts field.
- **The grievance officer being the proprietor** is disclosed nowhere, and the refunds page holds
  that route out as the substitute for chargeback arbitration.
- **"We reply within 48 hours"** carries no clock definition and no consequence.
- **`about` denies intermediary status** while describing intermediary conduct.
- **No CIN** for a private limited company.

The eight in the closed table are the ones where a page stated something FALSE or contradicted
another page. The open list is real and none of it is cosmetic, but every item is a page being
less complete or more absolute than it should be — not a page asserting an untruth.

## Why the cross-page class needed its own lint

The shape of the fix is already visible and it is not "reword eight sentences":

- Findings 1, 2 and the About/Privacy contradiction are **cross-page contradictions**, which no
  current lint can see. Every lint in this lane reads ONE page's rendered bytes. A cross-page
  consistency class is missing, and three of the four most severe findings live in exactly that
  blind spot. That is a Phase 02 lint, and this panel is the evidence for it.
- Findings 3, 4 and 5 are the **`payment_model: none` branch** carrying wording written for a
  gateway. The branch renders, traces and passes completeness — it is the prose that is wrong for
  the branch, which is the failure mode ADR-1009's answerability class was written for and which
  36 scenarios did not catch, because a scenario asks whether a question has AN answer, not
  whether the answer is TRUE for this venture.
- Finding 6 is a one-line renderer fix (pluralise at render time).
- Findings 7, 8 and the third-party-contract claims are **unfalsifiable or uncontrollable
  absolutes** — the same class the Phase 00 panel found, in the four files its stances never read.
  That is the twin-fix pattern again, now on prose rather than code.

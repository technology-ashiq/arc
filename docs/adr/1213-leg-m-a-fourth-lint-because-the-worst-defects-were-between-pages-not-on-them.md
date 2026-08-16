# ADR 1013 — LEG-M: a fourth lint, because the worst defects were BETWEEN pages, not on them

**Status:** accepted
**Date:** 2026-08-13
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** the claim list stops being maintained — a commitment added to two pages
without a `cross-page-claims.json` row means the list has become documentation rather than a
gate, and the mechanism should be replaced by one that derives claims instead of declaring them.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1200), on evidence produced after the v1.1 freeze, so it is a new decision rather than one of
the locked LEG-A..L set.

ADR-1202 and ADR-1209 give this lane three lints — value, trace, completeness. **All three read
one page's rendered bytes.** That was a deliberate simplification and it held until the pages
were read by people.

Phase 01's text panel ran three stances over the RENDERED bytes of two ventures, blind to each
other. They returned 68 findings, and **three of the four most severe were contradictions between
two pages**, each raised independently by more than one stance:

- `pricing`, `terms` and `refund-cancellation` stated **three different price-rise notice rules**.
  Pricing: "we tell you before your next payment, and the change applies from the payment after
  that." Terms: "at least 30 days before your next renewal, and you may cancel at the old price."
  Those resolve to different money, and notice given five days out satisfies one and breaches the
  other.
- `shipping-delivery` told the reader they were **"entitled to a refund under the Cancellation and
  Refunds page"** — a page granting exactly one right, within 14 days, which expressly refuses
  "the unused part of a period you chose to leave early."
- `about` described the operator as acting **"only on your instructions"** while `privacy` opened
  "we decide what personal data this service collects and why."

Every one of these pages passed all three lints. They were individually well-formed, fully traced,
and missing no mandatory clause. The defect was never on a page; it was in the space between two.

The sharpest detail is that the price-rise case was **not a numeric mismatch**. The pricing page
carried no number at all, so there was nothing to disagree with — and the page with no number was
the one a buyer reads before paying. A checker comparing numbers across pages would have found
nothing.

## Options considered

1. **Author the sentence once and include it on both pages.** Correct in principle; needs an
   include/fragment construct, and the executor contract pins the template language at two
   constructs with no expression language. Rejected for this cycle, not on merit.
2. **Detect prose contradiction.** Not a thing that exists mechanically. Rejected.
3. **Declare the claims that must be consistent, and check the NUMBER appears on every page that
   makes them.** Narrow, mechanical, and aimed exactly at the failure observed.

## Decision

**Option 3.** A fourth lint group, `consistency`, run **once over all rendered pages** rather than
per page, reading `products/legal/data/cross-page-claims.json`.

A claim names a facts field and the pages that must state it. The rule is not that the pages use
the same words — it is that **wherever a listed page makes the commitment, the rendered value of
that field appears on it**. A page that makes the commitment vaguely fails, which is the case that
actually bit.

- It joins the other three **in TRIAL**, WARN-first. Promotion is `/arc-retro`'s act against
  `docs/trial-ledger.md`, not this cycle's convenience.
- Its guard uses the same three-answer `conditionVerdict`: a malformed guard is a FAILURE, never
  a skip. That rule has now been re-applied on its fourth path in this lane, because a fix is not
  applied until it has been attacked somewhere it was never made.
- A claim anchored to a facts field the venture does not set is a FAILURE, not a skip — a
  cross-page check with nothing to compare passes every page and proves nothing.

**The negative control is the argument.** `legal-probe.mjs mutate cross-page-drift` restores the
vague pricing wording. The mutant page scores **value 0, trace 0, completeness 0, consistency 1**:
every pre-existing lint stays green and only the new one fires. Had that mutant scored 0 across
the board, this ADR would not exist.

**Confidence:** high on the failure, medium on the mechanism. The claim list is declared, so it
can rot — hence the revisit trigger. Option 1 remains the better long-term answer and is a
candidate for the template-language work in a later cycle.

**Rejected because:** Option 2 is not achievable. Option 1 needs a language change this cycle's
appetite does not hold, and shipping nothing while waiting for it would leave the three worst
findings the panel produced with no gate at all.

## Consequences

- `GROUPS` and `TRIAL` in `lints.mjs` grow from three entries to four. Anything that assumed
  three lints — a test, a doc, a count — is now wrong and must be re-derived rather than patched.
- The `_run.json` sidecar can now carry findings whose `page` is `-`, because a cross-page finding
  belongs to no single page. Consumers reading `findings[].page` must tolerate that.
- Five claims are declared at birth. That is a floor, not a survey: the panel found contradictions
  in prose that carries no number at all (`about` vs `privacy` on who decides), and this lint
  cannot see those. **That gap is real and is not closed by this ADR** — it is recorded here so
  the next reader does not mistake a green `consistency` group for cross-page correctness.

# ADR 1007 — LEG-G: lawyer review is a triple tripwire, and its advocate arm is armed early

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** any arm fires and the review is deferred anyway — a tripwire that fires and is
ignored is a date, not a control, and the mechanism is then re-designed rather than re-promised.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1200). Locked at the v1.1 freeze as LEG-G.

This module is not a lawyer and never pretends to be. The open question was only *when* a real
lawyer must read the text, and the plan answered it with three tripwires rather than a date.

**The kickoff LexOS audit moved one arm closer.** It is now confirmed, not hypothesised, that LexOS
stores third parties' privileged attorney-client matter (per-firm clients, cases, documents under
`prisma/`, behind a firm-scoped RLS boundary), and that LexOS's customers ARE advocates. The design
source wrote the third arm as *"a design-partner advocate review when the first lawyer-customer
relationship exists (near-free; the customer base is literally advocates)"* — that relationship is
one design-partner conversation away, and it is the cheapest arm by a wide margin.

The question panel asked whether confirmed privileged-data handling should force a real-lawyer
read-through into Phase 3's Definition of Done, before the owner's L1 approval. Its recommended
default was no.

## Options considered

1. **Add a mandatory lawyer read-through to Phase 3's DoD** — highest assurance on the page most
   likely to be tested, and it breaks the 5-day appetite and makes the cycle's close depend on a
   third party's calendar.
2. **Hold the triple tripwire as designed** — the owner's L1 approval remains sufficient for v1, and
   the escalation path already exists in the plan's own kill criteria.

## Decision

**Option 2, with the third arm explicitly armed.** The three arms, whichever fires first:

1. **₹25k MRR** — read from the ledger lane's views once they ship; until then the calendar arm and
   the owner's own calendar carry it.
2. **Calendar ~Q1-2027** — sized to land before the DPDP substantive provisions commence
   13/14-May-2027 (ADR-1206). This arm is now confirmed correct rather than assumed.
3. **A design-partner advocate review** at the first lawyer-customer relationship — **armed early**
   by the LexOS finding above and pursued as soon as a design-partner firm exists.

**Firing an arm produces a needs-you item, not a silent date.**

**The escalation path stays where the plan put it:** if Phase 0's mandatory text attack panel finds
the processor or DPDP clause unsound, the kill criteria fire — ship the core pages' content, bank the
engine, and the lawyer trigger escalates from tripwire to immediate. That is a gate the cycle
already contains, and it is a better instrument than a calendar promise because it is driven by
evidence about the actual text.

**Confidence:** high
**Rejected because:** Option 1 — makes a 5-day cycle's close depend on a third party's calendar, for
assurance the attack panel plus a permanent human gate already substantially provide.

## Consequences

Easier: the cycle can close on its own appetite, and the review happens when something real makes it
necessary.

Harder: v1's legal text ships with no lawyer having read it, on pages that describe the handling of
privileged material. That is stated plainly on the record rather than left to be inferred, and it is
the single strongest argument for the no-unearned-badges rule: nothing rendered may carry a
"reviewed by counsel" implication until an arm fires and it is true.

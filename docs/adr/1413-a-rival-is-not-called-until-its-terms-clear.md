# ADR 1413 — A rival is not called until its terms clear, and that check gates the spike

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** one-way
**Revisit trigger:** none for the rule. The provider-specific verdicts revisit whenever a
provider's terms change or written permission is obtained.

## Context

[ADR-1409](1409-dsv-j-rivals-are-evidence-and-arrive-by-spike-then-integrate.md) makes rival
drafts evidence, and the retro metric pack records a **rival-beats-all-arc rate**. That is, in
plain terms, a published-internally benchmark of a third party's service against ours.

Verification on 2026-08-23 found this is not merely a technical question. Vercel's API Terms
state, verbatim: *"[You shall not] use the API or any API Data to conduct performance testing
of the Services without Vercel's express written permission."* Its Acceptable Use Policy
separately prohibits using the service to *"Build substantially similar functionality,
competing products, or training competing AI models."* Google's generative-AI terms carry a
looser analogue about developing a similar or competing product.

Whether an **internal, unpublished** comparison falls inside those clauses is a legal judgment,
not something more searching resolves. What is not a judgment call is the sequencing: the check
belongs **before** the first live call, because a call cannot be un-made.

## Options considered

1. **Call the API and decide later** — pros: unblocks the spike immediately / cons: the
   irreversible act happens before the question is answered, which is the wrong order for a
   one-way door.
2. **Terms clearance is a spike entry gate** — pros: the reversible check runs first / cons:
   the spike can be blocked on an owner decision.

## Decision

Option 2. Phase 06's spike **may not make its first live call** to a rival provider until that
provider's terms position is recorded — either as an owner ruling accepting the read, or as
written permission obtained, or as a decision to use that provider under terms that plainly
permit it.

The clearance is recorded per provider on the spine as a `decision.recorded`, so the fact that
someone decided is a receipt rather than a memory.

**Evidence:** vercel.com/legal/api-terms and vercel.com/legal/acceptable-use-policy;
policies.google.com/terms/generative-ai/use-policy — all read 2026-08-23. v0's output ownership
is favourable and separate: *"Vercel assigns to you Vercel's rights, if any, in the Output."*
**Confidence:** high that the clauses exist as quoted; **low** on whether this specific internal
use falls inside them — which is exactly why the decision routes to a human rather than being
resolved here.

## Consequences

Easier: the lane cannot stumble into a terms breach through ordinary phase execution. Harder:
this may reverse the design source's recommended rival order. The source recommended **v0
first**; on this evidence v0 carries the sharpest clause *and* a credit cost, while **Stitch is
free and its analogous clause is generic** — so the evidence now points at Stitch first. That
ordering is the owner's reserved call (design source §13 item 4, due by Phase 05) and is left
to him with this evidence attached, not decided here.

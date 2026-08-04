# ADR 0413 — leads Phases 0–2 are built ahead of the pre-kickoff gate; Phase 3 stays BLOCKED

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** two-way
<!-- the code is fixture-proven and idle; nothing has been sent -->
**Revisit trigger:** the pre-kickoff gate is evidenced and the first real campaign runs — at
which point every fixture written here is tested against a reality it only guessed at. Any
fixture the real provider or the real ICP contradicts is a defect in this cycle, not in that one.

## Context

`PLAN-leads` opens with: *"NOT fired as of 2026-08-03 … This plan sleeps. Do not start
before the trigger fires"* (Constitution A8), and its cascade rule says a kickoff with an
undefined offer or an unwarmed domain means the trigger was mis-read.

At this kickoff **none of the six pre-kickoff gate rows is evidenced**. The kickoff prompt
was pasted with its template placeholders intact (`<offer>`, `<domain>`, `<leads adopts
EVO-H0 | stays with growth>`), and a repository search found no offer one-pager, no ICP v0
file, no capability report, no warm-up log and no DNS evidence. Row 1 (a named offer) is
itself blocked on LexOS billing, which targets Sep '26.

**The owner was shown this and directed the build to proceed anyway**, with all phases
completed and merged as one PR at the end. This ADR records that decision and, more
importantly, records exactly what it can and cannot buy.

## Options considered

1. **STOP entirely** — pros: strict compliance with the cascade rule. cons: 5 days of
   genuinely offline-buildable engineering sits idle for weeks waiting on a domain to warm,
   for no safety gain — the safety property is about *sending*, not about *building*.
2. **Build everything including Phase 3** — cons: impossible and dishonest. There is no
   domain to send from, no offer to sell, and no real leads. "Completing" Phase 3 would mean
   fabricating a campaign.
3. **Build Phases 0–2 in full; wire Phase 3's entry gate; leave Phase 3 BLOCKED.**

## Decision

**Option 3.**

**What this is licensed by:** `PLAN-leads` itself states the phases are offline-first —
*"provider behind an interface with a fake (offline-first — Phases 0–2 fully buildable with
zero real emails)"*. The cascade rule protects against **sending** ahead of the domain, not
against **building** ahead of it. Phases 0–2 contain no send path that a fake does not serve.

**The precedent is exact:** `ADR-0300` did this for evolve — built ahead of its trigger,
fixture-proven, unexercised, with the risk ledgered rather than glossed. This lane inherits
that shape deliberately.

**Phase 3 is BLOCKED, not deferred and not cut.** It is blocked on four things no code can
produce:

| Gate row | Why code cannot supply it |
|---|---|
| A named offer | A business decision; blocked on LexOS billing (Sep '26) |
| Dedicated domain, warmed ≥14d, DMARC green | 2–4 calendar weeks of physics |
| ICP v0 | Owner-written business judgment |
| Capability report → provider + verifier pick | `/arc-capability` run, then `ADR-0402`'s hard filter |

The Phase-3 **entry gate** *is* built (live DNS resolution, provider auth status through the
interface, dated seed-inbox evidence ≤7 days) — so that when the gate rows are eventually
evidenced, the gate itself is already code and refuses on failure regardless of what any
evidence file claims.

**Confidence:** high that Phases 0–2 are correctly buildable offline. **Low** that the
fixtures match the real provider's behaviour, because no real provider has been chosen — that
is exactly the risk below, and it is ledgered.

**Rejected because:** Option 1 — trades weeks of buildable work for no safety gain, since
nothing here can send. Option 2 — would require fabricating a campaign.

## Consequences

**Easier:** when the offer and the domain arrive, the engine is already written and
fixture-proven. The remaining work is a provider implementation behind an existing interface
plus the campaign itself.

**Harder — and this is the real cost:** every fixture in this cycle encodes a *guess* at the
real provider's semantics — idempotency-key behaviour, ack timing, bounce and complaint
webhook shapes, suppression API semantics. **If the eventual provider deviates, those
fixtures are wrong in a way no test in this lane can detect**, because the only oracle is the
fake, and the fake was written from the same guess. This is the identical risk `ADR-0300`
ledgers for evolve, and it is why `ADR-0402` binds the vendor at Phase-3 entry rather than
pretending to know it now.

**What must NOT be claimed:** this cycle does not make outbound "ready". It makes the engine
fixture-proven and unexercised. `PROGRESS.md` records Phase 3 as BLOCKED with its four gate
rows visible, so no future reader mistakes a green CI run for a working outbound channel.

**Clock:** `ADR-0408`'s 4-week evolve window does **not** start at this merge. It starts at
the first real send.

# ADR 0402 — Cold outbound sends from a dedicated domain, behind a provider interface

**Status:** accepted (policy frozen; the concrete vendor instance binds at Phase-3 entry)
**Date:** 2026-08-04
**Product:** `company` — shared decision, inherited by `growth` when that lane is born
**Reversibility:** one-way
<!-- domain reputation cannot be un-burned -->
**Revisit trigger:** the chosen provider drops idempotency-key support or suppression API,
or the dedicated domain's reputation degrades such that a second domain is needed.

## Context

Both the leads brief and the growth brief mandate deciding sending identity **once**. This
is that ADR. Two questions: which domain sends cold mail, and what must the provider do.

LexOS already uses Resend for *transactional* mail on its product domain. That setup is not
touched here.

Spam filters aggregate reputation to the **organizational** domain, so a burned subdomain
burns its parent. That single fact drives the domain half of this decision.

## Options considered

1. **Send cold mail from the product/root domain** — pros: nothing to buy or warm. cons: one
   spam-complaint run destroys the domain that carries password resets and receipts. Fatal.
2. **Send from a subdomain of the product domain** (`mail.<product>`) — pros: feels isolated;
   cheap. cons: it is *not* isolated — reputation aggregates to the organizational domain.
3. **Dedicated sibling domain, warmed, behind an interface** — pros: blast radius is one
   disposable asset. cons: costs a domain and 2–4 calendar weeks of warm-up before send #1.

## Decision

**Option 3.**

**Domain policy (frozen now):**
- Cold outbound sends **only** from a dedicated domain purchased for the purpose.
- **Never** the product or root domain, **and never a subdomain of it.**
- SPF + DKIM + DMARC published and verified green; warm-up log ≥14 days of *genuine*
  engagement. **No fake-engagement / bot warm-up networks** — dishonest signals, and a
  provider-ToS risk. The warm-up method is verified in the capability report.
- `List-Unsubscribe` on every send template.
- LexOS's Resend transactional setup is untouched.

**Provider requirements (frozen now — these are the selection filter):**
- API send with custom domain
- suppression API
- **idempotency-key support OR message-id lookup — a HARD filter.** `ADR-0403`'s
  duplicate-send guard and `ADR-0411`'s reconciliation both depend on it. A provider with
  neither is disqualified regardless of any other merit.
- inbound route — *nice to have only*; `ADR-0405` has a working fallback.

**Vendor instance:** deliberately NOT named here. It is selected from the pre-kickoff
capability report and binds at **Phase-3 entry**, because `ADR-0405`'s interface + fake means
Phases 0–2 build and prove out with zero real provider. Naming a vendor now would be
recording a decision nobody made.

**Confidence:** medium — the domain policy is high-confidence and structural; the claim that
*some* provider meets the idempotency hard filter is untested until the capability report
runs. Tracked as an assumptions-ledger row citing this ADR.

**Rejected because:** Option 1 — burns the transactional domain. Option 2 — subdomain
isolation is a myth; reputation aggregates to the parent.

## Consequences

**Easier:** the blast radius of a bad campaign is one disposable domain. Swapping providers
is an interface implementation, not a rewrite.

**Harder:** send #1 is gated on 2–4 calendar weeks that no amount of engineering shortens.
This is why warm-up sits in the pre-kickoff gate and not in the appetite.

**Binds:** the provider interface in Phase 0 must expose exactly the four requirements above,
so that a vendor failing the hard filter is caught at interface-implementation time rather
than at send time.

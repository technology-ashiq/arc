# ADR 0418 — the email verifier is MX + syntax, not a vendor

**Status:** accepted
**Date:** 2026-08-10
**Product:** `leads`
**Reversibility:** reversible (one function behind an existing interface; a vendor impl replaces it and nothing else moves)
**Revisit trigger:** Phase 05's real campaign, where bounce rate against a domain that costs 2–4 calendar weeks to warm is a business number rather than a mechanical one — or a measured bounce on the rehearsal that MX would have caught.

## Context

PLAN's External-dependencies table gives the email verifier's real impl as *"vetted verifier or
MX+syntax, from the capability report"*, and ADR-0402/0409 route the choice to
`/arc-capability`. In code it was a refusal, and on 2026-08-10 that refusal turned out to be one
of the two things blocking Phase 03's five journeys (ADR-0417 is the other): a corpus with no
verifier still dies on the first address, because `cmdResearch` verifies every candidate before
linting so that HELD is decided by the verifier rather than by whichever branch ran first.

The question the capability report would answer is "which vendor". The question actually in
front of Phase 03 is narrower: **what does verification have to be worth for five addresses the
owner already controls or knows?** A paid verifier's value is catching addresses that look fine
and do not exist. For a rehearsal recipient list the owner assembled by hand, that population is
empty by construction.

Against that, a vendor costs a `/arc-capability` session, a dependency, and — the part that
matters — **sending real people's addresses to a third party**, which is a PII export decision
that ADR-0410 would have to be reopened for. Paying that price to check addresses the owner can
verify by looking at them is the wrong trade at this phase.

## Decision

**Bind the verifier to syntax + a live MX lookup on the address's domain.** No vendor, no
account, no address leaves the machine.

Three states, and the middle one carries the weight:

| Result | When | What it means downstream |
|---|---|---|
| `invalid` | fails `isAddressShaped` | REJECTED by the lint |
| `unverifiable` | MX lookup throws, or returns empty | **HELD** — a dossier that exists and can never be sent to (ADR-0409) |
| `verified` | at least one MX record | eligible to be drafted and sent |

**A domain with no MX is `unverifiable`, never `invalid`.** Mail can be accepted on an A record,
so "no MX" is honestly "nobody confirmed this" rather than "this is wrong" — and for cold
outbound the conservative reading is the correct one, since the cost of a wrong `verified` is a
bounce against a domain that took weeks to warm.

**The syntax check reuses `isAddressShaped`**, the same predicate the store mints `lead_id` with.
A second address grammar here would be defect class D5: an address this accepts and the store
rejects is a lead that verifies and can never be given an id.

## The seam, and why it exists

`verifyAddress(email, resolveMx)` takes its resolver as a parameter; `verifyReal.verify` is one
line binding it to `dns()`. That is not tidiness — it is the only way the `verified` branch is
provable. `verifier()` returns the **fake** whenever `ARC_LEADS_FAKE=1`, so the real function is
never reached on CI (which fakes DNS) and needs live network anywhere else. Without the seam the
`verified` branch is unprovable in both places at once, and an unprovable branch is one nobody
notices deleting.

Measured rather than assumed: the box this was written on answers every DNS query with
`ECONNREFUSED`, so the first version returned `unverifiable` for `gmail.com`. That is what
sent the resolver behind a parameter.

## Consequences

**Good.** Zero cost, zero vendor, zero PII export. It catches the two failure modes that
actually occur in a hand-written corpus — a typo'd address and a domain that does not exist —
which is most of what a verifier is for at this size. All four states are proven offline.

**Bad, and accepted.** MX proves the *domain* accepts mail, never that the *mailbox* exists. A
correct-looking address at a real company will read `verified` and can still hard-bounce. At
five known recipients that risk is nil; at Phase 05's twenty-five strangers it is the whole
question, which is why the revisit trigger is written the way it is.

**Not decided here.** Whether Phase 05 buys a verifier. This ADR deliberately does not
pre-empt that; it says the rehearsal does not need one.

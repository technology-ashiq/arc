# ADR 1766 — A real venture answers `domain` with an owner-attested, read-only Cloudflare zone check

**Status:** accepted
**Date:** 2026-10-19
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a real venture arrives whose domain is not yet bought. A purchase path (`cloudflare-registrar`, the
candidate row) is then vetted, behind gate 1 and its own approval.

## Context

`domain` is a core slot behind gate 1. Its only row, `cloudflare-registrar`, is a `candidate` and has no adapter file.
A rehearsal answers the slot as a named ABSENT (ADR-1764). A real venture with no vetted row is REFUSED in
`runner.mjs` before any gate runs, so on `myfitfolio` the chain `domain → dns → tls → email-transactional → auth → authz →
tenancy → plans → checkout-portal → webhooks-ledger → refunds` cannot start. The owner bought `myfitfolio.com` and added it
to Cloudflare himself.

## Options

1. **A new read-only row, `cloudflare-zone`.** `verify` reads `GET /client/v4/zones?name={brand.domain}` and passes only
   when one zone answers with `status: active` and `name_servers` that public DNS (DoH, two resolvers) also returns for
   the apex. `scaffold` creates nothing. Crossing gate 1 needs the owner's approval, which records his attestation that he
   owns the domain.
2. **Vet `cloudflare-registrar` now.** This needs a payment-capable adapter and a purchase. myfitfolio does not need a
   purchase.
3. **Both.**

## Decision

Option 1. The adapter lives at `providers/domain/cloudflare-zone.mjs`, and its `hosts[]` is `api.cloudflare.com`,
`dns.google` and `cloudflare-dns.com`. It holds no write call: the zero-dep scan plus a fixture assert that no method
other than `GET` reaches `ctx.fetch`. Gate 1 stays where it is. The `approval.requested` payload names the zone id and
the nameservers the probe observed, so the owner's stamp attests to exactly what was seen.

**Amended 2026-10-20 (Phase 07 build):**
- The runner asks gate 1 BEFORE any adapter runs (`runner.mjs` `gate()`), so no probe has seen the zone when the owner
  decides. The approval therefore carries his attestation alone: the domain is his, with WHOIS privacy on. The observed
  zone id, nameservers and registry facts land in the verify receipt's evidence, and the owner's VETTING stamp
  (ADR-1705) is given on that evidence. The runner is not changed for one slot.
- The slot's exit criterion is "registered, WHOIS privacy" (ADR-1701: a row never redefines it), so verify also reads
  the registry's RDAP record over `rdap.verisign.com` (.com and .net): registered, not on hold or in redemption, and
  more than 30 days from expiry. Any other TLD is `rdap:tld-unsupported`, named, never guessed. WHOIS privacy itself
  is in the owner's gate-1 attestation, because a thin .com registry holds no registrant data to read.
- `hosts[]` is `api.cloudflare.com` + `rdap.verisign.com`; the two resolvers are `ctx.probe.doh`'s own pinned hosts.

`cloudflare-registrar` stays a `candidate`, and no purchase code is written in Cycle 2.

## Consequences

- One new row to vet: scout record, one real passing verify on `myfitfolio`, the owner's `decision.recorded`, and the
  digest (ADR-1705).
- After this row exists, `domain` is no longer a named ABSENT on `arc-sandbox`: its zone `automemory.ai` can be verified
  the same way. That is an optional re-proof, not done-line work.
- A zone that is still `pending`, or whose nameservers disagree with public DNS, answers `failed(zone:pending)` or
  `failed(zone:ns-mismatch)`, never `verified`.

**Evidence:** `runner.mjs:71` (real venture REFUSED before the gate), ADR-1764 (rehearsal ABSENT), Cloudflare v4 REST
zone list (stable, already used by the vetted `cloudflare-dns` row).
**Confidence:** high.

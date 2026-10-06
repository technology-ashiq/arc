# ADR 1732 — `email-transactional` writes its own DNS records on the DNS provider

**Status:** accepted
**Date:** 2026-10-06
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a second DNS provider being vetted for `dns`, or a mail provider that publishes its records itself

## Context

Resend gives a domain's SPF, DKIM and return-path records only after `POST /domains`; they must then exist in DNS before
Resend verifies. The exit criterion also needs DMARC at `p=quarantine`, which Resend does not provide. The `dns` slot runs
before `email-transactional` and writes one CNAME (ADR-1725); it cannot know records that do not exist yet. The `resend`
row could reach `api.resend.com` only.

## Options considered

1. **`dns` re-runs after email, reading email's records through `ctx.upstream`** — a cycle in the DAG.
2. **`email-transactional` writes the records itself on Cloudflare** — one slot owns one proof; the row gains a host and
   a key.

## Decision

Option 2. The `resend` row gains `api.cloudflare.com` and `CLOUDFLARE_API_TOKEN`. scaffold creates (or finds) the Resend
domain for `brand.domain`, writes each record Resend lists plus `_dmarc.<domain>` TXT `v=DMARC1; p=quarantine;` on the
zone, DNS-only, each tagged in its comment like the `dns` slot's record; a record of that name and type it did not create
is refused. It then asks Resend to verify. verify asks Resend for the domain's status (`verified`) and both public
resolvers for the DMARC record; Resend verified is the DKIM pass, read from the provider that signs the mail.

## Consequences

Two providers share one zone; the comment tags keep each slot's records apart, and the exit plan removes only records
whose comment is this slot's tag.

# ADR 1312 — FACE-M: localhost + token, no PII, escaped serializer, no analytics

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** the FACE-O hosted cycle (ADR-1314) — auth, tenancy and redaction at
the door are that cycle's ADRs; nothing here loosens before it.

## Context

The face renders the company's most sensitive live state. The spine already keeps PII off
by law (LED-C, leads grammar); the face must not become the place it leaks back in, and a
localhost tool must still assume hostile payloads (a `note.logged` body is attacker-
reachable text).

## Options considered

1. **Bind 127.0.0.1 + per-session token + origin check + HTML-escape at the serializer**
   — pros: smallest honest surface; XSS fixture is testable. Cons: none worth listing.
2. **LAN exposure / convenience binds** — cons: an unauthenticated company console on a
   network; rejected.

## Decision

Option 1 (REQ-09). L2 binds the literal `127.0.0.1` with a per-session token and origin
check — spelled out as a matrix, because "localhost + token" underspecifies a
browser-reachable mutating door (second-opinion finding, 2026-08-19): the token travels
in the `Authorization` header only (never a cookie, never a query string — no ambient
credential for CSRF to ride); an absent, `null`, or non-matching `Origin` is rejected on
every route with a named refusal; zero CORS allowances; an IPv6 `::1` bind only if
explicitly configured, under the same rules; a hostile-local-page / DNS-rebinding
fixture is part of the Phase 03 set;
HTML-escaping happens **at the serializer** (XSS via `note.logged` payloads is a named
fixture: `<script>`, RTL/bidi, 64 KB body → escaped, capped). No PII: keyed ids only;
draft/ticket bodies never travel from the spine — the face links to the local CLI
(`arc-leads review`) instead. No analytics, no telemetry. Works offline read-only on the
last synced cursor.

## Consequences

Easier: the threat model stays one paragraph long; the security pass has named fixtures.
Harder: anything wanting remote access waits for ADR-1314's cycle — by design.

# ADR 1314 — FACE-O: v1 is single-tenant local; the SaaS face is a later cycle

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a real external user/customer for a hosted HQ is named (demand, not
speculation) → a new cycle takes auth, tenancy and redaction-at-the-door as its REQs.

## Context

The face may become the public SaaS skin of arc — but v1's job is the owner's working
HQ, and hosting multiplies every security decision (FACE-M) by tenancy.

## Options considered

1. **Defer: single-tenant local v1, contract written to not preclude hosting** — pros:
   appetite goes to the working HQ; the L2 JSON contract is the reusable asset. Cons:
   some rework later (auth, redaction).
2. **Build multi-tenant now** — cons: no user exists; violates the wedge discipline.

## Decision

Option 1. v1 is single-tenant, localhost + token. The L2 contract (one read door, one
decision door, cursor polling, per-consumer cursors per SPINE-G) is written so a hosted
multi-tenant L2 is a later cycle's work, not a rewrite: auth, tenancy and redaction at
the door are named as that cycle's problems. Public hosting is a v1 no-go; this ADR
settles FACE-J's framework condition too (SaaS is not near ⇒ Vite, ADR-1309).

## Consequences

Easier: v1 stays small and honest. Harder: nothing until demand exists — which is the
test.

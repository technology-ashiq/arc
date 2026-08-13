# ADR 1002 — LED-C: revenue payloads are PII-free by construction, and the validator ships first

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** one-way
**Revisit trigger:** a reconciliation dispute cannot be resolved without a customer identifier
that is not already an opaque provider id — at which point the answer is a private off-spine
store keyed by HMAC (the PLAN-leads pattern), never a relaxed spine payload.

## Context

The spine is append-only and its closed days are immutable. `redact.mjs` is **secrets-only**:
there is no PII layer, and nothing on the spine can be erased after the fact. A customer email
that lands in a `revenue.received` payload is therefore on the record permanently, in a repo
that also backs a legal product (LexOS), under a regime (DPDP) that grants erasure rights.

The asymmetry is the whole point: every other data-protection control is about deleting data
later. On this substrate there is no later. Data that never enters never needs erasing.

## Options considered

1. **Strict PII-rejecting validator, shipped before any payload is ever ingested** — the contract
   is enforced at the only moment it can be enforced.
2. **Validator later, discipline now** — ingest carefully, add the check when convenient. The
   first mistake is unrecoverable, and it is made by a tired human at a keyboard, not by code.
3. **Post-hoc redaction pass** — cannot work: the immutable closed day is exactly the case, and a
   redaction event that supersedes a payload leaves the original bytes on the log.

## Decision

Option 1, and the **ordering is the decision**. Revenue payload contract v1:

- required: `amount`, `currency`, `venture`, `provider`, `provider_payment_id` (namespaced
  `provider:id`)
- optional: `plan`, `interval`, `customer_ref` (an opaque provider id or hash — never an email,
  phone number or personal name), `gross`/`fees`/`tax`/`net`, `fx`

A strict-mode validator **rejects PII-shaped fields and PII-shaped values** in `revenue.*`
payloads, with an adversarial corpus pinned as fixtures. It ships in Phase 0, before the first
real payload is ever ingested, and no ingest path exists until it does.

The reason that carried the most weight: this is the only control in the plan whose failure
cannot be repaired by any later phase.

## Consequences

Easier: erasure requests are answerable with "we never held it". Reconciliation works on
`provider_payment_id`, which is the field providers key their own exports on anyway.

Harder: a human ingesting a payment by hand cannot paste a provider record verbatim — the
normalizer must strip, and the validator must refuse what it does not recognise rather than
pass it through. Rejection is loud and blocking, never a warning.

The validator is parser-class: it gets the mandatory adversarial construct-a-breaking-input pass
before it is promoted to FAIL, with holes fixed and pinned as red fixtures. A permissive PII
check is worse than none, because it licenses the paste it fails to catch.

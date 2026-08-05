# ADR 0414 — A reply's identity is its CONTENT, not its arrival time

**Status:** accepted
**Date:** 2026-08-05
**Product:** `leads`
**Reversibility:** reversible
<!-- the kind has never been emitted outside fixtures; ADR-0413 records the cycle as
     fixture-proven and unexercised, so no live receipt carries the old preimage -->
**Revisit trigger:** a provider is adopted whose inbound webhook supplies a stable,
provider-side message id for every inbound mail including DSNs — that id then becomes the
discriminator and the content hash becomes belt-and-braces.

## Context

`outreach.replied` shipped in Phase 00 with the idem preimage

```
outreach.replied|<campaign>|<lead_id>|<ingested_at>
```

Phase 02 is the first code that actually produces the kind, and building the producer showed
the preimage is wrong in **both** directions at once. Same input, opposite failures:

**It splits one reply into two receipts.** `ingested_at` is a wall-clock stamp taken when the
file is read. Ingest the same `.eml` twice — the ordinary recovery action after a crash, a
half-finished run, or an operator who is not sure the first attempt landed — and the two runs
stamp different seconds, so the idem differs, so the spine takes both. Phase 02's own fixture
manifest demands the opposite in as many words: *same reply ingested twice → exactly one
draft (idem)*. The receipt that the draft is derived from could not satisfy it.

**It collapses two replies into one receipt.** Batch ingestion of an inbox export classifies
many replies inside the same second. Two of them from one lead in one campaign — a "no
thanks" and, seconds later, "actually unsubscribe me" — produce the identical preimage, and
the second is dropped as `DUP_IDEM`. The dropped one is silently whichever arrived second,
and `unsubscribe` is the class most likely to arrive second, because it is what someone sends
after the reply they already sent.

The common root: `ingested_at` describes **our processing**, not **the reply**. A total
preimage has to be total over the thing being recorded. Time-of-arrival is metadata about the
recorder.

`triage_class` being absent from the preimage is the same error a second time — two replies
that mean opposite things were allowed to share an identity.

## Options considered

1. **Add `triage_class` to the preimage, keep `ingested_at`.** Pros: one-line change; closes
   the unsubscribe-loses case. Cons: leaves re-ingest minting duplicates, which the fixture
   manifest names explicitly. Fixes the half that was reported and leaves the half that was
   not.
2. **Key on the provider's inbound message id.** Pros: it is the natural identity. Cons: no
   provider is bound (ADR-0413), the `--file`/stdin path has no provider at all, and DSN
   bounces frequently carry no usable id. Designing the only working ingestion path around a
   field it cannot have is how the fake→real gap widens.
3. **Content-address the reply — `reply_ref` = `reply_` + sha256(raw bytes)[0:32] — and put
   `reply_ref` + `triage_class` in the preimage, dropping `ingested_at` from it.** Pros:
   deterministic across re-ingest, distinct across distinct replies, available on every
   ingestion path including a pasted file with no headers, and it is the same discipline
   `draft_sha` already uses on this spine. Cons: a byte-level edit (a re-export that
   re-wraps a header) reads as a new reply.
4. **Compose a synthetic key from From + Date + Subject.** Pros: survives a re-wrap. Cons:
   it is a parser reading attacker-controlled headers to decide identity, and every one of
   those three fields is optional, forgeable, and PII-shaped.

**Chosen: 3.** The cons of 3 are a duplicate receipt in a rare case; the cons of 1 and 2 are a
lost unsubscribe and a path that cannot run, respectively. When the failure modes are
asymmetric this badly, take the one whose worst case is noise.

## Decision

`outreach.replied` carries a required opaque **`reply_ref`**, and its idem preimage becomes

```
outreach.replied|<campaign>|<lead_id>|<triage_class>|<reply_ref>
```

- **`reply_ref` = `reply_` + the first 32 hex of sha256 over the reply's raw bytes**, computed
  before any parsing. Bytes, not a parsed representation: a parser is the thing most likely to
  change between versions, and an identity that moves when the parser is improved is not an
  identity.
- **`ingested_at` stays in the payload and leaves the preimage.** It is audit information —
  *when did we learn this* — and keeping it out of the identity is the entire fix. This is a
  deliberate, documented exception to ADR-0400's total-preimage rule, and the rule is not
  weakened: the preimage must be total over **every field that distinguishes two legitimately
  different receipts**, and two ingests of one reply are not two receipts.
- **A re-classification is a `supersedes` correction**, never a second receipt. Re-ingesting
  the same bytes under an improved parser that returns a different class *does* mint a
  distinct idem, which would double-count a `bounce`. The emitter is not what stops that; the
  correction discipline is, and the fixture pins it.
- `reply_ref` is opaque on the spine exactly as `draft_ref` is (ADR-0412). The reply body,
  its headers and the address it came from live in the store; the spine gets the hash.

**On the hash being a fingerprint of content:** anyone who already holds a candidate plaintext
can confirm it against the ref. That is true of `draft_sha` today and accepted there for the
same reason — confirming a guess you already made is not a disclosure, and the alternative
(a random ref) forfeits the idempotency that is the whole point.

## Consequences

- The closed key set for `outreach.replied` gains one required key. Positive: every producer
  is Phase-02 code written after this ADR. The kind has never been emitted outside fixtures.
- Re-ingesting a reply is now **safe and boring** — the operator's natural response to "did
  that run finish?" stops being a way to corrupt the count.
- A bounce and an unsubscribe from one lead in one second are two receipts, which is what they
  are.
- The parser's output can change freely without moving any existing receipt's identity.
- Anything that dedupes replies by `(campaign, lead_id, ingested_at)` is wrong and there is
  now one place to say so.

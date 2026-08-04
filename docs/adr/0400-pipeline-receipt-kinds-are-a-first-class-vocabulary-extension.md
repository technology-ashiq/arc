# ADR 0400 — Pipeline receipt kinds are a first-class vocabulary extension, with keyed HMAC lead ids

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** one-way
**Revisit trigger:** a kind proves unused after two real campaigns, or the `lead_hmac_v1_`
grammar blocks a legitimate consumer that cannot be served by the private store.

## Context

`ADR-0026` froze the spine event vocabulary as a CLOSED set. Extensions happen only by ADR
(`ADR-0106` +3, `ADR-0107` +1, `ADR-0309` +8, `ADR-0310` +1). **Verified at this kickoff:
`KINDS` is 31 entries** (`.claude/scripts/hq/lib/validate.mjs`) and contains no `lead.*`,
`outreach.*`, `meeting.*`, `deal.*`, or `metric.observed`. The design source recorded 22 —
that count predates evolve's Cycle 7 and is stale; the substance is unchanged, since zero
pipeline kinds exist either way. Emitting one today fails `UNKNOWN_KIND`.

Outbound needs RevOps truth on the spine (`ADR-0401`), and the campaign report, the
suppression ledger, and the cap counters are all *derived from receipts* — so the kinds
must be typed, not prose. Simultaneously, **the repo is headed public** (owner strategy) and
lead PII must never enter it (`ADR-0410`). So the id that appears on the spine has to
survive publication.

## Options considered

1. **`note.logged` + tags** — pros: zero vocabulary change. cons: every consumer parses
   prose; the report, the caps and the suppression ledger all become string-scraping.
2. **First-class kinds, bare `sha256(email)` ids** (evolve's `h-<hex16>` grammar) — pros:
   consistent with the existing source_id form. cons: emails are low-entropy; anyone with a
   candidate list (a public lawyer directory) can hash-and-match every id on a public spine.
3. **First-class kinds, keyed HMAC ids** — pros: dictionary attack dies with the secret.
   cons: a secret to hold and back up; secret loss breaks suppression matching.

## Decision

**Option 3.** Extend `KINDS` 31 → 38 with seven pipeline kinds:

`lead.researched` · `outreach.sent` · `outreach.replied` · `meeting.booked` ·
`lead.suppressed` · `deal.won` · `deal.lost`

House grammar is `subject.verb-past`, so the owner's `lead.sent` was rejected — the lead is
not sent, the outreach is. The owner's `lead.suppressed` was accepted over the draft's
`suppression.added` (cleaner subject). `deal.won`/`deal.lost` are manual-CLI emission in v1:
closing deals is out of the outbound loop's appetite, but revenue truth needs a home.

**Payload discipline — keyed ids only:**

```
lead_id = "lead_hmac_v1_" + HMAC-SHA256(normalize(email), secret)[0:16 bytes as hex32]
normalize(email) = lowercase, trim
```

The secret lives in the private store (`ADR-0410`), never in the repo or on the spine.

**Rotation is additive, never a replacement** (corrected at kickoff by the attack panel — the
first draft said "re-derive from dossier emails", which silently un-suppresses exactly the
people who exercised delete-on-request, since `ADR-0410` purged their dossier and only the
retained v1 hmac survives). The store holds a **keyring**: a rotation adds `_v2_` and
**retires nothing**. Every suppression check derives the candidate address under *every*
retained secret and refuses on a hit under any of them. A secret missing from the keyring
makes every send path refuse, rather than silently matching less.

Payloads additionally carry
campaign id, class/status enums, timestamps, and provider message-id refs — **no raw names,
emails, URLs, and no free-text summary fields** (a summary leaks PII as easily as a field;
prose belongs in the private store).

Idempotency is total-preimage, e.g.
`sha256("outreach.sent|" + campaign + "|" + lead_id + "|" + touch_n)` — a touch can never
double-record by construction.

**Confidence:** high — this is a structural decision verified against the live `KINDS`
export and the existing ADR-0026 extension precedent, not an external claim.

**Rejected because:** Option 1 — makes every downstream consumer a prose parser.
Option 2 — dictionary-attackable on a repo that is going public.

## Consequences

**Easier:** the report, caps, suppression and (if `ADR-0408` fires) metrics are all typed
reader derivations. Double-recording is impossible by preimage.

**Harder:** one more secret to hold. **Losing it breaks suppression matching** — a person
who unsubscribed could resurface in a future research list and be contacted again. Backup
is named as an owner obligation in `ADR-0410`; this is the sharpest edge of this decision.

**Deliberate deviation:** evolve's `h-<hex16>` source_id grammar is *not* inherited for
person-derived ids. URLs are a lighter threat class than emails. If `ADR-0408` fires,
leads-derived `metric.observed` source_ids use this HMAC form too.

**Revisit if:** the vocabulary extension turns out to need an eighth kind mid-campaign —
that is a new ADR, never a quiet append.

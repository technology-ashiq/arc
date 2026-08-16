# ADR 1002 — LEG-B: the facts schema is enum-everything, with three risk tiers

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** one-way
**Revisit trigger:** a venture's real posture cannot be expressed by any enum value AND the missing
value is not a legal branch but a formatting preference — the schema has then become a straitjacket
rather than a review gate, and the tiering is reopened. (A missing LEGAL branch is not this
trigger: that is a template-set version bump, which is the design working.)

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1200). Locked at the v1.1 freeze as LEG-B; recorded here with the kickoff's evidence.

A facts file is hostile input. It is edited by a human in a hurry, interpolated into sentences that
carry legal meaning, and rendered into a page a stranger will rely on. The 2026-08-03 red-team
found the shape that matters: a compliance badge or a markup fragment riding a free-text value into
a clause whose provenance trace stays perfectly clean, because the *clause* came from the pinned
template and only the *value* was poisoned.

The repo's own history says the same thing from the other side: `arc-engine` 2026-08-03 — *"a value
interpolated into a line that carries meaning must be constrained AT THE POINT OF INTERPOLATION;
one newline in `intent` forged an `allowed-tools:` grant past both the lint and the compiler."*

## Options considered

1. **Free-text schema with a review step** — fastest to author, and every guarantee then rests on a
   human reading carefully. This is what a policy page must never rest on.
2. **Enum-everything, no free text at all** — maximally safe and unusable: an operator's trade name,
   address and grievance-officer name are irreducibly free text.
3. **Three risk tiers with the danger tier explicitly bounded** — safe by default, free text
   permitted only where it is unavoidable and only under a hard bound.

## Decision

**Option 3.** Every field is classified into exactly one tier, and the tier decides the validation:

- **ENUM / INT / BOOL / DATE — safe.** Closed vocabulary, parsed not matched. An unknown enum value
  is a parse error, never a passthrough.
- **FORMAT — low risk.** Emails, URLs, dates, GSTIN: a pinned regex, anchored, with the near-miss
  failing closed.
- **FREE-TEXT — dangerous.** Length ≤ 80, plain charset, no markup, no URLs, and a compliance-claim
  token denylist applied **to the RENDERED output**, not to the input value — a denylist on input
  is defeated by any encoding the renderer later undoes.

**Mandatory fields** (v1): `operator {type: individual|entity, legal_name, trade_name}` ·
`geographic_address` · support contact + phone · `grievance {name, email, address, ack_days}` ·
`data_categories[]` (closed enum) · `purposes[]` (closed enum) · retention tokens ·
`deletion_route {mailbox}` · `analytics[]` allow-list · `payment_model` (ADR-1211) ·
`payment_provider` enum · `refund_window_days` INT · `gst_registered` BOOL (+ GSTIN when true) ·
`stores_third_party_client_data` BOOL · `sub_processors[]` · `site_url` · `effective_date`.

**Every enum value maps 1:1 to a pre-approved clause block.** That mapping is the whole reason
trace-lint is a lookup rather than an NLP project, and it is what makes "every clause traces to a
pinned template block" a mechanical claim instead of a hopeful one.

**The schema is itself versioned.** A venture that does not fit an enum forces a template-set
version bump — **the friction IS the review gate**, and removing it would remove the only moment a
human is forced to look at a new legal posture.

**Evidence:** the interpolation-frame rule is arc's own recorded defect class
(`docs/retro-log.md` 2026-08-03 `arc-engine`, 2026-08-04 `arc-evolve`: *"a non-total encoder in a
hash preimage"*, and the 2026-08-09 `arc-absorb` twin-fix rows). No external library is adopted and
none is cited — the validator is zero-dep by A2.
**Confidence:** high
**Rejected because:** Option 1 — makes a human reader the only control on the one artifact that must
not depend on one. Option 2 — cannot express an operator's own name.

## Consequences

Easier: value-lint is decidable, and a poisoned value fails at a named field rather than surfacing
as a strange sentence on a live page.

Harder: **the escaping is itself a transform, and a transform can destroy the signal being judged.**
`arc-design-cycle3` 2026-07-30 pinned `font-family: Arial !important` for hash stability and spent a
whole cycle scoring designs with their typography deleted. The same shape is available here: escape
or normalise aggressively enough and a clause's legal meaning changes while every lint stays green.
So the render records, per page, **which transforms it applied**, and the text attack panel reads
the RENDERED bytes, never the template source. This is a stated obligation of Phase 0, not a note.

Also harder: adding a field is a versioned change to a one-way schema. That is the intent — but it
means the first real venture (REQ-08) is the last cheap moment to discover a missing field, which is
why the LexOS facts file is authored against the real repo rather than imagined.

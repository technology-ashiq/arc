# ADR 1017 — LED-R: the criteria receipt is an `approval.requested` PROFILE, and it gains zero kinds

**Status:** accepted
**Date:** 2026-08-13
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** a second ledger surface needs a receipted edit and the profile subject has to
grow a discriminator — at that point the subject vocabulary is doing a kind's job and should be
re-examined against ADR-0107 honestly rather than stretched again.

## Context

ADR-1008 (LED-I) requires that an edit to root `ventures.yaml` is honored **only** with an
accompanying `decision.recorded` receipt **naming the change**. That sentence was written before
anyone read `assertDecision`, and read literally it is not implementable.

`decision.recorded` has a **closed** payload — `decides | verdict | reason` and nothing else
(`.claude/scripts/hq/lib/validate.mjs`). `decides` must be the ULID of an `approval.requested`.
Worse, `event.idem` is welded to `sha256("decision.recorded|" + decides)`, so a decision cannot
even carry a second identity of its own. There is nowhere in a `decision.recorded` for a criteria
digest to live except inside `reason`, which is free human prose.

Putting the digest in `reason` was considered and rejected on the spot: matching a digest inside
prose is a substring search over attacker-influenced text, and this lane has already shipped one
control that was a grep and one mutant that walked past it (Cycle 7, propose-only guard).

## Options considered

1. **A new event kind, `criteria.changed`.** Honest and obvious, and it spends from a budget that
   is nearly gone: the vocabulary is closed at 44 (ADR-0026), Phase 02 has already committed the
   next slot to `month.closed`, and ADR-0107 counts every addition against `KINDS.length`. Paying a
   kind for a receipt when a receipt mechanism already exists is the wrong trade.
2. **The digest inside `decision.reason`.** Zero new machinery, and the control degrades to a
   substring match on prose. Rejected above.
3. **An `approval.requested` PROFILE carrying the digest, decided by an ordinary
   `decision.recorded`.** The approval holds the structured `subject` and `digest`; the decision
   points at it by ULID and approves or rejects it.

## Decision

Option 3, and it is not a novel pattern here — it is the third instance of one the repo already
runs twice:

> *"A PROFILE, not a kind: `approval.requested` stays generic for every other gate in the repo, and
> only a payload declaring `subject: "policy.promotion"` is held to the strict shape."*

and, for absorb's owner-judge receipt (ADR-0603 / ABS-D), *"only a payload declaring
`subject: "absorb.ab-judgement"` is held to its shape, **so the closed vocabulary gains ZERO
kinds**."*

Ledger's criteria receipt is therefore an `approval.requested` whose payload declares
`subject: "ledger.criteria"` and carries the **canonical digest** of the criteria being adopted.
It is held to a strict closed shape by `assertCriteriaChange` in `validate-ledger.mjs`, wired the
same way every other profile is. Honoring the file then means: the digest of the parsed live
`ventures.yaml` matches an `approval.requested` of that subject which has a `decision.recorded`
deciding it with `verdict: "approve"`. Anything else renders `UNRECEIPTED CRITERIA CHANGE`.

**The digest is over the parsed, canonicalized criteria, never the file bytes.** Reformatting,
comments and line endings must not invalidate a receipt; changing any number, venture or the
schema version must. A byte digest would make the control fire on whitespace, and a control that
fires on nothing gets muted.

**There is no genesis exemption.** The first `ventures.yaml` needs a receipt exactly as the tenth
edit does. An "initial import is trusted" clause is a permanent unreceipted write of arbitrary
criteria, which is the whole failure ADR-1008 exists to prevent.

The reason that carried the most weight: LED-I's control is *"a decision was recorded"*, and that
is fully satisfied by a decision that names the change transitively through the approval it
decides. The literal reading — a digest inside the decision payload — is not a stronger control,
it is the same control in a field that cannot hold it.

## Honest limit, stated rather than implied

This approves a **state**, not a **transition**. The check is "the criteria currently in the file
have an approved receipt", so criteria that go 90 → 120 → 90 need a receipt for 120 and then need
none to return to 90: the original approval of 90 still stands and still matches.

That is a real weakening and it is recorded here rather than discovered later. It was accepted for
v1 because the dangerous direction is closed: **every NEW criteria state requires a fresh approval
and a fresh decision**, so a line cannot move anywhere it has not already been approved. A
transition-based receipt would need `from_digest` alongside `digest`, which also needs an answer for
genesis, and Phase 1 has two days. The follow-on, if this ever matters, is a `from_digest` field
and a null-genesis rule — not a redesign.

Same discipline as the token grammar in this lane, whose comment states that `ashiq_ahmed1994`
passes it. A control is worth what it refuses, never what its ADR says it refuses.

## Consequences

Easier: the receipt path is the one already built, tested and understood (`arc-inbox approve`),
and the closed vocabulary stays at 44 with Phase 02's one slot intact.

Harder: a criteria change is two events rather than one, and the approval must be emitted before
the decision. That is the same two-step every other approved change in this repo takes, and the
ordering is enforced by `assertDecision`'s existing ULID check rather than by anything new.

This does not re-litigate LED-I. The file, the refusal string, the two v1 criteria and the
receipt requirement all stand exactly as ADR-1008 wrote them; this records the mechanism LED-I
left open, after the mechanism its wording implied turned out to be structurally impossible.

# ADR 0603 — ABS-D: an owner judgement is a sealed blind A/B carried by a payload profile, with zero new event kinds

**Status:** accepted
**Date:** 2026-08-09
**Product:** `absorb`
**Reversibility:** one-way
**Revisit trigger:** the sealed-mapping mechanic is shown not to bind — a judgement is recorded
whose blind mapping was readable before the decision, or a `pick` is recorded without a `reason`
and the chain accepts it. Either finding reopens the grammar, because receipts already written in
it would then be evidence of nothing.

## Context

Where a deterministic check exists, absorb uses it. Where one does not, the arbiter is the owner's
judgement — and a judgement that lives in memory is not evidence. Two failure modes are already
recorded in this repo: ranking N candidates against each other always yields a winner but never a
bar, and a session that reported five critique rounds on pixels it never opened.

So the judgement needs to be (a) blind, so authorship cannot leak into the verdict, (b) sealed, so
the blinding is provable after the fact rather than asserted, and (c) mandatory in both fields — a
pick without a reason is a coin flip with a receipt.

The spine's kind vocabulary is closed by decision, and `approval.requested` / `decision.recorded`
are already live with `arc-inbox` folding them (OPEN listing, wrong-kind error path). POL-E
established the pattern for extending meaning without extending vocabulary: a strict `subject:`
payload profile.

This grammar is shared. bench inherits it when bench's own trigger fires, which is why it is
defined once, here, and why it is a one-way door — receipts written in it outlive this cycle.

## Options considered

1. **New event kinds** (`absorb.judgement.requested` / `.recorded`). Pros: self-describing. Cons:
   the vocabulary is closed by an accepted ADR; extending it for one lane's convenience is exactly
   what that closure forbids, and every reader would need teaching.
2. **Strict payload profile on the existing kinds** (POL-E precedent). Pros: zero new kinds; the
   inbox already works; unknown keys can be rejected at the boundary. Cons: two profiles now share
   one kind, so the profile check has to be as strict as a kind check would have been.
3. **Free-form approval text.** Rejected: unknown keys pass, the blind mapping has nowhere to live,
   and the reason becomes optional in practice.

## Decision

**Blind, sealed, and both fields mandatory.**

- Variant labels are **randomized**. The label-to-variant mapping is **sealed in the evidence
  bundle** and revealed only *after* the decision is recorded.
- `approval.requested` carries the strict profile `subject: "absorb.ab-judgement"` with:
  candidate id · fixture list · blind labels · evidence path · correlation. **Unknown keys are
  rejected** (`assertDecision`-style), not ignored.
- The owner picks through the existing inbox. `decision.recorded` carries **`pick` and `reason`,
  both mandatory** — a missing reason is a refused write, not a blank field.
- **Zero new event kinds.** Profile only.

Defined once here. bench's brief gains its one inheritance line at bench's own kickoff, not now.

## Consequences

**Easier.** "The owner judged this" becomes checkable: the seal proves the blinding, the reason
proves it was a judgement rather than a pick, and the inbox chain already exists so no new reader
is needed.

**Harder.** The seal is only as good as the mechanic that hides it, and that mechanic is this
cycle's most attackable surface — a mapping readable before the decision makes every prior
judgement retroactively worthless, which is why it is one-way and why the revisit trigger names it
directly. Two profiles now share `approval.requested`, so the profile check must be exactly as
strict as a kind check, and a lenient reader is a silent hole rather than a loud one.

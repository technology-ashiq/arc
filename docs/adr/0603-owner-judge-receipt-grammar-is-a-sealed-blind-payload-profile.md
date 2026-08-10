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

## Amendment 1 (2026-08-09, Phase 03) — the `pick` cannot be its own field, and rides in `reason`

This ADR said `decision.recorded` carries **"pick + reason, both mandatory"**. Phase 03 found that
is not implementable as written, and the discovery came from actually running the chain rather than
from reading it.

**`assertDecision` in `.claude/scripts/hq/lib/validate.mjs` closes `decision.recorded` to exactly
`decides | verdict | reason`.** A fourth key is refused — by the same closed-shape discipline that
makes the kind trustworthy. So a `pick` field cannot exist without widening a payload shape that
**every lane** depends on, in the most shared file in the repo, while two other lanes are LIVE.

**The pick therefore rides in `reason`, prefixed `pick=<label>; `**, and absorb's chain validates
that prefix. The requirement is unchanged in substance — a decision still cannot be recorded without
naming which blind label won and why — but it is carried by a field that already exists rather than
by widening a shared contract.

**Why not widen `assertDecision`.** Two reasons, and the second is the stronger. First, blast radius:
every kind, every lane, every reader of the spine. Second, the closed shape is load-bearing *as a
closed shape* — the value of "decision.recorded has exactly three keys" comes precisely from nobody
being able to add a fourth for a good local reason. absorb having a good local reason is not an
exception to that; it is the case the rule is for.

**Recorded rather than quietly reinterpreted**, because "pick + reason, both mandatory" reads like a
schema and would have been implemented as one by the next reader.

**Where it is enforced, added 2026-08-09 after the Phase 03 adversarial pass found it enforced
NOWHERE.** This amendment originally said "absorb's chain validates that prefix" and nothing did: the
full chain ran green with the reason `"looks nicer"` and no label was ever named. The enforcement point
is `judgement.mjs reveal`, which now **looks the decision up on the spine** rather than believing the
`--decision` argument, and refuses unless all five hold:

1. the argument is a ULID (v1 accepted `--decision "I made it up"`),
2. a `decision.recorded` with that id **exists**,
3. its `decides` points at an `approval.requested` carrying `subject: "absorb.ab-judgement"`,
4. that approval's `commitment` and `correlation` are **this seal's** — so a decision on a different
   judgement cannot reveal this one, which it previously could,
5. its `reason` starts with `pick=<label>; ` and that label is one of **this** judgement's blind labels.

One lookup closes both. The reveal also records `decides_approval`, `verdict`, `picked_label` and
`picked_variant` in `mapping.json`, so the bundle says what was chosen and on whose authority instead
of only what the mapping was.


**Easier.** "The owner judged this" becomes checkable: the seal proves the blinding, the reason
proves it was a judgement rather than a pick, and the inbox chain already exists so no new reader
is needed.

**Harder.** The seal is only as good as the mechanic that hides it, and that mechanic is this
cycle's most attackable surface — a mapping readable before the decision makes every prior
judgement retroactively worthless, which is why it is one-way and why the revisit trigger names it
directly. Two profiles now share `approval.requested`, so the profile check must be exactly as
strict as a kind check, and a lenient reader is a silent hole rather than a loud one.

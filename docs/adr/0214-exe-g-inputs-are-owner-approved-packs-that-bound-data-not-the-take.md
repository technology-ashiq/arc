# ADR 0214 — EXE-G: inputs are owner-approved packs that bound data, not the take

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** the pack-approval queue stalls more than two days during the cycle — the batch size is wrong, or approval is on the wrong person.

Decided under the owner's **Build-out Mandate (2026-08-09)**.

## Context

The output of a runtime dispatch is governed by the L1-drafts ceiling and a human review. The
**input** was governed by nothing, and the input is where prompt injection enters. A pack assembled
from arbitrary repository state could carry an internal-only fact into a cloud-hosted contractor, and
no amount of output review would catch it, because the leak happened before the draft existed.

The v1 classifier is the owner. An automatic external-ok classifier is a security-critical parser
that deserves its own adversarial cycle, and it is a named rabbit hole.

But a governed input can be strangled two ways, and both were live risks. Per-dispatch approval makes
throughput a function of the owner's attention, which is the thing arc exists to spend less of
(Constitution A3). And a pack that dictates the *angle* as well as the data turns a contractor into a
typist — the exact mistake the design lane measured and reversed in ADR-0049.

## Options considered

1. **One approval per dispatch, pack fixes data and angle.** Maximum control; scales with owner
   hours and produces mediocre, over-directed work.
2. **No approval, classify automatically.** Scales; ships the security-critical parser this cycle
   explicitly refuses to build.
3. **Owner-approved packs with batch, angle and feedback semantics.**

## Decision

**Option 3**, with three semantics that each exist to prevent a specific failure:

- **Batch.** One approved pack may cover **N dispatches, with N declared at approval time**.
  Per-dispatch receipts stay individual. Throughput scales with pack approvals rather than with
  per-draft approvals, so the owner's hour buys more than one draft.
- **Angle.** The pack bounds the **data**, not the take. Unless the job pins an angle explicitly,
  angle selection belongs to the runtime. This is ADR-0218's freedom clause applied at the input.
- **Feedback.** Accepted past drafts and one-line rejection reasons **may ride the next pack**. Both
  are external-ok by nature — they were written to be published — so this crosses no boundary, and it
  is how the contractor improves while its own memory stays off (ADR-0211).

The boundary is fixture-proven, not asserted: a pack seeded with a planted `internal-only` marker is
**refused before dispatch** — before the runtime process starts — and the refusal is its own outcome
(ADR-0219), never a driver fault.

**The verdict grammar is a deferral, recorded in one line.** The absorb lane's ABS-D owner-judge
grammar does not exist yet, so per-draft verdicts use accept/reject plus a one-line reason through the
existing `approval.requested` → `decision.recorded` kinds. The grammar is kept deliberately
ABS-D-compatible so absorb inherits it rather than inventing a second one.

**Confidence:** high on the mechanism; medium on N, which is a habit rather than a number and is set
at the first approval sitting.

## Consequences

**Easier.** The owner's approval is a batch act, not a per-item one. The contractor gets latitude
where latitude produces better work, and constraint where a mistake is unrecoverable.

**Harder.** Batching widens the blast radius of one bad approval: a pack approved for N dispatches
carries its mistake N times, which is why the planted-marker fixture is a certification requirement
rather than a nicety. And "the pack is external-ok" is only as true as the owner's reading of it —
this is a human control, it is recorded as one, and the residual risk that a pack carries something
attacker-influenced is not closed by review.

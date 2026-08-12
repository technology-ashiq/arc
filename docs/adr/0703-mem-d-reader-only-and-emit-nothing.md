# ADR 0703 — MEM-D: memory reads the spine through the reader only, and emits nothing

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** two-way
**Revisit trigger:** a recall becomes something the company needs to audit after the fact (for
example, if a recall result is ever cited as the reason for a decision) — at which point the
event to add is a *decision* receipt that already exists, not a new `recall.completed` kind.

## Context

arc's event vocabulary is **closed** (ADR-0026). Measured 2026-08-11, `KINDS.length = 44` — up
from the 31 the design source recorded at its freeze, because leads and policy both added kinds
since. Any event outside that closed list is rejected as `UNKNOWN_KIND` and quarantined.

There is a recorded lesson about exactly this edge, from `arc-develop` on 2026-08-02: a receipt
emitter *reported success while every receipt was silently quarantined* — the command exited 0
because the writer is fire-and-forget, and the first sign of trouble was someone listing the
spine directory by hand.

So adding a kind is expensive and getting it wrong is silent. The question is whether memory
needs one at all.

## Options considered

1. **Add `recall.completed` (and friends) to the vocabulary** — pros: recall usage becomes
   queryable through the same spine as everything else. Cons: extends a deliberately closed
   vocabulary, needs its own ADR and validator shape, and records something that is not company
   history — a search is not a fact about the business.
2. **Reader-only, emit nothing** — chosen. Pros: zero vocabulary change, zero quarantine risk,
   zero policy surface. Cons: recall usage has to be observed some other way (a plain file, see
   ADR-0706).

## Decision

Memory **reads** the spine exclusively through the existing reader library — never by touching
`events/**`, `*.jsonl`, or `state.db` directly, which is what `spine-reader-lint.sh` already
enforces against the tracked source.

Memory **emits zero events**. `KINDS` is untouched at its live count of 44. Memory adds **no
kinds regardless** of what that count becomes between now and the build.

Memory needs **no `hq.policy.yaml` rows**. POL-I is not applicable: recall introduces no new
action kinds and is read-only, so there is nothing for the policy engine to gate.

The one exception is this kickoff itself, which emits `kickoff.done` and `approval.requested`
like every other kickoff — those are the *kickoff process's* receipts, not memory's, and both
kinds already exist.

**Confidence:** high.

## Consequences

- **Easier:** the cheapest possible spine and policy posture. Nothing to validate, nothing to
  quarantine, no vocabulary ADR to write.
- **Harder:** "does anyone actually use recall?" cannot be answered from the spine. That is
  answered instead by an observational log which is deliberately barred from ever gating
  anything (ADR-0706).
- Because memory never writes to the spine, the 2026-08-02 silent-quarantine failure class
  cannot occur here at all — there is no emitter to check.

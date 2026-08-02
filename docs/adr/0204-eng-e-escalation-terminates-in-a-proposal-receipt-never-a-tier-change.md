# ADR 0204 — ENG-E: escalation terminates in a proposal receipt, never in a tier change

**Status:** accepted
**Date:** 2026-08-03
**Product:** `engine` — lane `engine`, ADR band 0200–0299
**Reversibility:** one-way
**Revisit trigger:** proposal receipts accumulate that a human approves unchanged, every time,
for a whole cycle. That is evidence the human step is ceremony rather than judgement, and it
reopens the question — as a proposal to *automate an approved mapping*, never as permission for a
component to retune itself.

**Reconciles a known conflict.** The design source's ENG-E row drafted the ladder
`retry-once-same → one-tier-up → flag human`. [ADR-0069](0069-balanced-model-policy.md) block
**(b)(1)** forbids any component changing its own or another seat's model tier at runtime, and
block **(d)** flags this exact row as queued for reconciliation. This ADR resolves it in favour
of the policy.

## Context

ADR-0069 deliberately declines to define an escalation default, because an automatic default
would contradict the prohibition printed beside it. It hands this cycle a **constraint**, not a
ladder: whatever escalation is built, the tier change at the end of it is a reviewed diff.

So the middle rung of the drafted ladder — "one-tier-up", performed by the engine, at run time —
is the one thing that cannot be built. What remains is the question of what the engine does
*instead* when a retry does not fix a contract failure.

## Options considered

1. **Drop the middle rung: retry once, then flag a human** — pros: trivially compliant. Cons: the
   human is handed a failure with no analysis, and the information that a stronger tier might have
   helped dies with the run.
2. **Amend ADR-0069 to permit bounded auto-escalation** — pros: keeps the drafted ladder. Cons:
   dismantles block (b)(1), whose whole point is that a system that retunes itself has no
   reviewable history. Rejected on the merits, not on process.
3. **Retry once, then emit a tier-change *proposal* and stop** — pros: preserves the analysis the
   ladder was for, while the tier change stays a reviewed diff. Cons: the run does not
   self-recover; a human is in the loop before any stronger model is used.

## Decision

**The ladder is: `retry once on the same tier` → `emit a tier-change proposal receipt` → `stop,
flagged for a human`.** No component ever changes a tier at run time, anywhere, under any
condition — including the emergency clause of ADR-0069 block (f), which is a human action.

The proposal is a **receipt, not an action**: `arc-run` emits `approval.requested` (an existing
kind in the closed 22-kind vocabulary — no ADR-0026 extension is needed) carrying the process,
the driver, the failure, the tier it currently sits on, and the tier being proposed. The run then
terminates with `outcome: fail` and a payload reason. The printed ULID is the approval id; a human
answers with `arc-inbox approve|reject`, and acting on an approval means **editing
`engine/router.yaml` in a reviewed diff that cites ADR-0069**.

**A schema failure names the layer it blames.** Before a driver can be blamed, `arc-run` validates
the process's own pinned eval-fixture output against the process's own schema. If that fails, the
fault is the **process** and no driver is accused; if it passes and the live run does not, the
fault is the **driver**. The verdict rides as `fault_hint: driver | process | unknown` in the
`run.completed` payload — a sub-field, not a new event kind, so the closed vocabulary is
untouched. Without this, Phase 3's dogfood week produces a pile of schema failures that cannot
distinguish "this driver is weak" from "we shipped a broken schema" — and that is exactly the
distinction the kill criterion's "cut to 2 drivers" decision has to get right.

**ADR-0069 needs no amendment.** Its revisit trigger asks the engine kickoff to record which block
was missing. For escalation, **none was**: block (d) states that the engine owns this design and
inherits a constraint, and the constraint was honoured. That is recorded here as the answer to the
trigger, so the question is closed rather than left open.

**Confidence:** high
**Rejected because:** option 1 — throws away the diagnosis the ladder existed to produce.
Option 2 — dismantles the prohibition that makes every tier change reviewable.

## Consequences

**Easier.** Every tier change in arc's history remains a diff someone approved, with a receipt
that says why. The proposal carries the analysis, so the human decision is informed rather than
a guess at a failure.

**Harder.** An unattended `arc-run` cannot rescue itself. A headless overnight batch that hits a
contract failure stops and waits, and that is the intended behaviour, not a gap to be closed
later by a flag.

**What we'd revisit if this goes wrong.** If proposals are approved unchanged all cycle, the
revisit trigger above applies — and the answer would be a pre-approved mapping in `router.yaml`,
reviewed once, not a component granted the right to change tiers.

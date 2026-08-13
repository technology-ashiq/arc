# ADR 0801 — the build-out trigger is an owner instruction, and its receipt is owed, not cited

**Status:** accepted
**Date:** 2026-08-12
**Product:** `scheduler`
**Reversibility:** two-way
**Revisit trigger:** the owner records a `decision.recorded` for the Build-out Mandate — this ADR is then amended to cite its ULID and the honesty note is retired.

## Context

The kickoff instruction was explicit: *"Trigger: FIRED — owner's Build-out Mandate
(2026-08-09); cite its `decision.recorded` in the kickoff ADRs (A8's letter holds)."*

`PLAN-scheduler.md` and `PLAN-executor.md` both describe the mandate as the receipted decision
that converts their pull triggers. `PLAN-executor.md:391` phrases it as an obligation rather
than a fact — *"record it as decision.recorded in…"*.

**The receipt does not exist.** The canonical spine holds 1008 events and 21
`decision.recorded` events; none is dated 2026-08-09, and none references the mandate,
build-out, scheduler or executor. The nearest neighbours are `01KZBFDM37P135EQPBBZNTP3JH`
(2026-08-06, `policy-plan-approved`) and `01KZN380GP5EDF58H6VRTT0S0T` (2026-08-10, an absorb
pick). There is nothing to cite.

Constitution E3 (no fake claims) and A1 (evidence over assertion) decide what happens next.
A plausible ULID written into an ADR because an instruction asked for one is the exact shape of
the forgery `run-gate.mjs` spends 90 lines defending against on the read path.

## Options considered

1. **Cite the Constitution-adoption receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`** — it is real and it
   is the ULID nearest to hand in `PLAN-executor.md`. Cons: it receipts the Constitution's
   adoption, not the mandate; citing it would make this ADR say something false.
2. **Emit the `decision.recorded` from this session** — pros: the gap closes immediately.
   Cons: a decision receipt records *the owner deciding*; a session emitting one on his behalf
   is the machine minting its own authorisation, and `decision.recorded` is the very kind the
   policy promotion chain dereferences to prove a human authorised something.
3. **Record the trigger as owner instruction, name the missing receipt, proceed** — pros: true
   as written; the gap is visible and dated. Cons: the ADR carries an open loop.

## Decision

**Option 3.** The trigger is recorded as what it verifiably is: an owner instruction dated
2026-08-09, restated in this kickoff's own invocation on 2026-08-12. The `decision.recorded`
is named as **owed and absent**, not cited.

The kickoff's `approval.requested` for this plan is the natural place the loop closes: when the
owner approves, `arc-inbox approve <id> --reason …` produces a dated, real receipt that the
build-out was authorised — which is the thing the mandate's own receipt was supposed to be.

**Evidence:** all `*.jsonl` under the canonical spine
`E:/Work_Hub/01_Automemory/arc/.claude/state/hq/events/` parsed on 2026-08-12 — 1008 events,
21 of kind `decision.recorded`, zero on 2026-08-09, zero matching
`/mandate|build-out|buildout|scheduler|executor/i` in their payloads.
**Confidence:** high
**Rejected because:** option 1 — the receipt records a different decision, so citing it is a
false claim; option 2 — a machine-minted decision receipt is not a human authorisation.

## Consequences

**Easier.** A8's tension (`capability is built when a venture pulls it`) stays where ADR-0074
left it — flagged, not resolved, and resting on a reading the owner confirms at the approval
gate rather than on a receipt that was assumed to exist.

**Harder.** Two plan documents (`PLAN-scheduler.md`, `PLAN-executor.md`) assert a receipt that
is not there. This ADR does not edit them — they are frozen design sources — but any future
reader who trusts them will look for a ULID and find none, so this file is the correction of
record.

**What we would revisit if this goes wrong.** If the owner's approval of this plan is given
verbally and never recorded either, the build-out will have run its second and third lane with
no receipted authorisation anywhere — at which point the honest move is to stop citing a
mandate at all and call it what it is.

## Amendment 1 — 2026-08-12, the loop closed the way this ADR predicted

The owner approved the plan the same day and the approval is on the canonical spine:
`decision.recorded` **`01KZTCFG2DZQJ6EE2WP1RX8P1G`**, deciding
`approval.requested 01KZTBKYW27C8YPC9MK1X05G89` (gate: kickoff), verdict `approve`.

**What this does and does not settle.** It receipts *this lane opening and building*, which is
what the kickoff gate asked. It is **not** the Build-out Mandate's own
`decision.recorded` — that receipt still does not exist, and `PLAN-scheduler.md` /
`PLAN-executor.md` still assert one that cannot be found. The scope of the authorisation now on
the record is one lane, dated, attributed, and readable; the standing mandate remains an
instruction rather than a receipt.

The revisit trigger therefore **stays open** in its original form. Retiring it on the strength
of this receipt would be the same substitution the ADR refused in option 1 — citing a real
receipt for a decision it did not record.

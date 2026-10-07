# ADR 0511 — The policy evidence guard adopts ADR-0910's rule and cannot be clean with a BELOW-BAR cell

**Status:** accepted
**Date:** 2026-10-07
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** two consecutive months with no guard `run.completed` on the canonical
spine. The absence is the evidence (ADR-0910's own trigger, reused).

## Context

POL-L says the owner guard consumes the evidence fold, and its clean run must show every
capability with fresh evidence. ADR-0910 is **bench's** decision (BEN-F): a monthly,
owner-started guard whose clean run emits only `run.completed` and whose findings raise
`approval.requested`. Editing bench's guard to read policy evidence would land a policy
change in another lane's band and code.

The guard and the fold are also guard code. ADR-0502's sentence applies to them: *"a backstop
that the thing it binds can delete is not a backstop."* An agent able to edit the fold could
make the guard report clean.

## Options considered

1. **Extend bench's guard.** Cross-lane edit; it couples a model-drift guard to policy's
   evidence semantics.
2. **Policy's own guard, adopting ADR-0910's rule verbatim.** Bench's ADR stays untouched.
3. **A scheduled job.** The scheduler admits script-class ₹0 jobs, and this guard is one. But
   ADR-0910's reason for owner-started (forgetting is visible) holds, and a scheduled guard
   whose approvals nobody reads is the same poster.

## Decision

**Option 2.** `node .claude/scripts/hq/policy-evidence.mjs guard [--as-of YYYY-MM-DD]`, monthly,
first working day, owner-started. It runs from the **main clone** and refuses a non-canonical
spine (the worktree-spine finding of 2026-08-10).

- **Clean** ⇔ the fold returns zero BELOW-BAR cells. A clean run emits **only**
  `run.completed` (process `policy-evidence-guard@1.0.0`). That receipt is also every cell's
  `last_audit`.
- **Not clean:** `run.completed` with `outcome: partial`, and exactly **one**
  `approval.requested` (gate `policy-evidence`) listing every BELOW-BAR cell split into
  `no-writer` (no surface can clear it this cycle) and `clearable`. Never one approval per cell,
  and **raised only when that set differs from the previous guard run's**: a monthly copy of an
  unanswerable approval teaches the owner to ignore the inbox. The run is still not clean.
- **Invariant (c):** the clean verdict is computed from the full cell list, not a filtered or
  sampled one. A guard that drops a BELOW-BAR cell from its input is the mutant its fixture
  kills.

**The new files join the guarded set** (`ungrantable_resources` and the static deny floor)
in the cycle's owner paste, as whole files generated from the live ones (the Phase 04
STEP1/STEP2 pattern), once the fold is green. Until that paste lands, the files are editable,
and the tracker says so rather than implying otherwise.

**`policy-lint` delegates.** The BELOW-BAR class lives in `policy-evidence.mjs check`.
`policy-lint.mjs` (deny-listed) gains a `--evidence` flag that calls it, in the same owner
paste. One implementation, two entry points (POL-D).

## Consequences

Easier: no cross-lane edit; bench's guard is unchanged; the inbox stays a real needs-you
surface.

Harder: with the L1 refusal gap open, the guard is **never clean** until the interactive
receipt lands and real refusals happen. That is intended, and it will feel like noise. The
mitigation is that the approval lists cells and their states, so "unknown" (not instrumented)
and "absent" (instrumented, never exercised) read differently.

Revisit: the trigger above.

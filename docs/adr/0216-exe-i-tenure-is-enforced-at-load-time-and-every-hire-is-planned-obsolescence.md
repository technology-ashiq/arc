# ADR 0216 — EXE-I: tenure is enforced at load time, and every hire is planned obsolescence

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** two consecutive rejustifications pass without anyone reading the receipts — the review has become a rubber stamp and the period is wrong, or the trigger should be usage-based rather than calendar-based.

Decided under the owner's **Build-out Mandate (2026-08-09)**; period ruled by the owner, 2026-08-09.

## Context

An external dependency that nobody re-examines becomes permanent by accident. The failure is not that
a bad hire is made — it is that a hire made for one good reason stays after the reason is gone, and
nothing in the system is shaped to notice.

Calendar review needs something to fire it. A scheduler does not exist yet (it is a later build-out
slot), and a rule that depends on a component nobody has built is a rule that does not exist. This
repository has recorded that exact shape twice: *a stated control is not a control until something
asserts it* (retro-log 2026-08-02), and an ADR-mandated board note that was simply never written.

## Options considered

1. **A calendar reminder.** Needs a scheduler that does not exist, and lives outside the repository.
2. **Review at cycle boundaries.** Fires only when someone opens the lane — an idle lane's contractor
   never expires.
3. **Enforce at load time**, where the check runs because the thing is being used.

## Decision

**Option 3.** Every runtime row in `router.yaml` carries `review_by:` — a date, **mandatory, enforced
when the router loads**. The period is **2 weeks** (owner ruling, 2026-08-09): tight probation, and
cheap to renew because rejustification rides on receipts the runtime already produced.

Dispatching through an expired row **refuses loudly, naming the row and the file to edit**, and emits
**one idempotent** `approval.requested` rejustify-or-retire proposal. No scheduler is needed because
the check runs at use: a runtime nobody dispatches cannot expire dangerously, and one that is
dispatched cannot avoid the check.

**Propose-only in both directions.** Expiry never disables a row by itself and never renews one by
itself. Both are reviewed diffs. An automatic renewal would be the control removing itself; an
automatic disable would be an unreviewed production routing change, which ADR-0069 b(1) forbids.

**Termination is specified with the hire, not after it.** Two levers, in this order: **revoke the
capped key** (instant — the credential is the leash, ADR-0213) and **disable the row** by reviewed
diff. The emergency path is ADR-0069 block (f) carve-out 2 — human-approved, carrying an expiry, with
a follow-up ADR inside 48 hours.

**The standing loop this enables:** hire → transcripts → absorb studies → internalise → retire. Every
hire is planned obsolescence, and an external dependency is never permanent by default.

**Confidence:** high — enforcement at the point of use is the same shape as the birth rule and the
policy gate, both already live in this tree.

## Consequences

**Easier.** Retirement is routine rather than a crisis, which is what makes the upstream-churn risk
survivable: this runtime class has already produced a rename, a founder departure and a governance
handover inside three weeks.

**Harder.** A date in a file is only as honest as the person editing it, and a two-week period means
the owner meets this prompt often enough for it to become a reflex — which is this ADR's own revisit
trigger. Idempotence of the proposal has to be real, or an expired row dispatched five times files
five approval requests and teaches everyone to ignore them.

# ADR 0071 — a cycle is CLOSED when `HISTORY.md` says so; and the venture trigger fires on close OR appetite, whichever comes first

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053)
**Reversibility:** two-way
**Revisit trigger:** a cycle whose appetite is exhausted while genuinely-productive work is
still in flight, where firing the venture trigger on the appetite ceiling would cut off
something worth finishing. That is the case this rule handles badly by design, and the first
real instance of it is the signal to amend rather than to make an exception.

## Context

`PLAN-cycle3-venture-launch.md:3` sets the trigger for arc's first-money cycle:

> *"Cycle 2 (receipt spine) **closed**, or running late — first money must not wait past ~2
> weeks after it."*

The word `closed` is not defined anywhere, and neither is `running late`. Council session 002
found this while ranking arguments about sequencing and named it the single most
decision-relevant open question in the run: **the same sentence supports both "the trigger has
not fired" and "the trigger is overdue"**, so the venture start date is arguable in either
direction from identical text. That is how a deferral becomes indefinite without anyone
deciding to defer.

It also has a second cost. `docs/strategy/plans/README.md:28,31` gives arc-design and
arc-develop the trigger *"After Cycle-2 close"* — and arc-design **closed 2026-07-30 while
Cycle 2 was still LIVE**. Whether that was compliant is unanswerable until `closed` means
something.

## Options considered

1. **"Closed" = the last phase closes.** Pros: earliest, simplest. Cons: contradicts existing
   practice — `HISTORY.md:52` already says C2's entry *"finalizes at retro"*, and every closed
   cycle in the table was recorded after its retro, not after its last phase.
2. **"Closed" = the owner says so.** Pros: maximum flexibility. Cons: it is exactly the
   undefined judgement call that produced this ADR, wearing a different hat.
3. **"Closed" = what `HISTORY.md` already records, and the venture trigger gets a second,
   un-gameable anchor.** Chosen.

## Decision

**A cycle is CLOSED when its row in `docs/HISTORY.md`'s "At a glance" table reads `CLOSED`
with an end date.** That entry is written when the cycle's last phase closes **and** its retro
is recorded — which is what `HISTORY.md:52` ("entry finalizes at retro") already says and what
C1, C3 and C4 already did. This ADR invents nothing; it pins the practice so it cannot be
re-read later.

Machine-checkable in lane-mode as a corollary: the lane's `PROGRESS.md` machine header carries
`status:` not `LIVE`/`BLOCKED` and its `cycle:` line reads `closed <date>` (ADR-0051 — the
lane files are the truth, the board is a view).

**And the load-bearing half — the venture trigger fires on whichever comes FIRST:**

1. Cycle 2 is CLOSED as defined above, **or**
2. **Cycle 2's own appetite is exhausted** (its recorded burn reaches 100% of its recorded
   appetite).

`running late` means (2). It is measured against the cycle's *own* declared appetite, not
against a feeling, and the burn is already tracked. **Whichever fires first starts the ~2-week
clock.**

The second anchor exists because the first one is under the control of the person the trigger
is meant to bind. Without it, a cycle that is simply never closed defers first money forever
and no one ever makes that decision — the exact failure council session 002 recorded, and the
exact shape of "factory-polishing addiction", which `arc-master-execution-plan.md:234` already
names as arc's **#1 real threat**.

## Consequences

**What this settles today, stated plainly because it is uncomfortable:**

- **Cycle 2 is NOT closed.** `HISTORY.md:18` reads *"LIVE — Phase 04 dogfood"*. So the
  Cycle-3 venture trigger has **not** fired on branch (1).
- It has not fired on branch (2) either: C2 is at *"~40% of 12.5d"*. Appetite is not exhausted.
- **Therefore the venture cycle is not yet due — and the ~3-day deadline this session earlier
  reported to the owner was wrong.** That figure anchored the two weeks to Cycle 2's *kickoff*;
  the trigger clocks from its *close*. The error is recorded in council session 002 and is
  corrected here rather than left to propagate.
- The retroactive question about arc-design closing "after Cycle-2 close" while C2 was LIVE is
  now answerable: **it was not compliant with its stated trigger.** Recorded as a fact, not
  reopened — the cycle shipped and closed, and re-litigating it buys nothing.

**Easier.** "When does the venture cycle start?" has an answer that does not depend on who is
asked, and it cannot be pushed out indefinitely by simply not closing a cycle.

**Harder.** The appetite anchor can fire while useful work is genuinely in flight — that is the
revisit trigger above, and it is a deliberate trade: a rule that can never be inconvenient is a
rule that never binds.

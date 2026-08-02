# ADR 0072 — "arc good shape" is three parts, not four: implementing the plan library is venture-pulled work, not pre-venture work

**Status:** accepted
**Date:** 2026-08-03
**Product:** `company` — arc-wide (ADR-0053)
**Reversibility:** two-way
**Revisit trigger:** a remaining plan's trigger fires **without** a venture, real usage pain,
or an external event — i.e. arc-building alone unlocks one. That would falsify this ADR's
central finding and part 2 should come back into the definition.

## Context

The owner's sequencing position is: build arc to a self-standing "good shape" first, then run
ventures in parallel while arc keeps developing. He gave the definition in his own words, and
it is recorded verbatim in council session 002's decision statement:

> *"existing products improved, strategy plans implemented, arc working self-standing and able
> to self-develop"*

Council session 002 ([verdict NO](../council/sessions/002-arc-first-vs-venture-first-sequencing.md))
found via point **N2** (rated `Supported`) that this definition is **structurally unreachable**,
because 6 of the 17 pull-triggered plans require a live venture or revenue to be buildable at
all. The verdict's cheapest-test line asked for a written definition **excluding** those six,
or the condition can never be satisfied.

This ADR is that definition — and the check that produced it found the problem is **worse than
N2 stated.**

## The finding: arc-building unlocks ZERO remaining plans

Every trigger in `docs/strategy/plans/` was read at 2026-08-03. Five plans are done
(cycle2-spine, design, portfolio, model-policy) or live (develop). Of the **16 remaining**:

| What the trigger needs | Plans |
|---|---|
| A live venture or revenue | growth · leads · ledger · legal-pack · ops · trader · evolve |
| A decision to pick a venture | discover |
| Real-usage pain from live use | memory (*"finding a past lesson takes >2 min"*) · dashboard (*"brief repeatedly overflows one screen, OR portfolio ≥3 earning ventures"*) |
| Capability the engine cycle must build first | bench (*"≥2 drivers in real use AND they disagree"*) · policy (*"≥3 action kinds at ≥L2"*) · scheduler (*"first process earns L3"*) · chat-mcp (*"dashboard exists AND…"*) |
| An external event | engine (*"public-release prep · a second runtime · a price event"*) |
| **Already FIRED** | **cycle3-venture-launch** (Cycle 2 closed 2026-07-28) |

**Not one of the sixteen is unlocked by building more arc.** Not partially — zero. That is not
an accident or a gap; it is Constitution **A8** working exactly as written: *"Capability is
built when a venture pulls it, never pushed by ambition."* The plan library was **designed** so
that arc-building cannot advance it.

So part 2 of the definition — *"strategy plans implemented"* — is not a slow part of the goal.
It is a part that **cannot move at all** on the arc-first path. Keeping it makes the definition
self-referential: good shape needs plans implemented, plans need a venture, and the venture is
waiting on good shape.

## Options considered

1. **Keep all four parts.** Pros: the owner's words untouched. Cons: *"venture after good
   shape"* then means *"no venture, ever"* — a conclusion nobody chose and which contradicts the
   owner's own stated plan to run ventures in parallel later.
2. **Replace the definition with a date.** Rejected: the owner explicitly wants a condition,
   not a calendar, and a date does not describe what he is actually waiting for.
3. **Drop part 2 and make the remaining three checkable.** Chosen.

## Decision

**"arc good shape" = three parts, each demonstrated by a closed cycle rather than judged by
feel:**

| # | Part (owner's words) | Reached when |
|---|---|---|
| 1 | *existing products improved* | Every product arc ships has had at least one closed cycle against it since it was born — improvement is evidenced by a cycle that closed, not by an impression that things got better. |
| 2 | *arc working self-standing* | arc runs a **full cycle end-to-end on its own machinery** — kickoff → phases → close → retro, with its own gates deciding, and no ad-hoc step outside the harness. Demonstrated, not asserted. |
| 3 | *arc able to self-develop* | The `develop` lane — arc's own execution harness — is **closed and proven**, so an approved phase becomes proven slices through arc rather than through improvisation. |

**Part 2 of the original wording, *"strategy plans implemented", is removed from the definition
and re-labelled as what it actually is: venture-pulled capability.** Those plans are not
pre-venture work that was somehow skipped. They are the factory's response to a venture
existing, and they get built when one pulls them (A8).

## Consequences

**Easier.** "Good shape" stops being a feeling and becomes three checkable conditions the owner
can watch, and — critically — **it becomes reachable by the work he actually wants to do.** Under
the old wording it was not.

**Harder, and this is the part that must not be softened:** the honest consequence of the
finding is that **the plan library is no longer a to-do list.** There is nothing in it to work
through pre-venture. Once these three parts are met, arc-building runs out of pull-triggered
work entirely, and the only thing that unlocks the remaining sixteen is a venture. This ADR
makes "good shape" achievable; it does **not** make the arc-first path infinite, and it should
not be read as licence to keep finding arc work after those three are done.

**What this does not decide.** It does not set a venture date, and it does not overrule council
session 002's `NO` verdict on the open-ended arc-first framing — that verdict stands, and its
Resolution branch explicitly allows a *considered* deferral. This ADR is what turns the owner's
position from an open-ended one into a considered one: a condition that is written, checkable,
and reachable, instead of one that could never be satisfied.

**The venture trigger is unaffected and already fired.** Cycle 2 closed 2026-07-28
([ADR-0071](0071-a-cycle-is-closed-when-history-says-closed.md)), so
`PLAN-cycle3-venture-launch`'s ~2-week clock runs to **2026-08-11**. That is a separate,
already-live fact; deferring past it is the owner's call to make explicitly, not something this
definition quietly absorbs.

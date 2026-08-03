# ADR 0300 — evolve v1 is built ahead of its trigger: an explicit owner override of the A8 pull rule

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** two-way
**Revisit trigger:** the cycle reaches its 50% kill checkpoint (3.5d) with REQ-02 unmet, **or** a
client cycle ships EVO-H0 and the fixtures written here turn out not to match the real feed's
shape. Either falsifies "build now, connect later" and the banked artifacts become documentation.

## Context

`docs/strategy/plans/PLAN-evolve.md` opens with a sleep clause: *"Trigger (pull): ≥1
venture/module with 4+ weeks of real OUTCOME metrics on the spine … **This plan sleeps. Do not
start before the trigger fires** (Constitution A8)."* Its cascade rule adds: *"metric feed
younger than 4 weeks or gappy at kickoff → the trigger was mis-read — STOP at kickoff-lint."*

The gate was verified in-tree at kickoff, 2026-08-03. All five rows are unevidenced:

| # | Gate row | Verified state |
|---|---|---|
| 1 | Client + surface chosen | The kickoff prompt still carried the literal placeholder `<client module>`. No `growth` module exists anywhere in the repo; zero manifests declare `evolve` |
| 2 | EVO-H0 live + ≥4 weeks of receipts | `KINDS` in `.claude/scripts/hq/lib/validate.mjs:20` is frozen at 22 entries and contains neither `metric.observed` nor any `experiment.*`. Emitting one today fails `UNKNOWN_KIND`, so four weeks of receipts cannot exist on any machine |
| 3 | Primary + guardrail declared | Nothing to declare against |
| 4 | MDE → per-arm floor derived | No baseline rate exists to derive from |
| 5 | Watch-window definition | Same |

ADR-0072 is also in play: it found that **zero** of the sixteen remaining pull-triggered plans
are unlocked by building more arc, and named `evolve` among the seven needing a live venture.

The owner was shown this evidence in full and directed the build forward twice, the second time
explicitly: *"ne un istathuku yosikatha, as per the plan ne kickoff start pannu."* The sequencing
position is that arc itself is the priority and ventures come after arc reaches good shape.

## Options considered

1. **Hold the STOP.** Pros: A8 and the plan's own sleep clause are honoured literally; no code is
   written that cannot be exercised. Cons: overrides a direct, twice-stated owner decision on his
   own repo and his own Constitution; leaves the lane idle for a runway nobody has scheduled.
2. **Build the full loop including a synthetic client feed**, so the board renders live numbers.
   Cons: manufactures data on a spine whose central rule is that absent data is `MISSING`, never
   zero. This would corrupt the exact property the cycle exists to protect.
3. **Build the engine against fixtures; leave the feed a declared external dependency.** Chosen.

## Decision

**Build evolve v1 now, fixture-proven, with the client feed declared as an absent external
dependency rather than faked.**

Two things make this coherent rather than a rule simply being waived:

1. **The design source already separates build acceptance from the verdict.** Its pre-mortem row
   7 reads *"Build acceptance = pipeline fixture-proven; the real verdict = runway milestone
   outside the cap"*, and its Appetite section states the real verdict is not inside the
   appetite. Every REQ-01..05 acceptance in `PLAN.md` is a fixture assertion. None needs a real
   receipt stream.
2. **The missing feed is exercised, not hidden.** `metric.observed` staying out of `KINDS` means
   the board's baseline panels render `MISSING` — which is precisely REQ-02's required behaviour
   ("absent data is `MISSING`, never zero"). The gap tests the design instead of blocking it.

What the override costs, stated plainly: the **runway** — the operational stretch where a real
experiment reaches its floor and produces a real verdict — cannot start. Phase 3's "first real
experiment OPENED on the chosen surface" is therefore **cut from this cycle's scope** and
recorded as banked, not delivered.

EVO-H0 is **not** pulled into this lane to compensate (ADR-0308). Evolve consumes the metric
stream; it never bootstraps its own trigger.

**Confidence:** medium — the mechanism is verified in-tree, but "fixtures written before a real
feed exists will match that feed" is an untested bet, ledgered as such.

**Rejected because:** option 1 — the owner's explicit, repeated direction on his own governance
document is the decision, and the evidence was presented before he made it. Option 2 — a
synthetic feed would violate the cycle's own central non-negotiable.

## Consequences

**Easier.** The lane starts, and the four hardest parts of evolve (closed-payload receipt
grammar, the pinned verdict math with bit-for-bit reference vectors, the four-hop SHA lineage,
and the reader-only replay-identical board) are all fixture-provable today with no data at all.
When a client eventually ships EVO-H0, the connection is a config and a feed, not a build.

**Harder.** Nothing in this cycle can demonstrate end-to-end value on real traffic, so the
cycle's north-star claim closes as *fixture-proven, unexercised*. That must be written that way
at close — the `engine` lane's REQ-08 is the precedent for reporting a partial claim as partial
rather than waiving it, and this cycle inherits that standard. A second, subtler cost: fixtures
authored without a real feed encode the author's guess about that feed's shape, which is the
`design-cycle3` failure class (a normalisation that destroys the signal it measures) pointed at
data instead of pixels.

**What we'd revisit if this goes wrong.** If the 50% checkpoint arrives with REQ-02 unmet, the
kill criteria already say to bank the contract, lint and vocabulary ADRs as documentation and
stop. This ADR does not create a new escape hatch from that.

# ADR 0308 — EVO-H0: `metric.observed` enablement belongs to the client's cycle, not evolve's

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** two-way
**Revisit trigger:** two or more client cycles each implement this spec and diverge — at which
point the shared spec should move into evolve (or into `hq`) and be consumed, rather than
re-implemented per client.

## Context

Evolve's trigger is *"4+ weeks of `metric.observed` receipts"*. Verified at kickoff: `KINDS` in
`.claude/scripts/hq/lib/validate.mjs:20` holds 22 kinds and `metric.observed` is not among them.
The vocabulary is closed by ADR-0026, so emitting one today fails `UNKNOWN_KIND`. The trigger is
therefore not merely unfired — it is **technically impossible to fire** until some cycle adds the
kind.

That is a chicken-and-egg: evolve waits on receipts, and the receipts wait on a kind nobody has
added. The design source resolves it by ownership rather than by sequence.

## Options considered

1. **Evolve builds `metric.observed` itself**, so its own trigger becomes satisfiable. Cons: a
   system that bootstraps its own trigger has no trigger — the pull rule becomes decorative, and
   evolve would own an ingestion path for a client it does not have.
2. **Move the trigger off `metric.observed`** onto something already emitted. Cons: nothing
   currently on the spine measures an outcome; the trigger would be satisfiable without the
   evidence it exists to require.
3. **The first client's cycle ships it, to a spec frozen in evolve's design source.** Chosen.

## Decision

**EVO-H0 lands in the FIRST CLIENT's cycle.** It comprises: a vocabulary ADR adding
`metric.observed`, its closed-payload validator, the idem total-preimage formula, the `source_id`
grammar, and fixtures — implemented to the spec frozen in `docs/strategy/plans/PLAN-evolve.md`,
with any deviation flagged back to that plan.

**Evolve consumes; it never bootstraps its own trigger.** This lane does not implement
`metric.observed`, and doing so is listed as a no-go in `PLAN.md`.

**Spec-deviation check performed at this kickoff, as the kickoff prompt required:** EVO-H0 is not
law. It has not shipped in any cycle, partially or otherwise. The deviation is not a detail
mismatch — it is total absence, and it is recorded here and in ADR-0300 rather than glossed.

The consequence for this cycle is bounded and already designed for: the board's baseline panels
render **`MISSING`**, which is REQ-02's required behaviour for absent data, rather than erroring
or rendering zero.

## Consequences

**Easier.** The ownership line is unambiguous, and evolve's dependency on a real feed is a
declared external dependency with a fake — the same offline-first treatment every external
dependency gets — rather than a hidden assumption.

**Harder.** Evolve cannot be exercised end-to-end on real data until some other cycle does this
work, and that cycle does not exist and is not scheduled. The fixtures written here encode this
lane's *guess* at the real feed's shape; if the client's implementation deviates, the fixtures
are wrong in a way no test in this lane can detect. That is the specific risk ADR-0300 ledgers,
and this ADR's revisit trigger is the other half of it.

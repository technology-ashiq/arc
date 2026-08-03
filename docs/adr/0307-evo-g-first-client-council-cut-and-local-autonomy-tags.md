# ADR 0307 — EVO-G: the first client, the council cut, and autonomy tags that stay local

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** two-way
**Revisit trigger:** the policy engine is built and owns a global autonomy ladder — at which
point evolve migrates its local tags to it, never the reverse.

## Context

Three smaller decisions travel together because they all answer "what is in this cycle and what
is deliberately not".

The first client was recommended as growth title templates, *only after growth exists on a live
venture with traffic*. Verified at kickoff: no `growth` module exists anywhere in the repo, and
no venture is live. So the client slot is **unfilled**, which is the condition ADR-0300 records
and overrides.

## Options considered

1. **Pick a stand-in client from the 10 existing products** so the cycle has a named surface.
   Cons: none of them has an outcome metric or traffic; the "client" would exist only to make a
   field non-empty, which is the shape of a control that is not a control.
2. **Wait for a client.** That is the STOP that ADR-0300 already overrode.
3. **Leave the client slot explicitly unfilled and build against fixtures.** Chosen.

## Decision

**First client:** unfilled. The intended client remains growth title templates, and it is
reachable only once growth exists on a live venture with traffic. Fixtures stand in for a client
surface throughout this cycle; no existing product is nominated as a stand-in.

**Council is Phase 4 and is THE DESIGNATED CUT.** It is plumbing integration — honest value, not
engine safety — so burn pressure banks it as a follow-up micro-drop and the cycle still closes
whole. **No historical Markdown backfill in v1**: only receipts emitted from wiring-time forward
count. `council-calibrate.mjs` exists today but reads Markdown session files and scored outcomes
are 0, so a backfill would be inventing calibration from sessions that were never scored.

**L1/L2 demotion tags are LOCAL to evolve v1.** The policy engine owns the global autonomy ladder
when it is built; evolve migrates to it. Evolve does not build a policy engine, and its local
tags carry no meaning outside this lane.

## Consequences

**Easier.** The cycle has an unambiguous cut line that can be taken under pressure without
damaging the engine, and it does not carry the weight of a policy-ladder design it has no
mandate for.

**Harder.** With the client slot unfilled, every acceptance in this cycle is a fixture
assertion — the cycle cannot demonstrate value on real traffic, and must close saying so. An
empty client slot is also a standing invitation to fill it with something convenient later; the
rule that no existing product is nominated as a stand-in is what prevents that, and it is written
here so a future session cannot mistake convenience for a decision.

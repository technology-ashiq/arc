# ADR 0909 — budget is K-group admission control, and execution is sequential in v1 (BEN-E)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** a full run stops fitting the cap at real prices, or bench runtime becomes
the bottleneck — parallel execution is then its own decision with its own reservation ledger.

## Context

Provider cost is only known **after** a call, so post-call checking alone is not a cap — it is
a report of the overspend. Bench runs K attempts per fixture (K = 3), and the unit that must fit
is the whole group: stopping mid-group leaves a fixture with 2 of 3 attempts, which the
completeness gate (ADR-0906) disqualifies anyway, so the spend bought nothing.

## Options considered

1. **Post-call checking only** — simple, and it discovers the breach after paying for it.
2. **Per-invocation reservation** — reserves one call at a time; owner review round 2 found
   this **under-reserves by 3×** for a K=3 group and strands fixtures mid-group.
3. **Reserve the whole K-group before it starts.**

## Decision

**Option 3.** Before a fixture starts, reserve **K × its worst-case per-invocation spend**
(from `ceilings.json`, ADR-0904) against **BOTH** the full-run cap and the process sub-cap. If
the remainder cannot cover the whole group, **the fixture is NOT started** — recorded
`failure: budget`, skipped, its evidence kept, and its class marked `NO PROPOSAL` per ADR-0906.

Post-call reconciliation replaces the reservation with measured provider cost where the driver
reported one. The engine's own budget machinery is the backstop, never the primary control.

Cap exhausted mid-run → abort remaining, emit a partial report flagged `partial`, and
`run.completed` with `outcome: fail`, `payload.reason: "budget"`.

**Fixture execution is sequential in v1.** No concurrency means no reservation-ledger races,
and the whole class of parallel-accounting bugs is moot rather than solved.

Defaults: full-run **₹500**, per-process **₹100**, **K = 3**, temperature 0 where the provider
offers it. Caps are printed in every report.

## Consequences

**Easier:** the cap is a real bound rather than a post-hoc observation, and a budget-skipped
fixture leaves intact evidence instead of a half-scored group.

**Harder:** a conservative ceiling can refuse a group that would in fact have fit. That is the
intended direction of the error — refusing to spend is recoverable, overspending is not.

**The trap this closes:** `docs/retro-log.md` 2026-08-03 (arc-engine) — *"a bound was enforced
per-ATTEMPT while being described per-RUN: fallback hops and the retry each received a fresh
full budget (4× the stated cap), and a timeout was classified a driver fault so budget
exhaustion TRIGGERED the fallback that spent it again."* Bench's budget is therefore a property
of the **RUN**: one remaining-budget value is threaded through every attempt, retry and
fallback hop, and **budget exhaustion is its own terminal outcome that must never trigger the
retry or fallback path**. Phase 0 pins a fixture asserting exactly that, because this defect
was previously true in the one place it was checked.

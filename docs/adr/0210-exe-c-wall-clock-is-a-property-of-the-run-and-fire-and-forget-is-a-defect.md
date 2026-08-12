# ADR 0210 — EXE-C: wall-clock is a property of the run, and fire-and-forget is a defect

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** three consecutive calibration runs time out at the generous budget — which means the class is mismatched to the runtime, not that the budget is wrong.

Decided under the owner's **Build-out Mandate (2026-08-09)**.

## Context

An agent runtime is opaque and long-running by design. It decides its own number of internal steps,
its own tool calls, and its own retries — none of which arc can see. The only bound arc can enforce
from outside is **time**, and time is exactly the bound this repository has already got wrong once.

The engine's own retro entry, 2026-08-03: *a bound was enforced per-ATTEMPT while being described
per-RUN* — fallback hops and the retry each received a fresh full budget, so a run could legitimately
take four times its stated cap while every individual attempt stayed "inside" its bound; a timeout
was classified a driver fault, so budget exhaustion triggered the fallback that spent it again, and
the receipt then read `reason: driver`.

That defect was fixed in C6 and the fix is visible in the code
(`.claude/scripts/engine/arc-run.mjs:147` — *"THE BUDGET IS A PROPERTY OF THE RUN, NOT OF AN
ATTEMPT"*). This cycle adds a **new** timing enforcement point — the shim's own wall-clock around an
opaque child process — and a new enforcement point is exactly where a fixed defect comes back.

## Options considered

1. **The shim starts its own clock per invocation.** Simple; reintroduces the 2026-08-03 defect the
   moment a retry or a fallback hop exists above it.
2. **The shim receives the run's remaining time and enforces against that.** One clock for the run,
   passed down.
3. **Dispatch and collect later** (fire-and-forget with a polled result). Fits a long-running runtime
   naturally; produces dispatches with no collected result.

## Decision

**Option 2, and option 3 is named a defect rather than a mode.**

The wall-clock budget is a property of the **run**. The shim is handed the run's *remaining* time,
never a fresh full budget, and a timeout is classified as its **own** outcome —
`fail` with `reason: budget` — which must not trigger the fallback path it would otherwise multiply.
Budget exhaustion is never reported as a driver fault.

**No fire-and-forget.** A dispatch without a collected result is a defect, not an asynchronous
success. This is the same rule the spine already enforces on emission (exit 0 from a writer is not
evidence anything was written), applied to dispatch.

**Per-class budgets are set from calibration receipts, never guessed** (REQ-05). The first three runs
are calibration runs at a deliberately generous wall-clock, their durations recorded, and the class
budget derived from those receipts afterwards. A stingy guess would kill exactly the deep runs the
runtime was hired for — and a runtime pointed at a slow model can trip a wall-clock budget while
spending no money at all, so time and money fail independently.

The exit code a timeout produces is `EXIT.BUDGET_DECLINED` — **2**, not the 3 the design source
imagined. See ADR-0219.

**Confidence:** high — the failure mode is not hypothetical, it is this lane's own recorded defect
with the fix visible in the current tree.

## Consequences

**Easier.** One clock, one owner, one outcome class. The receipt's `reason` field means what it says.

**Harder.** The runtime's own internal retries remain invisible to arc and are charged against the
run's clock without arc being able to attribute them — so a run can exhaust its time inside a single
attempt for reasons the receipt cannot explain. That opacity is inherent to hiring a contractor and
is recorded here rather than papered over. The adversarial pass must attack the *remaining-time*
arithmetic specifically, since a fresh-budget bug is invisible to a single-attempt test.

# ADR 1401 — DSV-B: the composer sees its own work — render-in-loop, ≤3 iterations, immutable receipts

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** self-review catch rate (defects fixed before critique / total critic
findings) stays at zero across a full explore — the loop is then costing captures and buying
nothing.

## Context

Through Cycle 3 the composer wrote a page and never looked at it. Every judgment about the
rendered result came from a different agent reading a screenshot the composer never saw. The
lane's own retro row for 2026-07-30 records the cost: five critique rounds, three blind
rankings, receipts and a sealed prediction, all built on pixels nobody in the session opened
— the owner looked once and scored the output 23/100.

## Options considered

1. **Composer stays write-only; a separate step renders and hands the PNG back** — pros: no
   new tool grant / cons: invents an orchestration layer, and the hand-back is another report
   about pixels rather than the composer's own eyes.
2. **Composer renders and reads its own PNG, through one scoped entry point** — pros: closes
   the loop where the work is done / cons: needs a Bash grant on an agent that has none.

## Decision

Option 2. `ui-composer` gains exactly one scoped Bash entry point —
`.claude/scripts/design/design-render.sh` and nothing else — and runs
compose → render → read own PNG with vision → revise, at most **3 iterations**.

Iteration outputs are **immutable**: `self-review/iter-N/{render.png, meta.json}`, plus a
per-variant manifest carrying input sha · output sha · defect claim · revision reason. The
claim *"iteration 2 fixed what iteration 1 found"* must be provable from the receipts, not
narrated in prose.

Receipts are **local files, not spine events**: the spine vocabulary is closed
([ADR-0026](0026-spine-c-closed-event-kind-vocabulary-v1.md)) and none of its kinds is a render
receipt, so this extends the renderer's existing JSON-sidecar pattern rather than forcing an
awkward kind reuse.

Cost stated plainly: the stable shutter captures twice, so ≤3 iterations × 3 variants is up
to **18 captures per explore**.

## Consequences

Easier: a defect the composer can see is fixed before it reaches the critic. Harder: explore
wall-clock and capture count roughly triple, and `ui-composer`'s iron law 1 — *"your directory
only"* — no longer describes an agent that must read `.claude/state/design/renders/`; see
[ADR-1415](1415-the-composer-iron-law-gains-a-read-path-allowlist.md).

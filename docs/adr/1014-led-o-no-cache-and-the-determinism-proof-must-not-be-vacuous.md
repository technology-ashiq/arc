# ADR 1014 — LED-O: `arc pnl` keeps no cache, and its determinism proof must assert which engine ran

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** a render of the real spine exceeds 5 seconds on the owner's box — the sqlite
accelerator path opens, gated by the equivalence test defined below.

## Context

LED-A makes ledger reader-only. That leaves a question the design source never answered: does
`arc pnl` write any on-disk state of its own?

It also leaves a trap. REQ-01's acceptance is stated as `rm derived -> arc-replay -> arc pnl`
byte-identical to golden. If `arc pnl` is stateless, that sequence does not test `arc pnl` at all —
it tests `arc-replay`'s rebuild, and the pnl render is along for the ride. A test that passes
without exercising the thing it names is the vacuous-pass shape this repo has shipped repeatedly:
retro 2026-08-03 (arc-develop) records three in one cycle, and retro 2026-08-12 (arc-memory)
records a gate that printed its own contract and compared against nothing.

Verified on this tree: the reader chooses between two engines (`.claude/scripts/hq/spine.mjs`,
`chooseEngine`) — `scan` reads the JSONL day files, `sqlite` reads `derived/state.db`, which
`arc-replay` rebuilds. `auto` prefers sqlite and **silently falls back to scan** when sqlite is
unavailable; an explicit `ARC_SPINE_ENGINE=sqlite` fails closed with `NO_SQLITE` / `NO_STATE_DB`.

## Options considered

1. **No cache; recompute every render; prove determinism by engine-equivalence plus rebuild.**
2. **Cache derived P&L on disk** — faster repeat renders, and it needs invalidation logic inside a
   three-day Phase 0, plus a second store to keep honest.
3. **No cache, and keep REQ-01's acceptance as written** — leaves the acceptance testing replay
   rather than pnl, which reads as covered while covering nothing.

## Decision

Option 1. `arc pnl` writes **no state of its own** and recomputes from the reader on every
invocation. `derived/` belongs to the spine (`idem.index`, `state.db`), not to ledger.

REQ-01's determinism proof is therefore **two assertions, not one**:

- **Engine equivalence** — `ARC_SPINE_ENGINE=scan arc pnl` and `ARC_SPINE_ENGINE=sqlite arc pnl`
  produce byte-identical output over the same fixture spine. This is the assertion that actually
  exercises the render.
- **Rebuild determinism** — `rm -rf derived/ && arc-replay && arc pnl` is byte-identical to golden.

And a **negative control on the control**: the equivalence test must assert **which engine each leg
actually used** (the reader reports it; `ARC_SPINE_DEBUG` prints `engine=`). Without that, a box
where sqlite is unavailable runs `scan` twice, compares a thing to itself, and reports the
equivalence gate green — the same output that a working gate produces. Where sqlite is genuinely
unavailable the test **skips loudly by name**, and never passes quietly.

The reason that carried the most weight: an accelerator is exactly the kind of change that would
break this silently later, so the gate that would catch it has to be provably able to fail now.

## Consequences

Easier: no invalidation logic, no second store, no cache-versus-cold-render divergence class. The
assumptions ledger already carries the render-time risk with a 5-second trigger.

Harder: every render pays full derivation cost, and the equivalence test needs a real sqlite-capable
leg in CI to be meaningful rather than skipped — so the skip is counted and visible, not silent.

If the 5-second trigger fires, the sqlite accelerator lands **behind** this equivalence gate, which
is the gate's whole purpose.

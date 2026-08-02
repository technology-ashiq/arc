# ADR 0066 — Risk-triggered checkpoints run inline at the slice boundary

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** measured ceremony cost per validated slice rises after checkpoints go live, or an
inline checkpoint is observed swallowing a failure that a separate invocation would have surfaced.

## Context

When a slice's diff touches a deterministic risk glob — `rules/security-sensitive.md` paths,
migrations, auth, public-API surface — DEV-I requires a checkpoint. The design source specifies the
trigger but not who invokes it, and §4 gives `checkpoint` its own lifecycle mode.

## Options considered

1. **Inline at the slice boundary** — `next` finishes proving the slice, then runs the checkpoint
   before selecting the next one. Same script, same receipt, same verdict owner; a failing checkpoint
   stops there. `/arc-develop checkpoint` stays callable standalone.
2. **Stop and require an explicit call** — `next` exits naming the trip reason and the exact command;
   the owner invokes `checkpoint` before continuing. Keeps the five modes strictly single-purpose and
   makes every checkpoint a deliberate act.

## Decision

Option 1, with `checkpoint` remaining a first-class standalone mode.

The one reason that carried the most weight: the identical script runs in both options, so the extra
forced invocation buys ritual, not rigor — and "ceremony cost per validated slice" is one of the
plan's own outcome metrics (§12), while process tax is risk #1 in its pre-mortem (§10).

Single responsibility is preserved where it actually matters: the checkpoint script owns its verdict
and emits its own receipt either way. What is being decided is which command invokes it, not who
decides the outcome — and that separation is exactly ADR-0047's "runner owns the verdict".

Owner decision, 2026-08-02, at kickoff step 2b.

## Consequences

Easier: risk-touching slices cost no extra round trip, which is where the work is already slowest.
The trigger cannot be forgotten, because it is not a message asking a human to remember something.

Harder: `next` sometimes does substantially more than "advance one slice", so its output must state
plainly when a checkpoint ran and why it tripped, or the run becomes unpredictable to read.

What we would revisit if this goes wrong: if inline checkpoints make `next` opaque, the fix is louder
output and a `--no-checkpoint` escape for deliberate deferral, before considering option 2.

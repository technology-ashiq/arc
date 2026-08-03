# ADR 0303 — EVO-C: the variant grammar extends `PROCESS_RE` backward-compatibly

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** one-way
**Revisit trigger:** a surface needs more than one variant axis at a time (e.g. a two-factor
experiment), which a single `+slug` suffix cannot express. That would need a new grammar ADR, not
an edit to this one.

## Context

Both arms of an experiment must be distinguishable in their receipts, or the verdict math cannot
attribute a measurement to an arm. The spine's `process` field is the natural carrier.

Verified at kickoff: `PROCESS_RE` is
`/^[a-z0-9][a-z0-9._-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/` at `.claude/scripts/hq/lib/validate.mjs:45`.
A `+variant` suffix is rejected today as `BAD_PROCESS`. The regex is **exported** and re-used by
`process-lint` (ADR-0200) specifically so the engine asserts against the same regex the spine
enforces — a copied regex is a regex that drifts, per the 2026-07-22 retro entry. Any change here
is therefore a change to two consumers at once.

This is marked one-way because every receipt already written carries a value matched by the old
grammar. A change that invalidated them would break replay irreversibly.

## Options considered

1. **A separate `variant` top-level event field.** Pros: no regex change. Cons: the closed key
   set `REQUIRED_KEYS` would grow for every event kind including those with no variant, and the
   arm would be absent from the one field that already identifies what produced the receipt.
2. **Encode the arm in the payload only.** Cons: payloads are per-kind; a cross-kind query for
   "everything champion produced" would have to know every payload shape.
3. **Extend the process grammar with an optional suffix.** Chosen.

## Decision

`PROCESS_RE` becomes `name@x.y.z(+slug)?` with slug `[a-z0-9][a-z0-9-]{0,31}`.

- **Legacy `name@x.y.z` values stay valid** — this is the load-bearing property. Every existing
  receipt continues to validate and replay unchanged, proven by re-running the existing spine
  fixtures after the change.
- The variant is **mandatory on experiment-attributed receipts** and absent elsewhere.
- **Tagging is symmetric**: the champion carries `+champion`, the challenger `+challenger-a`.
  There is no untagged-arm inference — an untagged receipt is not "the champion by default", it
  is a receipt that does not belong to an experiment.

Because `process-lint` shares the exported constant, it inherits the extension automatically;
the fix is applied to the constant, not to each consumer. The 2026-08-03 `arc-engine` retro entry
— the same defect fixed in one file surviving in its twin — is why the grammar is changed in one
place and then grepped for by pattern.

## Consequences

**Easier.** Arm attribution rides a field every receipt already carries, and cross-kind queries
work without knowing payload shapes. Symmetric tagging removes a whole class of "which one was
the control?" ambiguity from the verdict math.

**Harder.** A one-way door on a grammar shared by the spine and the engine: the backward-compat
fixture (a legacy value that must still pass) is the control that keeps it honest, and it must be
written before the regex is touched. A near-miss slug — wrong case, too long, leading hyphen —
must fail closed rather than be coerced, per the recurring markdown/regex pattern in the retro
log: tolerant detection, strict grammar.

# ADR 0911 — bench rides existing spine kinds only (BEN-H)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** spine ownership rejects the `run.completed` reading for a bench run — the
fallback is a **micro vocabulary ADR against the live `KINDS.length`** (the established
develop/policy/metric pattern), as its own deliberate decision, never an improvised kind.

## Context

The spine vocabulary is closed (ADR-0026) and extended only by explicit ADR. Verified
2026-08-12 by importing the module rather than reading a doc: **`KINDS.length` = 44**
(`.claude/scripts/hq/lib/validate.mjs:33-53`), and all three kinds bench needs are present —
`approval.requested` and `decision.recorded` at `:34`, `run.completed` at `:36`.

This is the one inherited contract from `PLAN-bench.md` that survived kickoff verification
intact.

## Options considered

1. **New bench-specific kinds** (`bench.completed`, `bench.proposed`) — expressive, and it
   extends a closed vocabulary for semantics the existing kinds already carry.
2. **Ride the existing three.**

## Decision

**Option 2. Zero new kinds.**

- A bench run is a `run.completed` with `process: bench@x.y.z`, carrying the `subject` and
  `fingerprint` blocks (ADR-0903) and eligible cost (ADR-0904).
- A proposal leaves `approval.requested` with gate `router-merge`; a drift finding leaves one
  with gate `drift`. Engine's own escalation-proposal receipts set this precedent (ENG-E).
- A human verdict is `decision.recorded` via `arc-inbox`, whose reason is schema-mandatory and
  whose idem is bound to the approval ULID.

All emits are first-party `--strict` (ADR-0031/0032). Evidence paths are POSIX-relative into
the lane's evidence dir. A baseline re-pin reason rides the establishing run's `run.completed`
payload (ADR-0908).

**Counts are derived, never hardcoded.** Bench reads `KINDS.length` from the module; several
plans still assert a stale 31, and ADR-0107 already made the derived count the rule.

## Consequences

**Easier:** bench is readable by every existing spine consumer on day one, and the inbox is
already its needs-you surface.

**Harder:** `run.completed` payloads must distinguish a bench run from an engine run — done by
`process: bench@x.y.z`, which is why the process name is in the payload rather than inferred.

**The trap this closes:** `docs/retro-log.md` 2026-08-02 (arc-develop) — *"a receipt emitter
reported success while every receipt was silently quarantined… the emitting command still
exited 0."* After wiring any emit, bench **looks in both `events/` and `events/_quarantine/`**
and confirms where the receipt landed; `arc-run.mjs`'s own `verifyLanded()` is the pattern to
copy. Exit 0 from a fire-and-forget writer is not evidence that anything was written.

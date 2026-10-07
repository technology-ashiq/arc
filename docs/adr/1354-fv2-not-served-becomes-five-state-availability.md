# ADR 1354 — FV2-V: "not served" becomes one five-state `Availability`

**Status:** accepted 2026-10-07 by the owner ("ok", after reading the routed change: three phases, 14 -> 15 -> 16)
**Lane:** face (Cycle 16) · **REQ:** REQ-19 · **Phase:** 15 · **Amends:** ADR-1324 (no facts bundle; `NOT SERVED` is now one of five states)
**Reversibility:** two-way
**Revisit trigger:** a source that failed renders as 0 or blank anywhere in the face; a fold defines its own state strings; a declared `not-applicable` reads `unknown` after an adapter throw.
**Bound by:** ADR-1324 · ADR-1305 (Tape as-of replay) · ADR-1320 (decisions live in `.mjs`)

## Context

ADR-1324 made `NOT SERVED` honest about a route the door does not serve, but it is binary. The Money, Ventures, Legal, Growth and Leads folds collapse four different truths into it, or into a 0: a source read with no records, a source that could not be reached, a field that does not apply, and a kind arc has no adapter for. The owner reading a 0 cannot tell "checked, zero" from "could not check", and a room verb can plan on a 0 that was a failure.

## Decision

1. One enum, `face/src/lib/availability.mjs`: `served` · `zero` (source read, no records; renders 0 with provenance) · `unknown` (source unreachable or failed; never 0, never blank; shows the failure class) · `not-applicable` (declared, never inferred) · `not-instrumented` (arc knows the kind or adapter does not exist). Every fold imports it; none redefines it.
2. Every non-served field returns `{ availability, source, owner_lane, as_of }`. `face-coverage`'s walker FAILs a fold that cannot name a `source`, from birth.
3. An adapter failure maps to `unknown`, never to `zero`; a declared `not-applicable` never flips to `unknown` on failure.
4. `NotServed` becomes one five-state component; it keeps `data-not-served` for the harness and adds `data-availability`.
5. Room headers count `unknown` and `not-instrumented` fields, so missing telemetry is a number on screen.
6. A room verb whose plan reads an `unknown` field refuses `FIELD_UNKNOWN`. Only the verbs listed in Phase 15's spec are gated.
7. Tape as-of replay reproduces every state byte-identically.

## Options considered

- **A. One shared enum (chosen).** One vocabulary across rooms and the inbox (Phase 16 reuses `unknown`).
- **B. Per-fold states.** Each fold names its own; the drift is the problem this ADR exists to stop.
- **C. Add only `unknown`.** Smaller, but `zero`, `not-applicable` and `not-instrumented` would still share a word with one another.

## Consequences

- Five room folds change shape; their modules' fixtures and the browser smoke grow a state count.
- `FIELD_UNKNOWN` is a new refusal code on the listed verbs; it is not a spine kind.
- Building the missing adapters and backfilling `as_of` stay with the owning lanes.

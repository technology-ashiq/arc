# ADR 1905 — DIS-E: the output is a `venture.yaml`, never an extended one

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way

## Context

Locked in the design source (DIS-E). Fired by the owner ruling (ADR-1900). launch reads exactly the fields of LAU-J (ADR-1710). v1's one-pager was a report, and a report is not a link in the chain.

## Options considered

1. **A one-pager.** Rich, but the owner re-types it into a profile.
2. **A `venture.yaml` with exactly the LAU-J fields, plus a sibling `<slug>.hunt.md` evidence file.**

## Decision

Option 2. The exporter writes `slug · type · region · payment_model · tenancy · ai · honesty_class · compliance[] · brand{name,domain}`, emitted by a serializer and never string-built. Anything else the hunt knows goes into `products/launch/ventures/<slug>.hunt.md`, linked from a yaml comment. Discover never adds a field to launch's contract. If launch rejects the output for a reason inside its own contract, that is a STOP routed through `/arc-change --lane launch`.

## Consequences

The acceptor is launch's own `loadProfile()` (ADR-1912).

# ADR 1505 — DOC-E: narrative lives in separate files, and absence is a legal state

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way

## Context

Locked (DOC-E). A marked region inside a generated page invites an edit beside it that the next
regeneration deletes.

## Options considered

1. **Marked hand-written regions inside generated pages** — "never edit this part" enforced by discipline.
2. **`docs/wiki/_narrative/<type>/<id>.md`, hand-written, optional** — "never edit generated pages" enforced by path.

## Decision

Option 2. The renderer includes a narrative file's text verbatim under its entity's page, below the
generated facts. A narrative file is never generated and never rewritten by any script. No
narrative file = the page renders with the `narrative pending` banner (ADR-1506).

## Consequences

`docs/wiki/_narrative/` is the only hand-edited path under `docs/wiki/`, and the dirty-diff check
(ADR-1504) excludes it by that one prefix. Orphan narratives are coverage failures (ADR-1503).

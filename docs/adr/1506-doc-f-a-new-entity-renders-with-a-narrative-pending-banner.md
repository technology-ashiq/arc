# ADR 1506 — DOC-F: a newly born entity is documented before anyone writes about it

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way

## Context

Locked (DOC-F). Silent absence is the failure this lane exists to prevent. Constitution E3
separates recorded absence from both estimate and fabrication.

## Options considered

1. **No page until someone writes one** — the new thing is invisible until remembered.
2. **A page from whatever is machine-readable, with a visible banner** — real declared facts, and a recorded "nobody has written the why yet".

## Decision

Option 2. Every page with no narrative file carries
`> **Narrative pending.** These are the entity's declared facts only; nobody has written why it exists yet.`
`wiki-coverage` counts such a page **covered** and reports the narrative-debt figure
(`N of M entities have no narrative`) on stdout and on the generated index page — a count, derived,
never a target.

## Consequences

REQ-04 is proven by a fixture product with zero hand-written input appearing with its manifest facts
and this banner.

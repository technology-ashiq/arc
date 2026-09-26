# ADR 1508 — DOC-H: no model-authored narrative ships

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** one-way
**Revisit trigger:** none inside this cycle. Reopened only by a separate owner decision, recorded as a new ADR, that names a verification method able to tell the 10% wrong from the 90% right by reading.

## Context

Locked (DOC-H), with the design source's Rabbit hole 1 as its reason: a model writes fluent pages
that are each ~90% right, and the 10% is indistinguishable from the 90% by reading. This repo's
false-comment class — the `review_by` comment stating ninety days against an ADR saying two weeks,
the termination spec false twice in one comment, the `hosted: local` field that stopped being true
— were single lines, and each cost real time. Thirty pages of them would carry arc's authority.

## Decision

Narrative is hand-written or absent. A model is allowed for extraction (deterministic,
gate-verified), for draft *assistance* a human accepts line by line, and for bulk mechanical work.
Never for unattended prose that ships. The three Phase 03 narratives (`engine`, one thin product,
one sleeper lane) are written or line-accepted by the owner; if that cannot happen inside the
appetite, those files stay absent and the pages ship with the pending banner — absence is legal
(ADR-1505), fabrication is not.

## Consequences

Narrative coverage grows at human speed, and the narrative-debt count (ADR-1506) makes that visible
rather than hidden. The design source's note on a cheap-model trial applies to extraction only.

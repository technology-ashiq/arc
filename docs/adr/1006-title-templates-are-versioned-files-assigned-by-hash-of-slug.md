# ADR 1006 — Two title templates, versioned as files, assigned by `hash(slug)`, tagged in the payload

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** evolve opens a real experiment on this surface — at that moment EVO-C's
`name@x.y.z(+slug)` variant grammar takes over the arm naming, and `template_id` becomes the
thing evolve seals a `base_sha` against. Changing the assignment function after any receipt
exists re-assigns published articles and breaks replay, so it is one-way from the first publish.

## Context

REQ-04 wants an A/B slot that is **dumb on purpose**: the machinery that lets evolve run an
experiment later, with none of the optimization logic that would make growth a second, competing
evolve. GRO-D fixes the shape; this ADR pins the mechanics so replay is deterministic.

Evolve's own numbers set expectations honestly. `PLAN-evolve` REQ-04 derives a per-arm floor of
**~1,900 trials** for a CTR 3% → 4.5% detection at 80% power. This cycle publishes ten articles —
five per arm. So this slot **cannot** produce a verdict inside this cycle, and will not for a long
while after; it exists to make the data *collectable*, not to decide anything.

## Options considered

1. **Two templates as versioned files + deterministic `hash(slug) → template` + `template_id` in
   the payload.**
2. Human picks the template per article. Con: a cherry-picked assignment is not random with
   respect to the article, so the arms are confounded by whatever made the human choose — the data
   would be uninterpretable by evolve later.
3. Random assignment at publish time. Con: not replayable; re-deriving the board from the spine
   would produce a different assignment than the one that shipped.

## Decision

**Option 1.** `initiatives/growth/templates/title-a.md` and `title-b.md`, versioned files.
Assignment is `sha256(slug)` reduced to one of two arms — a pure function of the slug, so a
replay re-derives the same arm for every article that ever published, and no human can move an
article between arms without changing its slug (which changes its URL, which is already a visible
act).

`template_id` is a **payload field** on `content.published` (ADR-1001), not an inference from the
title text. A receipt missing the tag is rejected. The `+variant` process grammar stays evolve's
(EVO-C) and growth never emits it.

Growth emits **no `experiment.*` events, ever** — that is evolve's stream, and the two are never
summed (ADR-0302's stream contract).

**Honest limit, stated in `PLAN.md` and not only here:** five articles per arm against a
~1,900-per-arm floor means this cycle produces a *collectable* stream and **no verdict**. Anyone
reading a CTR difference between the arms during this cycle is reading noise.

**Evidence:** `PLAN-evolve` REQ-04 (floor derivation, ~1,900/arm) · EVO-C (variant grammar stays
evolve's) · `docs/adr/0302-*` (stream contract) · design source REQ-04, GRO-D.
**Confidence:** high.
**Rejected because:** option 2 confounds the arms at the source; option 3 is unreplayable.

## Consequences

Easier: evolve's first surface arrives pre-shaped, and the assignment is auditable from the slug
alone. Harder: the surface will sit in `PENDING` on evolve's board for months, which is the
correct rendering of insufficient data and must not be mistaken for a broken feed.

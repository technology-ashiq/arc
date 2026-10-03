# ADR 1417 — The stale-duplicate guard must tell an iteration from a stale page

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** the guard refuses a render that a human confirms was a genuine fresh
navigation — the discriminator is then wrong and needs a stronger signal than route identity.

## Context

`design-render.sh` carries a stale/duplicate guard (~L323). It loops over **every** `*.json` in
the flat output directory and, when it finds the same `screenshot_sha256` recorded under a
**different route name**, it **refuses and deletes the PNG and its meta**. Its comment states
the reasoning: *"the same pixels under two different route names means one of them did not
actually render — almost always a stale page the browser never navigated away from. Identical
pixels for the SAME route are expected and fine."*

That reasoning is correct today and becomes dangerous under
[ADR-1401](1401-dsv-b-the-composer-sees-its-own-work.md). The self-review loop renders the same
variant repeatedly across iterations, and its single most valuable signal is
**"my revision changed nothing visible"** — identical pixels across two iterations. Under
[ADR-1402](1402-dsv-c-the-renderer-is-session-safe-before-anything-runs-in-parallel.md) each
iteration writes to its own immutable path, so those renders are no longer the same
`$META` file the guard skips over.

The result, if nothing is done: the loop's most important finding is classified as a browser
fault, refused, and **the evidence is deleted**. A no-op revision would be indistinguishable
from a crash.

This is the shape [ADR-0049](0049-constraints-caused-the-convergence-freedom-restored.md) and
the lane's 2026-07-30 retro row both warn about — a normalisation or guard added for
measurement destroying the property being measured.

## Options considered

1. **Exempt the self-review tree from the guard entirely** — pros: one line / cons: turns the
   guard off exactly where renders are most frequent, and a genuine stale page inside a loop
   would then pass silently.
2. **Compare on (route, session) rather than route alone** — pros: keeps the guard live
   everywhere; same route + same session + same pixels is an iteration, same pixels under a
   *different route* is still a stale page / cons: needs `session` in the meta, which it does
   not carry today.
3. **Drop the guard** — rejected outright; it was added for a real pre-mortem risk and has no
   replacement.

## Decision

Option 2. The meta gains the render's **session id**, and the guard's discriminator becomes the
pair **(route, session)** rather than route alone. Same pixels under a different route stays a
refusal; same pixels for the same route in the same session is an **iteration**, recorded as
such with an explicit `unchanged: true` on the iteration receipt.

"Nothing changed" becomes a **first-class recorded outcome** of a self-review iteration rather
than an error. That is the signal the loop exists to produce.

## Consequences

Easier: the loop can report a wasted iteration honestly, and the guard keeps protecting every
other path. Harder: the guard is now a gate whose behaviour depends on a field that must always
be present — a meta written without a session must **fail closed**, not fall through to the old
route-only comparison, or this ADR silently reverts. That negative control is a Phase 00
fixture: a meta with a missing session must refuse, and it must be attacked by an agent that did
not write the guard.

## Amendment 1 (2026-10-03, Phase 03 close) -- a retry repeats the recipe

The Phase 03 S5 live explore could not be critiqued. The composer renders a variant in explore
mode, whose recipe adds `confined-loopback` (ADR-1418). The critic then renders the same page in
critique mode under its own session. The two are byte-identical by design, and the cross-session
case read them as a crash-retry and refused, so nothing could critique an explore variant after
its composer had rendered it.

A crash-retry runs the same recipe again under a fresh session id. A render under a different
recipe is a second look at the page, and matching pixels are what it should produce. Case 3 now
lets through exactly one pair: two recipes that differ by the explore transport token
`;confined-loopback` and nothing else. Any other difference, and an empty or unreadable recipe,
still refuses, failing closed the way a meta with no session does. The first draft allowed any
non-empty difference; the attack on it (9ea7d9b, B2) showed that let a whitespace or arbitrary
recipe through. The cross-route case and the iteration case are unchanged. Pinned in
`tests/design-render-session.bats`, with a same-recipe fresh-session render as the control.

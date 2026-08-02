# ADR 0107 — Spine vocabulary 21 → 22: `slice.stuck`

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** a fifth develop kind is proposed. Three extensions inside one cycle would mean
the grain is wrong and the set should collapse to one `develop.*` kind with a typed payload.

## Context

ADR-0106 extended the closed spine vocabulary from 18 to 21 for develop's lifecycle, and recorded
its own revisit trigger: *"a fourth develop lifecycle event needs a kind."* Phase 03 needs one.

The stuck protocol tracks a normalised error fingerprint and an attempt count per slice, and escalates
on deterministic backstops — the same fingerprint three times, or five attempts on one slice. Every
one of those escalations has to leave a receipt, because the whole reason the protocol exists is that
**where a build bleeds time is invisible afterwards unless something recorded it.** `/arc-retro`
reads the spine to find out where the hours went; a stuck event that emits nothing is a stuck event
that never happened as far as any later analysis is concerned.

There is no honest existing kind. `incident.raised` is for incidents, and a slice needing a third
attempt is not an incident — it is normal work being harder than expected, which is exactly the
signal worth keeping.

## Options considered

1. **Extend to 22 with `slice.stuck`** — the trigger ADR-0106 wrote down has fired, and this is the
   mechanism it named.
2. **Reuse `incident.raised`** — no vocabulary change, but it inflates every stuck slice into an
   incident, and a channel that cries incident on ordinary friction stops being read.
3. **Fold it into `slice.done` with a `stuck: true` payload** — but a stuck slice is frequently one
   that is NOT done, so the receipt would have to lie about the thing it is named after.
4. **Emit nothing; keep stuck state local** — `.claude/state/develop/` is disposable by design, so
   the counters would vanish between sessions and the retro would have nothing to read.

## Decision

Option 1. `slice.stuck` joins the vocabulary, which is now closed at **22**.

Payload carries the lane, the slice id, the normalised fingerprint, the attempt count, and which
backstop fired (`fingerprint-3x` or `attempts-5`). The fingerprint is normalised — paths, line
numbers and hex addresses stripped — so the same failure recurring is recognisable across runs
without the payload carrying anything machine-specific.

The count in the validator's error message stays derived from `KINDS.length`; it was hand-typed as
"18" once and went stale the moment ADR-0106 landed.

## Consequences

Easier: `/arc-retro` can answer "which slices cost the most attempts, and were they in one area?"
from committed receipts rather than memory. That is the raw material for the calibration record.

Harder: this is the second extension in one cycle. Two is a pattern worth watching, which is why the
revisit trigger above is set at the third — if a fifth kind is proposed, the right move is to
collapse `develop.*` into one kind with a typed payload rather than keep growing a closed set.

What we would revisit if this goes wrong: if stuck receipts prove too noisy to read, the fix is a
threshold on emission (only the backstop firings, not every attempt), not a retreat to local-only
state that no retro can see.

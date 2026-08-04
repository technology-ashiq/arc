# ADR 0408 — leads is evolve's first client: it ships EVO-H0's vocabulary, not evolve's clock

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads` (with a flagged deviation back to `docs/strategy/plans/PLAN-evolve.md`)
**Reversibility:** two-way
**Revisit trigger:** `growth` is born and runs a real campaign before leads does — then
growth, not leads, is the first client whose receipts start the 4-week window.

## Context

`ADR-0308` rules that **EVO-H0 lands in the FIRST CLIENT's cycle** — the `metric.observed`
vocabulary, closed-payload validator, idem formula, `source_id` grammar and fixtures — and
that evolve never bootstraps its own trigger (`ADR-0300`). `PLAN-evolve` pins that
obligation to `growth`. `PLAN-leads` (LEA-I) says: if leads reaches kickoff first, the pin
moves, by owner ruling recorded at kickoff.

**leads has reached kickoff first.** `growth` does not exist as a lane. The kickoff prompt
left the ruling as an unfilled placeholder, so it is resolved here from what is already on
the record rather than left open.

The complication the design source could not have known: **this cycle's Phase 3 (the real
campaign) is BLOCKED** on the pre-kickoff gate (`ADR-0413`). So leads will ship the
vocabulary but will emit no real campaign metrics.

## Options considered

1. **Leave the pin on growth** — pros: no scope added here. cons: growth does not exist;
   the obligation is pinned to a lane with no birth date, and evolve stays un-feedable.
2. **Adopt EVO-H0 fully, and count this cycle as starting the 4-week clock** — cons:
   dishonest. There are no real receipts, so there is no window to count.
3. **Ship the vocabulary now; the clock starts at first real send.**

## Decision

**Option 3.** Split what the design source treated as one obligation:

**Ships in leads Phase 0 (buildable offline, ~0.25d):**
- `metric.observed` added to `KINDS` alongside the `ADR-0400` pipeline kinds
- closed-payload validator: `(module, surface, variant?, cohort?, metric, value, unit_count,
  window_start, window_end, source_id)`
- idem total-preimage per the frozen spec, absent optionals as a literal `-`
- `source_id` grammar + fixtures
- stream contract fixture: `metric.observed` is the client feed aggregate; it is never
  summed with `experiment.measured`

**Does NOT ship, and is not claimed:**
- the ≥4 weeks of real receipts that satisfy evolve's trigger row 2. **The clock starts at
  the first real send, not at this merge.** Until then evolve's baseline panels correctly
  render `MISSING`, which is `REQ-02`'s specified behaviour for absent data.

**Deviation flagged back to `PLAN-evolve`, as `ADR-0308` requires:** the frozen spec's
`source_id` grammar allows `h-<sha256-hex16>` for anything derived from URLs/emails/user
data. Leads-derived source_ids instead use `ADR-0400`'s **keyed** `lead_hmac_v1_<hex32>`
form, because a bare hash of a low-entropy email is dictionary-attackable on a
soon-to-be-public spine. The validator therefore accepts **both** grammars. This is a
deliberate, scoped widening, not a detail mismatch.

**Confidence:** high — every element is transcribed from a frozen spec that is quoted, and
the split is forced by an observable fact (Phase 3 is blocked).

**Rejected because:** Option 1 — pins an obligation to a nonexistent lane. Option 2 — would
claim a window that has no receipts in it.

## Consequences

**Easier:** evolve's dependency stops being hypothetical. When a real campaign eventually
runs, the connection is config and a feed, not a build — exactly what `ADR-0300` predicted.

**Harder:** leads carries ~0.25d of scope that serves another lane, inside a 7-day appetite.
Accepted: it is the cheapest part of this cycle and the highest-leverage for the company.

**Sharp edge:** the fixtures written here encode leads' *guess* at the real feed's shape. If
the eventual real campaign deviates, the fixtures are wrong in a way no test in this lane
can detect. That is the same risk `ADR-0300` already ledgers from evolve's side, now
symmetric.

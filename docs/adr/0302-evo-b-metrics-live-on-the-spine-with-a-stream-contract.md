# ADR 0302 — EVO-B: metrics live on the spine, and two streams are never summed

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** two-way
**Revisit trigger:** board rendering from the reader exceeds a usable latency budget at real
receipt volume, or a client's metric genuinely cannot be expressed as a receipt.

## Context

Outcome metrics have to live somewhere. Constitution A5 and the spine's existing design say the
spine is the store and everything else is derived. The alternative — a metrics database — would
create a second source of truth whose disagreement with the spine nobody would notice.

There is a subtler trap. Two different things both look like "a measurement": the client's
aggregate/baseline feed, and an experiment-attributed unit measurement. Summed together, a board
double-counts and a verdict reads inflated trials.

## Options considered

1. **A metrics DB or warehouse.** Pros: query ergonomics. Cons: a second store to reconcile; the
   board stops being replayable, which kills REQ-02's byte-identical property.
2. **One metric stream for everything.** Cons: the board cannot tell a baseline datum from an
   experiment datum, so either it double-counts or it guesses.
3. **Two named streams on the spine, never summed.** Chosen.

## Decision

Metrics are spine receipts, consumed reader-only. Two streams with a hard contract:

- **`metric.observed`** — the client feed aggregate/baseline. Feeds the trigger and the board's
  baseline panels. **Owned by the client's cycle (ADR-0308), not by evolve.**
- **`experiment.measured`** — experiment-attributed unit measurement. Feeds the verdict math
  **only**.

**One datum, one stream. The board never double-counts** — proven by a fixture that puts data on
both streams for the same surface and asserts the panels stay separate.

Three hygiene rules ride along:

- **Idem = total preimage.** `sha256("metric.observed|module|surface|variant|cohort|metric|window_start|window_end|source_id")`,
  absent optionals as a literal `-`. Champion and challenger in the same window can never
  collide. This is designed directly against the `cycle2-receipt-spine` failure of 2026-07-28,
  where an idem preimage carrying no time silently discarded 100 real receipts.
- **`source_id` grammar** is `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`, or `h-<sha256-hex16>` for
  anything derived from URLs, emails or user data. Raw URLs and PII never land on the spine.
- **Window completeness is strict.** A window is COMPLETE only after idempotent emission
  succeeds. Failed, pending or spooled leaves it `MISSING` — never zero.

Corrections ride `supersedes`; nothing is ever overwritten. Manual CSV ingestion is acceptable
for v1; analytics-API fetchers are a separate pull-trigger later.

## Consequences

**Easier.** The board is a pure function of the spine, so REQ-02's replay-identical property is
reachable. Nothing needs backing up separately.

**Harder.** Every metric must be expressible as a closed-payload receipt, and the two-stream rule
is a discipline the code must enforce rather than a convention a reader remembers. The
double-count fixture is the control that makes it real.

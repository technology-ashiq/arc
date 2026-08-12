# ADR 0904 — cost eligibility without a pricing snapshot: a ceiling bounds spend, it never reports it

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** a repo-wide pricing snapshot lands (engine, executor or ledger) — bench
then derives eligible cost from it and the ceiling file reverts to a pure safety bound.

## Context

BEN-E sets caps of **₹500 per run / ₹100 per process**, self-labelled placeholders to be
"re-priced at kickoff against the then-current pricing snapshot". BEN-B and REQ-01 require
median **cost (INR)** per fixture, under the eligible-cost rule: provider usage × pinned
pricing snapshot = derived; neither available → absent, never estimated (ADR-0069 b(5)).

Verified 2026-08-12: **no pricing snapshot exists anywhere in the repo**, and never has.
`grep 'pricing snapshot'` hits exactly one file — `PLAN-bench.md` itself. The eligible-cost
rule is implemented in no code. ADR-0069's own metric 1 records the gap: *"Per-item attribution
does not exist today… Not computable until the engine provides it."*

What *does* exist is a per-run cost sidecar: a driver writes `{tokens_in?, tokens_out?, inr?,
source}` to `$ARC_DRIVER_COST_FILE`, and `arc-run.mjs:231-248` treats it all-or-nothing —
returning no cost flag and demoting token counts into the payload rather than fabricating an
INR figure.

There is a real trap here. BEN-E's admission control must reserve **K × worst-case
per-invocation spend BEFORE a fixture group starts**, because provider cost is only known after
a call. That reservation needs a rupee number the moment there is no snapshot to derive one
from — and the tempting move is to invent one and let it leak into the receipt as a cost.

## Options considered

1. **Bench authors and owns a repo-wide pricing snapshot** — real cost attribution, but bench
   becomes the maintainer of a cross-lane artifact with its own staleness surface, which no
   part of its mandate covers.
2. **A bench-local ceiling file used only as a pre-call bound**, with eligible cost derived
   solely from what a driver actually reports, and absent otherwise.
3. **Block on engine/executor producing the snapshot** — contradicts ADR-0900.

## Decision

**Option 2**, with one rule that carries the whole ADR:

> **A ceiling bounds spend. It never reports it.**

Concretely:

- `initiatives/bench/ceilings.json` declares, per `driver` + `model`, a **worst-case INR per
  invocation**. It is a safety bound, hand-authored, with an `as_of` date, and it is the ONLY
  input to BEN-E's `K × worst-case` reservation.
- **A ceiling may never be written into a `run.completed` payload, a scorecard cost column, or
  a proposal row.** Those carry only what the driver reported. If the driver reported nothing,
  cost is **absent** — never zero, never the ceiling, never interpolated (ADR-0069 b(5),
  Constitution E3).
- A class whose cost is absent is **not cost-eligible**, so BEN-A's cost tiebreak does not run
  for it. Quality comparison still runs — the two axes are split precisely so this is possible
  (ADR-0908).
- Caps stay **₹500 / ₹100**. They were never priced against a snapshot, so there is nothing to
  re-price against; they are re-derived from `ceilings.json` at Phase 0 and adjusted then if
  the arithmetic says a full run cannot fit.

## Consequences

**Easier:** admission control is real on day one and cannot be blocked by a missing company
artifact; bench invents no prices.

**Harder:** with only `claude-code` pinned in `engine/router.yaml`, most runs will report token
counts without INR, so **cost will frequently be absent and the cost tiebreak will frequently
not run**. That is the honest state of the instrument, and reports say so rather than showing a
confident number derived from nothing.

**The trap this closes:** a ceiling that leaks into a receipt is exactly ADR-0069 b(5)'s
"estimated" — *"an absent field is a fact about the instrument; an estimated one is a lie with
a decimal point."* Phase 0 pins a negative-control test that a ceiling value never appears in
any emitted payload.

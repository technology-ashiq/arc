# ADR 1004 — LED-E: spine vocabulary 44 → 45: `month.closed`, on IST boundaries, never restated

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** one-way
**Revisit trigger:** the first `month.closed` event that has to be superseded — if a month is ever
re-closed in practice, the freeze is not a freeze and the correction model below is wrong.

## Context

The event-kind vocabulary is closed (`ADR-0026`,
`docs/adr/0026-spine-c-closed-event-kind-vocabulary-v1.md`): an unknown kind is rejected as
`UNKNOWN_KIND` and quarantined. Adding a kind is a deliberate, ADR-gated act, following the
micro-vocab precedent set by `ADR-0107` (`docs/adr/0107-spine-vocabulary-22-slice-stuck.md`),
whose rule is that the count is stated against the **live** `KINDS.length` and never hardcoded.

**Measured on this tree, 2026-08-12: `KINDS.length` is 44, and `month.closed` is absent.** This
ADR takes the vocabulary from **44 to 45**. The design source `docs/strategy/plans/PLAN-ledger.md`
says "22 → 23" throughout; that figure was correct at an earlier draft and is stale — which is
precisely the failure mode ADR-0107's derived-count rule exists to prevent, reproduced by the
document that cites it. The number above was read from `.claude/scripts/hq/lib/validate.mjs`, not
from any plan.

A month must be able to stop moving. Without a freeze, every number in a P&L is provisional
forever and no one can be held to last quarter's figures — including the owner, by himself.

## Options considered

1. **`month.closed` event carrying the summary plus file shas** — the `day.closed` pattern at
   month scale; the freeze is itself a receipt, replayable and tamper-evident.
2. **A `closed-months.yaml` marker file** — no new kind, and the freeze then lives outside the
   only store that is append-only, in a file anyone can edit with no receipt.
3. **No freeze; always recompute** — simplest, and it means a refund in November silently rewrites
   September's reported net.

## Decision

Option 1. `arc pnl --close YYYY-MM` emits **one** `month.closed` event carrying the month summary
and the shas of the reconciliation inputs. Boundaries are **IST** (`+05:30`), matching the
timestamps events already carry.

**Post-close corrections book into the month they are recorded, never the month they concern.** A
closed month never restates: a fixture asserts that a post-close refund leaves the closed month's
bytes unchanged and appears in the current month.

The reason that carried the most weight: a number that can silently change is not a number anyone
can act on, and kill-distance decisions are acted on.

## Consequences

Easier: "what did September say" has exactly one answer forever. The close is a human ritual with
a green gate in front of it (LED-F, ADR-1005), so freezing is a deliberate act, not a cron job.

Harder: the correction model has to be taught, because booking a November refund into November
feels wrong to anyone expecting accrual accounting. This is management truth, not tax books — the
no-gos say so.

Adding the kind touches `KINDS` in `.claude/scripts/hq/lib/validate.mjs`. Retro 2026-08-02
(arc-develop) records an emitter reporting success while every receipt was quarantined as
`UNKNOWN_KIND` at exit 0 — so wiring this kind is not done until `events/` **and**
`events/_quarantine/` have both been listed and the receipt found in the first.

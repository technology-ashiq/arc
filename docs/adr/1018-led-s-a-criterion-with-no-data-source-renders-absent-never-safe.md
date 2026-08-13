# ADR 1018 — LED-S: a criterion with no data source renders ABSENT, never safe and never crossed

**Status:** accepted
**Date:** 2026-08-13
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** ledger gains a real traffic source, or a venture-start fact lands on the spine
— either one converts a permanent ABSENT into a real observation and this ADR should be re-read
before the conversion is wired.

## Context

`ventures.yaml` v1 ships exactly two criteria (ADR-1008): `days_without_revenue` and
`traffic_floor_monthly`. Building the render exposed that **ledger can only observe one of them.**

- `traffic_floor_monthly` has **no data source in this lane at all**. Ledger reads money.
  `metric.observed` exists in the closed vocabulary, but it is a **leads** kind with a
  leads-scoped `module`/`surface` vocabulary and leads PII rules; reading it here would make the
  money brain reinterpret another lane's receipts, which no ADR or PLAN line authorises.
- `days_without_revenue` is observable **only for a venture that has had revenue.** For a venture
  that never has, the clock has no zero: ledger does not know the venture start date, and no
  event on the spine carries it.

So on the day this ships, `lexos` has one criterion that cannot be evaluated at all and a second
that cannot be evaluated until its first rupee lands.

## Options considered

1. **Absent renders as a safe value** — 0 days without revenue, or traffic above the floor.
   Cheapest, and it is the exact failure ADR-1008 names: *"a criteria parser that accepts a
   malformed line is a criteria parser that silently disables a kill switch."* A criterion that
   reports OK because nothing was measured is the same switch disabled one layer further down,
   and it reports OK forever.
2. **Absent renders as crossed** — fail-shut, superficially the safe direction. It cries wolf on
   day one for every venture, and a kill meter that is always red is a kill meter that gets muted.
   The failure mode is delayed, not avoided.
3. **Absent is its own status, carries a mandatory reason, and is counted.**
4. **Drop `traffic_floor_monthly` from v1 until a source exists.** Tempting, and it deletes the
   evidence: the file would then show only the criteria that happen to be measurable, and nobody
   would ever be reminded that a declared kill line is unmeasured.

## Decision

Option 3. `ABSENT` is a first-class status beside `OK`, `WARNING` and `CROSSED`. It carries a
**mandatory human-readable reason** naming why there is no observation, it is **rendered rather
than dropped**, and the count of absent criteria is surfaced so the reader sees
"2 criteria could not be evaluated" instead of a short list that looks complete.

Absent **blocks nothing** — it is not a crossing and raises no needs-you item, because a
needs-you item that fires on missing data trains the reader to dismiss needs-you items. It is
**visible**, which is the entire point: an unmeasured kill line should look unmeasured.

This is the lane's own inherited non-negotiable applied where it was written to apply — *"Absent
stays absent: nullable-cost honesty end to end, with `source` surfaced on every cost line"*
(MP-F, ADR-1006). A kill criterion is a cost line's twin: both are numbers whose absence is
information.

The reason that carried the most weight: option 1 and option 4 both produce a screen where every
visible line is green, and they produce it for opposite reasons. Neither reader can tell that
screen from a healthy venture.

## Consequences

Easier: the render is honest on day one, and the two absences are self-documenting — the reason
string tells the next reader exactly which fact is missing and why nobody can compute it yet.

Harder: `arc pnl` ships with a visibly incomplete kill panel, which will read as unfinished work
to anyone who has not read this ADR. That is the correct impression: it IS incomplete, and the
incompleteness is in the data, not the code.

Phase 03's real-spine replay must therefore expect ABSENT rows and assert them, not treat them as
a defect — this is the second half of that phase's honest-empty acceptance, and the retro record
of a zero explained away for four days (2026-07-28) is why it is written down before the render
exists rather than after someone argues with it.

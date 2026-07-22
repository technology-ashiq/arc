# BRIEF — ledger module (the money brain)

> **Trigger (pull):** ≥2 revenue sources make the event-level view insufficient.
> **Prereqs:** spine with real `revenue.received` flowing (Cycle 2 REQ-03 built the
> ingest; this module builds the VIEWS).

**Goal:** per-venture P&L truth from the spine — MRR/one-time split, churn, AI-cost
attribution, and **kill-distance meters** (how far each venture sits from its own kill
criteria) — rendered in the brief and as `/arc-pnl`, all derived, all rebuildable.

**REQs (measurable):**
1. `arc pnl [venture]` renders revenue (real only — `revenue.simulated` excluded by
   construction, fixture-proven), costs (AI spend from run events + declared fixed costs),
   net, per month — byte-reproducible from JSONL replay.
2. MRR math correct on fixtures: new/expansion/churn transitions each covered by a pinned
   case; refunds handled (negative events via supersedes discipline, never edits).
3. Kill-distance: each venture's kill criteria live in `ventures.yaml` (days-without-
   revenue, traffic floor…); `arc pnl` shows distance-to-line; crossing → needs-you item
   in the brief automatically.
4. Currency honesty: INR + one foreign currency handled with explicit rate source +
   rate-date on every conversion (no silent rates).
5. Month-close ritual: `arc pnl --close YYYY-MM` freezes a month summary as an event
   (day.closed pattern at month scale) — the number can never silently change later.

**Appetite:** 1 week.
**Phases sketch:** 0 pnl math on fixtures (adversarial: refund/partial/dup cases) →
1 kill-distance + ventures.yaml + brief integration → 2 month-close + real month replay
→ retro.

**Non-negotiables/no-gos:** derived-only (delete state → replay → same P&L) · reader-only
access · simulated revenue excluded structurally · no accounting-software ambitions (this
is management truth, not tax books — GST/tax stays with the CA/tools) · no forecasting v1
· no dashboards (text first; HTML dashboard consumes the same reader later).

**Pre-mortem top-3:** (1) money math wrong = trust dead → fixture-first development, every
edge pinned (refund, partial, cross-day dup, currency); (2) fake precision on costs →
nullable-cost honesty carried through (source field surfaced); (3) kill-distance ignored →
it lands in needs-you, not buried in a report.

**Open decisions at kickoff:** fixed-cost declaration format · FX rate source · month-close day.

**Kickoff prompt:**
```
/arc-kickoff ledger module — the money brain
Design source: docs/strategy/plans/BRIEF-ledger.md (trigger: <N> revenue sources live).
Expand to full PLAN; REQs locked; fixture-first non-negotiable. STOP after PLAN + specs
for my approval.
```

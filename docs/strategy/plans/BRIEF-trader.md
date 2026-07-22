# BRIEF — trader sandbox (permanently special)

> **Trigger (pull):** stable monthly revenue exists from real ventures AND Ashiq
> explicitly opens this lane in writing. **Neither alone suffices.** **Prereqs:** spine ·
> policy engine (trader gets its own separate policy file) · ledger (so its costs are
> visible). Constitution E2: real-money trading is never delegable; this brief builds a
> RESEARCH SANDBOX, not an income stream. Expectation set honestly: retail algo trading
> is negative-sum after costs — score as income: 2/10. This exists to satisfy curiosity
> with receipts instead of losses. (Not financial advice; the sandbox's whole point is
> that no advice is trusted without evidence.)

**Goal:** a fully isolated paper-trading research loop — strategies as declarative specs,
walk-forward simulation on historical + live-paper data, honest metrics (after realistic
costs/slippage), everything an event in trader's OWN stream — with the real-money path
locked behind a handwritten policy edit + 72h cooldown + hard caps + circuit breaker.

**REQs (measurable):**
1. Isolation proven: own instance dir, own event stream (HQ merges read-only), own creds
   (none shared), own `trader.policy.yaml`; a lint proves trader code cannot import/emit
   into other modules' queues (fixture).
2. Strategy spec → deterministic backtest: same data snapshot + spec → identical results;
   costs/slippage/fees modeled explicitly (config, surfaced in every report).
3. Overfitting guards in code: train/validate/walk-forward split enforced; a strategy
   evaluated on its training window FAILS the report lint; min-trade-count floor.
4. Paper-live loop: ≥30 consecutive days paper trading with daily events + weekly report
   into the brief's background group; drawdown circuit breaker fires in sim (fixture).
5. Real-money gate (build the LOCK, not the trading): activation requires (a) handwritten
   edit to `trader.policy.yaml` by Ashiq, (b) 72h cooldown before effect (enforced by
   timestamp check, fixture-proven), (c) hard caps (max capital, max daily loss →
   auto-L0), (d) `decision.recorded` event. v1 ships with this path PROVEN LOCKED —
   attempting real orders without all four = blocked + incident (fixture).

**Appetite:** 1 week for the sandbox. Real-money unlock is NOT a phase of this or any
plan — it is a separate future decision Ashiq makes alone.
**Phases sketch:** 0 isolation + spec format + backtester (adversarial: lookahead-bias
and data-leak fixtures) → 1 paper-live loop + reports → 2 the lock (REQ-5) red-teamed →
30-day paper run (elapsed, background) → retro with honest verdict.

**Non-negotiables/no-gos:** E2 absolute · no real orders in v1 code paths at all (the
lock is tested against a stub broker) · no strategy marketplace/copy-trading · no
leverage modeling v1 · no crypto-degen presets · costs modeled pessimistically · verdict
reporting is Truth-Law honest (a losing sim is reported as losing, never reframed).

**Pre-mortem top-3:** (1) backtest overfit looks like alpha → walk-forward + floors in
code + pessimistic costs; (2) excitement erodes the lock → 72h cooldown exists exactly
for this, plus the written-trigger requirement; (3) sandbox quietly consumes serious
build time → appetite cap + background-elapsed design + ledger visibility of its costs.

**Open decisions at kickoff:** market/instrument scope for paper data · data source ·
report cadence.

**Kickoff prompt:**
```
/arc-kickoff trader sandbox — isolated paper-trading research
Design source: docs/strategy/plans/BRIEF-trader.md. BOTH triggers must be true (monthly
revenue + my written opening of this lane) — verify, else STOP. Expand to full PLAN;
isolation, overfitting guards, and the locked real-money gate are non-negotiable.
STOP after PLAN + specs for my approval.
```

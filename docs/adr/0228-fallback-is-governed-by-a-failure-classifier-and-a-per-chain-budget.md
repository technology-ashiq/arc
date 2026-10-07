# ADR 0228 — Fallback is governed by a failure classifier and a per-chain budget (ENG-H)

**Status:** accepted
**Date:** 2026-10-07
**Product:** engine
**Reversibility:** two-way
**Revisit trigger:** a real dispatch fails in a way none of the six classes describes honestly, so a driver has to
declare `unknown` for a failure an operator can name. That is the signal to grow the enum here, never to map the new
shape onto the nearest existing class.

## Context

Locked in the design source `docs/strategy/plans/PLAN-engine-process-layer.md` § Amendment 1 (ENG-H), routed by
`/arc-change --lane engine` on 2026-10-07 and kicked off as engine Cycle 8.

`engine/router.yaml` gives each class a `fallback:` list, and ADR-0225 validates every hop for driver-set membership
and the runtime grant. What a hop is FOR is decided by one condition, `a.verdict === "driver"` in arc-run's fallback
loop, and `attempt()` produces `driver` for every non-zero exit that is not 2 and not a policy denial. A connect error,
a 503, a crashed driver and an answer the driver could not parse all walk the chain the same way. The classification
that does exist arrived as bug fixes, one arm at a time: the budget arm (retro-log 2026-08-03#4), the overflow arm,
the policy arm. Each closed one shape. None made the class first-class, and chains carry no terms of their own: how
much a fallback may spend is whatever the caller's `--budget` says, or nothing.

## Options considered

1. **Keep the verdict, add arms as failures appear.** Cheap, and it is the history: one arm per incident, each found
   after it had spent money. The catch-all stays a catch-all.
2. **A new driver exit code per class.** Explicit, but it widens ENG-D's 0/1/2 map, which ADR-0219 closed and every
   driver, bench and the face read.
3. **A closed class set owned by one module; the driver declares its class in the cost sidecar; arc-run classifies
   what it observes itself; one pure function decides every hop.** The exit map is untouched, and the sidecar is
   already the channel for non-cost facts (`model`, `runtime`, ADR-0221).

## Decision

**Option 3.**

1. **`FailureClass`** is a closed set of six: `transport`, `provider-unavailable`, `model-invalid`, `policy-refusal`,
   `budget`, `unknown`. It is owned by ONE module, `.claude/scripts/engine/failure-class.mjs`, with the one pure
   decision `nextHop(chain, hops)`. arc-run's fallback loop asks it and nothing else.
2. **Hop rules.** `transport` and `provider-unavailable` may hop. `model-invalid` hops at most once, and only to a chain
   entry of a different model family. `policy-refusal`, `budget` and `unknown` never hop: they surface.
3. **`unknown` does not hop.** Today an undeclared driver failure falls back. After this ADR it surfaces. That is the
   point of the change, not a side effect.
4. **Where the class comes from.** arc-run classifies what it observes: the run deadline → `budget`, a policy denial →
   `policy-refusal`, exit 2 → `budget` (this includes the capped key's 403, which `drivers/hermes` already maps to
   BUDGET_DECLINED per ADR-0213), its own output ceiling → `budget`, a driver that never launched →
   `provider-unavailable`, exit 0 with a contract fault or unparseable stdout → `model-invalid`. For a driver exit 1,
   the driver DECLARES its class as `failure_class` in the cost sidecar. A value outside the set is `unknown`, loudly.
   A declaration on exit 0 or exit 2 is ignored, because those codes already decide the class. **The driver exit map
   stays 0/1/2** (ADR-0219).
5. **A per-attempt timeout is not the run's deadline.** A driver's own attempt cap expiring with run time left is
   `transport`. The run's deadline passing is `budget`.
6. **Chain terms.** Every class row and `default:` declares `max_attempts` (integer ≥1, counting every attempt
   including ADR-0204's retry), `max_wall_ms` (integer ms) and `max_cost` (integer paise, `writeCost`'s unit). A missing
   or malformed term is a router LOAD fault in `router-row.mjs`. The effective bound is the tighter of the term and
   the caller's `--budget`.
7. **Refuse before spend, deterministically.** `nextHop` is pure over the chain terms and the hops so far, each
   recorded as measured `{driver, tier, class, ms, cost?}`. It refuses the next hop when the attempt count would pass
   `max_attempts`, when elapsed is at or past `max_wall_ms`, or when spend so far is at or past `max_cost`. A started
   hop is given `min(run remaining, max_wall_ms − elapsed)`. The clock is an input, never read inside, so replaying
   recorded hops reproduces the decision.
8. **The record, zero new kinds.** `run.completed` keeps its existing `reason` values and gains `failure_class` (the
   final attempt's class) and `hops[]`. The escalation proposal stays `approval.requested` (ADR-0204).
9. **No promotion.** Every hop keeps the routed tier and records it. The pin is recomputed per driver under that tier,
   as arc-run already does. `independent-family-verifier` stays empty by default and a fallback never fills it.

**The kickoff forks, resolved here (all two-way):**

- **F1 — ADR-0204's same-tier retry against the cross-family hop.** When the chain holds a different-family entry the
  cross-family hop REPLACES rung 1. When it does not, rung 1 stays. Either way a contract fault buys at most ONE more
  attempt before the proposal receipt.
- **F2 — the family of `generic-api`.** It is read from the resolved pin or profile. A family arc cannot name counts as
  the SAME family (fail closed: no cross-family hop on a guess). Families are a fixed table in the module:
  `claude-code` → `anthropic`, `codex` → `openai`, `hermes` → `runtime:hermes`, `mock` → `mock:<driver-declared>`
  (so fixtures can pose both cases), `generic-api` → derived from its model id's vendor prefix or `unknown`.
- **F3 — `max_cost` when a prior hop reported no spend.** Fail closed. An absent figure means the spend is unproven,
  so no further hop is started under a finite `max_cost`. A finite `max_cost` on a chain whose first driver never
  reports `inr` therefore forbids every hop, and Phase 10 writes the live rows knowing which drivers report it.
- **F4 — explicit `--driver` runs.** They consult no row and have no chain. They gain only the `failure_class` /
  `hops[]` record. ENG-H governs the routed path.

## Consequences

- **Easier:** every hop has a stated reason on the receipt, so the ledger can price fallbacks by class. A new failure
  shape lands as `unknown` and stops, instead of quietly spending down a chain.
- **Harder:** a driver that declares nothing makes every chain through it stop hopping. `claude-code` and `codex` read
  only a CLI failure message today, so until they classify, `commit-msg-draft` and `review-diff` lose their fallback.
  That is recorded as an assumption with a trigger in the cycle PLAN, not hidden.
- **Harder:** every fixture `router.yaml` under `tests/` must carry the three terms or the load faults. Counted at
  kickoff: 14 test files write router fixtures (about 40 `classes:` blocks), and 24 copy the real router.
- **What would be revisited:** if `max_cost` under F3 makes every live chain hop-less because no production driver
  reports `inr`, the honest fix is a driver that measures spend, never an estimate.

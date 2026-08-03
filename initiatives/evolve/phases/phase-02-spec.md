# Phase 02 — Runner + verdict math

**Goal (one line):** Experiments assign deterministically, seal their target, respect floors and
TTL, and produce a verdict only via the one pinned test — computed at most once, above honest
floors, or not at all.

**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] Deterministic assignment: `hash(experiment_id|unit_id)` → arm; `hash(experiment_id|unit_id|"cohort")`
      → generation | verdict. Same unit replayed → identical arm AND cohort
- [ ] Fixed split from config (default 50/50, no adaptation); both arms tagged symmetrically
      (`+champion` / `+challenger-a`); concurrency cap enforced (default 2)
- [ ] TTL mandatory — floor unreached inside the window → auto-archived `no-verdict` WITH data
- [ ] **Canonical seal:** `experiment.opened` records `base_sha`; runner and verdict re-compare;
      mismatch → `experiment.closed` (`killed`, reason `canonical-drift`) and no proposal until a
      NEW experiment opens
- [ ] **Pinned reference vectors** for `newcombe-wilson-difference-v1`: counts in → exact bound
      values out, reproduced bit-for-bit
- [ ] Verdict refused unless: `MISSING` windows are excluded from BOTH arms **before** any floor
      count runs (an excluded window can never contribute toward reaching floor) · both arms ≥
      floor · bound ≥ `effect_floor` · delta ≥ MDE · guardrail intact — and a guardrail whose own
      window is `MISSING` for either arm is refused as **unresolved**, never scored as "no breach
      found" · zero cohort violations
- [ ] Fixed-horizon compute-once — an early (pre-floor) verdict compute is refused
- [ ] **Adversarial pass by a FRESH agent** on floor, cohort, seal and no-peeking enforcement
- [ ] tests added & green in CI · live demo run + output checked · tracker updated

## Verification plan

One coarse line, refined via `/arc-change` when the phase starts: every runner and verdict-math
fixture in the design source's fixture manifest goes red before green, with the reference vectors
committed alongside the implementation, and no code path exists by which a verdict can be
computed twice or before both floors are met.

## Rabbit holes in this phase

Statistical elegance beyond the one pinned test — EVO-F is the v1 ceiling (ADR-0306). Adaptive or
Bayesian allocation, and any sequential/peeking analysis, are no-gos rather than optimizations.

## Out of scope for this phase

Promotion lineage, inbox, watch window and freeze (Phase 03) · council receipts (Phase 04).

## Your-setup / pending

None.

## Non-negotiables (verbatim from PLAN)

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to promote,
  not to revert (Constitution A6, no exceptions, no carve-outs).
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits live in config; **enforcement lives in code**. A
  FRESH agent that has not seen the implementation runs the adversarial breaking-input pass on
  the manifest validator, every receipt validator, and floor + cohort + seal + lineage + watch
  enforcement — bound to the section that ships each gate, never deferred to the phase close.
- No experiments on money-touching surfaces (pricing, payments, revenue) — permanently refused
  at the contract layer, with a fixture.
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
  replay-identical board, config-hash-carrying verdicts, SHA-bound lineage at every hop. If
  replay cannot re-derive it, it does not count.
- Absent data is `MISSING`, never zero. Corrections supersede, never overwrite. No raw URLs or
  PII on the spine.
- Reader-only spine consumption; standard emitter for every receipt; real and simulated never
  mixed. Zero-dep Node + POSIX.

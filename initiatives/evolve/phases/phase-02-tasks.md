# Build Brief — phase 02 · Runner + verdict math

spec-hash: sha256:825eaac4dee2ca5bc3e2796b752164b34680c1be9aabb4432662a4fd31efe437
lane: evolve
reqs: 
adrs: 0306
blast-radius: (none)
no-gos: 
blast-radius-dropped: 3

### Non-negotiables

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to promote,
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits live in config; **enforcement lives in code**. A
- No experiments on money-touching surfaces (pricing, payments, revenue) — permanently refused
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
- Absent data is `MISSING`, never zero. Corrections supersede, never overwrite. No raw URLs or
- Reader-only spine consumption; standard emitter for every receipt; real and simulated never

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: Deterministic assignment: `hash(experiment_id|unit_id)` → arm; `hash(experiment_id|unit_id|"cohort")` → generation | verdict. Same unit replayed → identical arm AND cohort
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: Fixed split from config (default 50/50, no adaptation); both arms tagged symmetrically (`+champion` / `+challenger-a`); concurrency cap enforced (default 2)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: TTL mandatory — floor unreached inside the window → auto-archived `no-verdict` WITH data
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **Canonical seal:** `experiment.opened` records `base_sha`; runner and verdict re-compare; mismatch → `experiment.closed` (`killed`, reason `canonical-drift`) and no proposal until a NEW experiment opens
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **Pinned reference vectors** for `newcombe-wilson-difference-v1`: counts in → exact bound values out, reproduced bit-for-bit
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: Verdict refused unless: `MISSING` windows are excluded from BOTH arms **before** any floor count runs (an excluded window can never contribute toward reaching floor) · both arms ≥ floor · bound ≥ `effect_floor` · delta ≥ MDE · guardrail intact — and a guardrail whose own window is `MISSING` for either arm is refused as **unresolved**, never scored as "no breach found" · zero cohort violations
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: Fixed-horizon compute-once — an early (pre-floor) verdict compute is refused
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **Adversarial pass by a FRESH agent** on floor, cohort, seal and no-peeking enforcement
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: tests added & green in CI · live demo run + output checked · tracker updated
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

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

likely-failure-mode: a verdict declared on data that did not earn it - an arm below floor, a MISSING window counted, or a guardrail nobody resolved
likely-regression-site: verdict.mjs, and specifically the gate rather than the arithmetic
riskiest-file: .claude/scripts/evolve/verdict.mjs
expected-blockers: sourcing reference vectors independently, with no second tool available
expected-proof-failures: the reference vectors not reproducing bit-for-bit on some platform

### Slices

#### slice: 01

title: Deterministic assignment: `hash(experiment_id|unit_id)` → arm; `hash(experiment_id|unit_id|"cohort")` → generation | verdict. Same unit replayed → identical arm AND cohort
kind: logic
risk: high
proof: contract - determinism, a 2x2 arm-by-cohort contingency over 10000 units, and a 500-pair test that (a|b,c) and (a,b|c) are DIFFERENT assignments
tier: contract
sources: phase-02-spec.md
decision: hashing goes through canon.mjs (JSON.stringify of a domain-tagged array), NOT string joins - a unit id of `u7|cohort` produced the SAME preimage as the cohort draw for `u7`, making the arm and cohort ONE draw for that unit
result: independent: four ~2500 cells, chi-squared 0.028-2.98 against a 3.84 critical value at n=200k. CI run 30856255831 (19 jobs, 0 failures)
commit: 2b44775

#### slice: 02

title: Fixed split from config (default 50/50, no adaptation); both arms tagged symmetrically (`+champion` / `+challenger-a`); concurrency cap enforced (default 2)
kind: logic
risk: medium
proof: contract - a 50/50 split lands 4800-5200 of 10000; a 90/10 split honours the declared proportions; fractional, zero and negative shares are refused
tier: contract
sources: phase-02-spec.md
decision: per-ENTRY validation, not just the sum: [99.9,0.1] summed to 100 and gave the second arm ZERO units over 500,000 draws, because the walk is over 100 integer buckets
result: 8 malformed splits now refused. CI run 30856255831 (19 jobs, 0 failures)
commit: 2b44775

#### slice: 03

title: TTL mandatory — floor unreached inside the window → auto-archived `no-verdict` WITH data
kind: logic
risk: medium
proof: contract - ttlExpired fires exactly at the boundary and not 1ms before; 10 malformed inputs THROW rather than returning a falsy value
tier: contract
sources: phase-02-spec.md
decision: it THROWS rather than returning null. The refusal shared a channel with the answer - null is falsy, so a caller reading `if (ttlExpired(...)) kill()` treated `I cannot evaluate this` as `not expired` and the experiment never died. An explicit UTC offset is required, because an offset-less timestamp parses as LOCAL and killed the experiment on one machine but not another
result: 10/10 refuse; boundary exact. CI run 30856255831 (19 jobs, 0 failures)
commit: 2b44775

#### slice: 04

title: **Canonical seal:** `experiment.opened` records `base_sha`; runner and verdict re-compare; mismatch → `experiment.closed` (`killed`, reason `canonical-drift`) and no proposal until a NEW experiment opens
kind: logic
risk: medium
proof: contract - an intact seal passes, a moved seal reports canonical-drift, and a malformed digest is refused rather than string-compared
tier: contract
sources: phase-02-spec.md
decision: the seal was the best-defended surface in the adversarial pass: uppercase hex, whitespace, trailing newline, 65 chars, null, a boxed String and a Proxy all refused
result: held under attack, 0 breaks. CI run 30856255831 (19 jobs, 0 failures)
commit: 2b44775

#### slice: 05

title: **Pinned reference vectors** for `newcombe-wilson-difference-v1`: counts in → exact bound values out, reproduced bit-for-bit
kind: logic
risk: medium
proof: contract - two INDEPENDENT derivations, committed BEFORE any implementation; bit-for-bit against the pinned tree plus absolute agreement with the independent one
tier: contract
sources: phase-02-spec.md
decision: the two derivations DISAGREED on 6 of 8 cases by up to 24 ULP, and against 60-digit exact arithmetic NEITHER form is correctly rounded - so bit-for-bit as REQ-04 words it is unachievable across independent implementations. ADR-0311 splits the acceptance in two rather than quietly satisfying it with a tree that agrees with itself
result: 8/8 bit-for-bit; absolute agreement 1e-15 with per-case ULP caps where a near-0/near-1 cancellation makes ULP misleading. CI run 30856255831 (19 jobs, 0 failures)
commit: 2b44775

#### slice: 06

title: Verdict refused unless: `MISSING` windows are excluded from BOTH arms **before** any floor count runs (an excluded window can never contribute toward reaching floor) · both arms ≥ floor · bound ≥ `effect_floor` · delta ≥ MDE · guardrail intact — and a guardrail whose own window is `MISSING` for either arm is refused as **unresolved**, never scored as "no breach found" · zero cohort violations
kind: logic
risk: medium
proof: contract - a below-floor arm is named; an unresolved guardrail refuses; MISSING windows gate; a cohort violation refuses; an unresolved violation COUNT also refuses
tier: contract
sources: phase-02-spec.md
decision: cohortViolations of null/NaN/{} coerced to a false > 0 and read as clean - the same absence-of-evidence rule the guardrails already had, never applied here. MISSING windows now GATE rather than decorating the receipt
result: all refusals fire and name the wall. CI run 30856255831 (19 jobs, 0 failures)
commit: 2b44775

#### slice: 07

title: Fixed-horizon compute-once — an early (pre-floor) verdict compute is refused
kind: logic
risk: medium
proof: contract - a second compute is refused, and every truthy computedBefore value refuses
tier: contract
sources: phase-02-spec.md
decision: peeking and stopping when it looks good inflates the false-positive rate far above alpha; refusing the SECOND compute is what makes the first mean what it says
result: fail-closed on every truthy value. CI run 30856255831 (19 jobs, 0 failures)
commit: 2b44775

#### slice: 08

title: **Adversarial pass by a FRESH agent** on floor, cohort, seal and no-peeking enforcement
kind: logic
risk: medium
proof: contract - a THIRD fresh unanchored agent, on floor / cohort / seal / no-peeking, told to construct and RUN breaking inputs
tier: contract
sources: phase-02-spec.md
decision: run against the assignment layer AND the gate together, because the breaks that matter live at their seam - the gate validated a value the assignment layer had already stringified into a collision
result: 15 REAL BREAKS, all fixed and pinned in tests/evolve-gate.bats. Three root causes: in-band separators in hash preimages (configHash gave the SAME hash for floor 1000 and floor "1000" - opposite verdicts), refusals sharing a channel with answers (ttlExpired null, concurrencyRefusal undefined), and a gate that THREW instead of refusing on 10 realistic shapes
commit: 2b44775

#### slice: 09

title: tests added & green in CI · live demo run + output checked · tracker updated
kind: logic
risk: medium
proof: contract - the full CI matrix, 19 jobs across ubuntu 18/20/22, macos and windows
tier: contract
sources: phase-02-spec.md
decision: no local runs: CI is the only gate per the owner's standing instruction
result: CI run 30856255831 (19 jobs, 0 failures) green; three red rounds before it, each recorded in the commit log rather than amended away
commit: 2b44775

### Prediction scores

likely-failure-mode: hit -- 2b44775. Exactly that, five separate ways: an unresolved cohort count read as zero, MISSING windows never consulted, omitted guardrails read as none declared, NaN units passing the floor check, and a polluted prototype supplying a whole arm
likely-regression-site: hit -- 2b44775. 9 of the 15 breaks were in the gate; the arithmetic was clean apart from the alpha lookup
riskiest-file: hit -- 2b44775. verdict.mjs, as predicted
expected-blockers: unforeseen -- 77e4655. Sourcing the vectors was not the blocker. The blocker was that the two independent derivations DISAGREED, and that the acceptance criterion REQ-04 states was therefore unachievable as written. That needed an ADR, not a workaround
expected-proof-failures: hit -- dded67e. The vectors did fail to reproduce, but on the TOLERANCE rather than the platform: case D sits 512 ULP from the independent derivation and 2.2e-19 from it in absolute terms

### Debt ledger

- **what:** only alpha = 0.05 has a pinned quantile.
  **where:** `.claude/scripts/evolve/verdict.mjs` `Z_BY_ALPHA`.
  **why accepted:** a quantile table is a second thing to get wrong, and alpha rides the config hash precisely so a change to it is visible in every verdict. One value is all ADR-0310 declares.
  **cost of leaving it:** a client wanting a stricter alpha cannot run at all until a value is added and reviewed.
  **pay-down trigger:** the first client that asks for an alpha other than 0.05.
- **what:** `decide` takes counts as an argument rather than deriving them from the spine itself.
  **where:** `.claude/scripts/evolve/verdict.mjs`.
  **why accepted:** it keeps the gate a pure function that a test can attack directly, which is how all 15 breaks were found.
  **cost of leaving it:** a caller can hand it counts the board would never produce, so the MISSING-windows rule is enforced in the board and re-asserted here rather than being structurally impossible to violate.
  **pay-down trigger:** Phase 03's runner, which wires the board's counts into the gate - assert there that the two agree.


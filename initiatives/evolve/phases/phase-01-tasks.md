# Build Brief — phase 01 · Board

spec-hash: sha256:1d0e48cd2b7f646c9c56000a89e98cbd8b59789143f77ed1052231b9d062652f
lane: evolve
reqs: 
adrs: 0302, 0308
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

title: Board renders from the reader only — no direct spine file reads anywhere in the path
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: **Replay determinism:** wipe derived state → replay spine → board is byte-identical; and a fixture with two receipts sharing the same `ts` from different `actor`s (concurrent emitters) replays to the same board regardless of on-disk append order — the reducer sorts on a total order key (`ts` + `id`), never on file-arrival order
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: State `PENDING` renders below-floor surfaces with n-per-arm progress
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: Staleness renders loudly with an age (e.g. `last metric 12d ago`)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **`MISSING`** renders for any incomplete window — never rendered or counted as zero
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: `insufficient evidence` renders for council metrics below floor
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **Stream separation (ADR-0302):** experiment panels read `experiment.measured`; the baseline-panel path is proven ONLY against `MISSING`, since `metric.observed` is not a member of `KINDS` this cycle (ADR-0308) and no closed-payload validator for it exists — the "never summed" two-kind fixture is **deferred to the client's cycle**, when a legitimately validated `metric.observed` receipt first exists. Building one here would be doing EVO-H0's work inside this lane, which is a no-go
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: Baseline panels render `MISSING` today, since `metric.observed` is not in `KINDS` and no client feed exists — the absent feed is displayed honestly, not faked or zeroed
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: No invented numbers anywhere in the output
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: tests added & green in CI
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: live demo run + output checked
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

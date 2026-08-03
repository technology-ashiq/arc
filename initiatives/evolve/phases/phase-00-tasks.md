# Build Brief — phase 00 · Contract + steel thread

spec-hash: sha256:16f06d01d172bb7c18c8b42dad5793ab5d777f62b9ac94192d64374ed51e7395
lane: evolve
reqs: 
adrs: 0301, 0302, 0303, 0304, 0308, 0309
blast-radius: .., .claude/, .claude/scripts/, .claude/scripts/core/product-lint.mjs, .claude/scripts/evolve/*.mjs, .claude/scripts/evolve/money-surfaces.json, .claude/scripts/hq/arc-event.mjs, .claude/scripts/hq/arc-event.sh, .claude/scripts/hq/arc-replay.mjs, .claude/scripts/hq/lib/spine-io.mjs, .claude/scripts/hq/lib/validate.mjs, .claude/scripts/hq/spine.mjs, .claude/state/hq/events/, .claude/state/hq/events/_quarantine/, products/evolve/manifest.json, tests/evolve-contract.bats, tests/evolve-receipts.bats, tests/fixtures/products/good/, tests/fixtures/products/hostile/<case>/products/<name>/manifest.json
no-gos: 
blast-radius-dropped: 28

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

title: **ADR-0301** `evolve` manifest section validated: absent → exit 0 silent · present-but-invalid → exit 2 naming the exact missing keys · money-touching `promote_via` path → exit 2 permanently
kind: logic
risk: high
proof: contract - `bats tests/evolve-contract.bats` drives product-lint over 1 good and 9 new hostile fixtures inside the existing corpus, red first
tier: contract
sources: phase-00-spec.md, code:grep-fallback(594; no .codegraph/), adrs(11), learning(2), retro(11), churn(181)
decision: the section validator lives in `.claude/scripts/core/`, not `.claude/scripts/evolve/` as phase-00-spec pinned - product-lint.mjs is core-owned and a core file importing a downstream product breaks `sync-to-project --products core` in every consumer repo that never installs evolve; evolve requires core, so the Phase-02 runner imports it in the legal direction
result: 11/11 ok; red-before was 10 failing - NOT the spec's predicted `expected exit 2, got 0`, because the hostile cases already exited 2 via `unknown field "evolve"` with the wrong message; product-lint on the real repo root exits 0
commit: (empty until proven)

#### slice: 02

title: `KNOWN_FIELDS` extended in `.claude/scripts/core/product-lint.mjs`; the fixture diff is reviewed FIRST — confirm only the intended paths moved — then every pre-existing manifest fixture in the hostile corpus is re-recorded and returns its pinned verdict, unchanged (`arc-orchestrator` 2026-07-22: a golden fixture broke across 10 separate commits because any content edit to a product-shipped file moves its hash, surfacing as a surprise mid-task failure instead of a planned step)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: Every new file this phase adds under `.claude/scripts/` (validators, receipt helpers, the `evolve` schema code, any new command) is registered in a product manifest's `scripts`/`commands`/`files` array, and `product-lint`'s **coverage-invariant walk** (`unmapped file (synced but in no product)`, `product-lint.mjs:172-194`) runs green — that walk is a company-wide gate, not the evolve-scoped hostile corpus
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: Eight kinds from **ADR-0309** in `KINDS`, each with a closed-payload validator per **ADR-0304** (closed payloads, total-preimage idems, `supersedes` for corrections) + hostile fixtures
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **ADR-0302** stream contract encoded in the validators: `experiment.measured` is experiment-attributed and feeds verdict math only; `metric.observed` is the client's (ADR-0308) and is NOT implemented here; `source_id` grammar rejects a URL-shaped value and accepts the `h-<sha256-hex16>` hashed form
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: **Wiring assertion, per kind:** receipt landed in `.claude/state/hq/events/` AND `events/_quarantine/` gained nothing — and the check first proves it RAN (the emit command's own exit is captured; the directory listing is asserted non-empty before its contents are read), because a silent crash or an empty pipe reads as "quarantine gained nothing" and is otherwise indistinguishable from success. Exit 0 from the emitter is NOT accepted as evidence
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **ADR-0303** `PROCESS_RE` extended to `name@x.y.z(+slug)?` where **slug is `[a-z0-9][a-z0-9-]{0,31}`** (lower-case, digits and hyphen; must not start with a hyphen; 32 chars max) — a near-miss slug fails closed rather than being coerced — at the exported constant, so `process-lint` inherits it rather than carrying a copy; a legacy `name@x.y.z` fixture still validates (the backward-compat control, written before the regex is touched)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **Steel thread:** one `experiment.opened` receipt emitted → landed → read back via the reader, end to end, no direct file reads
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: Adversarial breaking-input pass run by a FRESH agent (not the author, not this session) on the manifest validator, all eight receipt validators, and the grammar change; every hole found is fixed and pinned as a fixture
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: tests added & green in CI
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: live demo run + output checked
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: contract tests green against fakes (fixture spine; no real client feed exists)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

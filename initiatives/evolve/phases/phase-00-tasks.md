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
result: 11/11 ok; red-before was 10 failing - NOT the spec's predicted `expected exit 2, got 0`, because the hostile cases already exited 2 via `unknown field "evolve"` with the wrong message; product-lint on the real repo root exits 0; regression bats tests/products.bats 34/34
commit: 231a24c

#### slice: 02

title: `KNOWN_FIELDS` extended in `.claude/scripts/core/product-lint.mjs`; the fixture diff is reviewed FIRST — confirm only the intended paths moved — then every pre-existing manifest fixture in the hostile corpus is re-recorded and returns its pinned verdict, unchanged (`arc-orchestrator` 2026-07-22: a golden fixture broke across 10 separate commits because any content edit to a product-shipped file moves its hash, surfacing as a surprise mid-task failure instead of a planned step)
kind: logic
risk: medium
proof: contract - the golden delta is derived and reviewed BEFORE regeneration (comm/join over path+hash columns), then `bats tests/sync.bats` proves byte-identity on both the rsync and cp-r install paths
tier: contract
sources: phase-00-spec.md, code:grep-fallback(608; no .codegraph/), adrs(11), learning(2), retro(13), churn(185)
decision: the phase-close re-record is a NAMED planned step, not this one - every remaining slice touches a synced file, so the golden goes stale again by design; recording it here as planned is what stops it surfacing as a surprise mid-task failure (the 2026-07-22 pattern)
result: 187 rows compared, 0 removed, 3 added, exactly 1 hash moved (product-lint.mjs, the only file edited); bats tests/sync.bats 23/23. First comm/join pass warned `input is not in sorted order` and was rerun under LC_ALL=C before any conclusion - an unsorted join drops rows silently and would have read as "nothing else changed"
commit: 6725764

#### slice: 03

title: Every new file this phase adds under `.claude/scripts/` (validators, receipt helpers, the `evolve` schema code, any new command) is registered in a product manifest's `scripts`/`commands`/`files` array, and `product-lint`'s **coverage-invariant walk** (`unmapped file (synced but in no product)`, `product-lint.mjs:172-194`) runs green — that walk is a company-wide gate, not the evolve-scoped hostile corpus
kind: logic
risk: medium
proof: contract - `bats tests/evolve-contract.bats` gains two coverage-walk cases: a new `hostile/unmapped-file` fixture that must exit 2 naming the orphan by exact path, and the real repo root which must exit 0
tier: contract
sources: phase-00-spec.md, code:grep-fallback(609; no .codegraph/), adrs(11), learning(2), retro(16), churn(185)
decision: no `products/evolve/manifest.json` is created in Phase 00 - every file this phase adds belongs to core (manifest schema) or hq (spine validators), and a product manifest with an empty payload array is itself a lint error; the evolve product is born in Phase 01 with the board code
result: 13/13 ok. The walk had only ever been observed PASSING; the new fixture is its failing case and reports `.claude/rules/orphan.md` while not reporting its mapped sibling, so it discriminates rather than flags everything. One assertion I first wrote was an `A || B` tautology that could never fail - caught and replaced before commit
commit: b77f818

#### slice: 04

title: Eight kinds from **ADR-0309** in `KINDS`, each with a closed-payload validator per **ADR-0304** (closed payloads, total-preimage idems, `supersedes` for corrections) + hostile fixtures
kind: logic
risk: medium
proof: contract - `bats tests/evolve-receipts.bats` drives all eight kinds through the REAL emitter into a sandboxed spine; closed-payload, enum, seal, split, arm, TTL and idem cases each have their own failing fixture
tier: contract
sources: phase-00-spec.md, code:grep-fallback(609; no .codegraph/), adrs(11), learning(2), retro(14), churn(186)
decision: the idem is derived BY THE EMITTER for these eight kinds and a caller-supplied --idem is refused (anti-preclaim); time is deliberately out of the preimage, so a doubled `experiment.assigned` for one unit collides instead of quietly doubling that arm's n. Validators live in a new hq/lib/validate-experiment.mjs rather than inline - 8 validators would have tripled validate.mjs
result: 31/31 ok, red first at 24/27 failing. KINDS 22 -> 30, and the size in the UNKNOWN_KIND message is derived from KINDS.length so the test asserting "closed 30" cannot go stale by hand. Regression: bats tests/spine-emit.bats 30/30 (pinned hostile corpus, both modes)
commit: a50489e

#### slice: 05

title: **ADR-0302** stream contract encoded in the validators: `experiment.measured` is experiment-attributed and feeds verdict math only; `metric.observed` is the client's (ADR-0308) and is NOT implemented here; `source_id` grammar rejects a URL-shaped value and accepts the `h-<sha256-hex16>` hashed form
kind: logic
risk: medium
proof: contract - four cases in `bats tests/evolve-receipts.bats`: metric.observed still UNKNOWN_KIND, a URL-shaped source_id refused, an email-shaped unit_id refused, the h-<16 hex> form accepted
tier: contract
sources: phase-00-spec.md
decision: the URL/PII refusal IS the charset, not a check bolted on after it - OPAQUE_ID_RE excludes `:` `/` `@` `%`, so a raw URL or address cannot pass the grammar at all; the same rule covers unit_id, which is the higher PII risk and which the spec named only for source_id
result: 4/4 ok. `metric.observed` is absent from KINDS by design (ADR-0308) and its refusal is now a pinned test rather than an accident of not having built it
commit: a50489e

#### slice: 06

title: **Wiring assertion, per kind:** receipt landed in `.claude/state/hq/events/` AND `events/_quarantine/` gained nothing — and the check first proves it RAN (the emit command's own exit is captured; the directory listing is asserted non-empty before its contents are read), because a silent crash or an empty pipe reads as "quarantine gained nothing" and is otherwise indistinguishable from success. Exit 0 from the emitter is NOT accepted as evidence
kind: logic
risk: medium
proof: contract - the loop in `bats tests/evolve-receipts.bats` test 1 runs all eight kinds and asserts, in this order: the emit's own exit code, then events/ non-empty, then quarantine empty, then the landed line carries the kind
tier: contract
sources: phase-00-spec.md
decision: the ORDER is the control, not the assertions themselves - checking quarantine first would pass on a silent crash, since a crashed emitter also quarantines nothing; events/ non-empty is what makes the quarantine reading mean anything
result: 8/8 kinds land, 0 quarantined. Hook mode separately asserted: exit 0, appends NOTHING, quarantines exactly 1 - so the dual-mode contract holds for the new kinds too
commit: a50489e

#### slice: 07

title: **ADR-0303** `PROCESS_RE` extended to `name@x.y.z(+slug)?` where **slug is `[a-z0-9][a-z0-9-]{0,31}`** (lower-case, digits and hyphen; must not start with a hyphen; 32 chars max) — a near-miss slug fails closed rather than being coerced — at the exported constant, so `process-lint` inherits it rather than carrying a copy; a legacy `name@x.y.z` fixture still validates (the backward-compat control, written before the regex is touched)
kind: logic
risk: medium
proof: contract - the backward-compat control (legacy name@x.y.z validates) is run GREEN BEFORE the regex is touched; then arm-tagged ids validate, six near-miss slugs fail closed, and an identity check proves validate.PROCESS_RE and core.PROCESS_RE are the SAME object
tier: contract
sources: phase-00-spec.md
decision: the definition moved to core/variant-grammar.mjs and validate.mjs RE-EXPORTS it - three products need the grammar and core is the one they all already require; a re-export keeps process-lint's existing import working against exactly one regex instead of a copy that drifts
result: 4/4 ok. Control was green before AND after, so it proves compatibility rather than being green only afterwards. Regression: bats tests/engine-process-lint.bats 15/15, including its own "judged by the spine's own PROCESS_RE, proven by agreement not by grep" case. One test failure during this slice was MY harness (a bare Windows path is not a legal ESM specifier), not the code - diagnosed before assuming drift
commit: a50489e

#### slice: 08

title: **Steel thread:** one `experiment.opened` receipt emitted → landed → read back via the reader, end to end, no direct file reads
kind: logic
risk: medium
proof: verified-real - run on the REAL spine, not a sandbox: emit through arc-event.sh --strict with the exit captured, quarantine re-counted, then `spine.mjs read --kind experiment.opened`, then the seal re-derived from the live file and compared
tier: verified-real
sources: phase-00-spec.md, code:grep-fallback(611; no .codegraph/), adrs(11), learning(2), retro(12), churn(187)
decision: base_sha is a REAL sha256 of a real in-tree file, not a fabricated 64-hex literal - a steel thread whose seal was invented proves the plumbing but never that the seal means anything
result: x-evolve-steel-thread-01 landed as 01KZ49NVNHAAWNJKKX0HNXNQQR; quarantine 1 line before and 1 after (the pre-existing INTERNAL entry, unchanged); reader returned it with base_sha e652a15c..73e5, which re-derives bit-identical from the live file. Negative controls: the reader returns 0 rows for a kind never emitted, and one appended byte moves the seal to a5b708ad..d27b
commit: (empty until proven)

#### slice: 09

title: Adversarial breaking-input pass run by a FRESH agent (not the author, not this session) on the manifest validator, all eight receipt validators, and the grammar change; every hole found is fixed and pinned as a fixture
kind: logic
risk: medium
proof: contract - TWO fresh unanchored agents (not the author, not this session), one on the manifest validator + money classifier, one on the eight receipt validators + grammar; each told to CONSTRUCT AND RUN breaking inputs and that a finding it did not execute is not a finding
tier: contract
sources: phase-00-spec.md
decision: neither attacker was shown this Build Brief or the git log - the memory `gate-author-cannot-be-its-attacker` records an author pass finding 0 holes where a fresh agent found 9, and anchoring on the author's reasoning is exactly what causes that
result: 15 REAL HOLES, all fixed and pinned. Manifest (6): case-varied money segment resolving to the real file on NTFS/APFS - PROVED by writing through the accepted path; symlink/junction/hardlink aliases; `promote_via: ["."]` and bare directories; prefix-only matching missing `app/(pricing)/page.tsx`; duplicate JSON keys hiding a money path; non-canonical aliases defeating dedup. Receipts (9): the idem was a SUBSET not a total preimage, so corrections could NEVER LAND and a junk verdict pre-claimed the key forever; `arm` in the assigned idem let ONE UNIT land in BOTH arms, corrupting the n the verdict is computed from; `venture` dropped from the preimage - the exact 100-receipt regression arc-event.mjs documents as already fixed; experiment.opened accepted money surfaces because the non-negotiable was only enforced in the manifest lint; target_path accepted `mailto:`, `|` (the idem separator) and `src/nul`; target_path aliasing gave one file 5 idems; `--strct=1` silently downgraded strict to hook mode (pre-existing arc-event bug); `module` unbounded at 63KB; U+202E bidi override in a close reason rendering "not promoted" as its opposite. My own correction test was ALSO wrong - it varied window_end, so it corrected a different window and proved nothing while the real correction path was broken
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

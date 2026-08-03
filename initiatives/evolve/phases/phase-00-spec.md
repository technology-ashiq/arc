# Phase 00 — Contract + steel thread

**Goal (one line):** A module can declare an `evolve` section that is validated strictly from
birth, the eight experiment kinds exist on the spine with closed payloads, and one receipt travels
the full thin path — emitted through the standard emitter, landed in `events/`, read back through
the reader.

**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** none

## Build targets (concrete — this spec is the executor's whole information set)

Everything below is inlined deliberately. An executor reads PLAN.md and this file, not the ADRs,
so an ADR number alone is a dangling pointer.

**Paths, verified in-tree 2026-08-03:**

| What | Where |
|---|---|
| Event vocabulary + payload validators | `.claude/scripts/hq/lib/validate.mjs` (`KINDS` at :20, `PROCESS_RE` at :45) |
| Standard emitter | `.claude/scripts/hq/arc-event.sh` → `.claude/scripts/hq/arc-event.mjs` |
| **The reader** (reader-only spine API) | `.claude/scripts/hq/spine.mjs`, over `.claude/scripts/hq/lib/spine-io.mjs`. Replay driver: `.claude/scripts/hq/arc-replay.mjs` |
| Manifest gate | `.claude/scripts/core/product-lint.mjs` (`KNOWN_FIELDS` at :38, coverage walk at :172-194) |
| **Hostile manifest corpus** | `tests/fixtures/products/hostile/<case>/products/<name>/manifest.json`; passing cases at `tests/fixtures/products/good/` |
| New evolve code | `.claude/scripts/evolve/*.mjs` |
| New tests | `tests/evolve-contract.bats`, `tests/evolve-receipts.bats` (matches the `develop-*` / `engine-*` convention) |
| Product ownership | **a NEW `products/evolve/manifest.json`** (`requires: ["core", "hq"]`), listing every new `.claude/` file in its `scripts` / `files` array. The coverage walk hard-fails on any unmapped synced file, so this manifest is created in the same slice as the first script |

**The `evolve` manifest section — exact key set** (ADR-0301). Top-level key `evolve`, object:

- `metrics[]` — `{ name, source_event, aggregation, direction: "higher-is-better"|"lower-is-better", role: "primary"|"guardrail" }`
- `experiments[]` — `{ surface_file, variant_grammar, split, excluded_categories[] }`
- `evals` — `{ holdout_rule, per_arm_floor, minimum_effect_rule, test_id, alpha, effect_floor }`
- `promote_via` — array of exact repo-relative file paths (an allowlist; globs and `..` refused)

Absent → exit 0. Present and missing any of the four → exit 2 naming each missing key by name.

**The eight kinds added to `KINDS`** (ADR-0309 — literal list, count moves 22 → 30):

| Kind | Closed payload fields |
|---|---|
| `experiment.opened` | `experiment_id`, `module`, `surface`, `target_path`, **`base_sha`**, `split`, `ttl_days`, `arms[]` |
| `experiment.assigned` | `experiment_id`, `unit_id`, `arm`, `cohort` |
| `experiment.measured` | `experiment_id`, `unit_id`, `arm`, `cohort`, `metric`, `value`, `unit_count`, `window_start`, `window_end`, `source_id` |
| `experiment.verdict` | `experiment_id`, `outcome` (`verdict`\|`no-verdict`), `bound`, `delta`, `n_per_arm` (**an object keyed by arm tag → integer**, e.g. `{"+champion": 1900, "+challenger-a": 1874}` — a single scalar cannot express REQ-04's "both arms ≥ floor"), `config_hash`, `metric_hash` |
| `promotion.proposed` | `proposal_id`, `experiment_id`, `kind` (`promote`\|`revert`), `patch_sha`, `base_sha`, `candidate_sha`, and for a revert also `applies_to`, `restores` |
| `experiment.promoted` | `proposal_id`, `commit_ref`, `observed_candidate_sha` |
| `experiment.rolled_back` | `proposal_id`, `commit_ref` |
| `experiment.closed` | `experiment_id`, `outcome` (`winner`\|`no-verdict`\|`killed`), `reason` |

`source_id` grammar: `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`, or `h-<sha256-hex16>` for anything derived
from a URL, email or user data. A URL-shaped value is refused. Idems are total-preimage over every
identity-bearing field, absent optionals written as a literal `-`.

`metric.observed` is **NOT** in this list and is not built here — it is the client's cycle
(ADR-0308), and building it in this lane is a no-go.

**The money-surface classifier** — the rule, not just what it must reject. `promote_via` entries
are matched against a maintained denylist of **path globs and vendor directory names** held in
`.claude/scripts/evolve/money-surfaces.json`, seeded with at minimum: `**/stripe/**`,
`**/billing/**`, `**/payments/**`, `**/pricing/**`, `**/checkout/**`, `**/subscription*/**`,
`**/invoice*/**`, `**/paddle/**`, `**/lemonsqueezy/**`, `**/entitlement*/**`. It is a
**glob match over path segments, never a substring search over three words** — which is why
`lib/stripe/webhook-handler.ts` (naming no money keyword) is still refused, by the `**/stripe/**`
vendor glob. Adding a surface to the denylist is a normal edit; removing one is not permitted by
this phase.

## Exit criteria (Definition of Done)

- [ ] **ADR-0301** `evolve` manifest section validated: absent → exit 0 silent ·
      present-but-invalid → exit 2 naming the exact missing keys · money-touching `promote_via`
      path → exit 2 permanently
- [ ] `KNOWN_FIELDS` extended in `.claude/scripts/core/product-lint.mjs`; the fixture diff is
      reviewed FIRST — confirm only the intended paths moved — then every pre-existing manifest
      fixture in the hostile corpus is re-recorded and returns its pinned verdict, unchanged
      (`arc-orchestrator` 2026-07-22: a golden fixture broke across 10 separate commits because
      any content edit to a product-shipped file moves its hash, surfacing as a surprise
      mid-task failure instead of a planned step)
- [ ] Every new file this phase adds under `.claude/scripts/` (validators, receipt helpers, the
      `evolve` schema code, any new command) is registered in a product manifest's
      `scripts`/`commands`/`files` array, and `product-lint`'s **coverage-invariant walk**
      (`unmapped file (synced but in no product)`, `product-lint.mjs:172-194`) runs green — that
      walk is a company-wide gate, not the evolve-scoped hostile corpus
- [ ] Eight kinds from **ADR-0309** in `KINDS`, each with a closed-payload validator per
      **ADR-0304** (closed payloads, total-preimage idems, `supersedes` for corrections) +
      hostile fixtures
- [ ] **ADR-0302** stream contract encoded in the validators: `experiment.measured` is
      experiment-attributed and feeds verdict math only; `metric.observed` is the client's
      (ADR-0308) and is NOT implemented here; `source_id` grammar rejects a URL-shaped value and
      accepts the `h-<sha256-hex16>` hashed form
- [ ] **Wiring assertion, per kind:** receipt landed in `.claude/state/hq/events/` AND
      `events/_quarantine/` gained nothing — and the check first proves it RAN (the emit
      command's own exit is captured; the directory listing is asserted non-empty before its
      contents are read), because a silent crash or an empty pipe reads as "quarantine gained
      nothing" and is otherwise indistinguishable from success. Exit 0 from the emitter is NOT
      accepted as evidence
- [ ] **ADR-0303** `PROCESS_RE` extended to `name@x.y.z(+slug)?` where **slug is
      `[a-z0-9][a-z0-9-]{0,31}`** (lower-case, digits and hyphen; must not start with a hyphen;
      32 chars max) — a near-miss slug fails closed rather than being coerced — at the exported
      constant, so
      `process-lint` inherits it rather than carrying a copy; a legacy `name@x.y.z` fixture still
      validates (the backward-compat control, written before the regex is touched)
- [ ] **Steel thread:** one `experiment.opened` receipt emitted → landed → read back via the
      reader, end to end, no direct file reads
- [ ] Adversarial breaking-input pass run by a FRESH agent (not the author, not this session) on
      the manifest validator, all eight receipt validators, and the grammar change; every hole
      found is fixed and pinned as a fixture
- [ ] tests added & green in CI
- [ ] live demo run + output checked
- [ ] contract tests green against fakes (fixture spine; no real client feed exists)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/evolve-contract.bats` then `bats tests/evolve-receipts.bats`
- **Expected failure first:** before any code, `bats tests/evolve-contract.bats` fails on
  `manifest with evolve section → exit 2 naming missing keys` with
  `expected exit 2, got 0` — because `product-lint` today does not know the field, so an
  `evolve` section is an unknown field and the current behaviour is a generic unknown-field
  error, not a section-aware one. And `bats tests/evolve-receipts.bats` fails on
  `emit experiment.opened → lands in events/` with the receipt in `_quarantine/` carrying
  `UNKNOWN_KIND`, because `KINDS` holds 22 entries and none is `experiment.opened`. Both
  failures prove the tests test something real — they are the exact two states verified in-tree
  at kickoff.
- **Live demo scenario:** add an `evolve` section to a scratch fixture manifest with a
  `promote_via` entry pointing at a payments path → run `product-lint` → observe exit 2 and the
  refusal naming the money path. Then remove that entry, emit one `experiment.opened` through
  `arc-event.sh`, and `ls` both `events/` and `events/_quarantine/` to confirm where it landed.
- **Real-system check:** inspect `.claude/state/hq/events/` and `.claude/state/hq/events/_quarantine/`
  by hand after the emit — the `develop` lane's 2026-08-02 failure was invisible to the emitter's
  own exit code and surfaced only by listing these two directories.
- **Expected evidence:** bats output showing red → green for both files; the two directory
  listings; the fresh agent's adversarial report with each hole's fixture.

## Rabbit holes in this phase

Generalizing the manifest schema for modules that do not exist — design for growth-style surfaces
and council only, extend by ADR. Event-grammar creep: the eight kinds are frozen by ADR-0309, and
a missing field is a new ADR, never a new payload key.

## Out of scope for this phase

Board rendering (Phase 01) · assignment, floors and verdict math (Phase 02) · promotion lineage
and the watch window (Phase 03) · council receipts (Phase 04) · `metric.observed` itself, which is
the client's cycle and never this lane's (ADR-0308).

## Your-setup / pending

None. No keys, accounts or external services — the fixture spine is in-repo and no client feed
exists or is expected during this cycle.

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

# PLAN (design source) — Model-Agnostic Foundation: engine v1 + process-layer pilot

> **Freeze log:** v1 2026-07-22 (pre-lanes draft) → v1.1 2026-08-02 (C5's 2-item queue
> note: ADR-0069 inheritance + ENG-E conflict flagged) → **v2 2026-08-02, full lane-era
> redraft:** the queue is absorbed into the body; routing/tiers/receipts inherited from
> ADR-0069; ENG-E ladder reconciled with 0069 b(1) (auto-step dropped, proposal receipt
> instead); policy metrics 1–3 made computable via the `run.completed` payload; bench
> handshake added (task-class-tagged fixtures, eval revisions, driver `--version`);
> kickoff prompt rewritten to lane grammar (ADR-0054); appetite made honest at 2.5w.
> Decisions ENG-A..G locked; real ADR numbers assigned at kickoff from the next free slot.
>
> **Trigger (pull, any one — the first two are ADR-0069 block (d), checked where it says):**
> **public-release prep begins** (any lane's PLAN.md names public release or external
> users in its Goal — checked at `/arc-kickoff` by the person writing that goal) · **a
> provider event** (price change, deprecation, new tier, or sustained availability problem
> touching a block-(a) tier — no automated watch exists and none is pretended) · **a
> second runtime is genuinely needed for real work** — this third trigger is this plan's
> own, not yet in the policy: if IT is the one that fires, the kickoff's first act is a
> one-paragraph amending ADR adding it to 0069 block (d). The policy's revisit trigger
> anticipates exactly this kind of gap-notice; firing on an unrecorded trigger without
> the amendment would put plan and policy in contradiction (MP-A: policy outranks).
> **Prerequisites:** spine live (C2) ✓ · Balanced Model Policy adopted (ADR-0069, C5) ✓.
> **Do not start before a trigger fires** (Constitution A8 — adopted v1.0 on 2026-08-06,
> receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`; the governance gap this plan noted is now closed).
> Engine work
> lives in its own lane, born only by `/arc-kickoff --lane engine` (ADR-0054); board row
> order stays the owner's priority call (ADR-0051/0052 — WIP visible, never gated).

## Inherited from ADR-0069 (read this before the REQs)

This cycle **implements** the Balanced Model Policy; it decides nothing the policy
already decided. Concretely:

- **Tier definitions + seat map = block (a).** `router.yaml` encodes tiers by their
  policy names (cheap-scan · balanced-workhorse · high-judgment ·
  independent-family-verifier); the claude mapping is "implementation v1", swappable
  without touching the tiers. Zero new "which model where" forks — that is the policy's
  own north-star for this handover, and REQ-06 is written to hit it.
- **Prohibitions = block (b).** b(1) — no component changes a seat's tier at runtime —
  shaped ENG-E v2 below. b(5) — absent data is never estimated — shapes the cost fields
  in REQ-05.
- **Receipt schema = block (e).** The MP-F fingerprint rides `run.completed` payloads:
  forward-only, unavailable fields stay absent.
- **Escalation:** the policy deliberately defines **no** ladder — it hands this cycle a
  *constraint*: whatever ladder is built, the tier change at its end is a reviewed diff.
  v1's `one-tier-up` auto-step is **dropped, not amended into the policy** — runtime
  auto-switching would gut b(1) for a v1 convenience. If evidence ever argues for it,
  bench produces that evidence (escalation-rate metric) and an amending ADR carries it.

## Goal

One sentence: arc's processes stop being Claude-Code-dialect prisoners — a canonical
model-neutral process layer (3 pilot commands, byte-diff-proven) plus an engine that runs
any process on any of 3 drivers with hard budgets and a **policy-derived**, hand-edited
routing table — so models become swappable parts and every future model is an upgrade,
not a migration.

## Relationship to neighbouring plans (this is NOT those)

- **model-policy (C5):** decided *which seat gets which tier and what may never happen*.
  This cycle wires that policy into runnable form. Amending the policy from inside this
  cycle is a no-go except the two named cases (trigger-three amendment; a "which model
  where" gap per 0069's own revisit trigger).
- **bench (`BRIEF-bench.md`, double-gated sleeper):** systematizes model comparison AFTER
  ≥2 drivers are in real use. This cycle ships bench's fuel deliberately: task-class-tagged
  eval fixtures with revision fields, versioned drivers, eligible cost evidence.
  No bench RUNNER here.
- **develop (1.6):** owns how build cycles execute (plan-approval → phase-done). The
  engine owns how *processes run on models*. No overlap; both are company organs.
- **portfolio:** engine work is a lane; its OUTPUTS (`processes/`, `engine/`, `drivers/`)
  are shared company organs at repo root (ADR-0053) — never per-lane.

## Current state (verified 2026-08-02 — re-verify at kickoff)

- **23 commands / 27 agents** in Claude Code dialect under `.claude/` (census query per
  ADR-0069: `grep -r '^model:' .claude/agents/` → 1 haiku · 22 sonnet · 4 opus).
  Substance and dialect are fused; ADR-0013 already keeps ENGINE SCRIPTS model-free
  ("assume no Claude").
- Scripts re-homed per product: `.claude/scripts/{core,council,design,hq,plan,review}`;
  registry + selective install live.
- **Spine LIVE since C2:** closed 18-kind vocabulary (ADR-0026) including `run.completed`
  and a defined-but-emitterless `cost.incurred`; emitter dual-mode (ADR-0031); inbox
  approve/reject working (`arc-inbox.mjs`, SPINE-G reader-only refold).
- **Lanes LIVE (ADR-0050..0062):** `initiatives/{design,model-policy,portfolio}`;
  `--lane` grammar in `.claude/rules/lanes.md`; PORTFOLIO.md board is a view (ADR-0051).
- **ADR-0069 adopted (C5):** tiers + seat map, never-do list, 5 metrics (1–3 are
  engine-native; metric 1 explicitly "not computable until the engine provides it"),
  MP-F fingerprint block, engine-trigger table.
- **Pilot drift is real and ongoing:** `arc-kickoff.md` was rewritten in C4 (lanes) and
  again 2026-08-01, and C5 Phase 3 adds the attacker reject-log to its step 5. The
  complex pilot is a moving target — REQ-02 therefore starts by re-pinning pilot bytes
  at a named commit.
- `.codex/` + `.agents/` dirs and `AGENTS.md` exist at root (early multi-tool
  experiments) — adapters formalize what these started.
- Nothing exists of: `processes/`, `adapters/`, drivers, router, `arc-run`, `arc-compile`.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | One canonical truth per pilot process | 3 pilots canonicalized — `arc-commit` (simple), `arc-review` (medium), `arc-kickoff` (complex) — as `processes/NAME.process.yaml`: intent, inputs, steps, abstract tool needs, output JSON schema, **task-class**, eval fixture refs, semver (+ a `format:` field versioning the format itself). Eval packs carry a **revision** field and each fixture a **task-class tag**; target ≥5 fixtures per task class the pilots exercise (bench's MIN_FIXTURES handshake — classes the pilots don't touch honestly get 0, stated). Schema-validated by a new `process-lint` (hostile fixtures pinned: bad YAML, missing schema, unknown tool, cyclic includes) | 0 |
| REQ-02 | Compile, don't rewrite — proven | **Kickoff first re-pins the 3 pilot files at a named commit** (they have drifted since v1 and will drift again — flagged, never silently absorbed). Then `arc-compile --target claude-code` regenerates the 3 pilot command files **byte-identical** to those pinned bytes (LF-normalized; the arc-bytediff method). Only after 3/3 byte-identical does the canonical file become source of truth (generated files carry a header) | 1 |
| REQ-03 | A second dialect exists | `arc-compile --target codex` (or agentsmd) emits a runnable equivalent for the 3 pilots; goldens pinned; regeneration only via reviewed diff (existing golden-fixture rule extended) | 1 |
| REQ-04 | Any process, any driver, one interface | `arc-run --process commit-msg-draft --driver X` works headless for X ∈ {claude-code, codex, generic-api}; output validates against the process's JSON schema on ALL drivers. **Failure ladder (0069-b(1)-conformant):** schema-fail → ONE same-tier retry → `outcome: fail/schema` + an **escalation-proposal receipt** (`approval.requested`, existing kind — decided via `arc-inbox approve|reject <ULID> --reason`) + a printed manual next step. **No automatic tier change anywhere.** A human re-running with explicit `--driver`/`--model` is a human decision, not auto-switching (isolated trials additionally covered by 0069(g)). Fixture-proven, including on the mock driver | 2 |
| REQ-05 | Budgets are hard, and every run is a policy-grade receipt | `--budget inr=N,min=M` enforced: a fixture process that would exceed budget stops with `outcome: fail/budget` — never silently continues. Every run emits `run.completed` whose payload carries: process@semver · task-class · driver + driver `--version` · **MP-F fingerprint** (provider · exact model id · prompt/canonical sha · input sha · timestamp · wall-clock duration · effort + cost **if visible**) · retries · escalation `none|proposed` · optional work-item ref (`--ref`). Cost fields follow the eligibility rule: provider-reported usage × pinned pricing snapshot = derived; neither available → **absent, never estimated** (0069 b(5)). This makes policy metrics 1–3 computable by a reader script with **zero new event kinds** | 2 |
| REQ-06 | Routing is explicit, policy-derived, not magic | `engine/router.yaml` (hand-edited): header cites ADR-0069; rows = task-class → **tier by its policy name** → driver + implementation model + fallback chain. Includes the **independent-family-verifier** row even while unoccupied (routing to it → loud "tier defined, unoccupied" error — the slot the policy told the engine to inherit). Every row carries `data: internal-only|external-ok`. `arc-run --driver auto` resolves through it; unknown class → loud error naming the file to edit. Any edit is a reviewed diff citing the policy (MP-A) | 2 |
| REQ-07 | No secrets or bounded data leak through drivers | Driver logs/transcripts scrubbed by the same deny-pattern scanner as the spine (SPINE-E); fixture: a fake key in process input never appears in any driver artifact. **Data boundary:** a process whose input is marked `internal-only` routed toward an `external` driver → refused loud (exit 5), fixture-proven — the first convenience routing must not silently ship repo context to a third party | 2 |

## Appetite

**2.5 weeks (13 working days) hard cap.** **Tier: M** (≤3w). Phase appetites below are
ceilings, not entitlements. *(v1 said "2 weeks" over 13 days of phases — the number is
now honest.)*
**Kill criteria:** 50% (6.5d) burnt without REQ-02's 3/3 byte-identical proof → the
compile approach is wrong for this codebase; bank process-lint + canonical files as
documentation, stop, retro. Generic-api driver flaky beyond 2 days of fixes → cut to 2
drivers (claude-code + codex), bank, note the third as demand-triggered.

## Decisions to ADR at kickoff (next free slots)

| ID | Decision |
|---|---|
| ENG-A | Canonical format: YAML process files, one per command; JSON-schema output contracts; semver per process + `format:` version for the format itself; `processes/` at repo root as a company organ (ADR-0053). **Sub-decision (the prose trap, named):** the canonical body is **dialect-neutral** — anything dialect-specific must be an adapter transform or a declared placeholder (tool names, argument markers, frontmatter). A canonical file holding per-target prose blocks = lint error; that failure mode is "two hand-written files stapled together", and it kills "one canonical truth" quietly |
| ENG-B | Adapters are pure functions canonical→dialect; generated files carry a DO-NOT-EDIT header; hand-edits to generated files = lint failure (WARN-first, trial-ledger row) |
| ENG-C | Byte-diff gate is MIGRATION-ONLY; post-flip regression = schema validation + eval fixtures + reviewed goldens |
| ENG-D | Driver contract: `drivers/NAME run <process> <input-json> <budget>` → output-json on stdout; **cost + usage in a sidecar file is the contract** (fd3 stays an optional POSIX nicety — CI runs 3 OS and fd3 is fragile off-POSIX); stderr = logs; exit map **0** ok · **2** schema-fail · **3** budget-stop · **4** driver-error · **5** data-boundary-refusal; every driver answers `--version`; generic-api via plain HTTP (OpenRouter/LiteLLM-style), model pinned in router.yaml |
| ENG-E | **(v2 — reconciled with 0069 b(1)):** escalation = retry-once-same-tier → fail loud + escalation-proposal receipt (`approval.requested`) naming the suggested tier; every standing tier change is a reviewed `router.yaml` diff citing ADR-0069 (MP-A). No component changes a tier at runtime; no auto-learning in v1 (bench owns evidence later) |
| ENG-F | `drivers/mock` ships in Phase 2 as the deterministic test-harness driver (replays pinned outputs): keyless CI for budget/escalation/scrub/boundary fixtures. Excluded from router.yaml and from the ≤3 production-driver cap — it is a harness, not a route |
| ENG-G | `run.completed`'s payload is the cost-attribution surface (policy metric 1); `cost.incurred` stays emitter-less this cycle — one receipt per run, no double-counting. Revisit only via `/arc-change` carrying a concrete metric-1 gap |

## Non-negotiables

- Adversarial breaking-input pass on process-lint, compiler, and every driver wrapper
  before FAIL promotion (parser-class rule).
- The 20 non-pilot commands stay hand-written and untouched this cycle; agent files
  untouched (commands only, v1).
- `arc-run` headless only — it never wraps interactive sessions.
- Every run emits `run.completed` with the **full REQ-05 payload** via the standard
  emitter. A run missing its fingerprint is a defect, not a style choice (0069 names
  "skipped exactly when someone is in a hurry" as MP-F's failure mode — Phase 3 counts it).
- Absent cost/effort fields stay absent — recorded, estimated and fabricated are three
  different things (0069 b(5)).
- Zero-dep Node + POSIX inherited; no LangChain-class dependencies; no SDK lock-in in
  drivers (plain HTTP for generic-api).
- Closed event vocabulary untouched (ADR-0026): reuse `run.completed` +
  `approval.requested`, extend nothing.
- All new lint starts WARN in TRIAL; evidence bundles lane-scoped (ADR-0055).
- `processes/`, `engine/`, `drivers/` are company organs at repo root (ADR-0053) — never
  per-lane.

## No-gos

- No bench RUNNER (fixtures only) · no auto-updating router · **no runtime
  auto-escalation in any form** · no >3 production drivers · no full canonicalization of
  all 23 commands · no agent-file canonicalization · no local-model driver (ollama/vLLM =
  separate brief, pulled by cost or privacy need) · no prompt-optimization tooling ·
  no metric dashboards or reader tooling (computable payloads ≠ instrumented reporting) ·
  no `cost.incurred` emitter (ENG-G) · no amending ADR-0069 from inside the cycle except
  the two named cases (trigger-three; a "which model where" gap per 0069's revisit trigger).

## Rabbit holes (named detours)

- Perfect abstract-tool taxonomy — start with 6 (`fs.read, fs.write, shell.run,
  web.search, git.op, ask.human`), extend by ADR only.
- YAML schema elegance · driver feature-parity chasing (drivers differ; the OUTPUT
  CONTRACT is the equalizer) · benchmarking temptation.
- Fingerprint tooling — MP-F is fields in payloads the engine already writes, not a
  collector (0069 non-negotiable A2).
- CLI namespace bikeshed: decide ONCE at kickoff between `arc-run`/`arc-compile` and
  `arc engine run|compile` — bench's brief assumes `arc engine bench`, so the namespace
  chosen here is the one bench inherits. Decide, record in ENG-D's ADR, spend zero
  further minutes.

## Assumptions ledger (cap 7 — no falsification trigger, no entry)

| Assumption | How we'd know it's wrong (trigger) | Phase that tests it |
|---|---|---|
| Pilot prose is genuinely dialect-neutral once placeholders are extracted | REQ-02 convergence requires a per-target prose block → ENG-A sub-decision violated; STOP, rethink the canonical format before Phase 2 | 1 |
| A second dialect can actually RUN the pilots, not just render them | Golden emitted but no real end-to-end invocation completes → REQ-03 is paper compliance; record honestly, demote codex target to documentation status | 1/3 |
| Provider usage data is available per call on the generic-api path | Chosen endpoint returns no usage block → cost lands **absent** (never client-side token-counted); noted as a bench constraint | 2 |
| The 6-tool abstract taxonomy covers the 3 pilots | A pilot step needs a 7th tool → extend by ADR, never inline | 0 |
| Sidecar cost files behave identically on all 3 CI OSes | A CI leg diverges → fall back to a stdout-frame protocol by ADR | 2 |
| One real dogfood week fits inside Phase 3's 2d | <3 real non-Claude runs by seal → Phase 3 closes with the receipt count it truly has; north-star marked unmet, retro decides next | 3 |

## Pre-mortem (top 5 — seeded from history first)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Compile output never converges byte-identical (files too idiosyncratic, or drifted mid-cycle — they are ALREADY drifting: C4 + C5 both edited a pilot) | Pilot order simple→complex; kickoff re-pins pilot bytes at a named commit; kill criteria at 50% names this exact exit; "documented canonical + hand dialect" is banked value |
| 2 | Generic-api driver quality embarrasses the contract | Schema + fail-loud + proposal receipt make weak output visible; REQ-04 fixtures prove the ladder, mock driver proves it keylessly in CI |
| 3 | Secrets or bounded data leak through an external driver | REQ-07 scrubber (SPINE-E deny-patterns) + data-boundary refusal (exit 5), both fixture-proven |
| 4 | Silent drift: someone edits a generated file | ENG-B DO-NOT-EDIT header + lint (WARN-first, trial-ledger row) |
| 5 | Payload discipline decays under time pressure (0069 predicts this exact failure for MP-F) | Fingerprint-missing `run.completed` = lint WARN (promotable only via trial-ledger evidence); the Phase-3 dogfood week counts absent-field runs and the retro reads the count |

## External dependencies (interface + fake + real + contract test per dep)

| Dependency | Interface | Fake | Real | Contract test |
|---|---|---|---|---|
| claude-code CLI | `drivers/claude-code` | `drivers/mock` (pinned replay) | local CLI | pilot fixtures headless, schema-validated |
| codex CLI / agentsmd runtime | `drivers/codex` | `drivers/mock` | local CLI | golden + one real end-to-end invocation (assumption 2) |
| generic-api endpoint (OpenRouter/LiteLLM-style) | `drivers/generic-api`, plain HTTP | `drivers/mock` | model id pinned in router.yaml | schema-validated fixture run + usage-block presence probe (assumption 3) |

## Phases (risk-ordered; appetites are ceilings)

| Phase | Capability | Appetite |
|---|---|---|
| 0 | `processes/` format v1 + process-lint (hostile fixtures + adversarial pass) + 3 pilots canonicalized + eval fixtures written (task-class-tagged, revisioned, ≥5 per exercised class) | 4d |
| 1 | `arc-compile`: pilot bytes re-pinned at a named commit → claude-code target → **3/3 byte-identical proof** → flip source of truth; codex target + goldens | 3d |
| 2 | Engine: 3 drivers + `drivers/mock` + `arc-run` (hard budgets, fail-loud + proposal receipts, full `run.completed` payload, secret scrub + data-boundary refusal) + `router.yaml` (policy-derived, verifier row, data classes) + `--driver auto` | 4d |
| 3 | Dogfood + seal: one real week where commit-msg drafting runs via `arc-run` on a non-Claude driver ≥3× · fourth-driver stub receipt (<1h, ENG-F pattern) · absent-field payload count · retro + lint promotions review | 2d |

**North-star:** the 3 pilot processes run on 2+ drivers with identical contract
compliance; a NEW driver is one shim file, proven by the <1h stub receipt; and when
bench's trigger later fires, its kickoff inherits task-class fixtures, eval revisions,
driver versions and eligible cost evidence that **already exist** — zero
re-instrumentation, exactly as this cycle inherited its policy from ADR-0069.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (only after a trigger fires)

```
/arc-kickoff --lane engine Model-agnostic foundation — engine v1 + process-layer pilot

Design source: docs/strategy/plans/PLAN-engine-process-layer.md (v2, approved; trigger
fired: <state which — if the second-runtime trigger, write the one-paragraph ADR-0069
block-(d) amendment FIRST>). Read it fully. Decisions ENG-A..G are locked; assign them
the next free ADR numbers. Routing, tiers and receipt schema are INHERITED from ADR-0069
— this kickoff decides zero new "which model where" forks. REQ-02's byte-identical gate
is the heart: re-pin the 3 pilot files at a named commit before writing specs; drift
since this plan is flagged, never silently absorbed. No runtime auto-escalation anywhere
(0069 b(1)) — escalation ends in a proposal receipt, and tier changes are reviewed
router diffs. STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before
Phase 0 code.
```

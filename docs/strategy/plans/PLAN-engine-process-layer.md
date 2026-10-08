# PLAN (design source) — Model-Agnostic Foundation: engine v1 + process-layer pilot

> **Freeze log:** v1 2026-07-22 (pre-lanes draft) → v1.1 2026-08-02 (C5's 2-item queue
> note: ADR-0069 inheritance + ENG-E conflict flagged) → **v2 2026-08-02, full lane-era
> redraft:** the queue is absorbed into the body; routing/tiers/receipts inherited from
> ADR-0069; ENG-E ladder reconciled with 0069 b(1) (auto-step dropped, proposal receipt
> instead); policy metrics 1–3 made computable via the `run.completed` payload; bench
> handshake added (task-class-tagged fixtures, eval revisions, driver `--version`);
> kickoff prompt rewritten to lane grammar (ADR-0054); appetite made honest at 2.5w.
> Decisions ENG-A..G locked; real ADR numbers assigned at kickoff from the next free slot.
> → **v2.1 2026-10-07, Amendment 1 (`/arc-change --lane engine`, owner-raised):** ENG-H —
> fallback is governed by a failure classifier and a per-chain budget, not merely configured
> as a list. Adds REQ-08, one assumption row and one next-cycle phase; ENG-A..G untouched.
> The lane is IDLE (Cycle 7 closed at Phase 08), so this is NOT a live phase spec — it is
> built at the next `/arc-kickoff --lane engine`. Full text: § Amendment 1 below.
> → **v2.2 2026-10-08, Amendment 2 (`/arc-change --lane engine`, from the Cycle 8 retro):**
> ENG-I the logic attacker leaves its trial (a router row, `independent-family-verifier` filled
> by its own ADR-0069 amendment, a governed chain) · ENG-J ci-digest exits 5 on a CONFLICTING PR
> with no run · ENG-K `nonneg-drift` skips closed phases. Next cycle; full text: § Amendment 2.
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
| REQ-08 *(Amendment 1, next cycle)* | A fallback never re-sends a prompt for a failure no other model would fix, and never spends past its chain's terms | Every failed attempt carries one `FailureClass` from a closed set of six; a hop is taken ONLY for `transport`/`provider-unavailable`, at most once (cross-family) for `model-invalid`, never for `policy-refusal`/`budget`/`unknown`. Every routed chain declares `max_attempts`, `max_wall_ms`, `max_cost`; a missing term is a router LOAD fault, and a hop that would breach any term is refused before it spends. Every hop's class is on the `run.completed` payload (zero new kinds). Proven by the four invariants in § Amendment 1, including a mutant that drops the classifier and must turn the suite red | next (09) |

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
| ENG-H *(Amendment 1, 2026-10-07)* | **Fallback is governed, not listed.** One module owns a closed `FailureClass` enum (`transport` · `model-invalid` · `provider-unavailable` · `policy-refusal` · `budget` · `unknown`) and the one pure decision `nextHop(chain, hops)`; arc-run's fallback loop consults nothing else. Hop rules: `transport`/`provider-unavailable` may hop; `model-invalid` hops at most once and only to a different model family; `policy-refusal`, `budget` and `unknown` never hop — they surface. Every chain declares `max_attempts`/`max_wall_ms`/`max_cost`. A hop keeps the ROUTED tier and never lands in a tier it was not routed to. Driver exit map stays 0/1/2 (ADR-0219); the class travels in the cost sidecar (the ENG-D channel). Detail and kickoff forks: § Amendment 1 |

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
| *(Amendment 1)* Each driver can tell transport from model failure from what it observes | A driver's transport failures and bad answers reach it as the same signal (e.g. a CLI that exits 1 with indistinguishable stderr for overload and for a refusal) → that driver declares `unknown`, so every chain through it stops hopping; recorded per driver, never papered over with a stderr regex guess | next (09) |

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
| next (09) *(Amendment 1)* | Governed fallback (ENG-H / REQ-08): `FailureClass` module + `nextHop` · driver-declared class in the sidecar · chain terms in `router.yaml` enforced at load and before every hop · per-hop record on `run.completed` · the four invariants + the classifier-drop mutant · two-surface adversarial pass. Numbered at kickoff (lane's next free phase is 09); the kickoff may split it by risk | 3d (ceiling) |

**North-star:** the 3 pilot processes run on 2+ drivers with identical contract
compliance; a NEW driver is one shim file, proven by the <1h stub receipt; and when
bench's trigger later fires, its kickoff inherits task-class fixtures, eval revisions,
driver versions and eligible cost evidence that **already exist** — zero
re-instrumentation, exactly as this cycle inherited its policy from ADR-0069.

---

## Amendment 1 (2026-10-07) — ENG-H: fallback is governed by a failure classifier and a per-chain budget

**Routed by** `/arc-change --lane engine`, raised by the owner on 2026-10-07. The engine lane is
IDLE and Cycle 7 closed at Phase 08, so this is a design-source amendment for the **next**
`/arc-kickoff --lane engine` and not a live phase spec. It decides no tier and adds no provider.

### The problem, verified against the code (main @ `9864ee29`)

- `engine/router.yaml` carries a `fallback:` list per class, and ADR-0225 validates every hop
  for driver-set membership and the runtime grant. What a hop is FOR is decided by nothing more
  than `a.verdict === "driver"` (`arc-run.mjs`, the `while` at ~L2025). `attempt()` (~L1823)
  sorts a result into `budget | harness | policy | driver | schema | ok`, and **`driver` is a
  catch-all**: any non-zero exit that is not 2 and not a policy denial lands there, so a
  connect error, a 503, a provider refusal (fixture 10's 403) and a driver that crashed on its
  own bug all walk the chain the same way.
- The only classification that exists was added as bug fixes, one arm at a time — the budget
  arm (a timeout spent the budget again per driver), the overflow arm (arc-run's own ceiling
  blamed on the driver), the policy arm (one denial became three incidents). The comment near
  ~L617 records a dispatch shape that "went straight past the boundary with no classification
  at all". Each fix closed one shape; none made classification first-class.
- `generic-api` already knows the difference internally (it retries 429/5xx, then throws
  `transport failed after N attempt(s)`) and then reports it upward as a bare exit 1, which
  arc-run cannot tell apart from a model answer it could not parse.
- Chains carry no terms of their own. The run's `--budget inr=,min=` bounds the RUN, but a chain
  has no `max_attempts`, no wall cap and no money cap, so how much a fallback may spend is a
  property of whoever called arc-run, not of the route.

### The decision (ENG-H) — what the kickoff inherits as locked

1. **One module, one enum, one decision.** `FailureClass` is a closed set of six, owned by ONE
   module (next to `router-row.mjs`), together with the pure function `nextHop(chain, hops)`.
   arc-run's fallback loop asks `nextHop` and nothing else; there is no second copy of the rule
   in arc-run, bench or a driver (the "validate one read, compare another" twin this lane has
   closed three times).

   | class | meaning | hops? |
   |---|---|---|
   | `transport` | connect / DNS / TLS / 5xx / a **per-attempt** timeout before the first token — the request never reached a model that answered | yes |
   | `provider-unavailable` | 429 / 503 / overloaded **after** the driver's own transport retries (ADR-0203) are spent; or the driver is not installed / did not launch | yes |
   | `model-invalid` | a model answered and the answer failed the contract (not JSON, or `validateData` faults) | **at most once, and only to a different model family** |
   | `policy-refusal` | arc's policy gate denied, or the provider refused the request on policy/content grounds | **never** — no other driver is more permitted |
   | `budget` | the RUN's deadline, `inr` spent, the driver declined for budget (exit 2 — this includes the capped key's HTTP 403 `Key limit exceeded`, which `drivers/hermes` already maps to BUDGET_DECLINED per ADR-0213 / fixture 10), arc-run's output ceiling, or a chain term would be breached | **never** — the next hop spends again |
   | `unknown` | anything not positively classified, including a driver exit 1 that declared no class | **never** |

2. **`unknown` does not hop, and that is a behaviour change on purpose.** Today an undeclared
   driver failure falls back. After ENG-H it surfaces. A chain through a driver that declares
   nothing therefore stops hopping until that driver classifies its failures — named, not
   hidden, and counted at kickoff (assumption row above).

3. **Where the class comes from.** arc-run classifies what it observes itself (timeout against
   the run deadline → `budget`, policy denial → `policy-refusal`, exit 2 → `budget`, overflow →
   `budget`, not-launched → `provider-unavailable`, exit 0 with a contract fault →
   `model-invalid`). For a driver exit 1, the driver DECLARES its class in the cost sidecar
   (`failure_class`, the ENG-D channel; `writeCost` already carries non-cost facts — `model`,
   `runtime` — for exactly this reason). The **exit map stays 0/1/2** (ADR-0219): no new exit
   code. A declared value outside the closed set is `unknown`, loudly; a declaration on exit 0
   or exit 2 is ignored, because those codes already decide the class.

4. **A per-attempt timeout is not the run's deadline.** Invariant (a) depends on keeping the two
   apart: generic-api's own attempt cap expiring with run time left is `transport` (hops); the
   run's `ARC_DRIVER_DEADLINE_EPOCH_MS` passing is `budget` (never hops). Conflating them is the
   exact defect the timeout arm was written to remove.

5. **Chain terms.** Every class row AND `default:` in `router.yaml` declares
   `max_attempts` (integer ≥1, counting every attempt including ADR-0204's same-tier retry),
   `max_wall_ms` (integer ms) and `max_cost` (integer **paise**, the unit `writeCost` already
   uses). A row missing any of the three is a **load fault** reported by `router-row.mjs`, like
   the four hire terms — a term that only fails when used sits wrong for as long as nobody uses
   it. The effective bound is the tighter of the chain term and the caller's `--budget`.

6. **Refuse before spend, deterministically.** `nextHop` is pure over `(chain terms, hops so far)`
   where each hop records `{driver, class, ms, cost?}` as MEASURED. It refuses the next hop when
   `attempts + 1 > max_attempts`, when elapsed `≥ max_wall_ms`, or when spend so far `≥ max_cost`;
   a started hop gets `min(run remaining, max_wall_ms − elapsed)` as its timeout, so it cannot run
   past the term. Replaying the same recorded hops yields the same decision — that is invariant
   (c)'s "replay-deterministic", and it is why the clock is an input, never read inside.

7. **The hop record — zero new kinds.** The receipt kind stays `run.completed`, and its existing
   `reason` field keeps its current values (`budget | policy | schema | driver | …`) so no reader
   breaks. Two fields are added to that payload: `failure_class` (the final attempt's class) and
   `hops: [{driver, tier, class, ms, cost?}]`, one entry per attempt. The ledger prices fallbacks
   from `hops`; the escalation proposal stays `approval.requested` exactly as ADR-0204 has it.

8. **No promotion.** Every hop keeps the routed `tier` (each hop's `tier` is recorded so this is
   checkable); the pin is recomputed per driver UNDER THAT TIER, as arc-run already does. A hop
   never lands in a tier it was not routed to, and `independent-family-verifier` stays empty by
   default (ADR-0069's unoccupied slot; ADR-0225's reach rule) — a fallback is never how it gets
   filled.

### Invariants the kickoff must pin (owner-written, verbatim intent)

- **(a)** A wall-time timeout classified `transport` falls back; the same prompt classified
  `model-invalid` falls back once and stops.
- **(b)** `policy-refusal` never reaches a second driver — pinned with a fake driver that
  refuses, and the second driver's invocation count read as ZERO (it ran = it was counted).
- **(c)** A chain budget breach refuses the hop **before** spend, and the decision is
  replay-deterministic.
- **(d)** An unclassified failure is `unknown` and does NOT fall back — **the mutant that drops
  the classifier must fail the suite** (the mutant IS the negative control, per this lane's
  non-negotiable).

### Forks left to the kickoff — each with a recommendation, none decided here

- **F1. ADR-0204's same-tier retry vs ENG-H's cross-family hop for `model-invalid`.**
  *Recommendation:* when the chain holds a different-family entry, the cross-family hop REPLACES
  rung 1; when it does not, rung 1 stays. Either way at most ONE extra attempt for a contract
  fault, then the proposal receipt. Two extra attempts (retry + hop) is the "fail three times
  instead of once, slower" shape router.yaml already warns about.
- **F2. Model family for `generic-api`.** It reaches a gateway, so its family is the profile's
  model, not the driver. *Recommendation:* family is read from the resolved pin/profile; an
  unknown family is treated as SAME family (fail closed: no cross-family hop).
- **F3. `max_cost` when a prior hop reported no spend.** ADR-0069 b5 forbids estimating.
  *Recommendation:* fail closed — an absent figure means the spend is unproven, so no further
  hop under a finite `max_cost`; the kickoff measures which drivers actually report `inr` and
  says what that does to each live chain before any row is written.
- **F4. Explicit `--driver` runs** (bench, arc-attack's trial) consult no row and therefore
  have no chain. *Recommendation:* they keep no chain and gain only the `failure_class`/`hops`
  record; ENG-H governs the routed path.

### Blast radius the kickoff must count before writing specs

- Every fixture `router.yaml` under `tests/` gains three required terms (a missing term faults
  the load) — count them; `engine-router-row.bats` is the known heavy one.
- Drivers: `generic-api` declares `transport`/`provider-unavailable` from what it already knows;
  `claude-code`, `codex`, `hermes` and `mock` each need a declared class or they read `unknown`.
  `mock` must be able to replay any class (a `__failure_class` recording key, stripped like
  `__cost`), or the invariants cannot be proven offline (ENG-F).
- Readers of `run.completed` (`hq/lib/face/reads.mjs`, `jobs/audit.mjs`, the ledger lane, bench)
  must tolerate the two new payload fields; none may start depending on `reason` changing.

### Out of scope / no-gos

Adding providers · auto-switching (ADR-0069 b1 forbids it) · changing any tier · a new spine
kind · a new driver exit code (ADR-0219) · filling `independent-family-verifier`.

---

## Amendment 2 (2026-10-08) — Cycle 8 retro: three items for the next engine cycle

**Routed by** `/arc-change --lane engine` from the Cycle 8 retro (`docs/retro-log.md`, rows dated
2026-10-08), each item approved by the owner the same day. The lane is IDLE (Cycle 8 closed at
Phase 10), so this is a design-source amendment for the **next** `/arc-kickoff --lane engine`, not
a live phase spec. Numbers (REQ, ADR, phase) are assigned at that kickoff, from engine's ADR band.

### ENG-I — the logic attacker leaves its trial: a router row, a tier, a governed chain

- **Verified (main @ `6f7cd6a5`):** `engine/router.yaml` gives the logic-surface attacker no row
  on purpose and states the exit condition itself: once it "has run on more than one phase's PRs
  it is production use, and it needs an ADR-0069 amendment filling `independent-family-verifier`
  plus a row of its own -- or it stops." It has run on PRs in org C17, C18, C20 and engine C8.
- **The cost of leaving it:** in all four cycles the logic surface failed through `/arc-attack`
  and was re-run by hand on another model; three advisory retro rows (2026-10-02, -03, -05) did
  not stop it. Cycle 8 built the exact mechanism that would: a classified failure that hops.
- **What the kickoff decides:** an ADR amending ADR-0069 that fills `independent-family-verifier`
  (a production tier change — a reviewed diff citing ADR-0069, per AGENTS.md), and an
  `attack-diff-logic` row with the three ENG-H chain terms.
- **Fork, with a recommendation:** router.yaml's attack row says "quietly swapping an attacker onto
  another model family is not a fallback, it is a different attacker." *Recommendation:* a hop is
  allowed only inside the non-Claude set the tier names, and the attack report names the model
  that produced it, so the swap is visible rather than quiet. That is what is done by hand today,
  unreceipted.
- **Pin:** a logic run whose first model fails `transport`/`provider-unavailable` produces a
  report from the second model with no human step, and its receipt carries both hops.

### ENG-J — ci-digest tells "no run yet" from "no run ever"

- **Verified:** `.claude/scripts/review/ci-digest.mjs` exits 3 for both "no run yet" and "jobs
  still running". GitHub builds no `refs/pull/N/merge` for a CONFLICTING PR, so no run ever comes,
  and the background watch loop (exit 3 = keep waiting) waits to its deadline. PR #375 lost three
  hours this way; the 2026-08-13 arc-ledger row had already named the cause.
- **Change:** when the head SHA has no run, read the PR's `mergeable` state; on `CONFLICTING`,
  exit with a new code of its own (5) and print the fix: regenerate the generated files on the
  merged tree. `UNKNOWN` (GitHub still computing) stays 3.
- **Blast radius counted:** callers are `.claude/commands/arc-attack.md`, `tests/engine-attack-diff.bats`,
  `tests/engine-attack-probe.mjs`; the watch loops in AGENTS.md and memory break on any non-3 code,
  so a new code stops them, which is the point. The sync golden lists the file.
- **Pin:** a fixture `gh` answering no runs + `CONFLICTING` exits 5; no runs + `MERGEABLE` exits 3.

### ENG-K — kickoff-lint's `nonneg-drift` stops judging closed phases

- **Verified:** `kickoff-lint.mjs` § 8d compares every `phases/phase-NN-spec.md` against the live
  PLAN's non-negotiables, done or not. Engine's `phase-00-spec.md` (parked, shipped in Cycle 6)
  WARNs against Cycle 8's PLAN on every run, a false positive logged in `docs/trial-ledger.md`
  2026-10-08 that resets the gate's promotion count.
- **Change:** skip a spec whose phase row in PLAN/PROGRESS is done (✅) or parked; a closed phase's
  spec is history, and no executor reads it.
- **Pin:** a fixture with a drifted done-phase spec is clean; the same drift on an open phase still
  WARNs (the mutant that skips every spec must fail).

### No-gos (this amendment)

Auto-switching (ADR-0069 b1) · a new spine kind · any change to ENG-H's six classes · ENG-I is the
ONLY tier change, and it overrides Amendment 1's "filling `independent-family-verifier`" no-go by
name, through its own ADR.

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

**Amendment 1 kickoff (the next engine cycle).** Paste instead:

```
/arc-kickoff --lane engine Governed fallback -- a failure classifier and a per-chain budget (ENG-H)

Design source: docs/strategy/plans/PLAN-engine-process-layer.md § Amendment 1 (v2.1). ENG-H
is locked; assign it the next free engine ADR number (0228 was free on main at 2026-10-07 --
re-sweep origin/* and sibling worktrees first). REQ-08 is the cycle's REQ; its four
invariants (a)-(d) are acceptance, and (d)'s classifier-drop mutant is the negative control.
Resolve forks F1-F4 with the recommendations unless evidence says otherwise, and count the
blast radius (fixture routers, driver declarations, run.completed readers) before writing
specs. No tier changes, no providers, no new spine kind, no new exit code.
```

# PLAN (design source) — Model-Agnostic Foundation: engine v1 + process-layer pilot

> **Trigger (pull, any one):** arc public-release prep starts · a second runtime is
> genuinely needed for real work · a model-price/quality event makes single-vendor risk
> concrete. **Prerequisites:** Cycle 2 (spine) closed — engine runs emit `run.completed`
> events with cost. **Do not start before a trigger fires** (Constitution A8).

## Goal

One sentence: arc's processes stop being Claude-Code-dialect prisoners — a canonical
model-neutral process layer (3 pilot commands, byte-diff-proven) plus an engine that runs
any process on any of 3 drivers with hard budgets and a hand-edited routing table — so
models become swappable parts and every future model is an upgrade, not a migration.

## Current state (as of 2026-07-22 — re-verify at kickoff)

- 22 commands / 23 agents in Claude Code dialect under `.claude/` — substance and dialect
  are fused; ADR-0013 already keeps ENGINE SCRIPTS model-free ("assume no Claude").
- Scripts re-homed per product (`.claude/scripts/{core,council,plan,review}`); registry +
  selective install live; spine expected live (Cycle 2) — engine events land on it.
- `.codex/` dir and `AGENTS.md` exist at root (early multi-tool experiments) — adapters
  formalize what these started.
- Nothing exists of: `processes/`, `adapters/`, drivers, router, `arc-run`.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | One canonical truth per pilot process | 3 pilots canonicalized — `arc-commit` (simple), `arc-review` (medium), `arc-kickoff` (complex) — as `processes/NAME.process.yaml`: intent, inputs, steps, abstract tool needs, output JSON schema, eval fixture refs, semver. Schema-validated by a new `process-lint` (hostile fixtures pinned: bad YAML, missing schema, unknown tool, cyclic includes) | 0 |
| REQ-02 | Compile, don't rewrite — proven | `arc-compile --target claude-code` regenerates the 3 pilot command files **byte-identical** to the current hand-written `.claude/commands/*` (LF-normalized; the arc-bytediff method). Only after 3/3 byte-identical does the canonical file become source of truth (header comment marks generated files) | 1 |
| REQ-03 | A second dialect exists | `arc-compile --target codex` (or agentsmd) emits a runnable equivalent for the 3 pilots; goldens pinned; regeneration only via reviewed diff (the existing golden-fixture rule extended) | 1 |
| REQ-04 | Any process, any driver, one interface | `arc-run --process commit-msg-draft --driver X` works headless for X ∈ {claude-code, codex, generic-api}; output validates against the process's JSON schema on ALL drivers; schema-fail → one retry → escalate one tier → flag (fixture-proven) | 2 |
| REQ-05 | Budgets are hard | `--budget inr=N,min=M` enforced: a fixture process that would exceed budget is stopped and reports `outcome: fail/budget` — never silently continues; spend lands on the spine as `run.completed` cost | 2 |
| REQ-06 | Routing is explicit, not magic | `engine/router.yaml` (hand-edited): task-class → driver + fallback chain; `arc-run --driver auto` resolves through it; unknown class → loud error with the file to edit | 2 |
| REQ-07 | No secrets leak through drivers | Driver logs/transcripts scrubbed by the same deny-pattern scanner as the spine (SPINE-E); fixture: a fake key in process input never appears in any driver artifact | 2 |

## Appetite

**2 weeks hard cap.** Tier: M.
**Kill criteria:** 50% burnt without REQ-02 (byte-identical proof) → the compile approach
is wrong for this codebase; bank process-lint + canonical files as documentation, stop,
retro. Generic-api driver flaky beyond 2 days of fixes → cut to 2 drivers (claude-code +
codex), bank, note the third as demand-triggered.

## Decisions to ADR at kickoff

| ID | Decision |
|---|---|
| ENG-A | Canonical format: YAML process files, one per command/agent; JSON-schema output contracts; semver per process; `processes/` at repo root |
| ENG-B | Adapters are pure functions canonical→dialect; generated files carry a DO-NOT-EDIT header; hand-edits to generated files = lint failure (WARN-first) |
| ENG-C | Byte-diff gate is MIGRATION-ONLY; post-flip regression = schema validation + eval fixtures + reviewed goldens |
| ENG-D | Driver interface: `drivers/NAME.sh run <process> <input-json> <budget>` → output-json on stdout, cost on fd3/sidecar; generic-api via OpenRouter/LiteLLM-style endpoint, model pinned in router.yaml |
| ENG-E | Escalation ladder fixed: retry-once-same → one-tier-up → flag human. No auto-learning in v1 (bench owns that later) |

## Non-negotiables

- Adversarial breaking-input pass on process-lint, compiler, and every driver wrapper
  before FAIL promotion (parser-class rule).
- The 19 non-pilot commands stay hand-written and untouched this cycle.
- `arc-run` headless only — it never wraps interactive sessions.
- Every run emits `run.completed` (+cost) to the spine via the standard emitter.
- Zero-dep Node + POSIX inherited; no LangChain-class dependencies, no SDK lock-in in
  drivers (plain HTTP for generic-api).
- Eval fixtures for the 3 pilots exist from Phase 0 (cheap now, bench's fuel later).

## No-gos

- No bench RUNNER (fixtures only) · no auto-updating router · no >3 drivers · no full
  canonicalization of all 22 commands · no agent-file canonicalization (commands only, v1)
  · no local-model driver (ollama/vLLM = separate brief, pulled by cost or privacy need)
  · no prompt-optimization tooling.

## Rabbit holes

Perfect abstract-tool taxonomy (start with 6: fs.read, fs.write, shell.run, web.search,
git.op, ask.human — extend by ADR) · YAML schema elegance · driver feature parity chasing
(drivers differ; the OUTPUT CONTRACT is the equalizer) · benchmarking temptation.

## Pre-mortem (top 4)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Compile output never converges to byte-identical (hand-written files too idiosyncratic) | Pilot order simple→complex; kill criteria at 50% names this exact exit; even "documented canonical + hand dialect" is banked value |
| 2 | Generic-api driver quality embarrasses the contract | Schema + escalation make weak output fail LOUD; REQ-04 fixture proves the ladder |
| 3 | Secrets in driver transcripts | REQ-07 scrubber + fixture; same deny-patterns as spine |
| 4 | Silent drift: someone edits a generated file | ENG-B DO-NOT-EDIT header + lint (WARN-first) |

## Phases

| Phase | Capability | Appetite |
|---|---|---|
| 0 | `processes/` format + process-lint (hostile fixtures + adversarial pass) + 3 pilots canonicalized + eval fixtures written | 4d |
| 1 | `arc-compile`: claude-code target → **3/3 byte-identical proof** → flip source of truth; codex/agentsmd target + goldens | 3d |
| 2 | Engine: 3 drivers + `arc-run` (budgets, escalation, spine events, secret scrub) + `router.yaml` + `--driver auto` | 4d |
| 3 | Dogfood + seal: one real week where commit-msg drafting runs via `arc-run` on a non-Claude driver at least 3× · retro · lint promotions review | 2d |

**North-star:** the 3 pilot processes run on 2+ drivers with identical contract compliance,
and a NEW driver can be added by writing one shim file — measured by actually stubbing a
fourth driver in <1 hour during Phase 3.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (only after a trigger fires)

```
/arc-kickoff Model-agnostic foundation — engine v1 + process-layer pilot

Design source: docs/strategy/plans/PLAN-engine-process-layer.md (approved; trigger fired:
<state which>). Read it fully. Decisions ENG-A..E are locked; assign them the next free
ADR numbers. REQ-02's byte-identical gate is the heart — if the pilot files have drifted
since this plan, flag before writing specs. STOP after PLAN.md + phase specs +
kickoff-lint pass — I approve before Phase 0 code.
```

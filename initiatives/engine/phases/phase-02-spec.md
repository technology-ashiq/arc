# Phase 02 — The engine: one interface, three drivers, hard budgets

**Goal (one line):** `arc-run` executes any canonical process headless on any of three drivers
behind one interface, enforces a hard budget, validates output against the process's schema,
escalates to a proposal receipt instead of a tier change, scrubs secrets from every artifact, and
routes through a hand-edited `engine/router.yaml`.

**Appetite:** 4 days
**Depends on:** phase-01

Serves **REQ-04** (any process, any driver, one interface), **REQ-05** (budgets are hard),
**REQ-06** (routing is explicit), **REQ-07** (no secrets leak through drivers).

## What this phase actually builds

- `.claude/scripts/engine/arc-run.mjs` — headless only, never wrapping an interactive session.
  Flags: `--process`, `--driver` (a name or `auto`), `--budget inr=N,min=M`, `--input`.
- `drivers/claude-code.sh`, `drivers/codex.sh`, `drivers/generic-api.sh` — the ADR-0203 interface:
  `drivers/NAME.sh run <process> <input-json> <budget>` → output JSON on **stdout**, cost record to
  the **sidecar** path in `ARC_DRIVER_COST_FILE` (not fd3 — fd3 does not survive the Windows leg
  portably, and all three legs gate). stderr is diagnostics and is never parsed. Exit `0` produced
  an answer, `1` driver failure, `2` declined for budget.
- **Each `.sh` is a thin POSIX wrapper over a `.mjs` core**, exactly as `arc-event.sh` wraps
  `arc-event.mjs` (ADR-0031). This is not cosmetic: `council-juror.mjs:144-149`'s exit discipline —
  `process.exitCode`, natural drain, unref'd 250 ms backstop — is **Node-only** and a shell script
  cannot reuse it, so without the wrapper shape the generic-api driver would have to re-derive that
  fix in POSIX/curl and would re-earn retro-log 2026-07-16's Windows libuv assertion the hard way.
- **Runtime permissions come from the Phase-01 mapping table, not a second one.**
  `drivers/claude-code.sh` translates a process's declared `tools:` into the CLI's headless
  permission flags by reusing `adapters/claude-code.mjs`'s table (ADR-0201). If that table cannot
  be reused outside compile time — it is a pure `canonical → text` function, not a runtime lookup —
  that gap is a **named finding before this phase closes**, never a silent second implementation
  that is free to drift from the first.
- `engine/router.yaml` — task-class → driver + fallback chain, hand-edited, read by `--driver auto`.
- `tests/engine-driver-contract.bats` — one contract suite, run against every driver's fake and,
  where installed, its real implementation.

## Inherited, not decided here

`router.yaml` is the **implementation** of ADR-0069 blocks (a) and (b) — tier definitions, the seat
map, the prohibitions. This phase writes zero new "which model where" decisions. `process-lint`
gains a check that FAILs when `router.yaml` names a tier absent from ADR-0069 block (a), so the
table cannot drift away from the policy it implements.

The **known hole to record, not silently fix**: 28 agent files carry 27 `model:` lines —
`spec-fidelity.md` has none — so block (a)'s seat map is one seat short of the live census. Assigning
that seat a tier is a policy change and belongs to `/arc-change` plus a reviewed diff citing
ADR-0069, not to this phase. The router records the gap loudly.

## Escalation, per ADR-0204

`retry once on the same tier` → `emit an approval.requested proposal receipt` → `stop, flagged`.
No component changes a tier at run time. The proposal payload carries the process, the driver, the
failure, the current tier and the proposed tier; the printed ULID is the approval id. Acting on an
approval means a reviewed `engine/router.yaml` diff citing ADR-0069 — never an automatic edit.

`fault_hint` is populated by first validating the process's own pinned eval fixture output against
its own schema: fixture fails → fault is `process`, and no driver is accused; fixture passes and
the live run fails → fault is `driver`. It rides as a payload sub-field, so the closed 22-kind
vocabulary is untouched.

## Budgets and cost, per REQ-05

Both bounds are hard: `inr` and `min`. A run projected to exceed either is stopped **before** the
spend, and reports `outcome: fail` with a budget reason. Money follows the spine's existing rule —
integer minor units (paise), never floats. A driver that crashes before writing its sidecar leaves
the cost **absent**; `arc-run` records absent, never zero and never an estimate (ADR-0069 b5).

Every run emits `run.completed` through `arc-event.sh` with `--process NAME@SEMVER`, `--model`,
`--cost` and `--outcome`. Both kinds are already in the closed vocabulary, so there is no
ADR-0026 extension. The emit is **verified to have landed** — the run checks `events/` and
`_quarantine/` and reports where the receipt actually went, because exit 0 from a fire-and-forget
writer is not evidence that anything was written.

## Secrets, per REQ-07

Four artifact classes are scanned, not one: driver **stdout**, the driver **transcript**, the
**cost sidecar**, and the **spine payload**. The scanner is the spine's own `scanSecrets()` and
`DENY_RULES` from `.claude/scripts/hq/lib/redact.mjs`, imported — never a second copy that drifts.
The fixture plants 3 keys matching live rules, and a negative control proves the check can fail.

## Rabbit holes in this phase

- **Driver feature parity.** Drivers differ; the output contract is the equalizer. Chasing parity
  is how 4 days becomes 3 weeks.
- **A clever router.** Hand-edited YAML, an unknown class exits non-zero naming the file to edit.
  No inference, no defaults that guess.
- **Abrupt exit in the fetch-based driver.** Copy `council-juror.mjs:144-149` — `process.exitCode`,
  natural drain, unref'd 250 ms backstop. Retro-log 2026-07-16 already paid for this lesson.
- **Two unbounded retry loops.** Both bounds are fixture-proven; an unbounded one is a hang, not a
  failure.

## Out of scope for this phase

- Real-work runs, the 4th-driver timing, retro and lint promotions → Phase 03.
- Computing any of ADR-0069's five metrics — the receipt is provided, the metric is another cycle.
- Anything in the PLAN's `## No-gos`.

## Exit criteria (Definition of Done)

- [ ] `arc-run --process commit-msg-draft --driver X` runs headless for all 3 drivers, output
      validating against the process schema on each
- [ ] the escalation ladder is fixture-proven end to end, terminating in an `approval.requested`
      receipt with `fault_hint` correct for both a driver fault and a process fault
- [ ] a fixture process exceeding either budget bound is stopped and reports `outcome: fail` with a
      budget reason, and never spends
- [ ] `run.completed` receipts are confirmed present in `events/` and absent from `_quarantine/`
- [ ] an absent cost field is recorded absent — a fixture asserts it is never zero and never
      estimated
- [ ] `--driver auto` resolves through `engine/router.yaml`; an unknown class exits non-zero naming
      the class and the file; `process-lint` FAILs on a tier absent from ADR-0069 block (a); the
      untiered `spec-fidelity` seat is recorded as a named gap
- [ ] all 4 artifact classes pass `scanSecrets()` with 3 planted keys, and the negative control fails
- [ ] the fresh-agent adversarial pass has run against `arc-run` and all 3 driver wrappers, findings
      fixed and pinned
- [ ] contract tests green against every fake; green against each real implementation that is
      installed, and explicitly recorded as not-run for any that is not
- [ ] tests added and green on all 3 CI legs; CI test-count floor raised
- [ ] tracker updated in `initiatives/engine/PROGRESS.md`, `board-lint.sh` re-run

## Verification plan

Coarse at kickoff, refined when the phase starts (via `/arc-change`): the contract suite
`tests/engine-driver-contract.bats` runs the identical set of assertions against every driver's
fake, so a driver either satisfies the interface or is visibly not a driver; budget, escalation and
secret-scrub each get a fixture plus a negative control.

## Your-setup / pending

An LLM HTTP endpoint (OpenRouter or LiteLLM-style) and its key — **the owner must create the
account, fund it, and export the key before this phase starts.** This is a new external SaaS
dependency with real billing, and it has zero prior art anywhere in this repo's history; every other
setup item in this cycle is either already-installed local tooling or free. It is called out rather
than listed as a checkbox already ticked.

The `codex` CLI installed, for the real arm of the codex contract test.

Both are optional in the sense that every fake runs offline; an uninstalled real implementation is
recorded as not-run, never skipped silently.

**Tripwire:** at 2.0 days inside this phase, if `generic-api` is still flaky, invoke the plan's
second kill criterion — cut to 2 drivers, bank, and note the third as demand-triggered. Read this
line when the phase starts, not after it.

## Non-negotiables (verbatim from PLAN)

- Every gate, lint, parser and driver wrapper this cycle ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture (retro-log 2026-08-02: the author's own 26 inputs found nothing and an unanchored agent then found 9 real holes).
- No component changes a model tier at run time, anywhere, under any condition — every production tier change is a reviewed `engine/router.yaml` diff citing ADR-0069 block (b)(1); escalation ends in a proposal receipt (ADR-0204).
- The 21 non-pilot commands stay hand-written and untouched this cycle, and no agent file is canonicalized.
- `arc-run` is headless only — it never wraps an interactive session.
- Every run emits `run.completed` with its cost through the standard emitter, and the emit is VERIFIED to have landed in `events/` and not in `_quarantine/` — exit 0 from a fire-and-forget writer is not evidence that anything was written (retro-log 2026-08-02).
- An unavailable cost or fingerprint field stays absent — never estimated, never inferred, never interpolated (ADR-0069 block (b)(5) and block (e)).
- Zero-dep Node plus POSIX is inherited: no LangChain-class dependency, no vendor SDK in any driver, plain HTTP for generic-api.
- Eval fixtures for the 3 pilots exist from Phase 0, and every gate ships with a negative control proving the check can fail (retro-log 2026-08-02).
- Editing any file the sync-golden manifest hashes means a named regeneration step: diff the delta first, confirm only intended paths moved, then re-record (retro-log 2026-07-22).
- The CI test-count floor is raised by re-running the count and asserting it equals the live `@test` total, never by hand-typing a number that four separate phase closes must each remember — a hand-maintained count is what rotted silently for five days in arc-orchestrator (retro-log 2026-07-22).

# Cap inventory — the tree as it is, 2026-08-07

Phase 03 · REQ-07 "One source of cap truth, honestly" · lane `policy`.
Taken against `87c968e` (the tree at phase start).

**What counts as a cap here:** something that limits what a run may **spend, consume, or do**.
Not everything numeric. A tier label, a display truncation and a confidence bucket all look like
caps and are none, so each is recorded as **NOT-A-CAP with its reason** rather than dropped — a
row that quietly disappears is indistinguishable from a row nobody looked for.

**The distinction that carries the whole table** is DECLARED versus ENFORCED. A value sitting in
a file is a declaration. A cap is only real if some code path *refuses* because of it, and that
path is named below with its own `file:line`. Where no refusing path exists, the row says **no
enforcer** — that is the finding, not a gap in the survey.

**Method, and its limits.** A survey agent swept the tree; every row below was then re-opened at
its cited `file:line` and checked against the claim (53/53 matched, 0 missing). The three
load-bearing *negatives* — "no driver reads the budget", "`concurrencyRefusal` has no production
caller", "no seat counter exists" — were re-derived independently by grep rather than accepted,
because a negative is exactly where a survey is weakest. This inventory is **scoped to REQ-07's
four named areas plus what materially contradicts the plan**. It is deliberately not every
timeout, `maxBuffer` and ReDoS bound in the repo: inventory completionism is this phase's named
rabbit hole.

---

## 1. Engine budgets — `arc-run --budget`

**`min` is a real cap. `inr` is not, quite.** The minute budget becomes a process timeout with
`SIGKILL` and stops the fallback chain. The rupee budget is compared **after each attempt**, and
no shipped driver reads the budget it is handed — so the money is already spent when the check
runs. `arc-run.mjs:435-437` says so itself.

| `file:line` | What | Verdict | Declared or enforced |
|---|---|---|---|
| `.claude/scripts/engine/arc-run.mjs:59` | `--budget` captured from argv | CAP | parse only; enforcement at :157, :369, :438 |
| `.claude/scripts/engine/arc-run.mjs:128` | `BUDGET_KEYS = ["inr", "min"]` | CAP | closed key set; enforced at :138 |
| `.claude/scripts/engine/arc-run.mjs:138` | unknown budget key | CAP | **ENFORCED** — `process.exit(2)` inline |
| `.claude/scripts/engine/arc-run.mjs:141` | value non-finite or `> 1e9` | CAP | **ENFORCED** — `process.exit(2)` inline |
| `.claude/scripts/engine/arc-run.mjs:153` | `msRemaining()` across the whole run | CAP | consumed at :369 and :445 |
| `.claude/scripts/engine/arc-run.mjs:157-158` | a bound that leaves nothing to spend | CAP | **ENFORCED** — `fail("budget", …)` **before any driver is invoked** |
| `.claude/scripts/engine/arc-run.mjs:369,371,376` | remaining minutes → `spawnSync` `timeout`, `killSignal: "SIGKILL"` | CAP | **ENFORCED** — this is where the time cap becomes real |
| `.claude/scripts/engine/arc-run.mjs:400` | a timeout is attributed to the *budget*, not the driver | CAP | **ENFORCED** — and it is what stops the fallback chain re-spending it |
| `.claude/scripts/engine/arc-run.mjs:438-439` | `overBudget()` on `inr` | CAP | **ENFORCED POST-HOC ONLY** — after the spend, never before |
| `.claude/scripts/engine/arc-run.mjs:445` | both bounds gate the fallback loop | CAP | **ENFORCED** |
| `.claude/scripts/engine/arc-run.mjs:107` | a class the router does not name | CAP | **ENFORCED** — `process.exit(1)`, no route no run |
| `.claude/scripts/engine/drivers/common.mjs:149` | the driver receives `budgetStr` positionally | NOT-A-CAP | received and discarded |
| `.claude/scripts/engine/drivers/common.mjs:194` | `budget` handed to `produce()` | NOT-A-CAP | **no enforcer.** Zero `budget` references in `claude-code.mjs`, `codex.mjs`, `generic-api.mjs` — re-checked by grep, not taken from the survey |

## 2. `engine/router.yaml`

**Contains no spend or usage cap.** It is a class → tier → driver → model table. The one
limit-shaped thing in it is the length of each `fallback:` list.

| `file:line` | What | Verdict | Declared or enforced |
|---|---|---|---|
| `engine/router.yaml:32` | `models:` — tier-to-concrete-model map | **NOT-A-CAP** | selects *which* model runs, never *how much* may be spent. "cheap-scan" is a tier label; nothing compares it to a budget |
| `engine/router.yaml:47` | `tiers:` — the allowed vocabulary | **NOT-A-CAP** | `process-lint` FAILs an unlisted tier, but a tier is a routing label |
| `engine/router.yaml:60, 75, 83` | `fallback:` list length | CAP (weak) | **ENFORCED** by `fallbacks.length` at `arc-run.mjs:445` — bounds how many driver hops a failed run may make |

## 3. `processes/*.process.yaml` — the `permissions:` block

**It caps TOOL SURFACE, not spend.** Two values only. Three readers act on it, and one of the
two values is the *opposite* of a cap.

| `file:line` | What | Verdict | Declared or enforced |
|---|---|---|---|
| `processes/commit-msg-draft.process.yaml:4` | `permissions: declared` | CAP | **ENFORCED** (delegated) via `drivers/claude-code.mjs:34,47` → `--allowedTools`; the CLI is the refusing layer |
| `processes/review-diff.process.yaml:4` | `permissions: declared` | CAP | same |
| `processes/kickoff-plan.process.yaml:4` | `permissions: unrestricted` | **NOT-A-CAP** | the opposite of one: `drivers/claude-code.mjs:34` sets `allowed = null`, so no `--allowedTools` is passed and the process runs with everything |
| `.claude/scripts/engine/adapters/claude-code.mjs:135` | compile-time branch on `declared` | CAP | turns the declaration into a real `allowed-tools:` line |
| `.claude/scripts/engine/adapters/claude-code.mjs:142-143` | `declared` that renders to an EMPTY grant set | CAP | **ENFORCED** — throws at compile time, because an absent line silently means unrestricted |
| `.claude/scripts/engine/drivers/claude-code.mjs:34,47` | run-time reader | CAP | **ENFORCED** (delegated to the CLI) |
| `.claude/scripts/engine/process-lint.mjs:294,296` | missing or invalid value | CAP | **ENFORCED** at lint time — `permissions-invalid` |

**Nothing anywhere reads `permissions:` and refuses a spend.**

## 4. Council mode envelopes

**Prose, with no mechanical enforcer.** The confidence buckets are enforced; the seat and
model-call envelope is not. It is obeyed by the agent choosing to obey.

| `file:line` | What | Verdict | Declared or enforced |
|---|---|---|---|
| `.claude/commands/arc-council.md:222` | **"Seats: 6 max (2 + 3 + 1). Model calls: 7 max."** | CAP (prose) | **NO ENFORCER.** No counter in `council-lint.mjs`, `council-juror.mjs` or `council-calibrate.mjs` — re-checked by grep |
| `.claude/commands/arc-council.md:46` | "Ceiling 4" on matched domain experts | CAP (prose) | **NO ENFORCER** |
| `.claude/scripts/council/council-lint.mjs:257` | `High` confidence without `Research mode: live` | **NOT-A-CAP** | a confidence bucket — but genuinely **ENFORCED** by `fail(...)`. Caps an epistemic claim, not spend |
| `.claude/scripts/council/council-juror.mjs:52` | 60s per-request juror timeout | CAP | **ENFORCED** via `ctl.abort()` and `fail("timeout", …)` |

## 5. Declared, tested, never wired

| `file:line` | What | Verdict | Declared or enforced |
|---|---|---|---|
| `.claude/scripts/evolve/assign.mjs:97,105` | `concurrencyRefusal(openIds, cap = 2)` — 2 open experiments per module (ADR-0310) | CAP | **NO PRODUCTION CALLER.** Every reference outside its own file is in `tests/evolve-gate.bats` and `tests/evolve-runner.bats`. A cap that is written, tested, and never invoked — the exact shape a fixture matrix is supposed to catch and did not |
| `arc.gates.yaml:13` | "hook tier has a hard <30s budget, ADR-0006" | **NOT-A-CAP** | the sentence is a **comment**. No gate row carries a timeout field and no code reads a per-gate time budget |

---

## The finding: a live cap-bearing module now exists

`PLAN.md` REQ-07 defers migration on this stated ground:

> the Current-state inventory already established that **no live cap-bearing module exists**
> (`PLAN-leads.md` is the named future candidate, waiting on its own unfired trigger)

**That premise is false as of this inventory.** `leads` is LIVE (`initiatives/leads/PROGRESS.md`
`status: LIVE`) and ships the complete shape under ADR-0403 — config may only *lower*, ceilings
live in frozen code, env and flag overrides are refused outright, and the guard throws **before
the provider is contacted**:

| `file:line` | What |
|---|---|
| `.claude/scripts/leads/lib/caps.mjs:29-32` | `DEFAULTS` — 20 sends/IST day, 2 touches/lead, 7-day rolling window, weekday send window |
| `.claude/scripts/leads/lib/caps.mjs:36-37` | `CEILINGS` — frozen; config above them is refused at :113 |
| `.claude/scripts/leads/lib/caps.mjs:46,49` | `FLOORS` — because *lowering* a window weakens a cap; `rolling_window_days: 0` would delete the touch cap |
| `.claude/scripts/leads/lib/caps.mjs:113` | the ask-to-exceed refusal, on the CONFIG, before any send |
| `.claude/scripts/leads/lib/caps.mjs:137,139,142` | `assertNoCapOverrides` — refuses `LEADS_CAP_*` env and `--force` / `--no-cap` flags |
| `.claude/scripts/leads/lib/guard.mjs:241` | called first thing on every send, so the refusal is unavoidable |
| `.claude/scripts/leads/lib/guard.mjs:331,338,342` | run-time refusals: touch cap, daily cap, send window |

Reachability was checked rather than assumed: `guardSend` is called from
`.claude/scripts/leads/lib/sequencer.mjs:83`, a production path, not a test.

**What this does and does not change.** It does **not** reopen migration inside this cycle —
REQ-07's own words are that migration "reopens as new work the day a real module exists, **never
hunted for inside this cycle's 0.5 days**". Phase 03 keeps its scope. What it changes is that the
day has arrived, so the deferral stops resting on "there is nothing to migrate" and starts resting
on "this is out of budget", which is a different and more honest sentence. The reopening condition
and its owner are recorded in `PROGRESS.md`.

`initiatives/leads/**` is do-not-touch for this lane, so nothing here edits it.

## Retired cap paths

**None found.** No path in the four named areas is superseded or dead, so nothing is attic'd
(A10, ADR-0023). `concurrencyRefusal` is the closest candidate and is explicitly **not** retired
— it is unborn, never wired in the first place, and deleting or atticing another lane's
un-wired cap is not this lane's call.

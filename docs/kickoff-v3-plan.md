# Kickoff v3 Plan — Round 5: The Multi-Agent Planning Engine

> Goal: make `/arc-kickoff` the world's best planning command — **provably, not rhetorically**.
> Continues `docs/kickoff-upgrade-plan.md` (Rounds 1–4, implemented & verified 2026-07-11).
> Kept as a separate file so no tracked file is modified outside a feat branch — merge or
> append into `kickoff-upgrade-plan.md` on the implementation branch if preferred.
> Same ground rules as Rounds 1–4: no second planning universe; every addition is a **gate**,
> a **cap**, or an **agent with a bounded charter**. Command files stay one screen; detail lives here.

## Why (context)

2026 field: Superpowers constrains *process* (TDD), GSD constrains *context* (rot prevention),
gstack constrains *perspective* (roles), Harness constrains *delivery* (evidence loop). Each wins
one dimension; users stack all three and get chaos. Arc v2 already constrains **artifacts +
determinism** — `kickoff-lint.mjs` is the field's only deterministic plan gate. Round 5 adds the
missing dimensions inside the existing identity: independent adversarial pressure, parallel recon,
executor simulation, decision reversibility, adaptive depth, and a measurement loop that turns
"best" from marketing into a provable claim.

## Doctrine (governs every choice below)

**Anchored creation, unanchored verification, deterministic gates.**

- Main thread **CREATES** (it holds the human conversation context): PLAN, ADRs, phases.
- Fresh-context agents **VERIFY / CHALLENGE** (they hold no author bias): survey, question-design,
  research, attack, simulate. Rationale: anchoring bias — the mind that wrote the plan cannot
  attack it, and asks questions that confirm its own assumptions.
- Scripts **GATE** (never LLM self-assessment): kickoff-lint, blocker counts, enum checks.
- **Never-agent list (permanent):** lint (script forever) · STOP (human forever) · appetite (human forever).
- Agent outputs NEVER become report files — every finding must land as a **mutation of an existing
  artifact section** (pre-mortem row, assumption entry, REQ cell, rabbit hole, ADR field) or be dropped.

## What does NOT change

- File structure: `PLAN.md` / `phases/` / `PROGRESS.md` / `docs/adr/` — untouched. No `.planning/`,
  no `BRIEF.md` (parked, see v3.1), no new trackers, no separate RESEARCH.md (findings → ADR only).
- Rounds 1–4 mechanics: appetite + kill criteria, premise check (R2-1), max-question cap with
  defaults, REQ lifecycle + [vague] lint (R2-2/R2-4), assumptions ledger + FIRED (C3),
  retro-seeded pre-mortem (**relocated into an agent, same seed rule** — see R5-2 focus C),
  Phase-0 steel thread on fakes + contract tests, expected-fail-first (R2-3), verification detail
  Phase 0–1 only, `/arc-change` C1–C5 sync, `/arc-resume` 5-block dashboard, one-session kickoff
  timebox (A5), STOP gate.
- Explicit re-rejections: GSD `.planning` machinery · gstack persona roster · Spec Kit LLM-judgment
  gates · a new `/arc-plan` command (second planning universe) · LLM 0–10 plan-quality scores.

## New agents (4) — planning-stage roster goes 2 → 6

| Agent | Model tier | Tools | Spawn condition | Returns (hard caps) |
|---|---|---|---|---|
| `codebase-surveyor` | cheap | Read, Grep, Glob, Bash (Graphify query → grep fallback) | Step 0, brownfield only; runs parallel with Step 1 | `## Current state` block, **≤30 lines**: entry points, conventions, hot modules, blast-radius notes |
| `question-planner` | mid | Read | Step 2, always (after surveyor + premise) | **≤5 forks** (S-tier: ≤3), each: question + why-it-matters + recommended default + reversibility guess. Forbidden from re-asking what Steps 0–1 resolved |
| `plan-attacker` | sonnet-class | Read | Step 5 panel; focus mode passed as arg (A/B/C) | **≤7 findings per run**, each = `{target section, exact mutation text, rationale ≤2 lines}`. Non-mapping findings dropped by charter |
| `plan-simulator` | sonnet-class | Read | Step 8.5, tiers M/L, after lint passes | BLOCKER list `{what's missing, where it should live}` + count. **Count is the gate** |

Existing agents in the planning path: `researcher` (now spawned ×N in parallel — R5-1),
`product-challenger` (now auto-suggested — R5-9). No changes to their files.

## Target step flow (arc-kickoff.md end-state)

```
0.    Preflight (archive guard unchanged). Brownfield → spawn codebase-surveyor
      (parallel with Step 1); its ≤30-line return becomes PLAN ## Current state.
1.    Appetite + kill criteria (human). Derive tier DETERMINISTICALLY from appetite:
      S ≤ 3 days · M ≤ 3 weeks · L > 3 weeks. Write `Tier: S|M|L` under Appetite.
2a.   Premise check (unchanged rule). Fuzzy new-product goal → offer product-challenger first.
2.    Forks: spawn question-planner → main thread asks its questions (≤5, S: ≤3).
      Two-way-door forks NEVER reach the user — decide, record ADR, move on (R5-4).
2b.   Research gate (unchanged conditions). Qualifying forks ≥2 → researcher ×N in
      PARALLEL, max 4 concurrent, one fork per charter (R5-1). Still high-impact +
      low-confidence after research → SPIKE (R5-10).
3.    ADRs — now with Reversibility + Revisit-trigger fields (R5-4).
4.    Write PLAN.md (template + tier line).
5.    ATTACK PANEL (replaces main-thread pre-mortem step): plan-attacker ×3 in parallel —
      focus A: edge cases + feasibility (REQ acceptance cross-checked against ADR Evidence)
      focus B: scope/YAGNI + hidden dependencies
      focus C: pre-mortem — charter REQUIRES reading docs/retro-log.md first; matching
               patterns MUST appear as rows; "no history to seed" recorded when empty
      (Ambiguity class stays with the deterministic [vague] lint — not an attacker's job.)
      Tier S: one merged run (A+C). Main thread reconciles: accept → apply mutation;
      reject → finding dies silently. Caps enforced: pre-mortem stays 5 rows (replace
      weakest, never grow), assumptions ≤7, REQ ≤ tier cap — attackers COMPETE for slots.
6.    Phases risk-first (unchanged) + each phase spec gets `Depends on:` line (R5-11).
7.    PROGRESS.md (unchanged).
8.    Self-check gate: kickoff-lint with new check groups (below).
8.5   SIMULATION GATE (M/L): spawn plan-simulator. Blockers > 0 → fix (spec edit, PLAN
      edit, or explicit assumption entry with trigger) → respawn. Two consecutive
      non-zero rounds → stop early, show me the blockers (human call).
8.75  SECOND OPINION (L only): /arc-second-opinion flow against PLAN.md +
      phase-00-spec.md (cross-model). Disagreement → pre-mortem row or fork reopened.
      Agreement → proceed, no note (anti-slop).
9.    STOP (unchanged) + new one-screen summary: tier, REQ count, top-3 risks,
      one-way doors decided, no-gos/dropped highlights, metrics baseline row.
```

## Changes by item

### R5-1. Parallel recon fan-out
**File:** `arc-kickoff.md` step 2b (wording only).
Spawn one researcher per qualifying fork, **in parallel, max 4 concurrent**; each charter = one
fork question. Findings land in ADRs only (unchanged rule). `researcher.md` untouched — its
method (Context7-first, triangulation, confidence H/M/L, date+version) already covers the
scout + verifier roles.

### R5-2. Adversarial panel → plan mutations
**Files:** NEW `.claude/agents/plan-attacker.md` + `arc-kickoff.md` step 5.
One agent, three focus modes (A/B/C above). Fresh context; reads `PLAN.md`, `phases/`,
`docs/adr/`, `docs/retro-log.md` (focus C). Every finding names its target section + exact
replacement text; ≤7 per run. The old main-thread pre-mortem step becomes: spawn focus C,
reconcile. Independence is the point — the plan's author cannot see its failure modes (Klein).

### R5-3. Executor simulation gate
**Files:** NEW `.claude/agents/plan-simulator.md` + `arc-kickoff.md` step 8.5.
Charter: fresh context; read **ONLY** `PLAN.md` + `phases/phase-00-spec.md` (hard rule — that is
the executor's real information set). Attempt to write the concrete Phase-0 execution checklist
(commands, files, test-first per expected-fail-first). Any point where required info is absent or
ambiguous → BLOCKER. Gate: **count = 0**. This is Superpowers' "junior engineer with no context"
principle, mechanized — and it stays deterministic (count, not a quality score).

### R5-4. ADR reversibility + auto-decide
**Files:** `docs/templates/adr-template.md`, `arc-kickoff.md` steps 2–3, `kickoff-lint.mjs`,
`arc-phase-done.md`.
- Template: `Reversibility: one-way | two-way` + `Revisit trigger:` (required for one-way).
- Command rule: **two-way doors auto-decide** — recorded, never user-asked. One-way doors
  (schema, auth model, payments, framework class) are the only user questions.
- Lint `[adr]`: every ADR in PLAN's index has a valid Reversibility enum; one-way without a
  revisit trigger = FAIL.
- `arc-phase-done`: at phase close, scan ADR revisit triggers + assumptions FIRED
  (complements `/arc-change` C3, which catches them mid-build).

### R5-5. Size tiers (adaptive depth)
**Files:** `docs/templates/PLAN-template.md`, `kickoff-lint.mjs`, `arc-kickoff.md` step 1.
`Tier: S|M|L` line under Appetite — derived from the appetite number, never judgment.

| Tier | Appetite | REQ cap (lint) | Questions | Panel | Simulation | 2nd opinion |
|---|---|---|---|---|---|---|
| S | ≤ 3 days | 5 | ≤ 3 | 1 merged run (A+C) | skip | no |
| M | ≤ 3 weeks | 10 | ≤ 5 | ×3 parallel | ON | no |
| L | > 3 weeks | 10 | ≤ 5 | ×3 parallel | ON | YES + verifier pass |

L-tier verifier pass: researcher re-checks the top-3 load-bearing ADR Evidence claims.
Lint `[tier]`: tier line present + valid enum; active REQ count ≤ tier cap.

### R5-6. Plan-level second opinion
**File:** `arc-kickoff.md` step 8.75 (L only). Reuse the existing `/arc-second-opinion` flow,
target = `PLAN.md` + `phase-00-spec.md`. Cross-model = decorrelated errors. Disagreements land as
pre-mortem rows or reopened forks — never a report.

### R5-7. Metrics scoreboard (the "provably best" loop)
**Files:** `docs/templates/retro-log.md`, `arc-retro.md`, `arc-phase-done.md`.
Retro-log gains a metrics row per project:
`YYYY-MM-DD | project | tier | rework | amendments | FIRED n/total | burn % | sim-blockers-r1 | t-to-phase0`

Definitions (all captured, none gate mid-build — read at retro only, to avoid mid-flight Goodhart):
- **Rework rate** — phases reopened after close ÷ phases closed.
- **Amendment count** — `/arc-change` invocations per phase (surprise proxy).
- **Assumption hit rate** — FIRED ÷ total. 0% = ledger theatre, >50% = weak recon; both flagged.
- **Appetite accuracy** — actual burn ÷ planned.
- **Simulator blocker trend** — round-1 blocker count per kickoff; should fall across projects.
- **Time-to-first-shipped-slice** — kickoff date → Phase-0 DoD date.

Capture points: `arc-phase-done` appends per-phase counters; `arc-retro` writes the project row.
This scoreboard is what earns the "world's best" claim — evidence over assertion.

### R5-8. codebase-surveyor agent
**Files:** NEW `.claude/agents/codebase-surveyor.md` + `arc-kickoff.md` step 0.
Brownfield only; Graphify first, grep fallback (same rule as today, relocated into the agent).
Survey noise stays in the agent's context; main thread receives ≤30 curated lines → PLAN
`## Current state`. Runs parallel with the Step-1 appetite conversation. Greenfield: not spawned.

### R5-9. question-planner agent (+ product-challenger wiring)
**Files:** NEW `.claude/agents/question-planner.md` + `arc-kickoff.md` steps 2a–2.
Fresh context reads goal + premise answers + `## Current state`; returns the ≤5 (S: ≤3)
highest-information forks with defaults + reversibility guesses. Fixes the anchoring failure:
the main thread asks questions that confirm its own assumptions; a fresh agent asks about its
blind spots. **Main thread may drop or merge questions, never add unvetted ones.**
Wiring line in 2a: fuzzy new-product goal → offer `product-challenger` before kickoff proper
(already built, currently underused).

### R5-10. Spike mechanism
**Files:** `arc-kickoff.md` step 2b, `adr-template.md`, `kickoff-lint.mjs`, `arc-phase-done.md`.
A fork still high-impact + low-confidence after research → ADR records
`Decision: DEFERRED — spike scheduled`; a spike task lands at the top of `phase-00-spec.md`:
question, timebox (≤ half a day), expected evidence. **Spike code is quarantined** (`spike/` dir
or throwaway branch) — never merged into product code. ADR finalized when spike evidence lands.
Lint `[spike]`: a DEFERRED ADR must reference a spike task; DEFERRED is allowed at STOP
(falsifiable plan > perfect plan) but **blocks `/arc-phase-done` for Phase 0** until resolved.

### R5-11. Dependency lines (light DAG)
**Files:** `docs/templates/phase-spec-template.md`, `kickoff-lint.mjs`.
Phase spec gains `Depends on: phase-NN[, …] | none` (+ optional `Enables:`).
Lint `[deps]`: referenced phases exist · no cycles (topological check) · Phase 0 depends on none.
Risk-first ordering stays the human call; the lines make violations visible and machine-checkable.
(Full DAG / critical path / worktree lanes: parked to Round 6 with subagent execution.)

## Parked — explicit, so nothing is silently dropped

**v3.1 (condition-triggered):**
- `phase-architect` agent (fresh-eyes risk ordering, fixture-benchmarkable) — when subagent
  execution lands in arc.
- `PLAN-writer` agent — requires an intake artifact (BRIEF) first; converting synthesis today
  loses interview nuance at the agent boundary.
- Per-phase **context budgets** — meaningful only with fresh-agent-per-task execution
  (GSD auto-mode stays rejected; human drives).
- Mid-kickoff resume state — unnecessary while kickoff is one-session (A5); revisit for headless.

**Round 6 (the self-improving + proof round):**
- **Self-tuning loop**: retro metrics adjust caps/charters via a deterministic trigger table
  (e.g., 3 consecutive projects with Phase-2 appetite blowouts → kickoff proposes earlier split).
- **Benchmark harness**: same dummy goal run through GSD / Superpowers / gstack / arc;
  scoreboard comparison; publishable — the "world's best" proof.
- **Per-agent eval fixtures**: fixture PLAN with planted defects → attacker must find them;
  planted blockers → simulator must catch them. Regression suite for the planning system itself
  ("testable planning" — a field first).

**Round 7 (SaaS runway):**
- Headless pipeline: every stage typed I/O (artifacts in → artifacts out), async human gates
  (fork answers + STOP approval via queue).
- Agents as product units: per-agent model routing (cheap scouts / sonnet attackers / strongest
  synthesis), custom-attacker marketplace (e.g., a fintech compliance-attacker), multi-AI
  portability — charters are markdown + I/O contracts; Claude Code native, Codex/Cursor adapters.

## Anti-slop rules (Round 5 additions)

1. Agent findings must target an existing section and **fit its cap** — no new sections, no
   report files, no cap inflation. Attackers compete for slots (replace weakest row, never grow).
2. Simulation gate = blocker **count**, never a quality score.
3. Tier derives from the appetite number, never judgment; tier caps lint-enforced where countable.
4. question-planner output is the question **ceiling** — main thread can drop, never add unvetted.
5. Spike code never merges; DEFERRED blocks Phase-0 close, not STOP.
6. Rejected attacker findings die silently — no rejection logs.
7. Never-agent list is permanent: lint, STOP, appetite.

## Implementation order (each step = own commit on the feat branch)

1. **Templates**: R5-4 ADR fields · R5-5 tier line · R5-10 DEFERRED wording · R5-11 depends-on
   (lint needs the sections to exist first).
2. **kickoff-lint.mjs**: `[adr]` `[tier]` `[deps]` `[spike]` check groups + mutation fixtures.
3. **Agents** (each ≤ one screen): `codebase-surveyor.md` · `question-planner.md` ·
   `plan-attacker.md` · `plan-simulator.md`.
4. **arc-kickoff.md** rewrite to the target flow (stays one screen; detail lives here + templates).
5. **arc-phase-done.md**: revisit-trigger/FIRED scan · metrics counters · DEFERRED-spike block.
6. **arc-retro.md + retro-log template**: metrics row.
7. Full fixture suite rerun (Rounds 1–5).

## Verification (of Round 5 itself)

- Lint fixtures: ADR missing Reversibility → FAIL `[adr]` · one-way without revisit trigger →
  FAIL · S-tier PLAN with 8 active REQs → FAIL `[tier]` · phase dep cycle 01↔02 → FAIL `[deps]` ·
  DEFERRED ADR without spike task → FAIL `[spike]` · **all Round 1–4 fixtures still pass**.
- Dry-run S-tier dummy goal: surveyor skipped (greenfield), ≤3 questions, 1 attacker run,
  no simulation → STOP within one session.
- Dry-run M-tier with a deliberately underspecified phase-00: simulator returns ≥1 blocker;
  after one fix round → 0 → gate passes.
- Dry-run L-tier: researchers spawn in parallel (≤4) · second opinion runs · a disagreement
  lands as a pre-mortem row.
- Planted-defect fixture: PLAN whose REQ acceptance contradicts an ADR consequence → attacker
  focus A must flag it (miss = tighten the charter before shipping Round 5).
- All command files remain one screen; zero new top-level files beyond the 4 agent charters
  (+ this doc).

## Success definition — "is it the world's best?"

- **Design claim (earned at Round 5 close):** arc-kickoff holds every planning mechanism the
  field's leaders have, plus seven none of them have — deterministic lint · mutation-bound
  adversarial panel · simulation gate · reversibility-scoped questioning · retro-seeded
  independent pre-mortem · tiered depth · metrics loop.
- **Proof claim (earned later):** the R5-7 scoreboard across the next 2–3 builds, then the
  Round-6 benchmark harness. Evidence over assertion — the title is earned by the scoreboard,
  not by this document.

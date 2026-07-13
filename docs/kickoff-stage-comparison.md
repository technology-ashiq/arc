# Kickoff Stage Comparison — arc vs 7 Frameworks

**Date:** 2026-07-12 · **Scope:** the kickoff/planning pipeline ONLY (not execution/ship).
**Compared:** arc `/arc-kickoff` (v2 + Round 2/3, verified 2026-07-11) vs GSD Core, Spec Kit, BMAD-METHOD, Superpowers, gstack, Agent OS, Harnessed.
**Method:** every claim verified against actual repo files — raw command/workflow/skill files, gate scripts, and engine source fetched 2026-07-12 (GSD's 1,629-line new-project workflow, gstack's 127KB spec skill + resolvers + hooks, Harnessed's TypeScript gate engine, Spec Kit templates/scripts, BMAD skill step-files, Agent OS v3 commands, Superpowers SKILL.md files). GSD/Superpowers/gstack planning flows additionally cross-checked against the 2026-07-09 full-clone comparisons (`gsd-superpowers-vs-arc-comparison.md`, `gstack-vs-arc-comparison.md`) — no planning-flow changes in between (verified per-file commit history).
Companion docs: `gsd-superpowers-vs-arc-comparison.md` · `gstack-vs-arc-comparison.md` · `kickoff-upgrade-plan.md`.

---

## TL;DR — the honest verdict

- **There is no single "top 1" — each framework is a different bet.** GSD bets depth (10–50x token ceremony, multi-session, 15+ subagent spawns). Superpowers bets prose. Spec Kit bets templates. arc bets **one-session, deterministic-script gates, risk discipline**.
- On arc's own axis, arc is already unique: **the only one of the 8 whose plan-content gate is 100% script (exit 1), zero LLM judgment** — and the only one with appetite/kill-criteria, retro-seeded pre-mortem, and a mandatory-trigger assumptions ledger. Verified: none of the 7 has any of those four.
- Stage-by-stage, GSD wins 3–4 of 8 stages (brownfield survey, research, elicitation depth, decision-consumption gating). Those wins come from spend arc deliberately refuses — cost of the bet, not a bug.
- **arc's real gap is not design — it's evidence.** kickoff-lint itself has zero committed tests (19 bats files in `tests/`, none for the lint); no eval comparing arc-kickoff outcomes vs baseline. Per arc's own rule ("the script's verdict is the gate, prose isn't"): the ranking is evidence, not features.

---

## 1. The eight pipelines

### 1.1 arc `/arc-kickoff` — 1 command, 10 steps, 1 session (timeboxed)

| Step | Process | Tools | Gate |
|---|---|---|---|
| 0 Preflight | existing PLAN → "new or revise?" + archive; brownfield → Graphify/grep survey → `## Current state` | Graphify, grep | never-overwrite (prompt) |
| 1 Appetite | time budget as constraint + kill criteria (50% tripwire) | — | — |
| 2a Premise + forks | startup-risk build → one premise block (who/status-quo/why-switch/wedge); max 5 fork questions w/ recommended defaults | AskUserQuestion | conditional-mandatory (prompt) |
| 2b Research | researcher agent ONLY for the mandatory list (version-sensitive APIs, costly-to-reverse arch, unknown domains); findings → ADR Evidence/Confidence/Rejected | subagent, web | condition list (prompt) |
| 3 ADRs | one per resolved fork, `docs/adr/NNNN-*.md` | template | — |
| 4 PLAN.md | REQ table ≤10 (user-centric/atomic/testable, status lifecycle), assumptions ≤7 w/ mandatory falsification triggers, no-gos, rabbit holes, external deps (interface+fake+real+contract test) | template | hard caps |
| 5 Pre-mortem | seeded from `docs/retro-log.md` (matching past patterns = mandatory rows), top-5 causes mitigated/accepted | — | — |
| 6 Phases | risk-first; Phase 0 = steel thread on fakes; per-phase spec w/ verification plan (detailed 0–1 only) + expected-fail-first | templates | — |
| 7 PROGRESS.md | phase table, done-log, appetite burn, `## Now` | — | — |
| 8 **Lint** | `kickoff-lint.mjs`: 12 deterministic check groups — sections non-empty, REQ format/lifecycle/cap/phase-bijection, vague-acceptance ban-list w/ verifiable-token exception, assumptions cap+triggers, pre-mortem ≥5 mitigated, deps 4 columns, ADR index↔files, kill criteria, `## Now` | **Node script, exit 1** | **HARD (script)** |
| 9 STOP | show PLAN + phase list, explicit approval before any product code | — | HARD (prompt) |

### 1.2 GSD Core (`open-gsd/gsd-core` v1.7.0-rc.6) — 5 commands, ~40+ steps, multi-session

| Stage | Process | Tools | Gates |
|---|---|---|---|
| `/gsd:map-codebase` (brownfield) | 4 parallel mapper agents → **7 docs** (STACK/INTEGRATIONS/ARCHITECTURE/STRUCTURE/CONVENTIONS/TESTING/CONCERNS) in `.planning/codebase/`; orchestrator verifies existence + line counts + secret-leak scan | 4 subagents | existence verify |
| `/gsd:new-project` (9 steps) | freeform opener → adaptive questioning (no cap, anti-checklist rules) → PROJECT.md → config rounds (YOLO/interactive, granularity, model profiles) → **4 parallel researchers** (STACK/FEATURES/ARCHITECTURE/PITFALLS) + synthesizer → per-category feature multi-select → REQUIREMENTS.md (CATEGORY-NN ids, traceability: each req → exactly one phase) → roadmapper agent (2–5 observable success criteria/phase, 100% coverage validation) | 6+ subagents, Context7, web | "Ready?" gate; roadmap approval ("CRITICAL: Ask for approval before committing"); `gsd-tools verify-summary` self-heal |
| `/gsd:spec-phase N` (optional) | scout code first → Socratic interview **max 6 rounds × 2–3 questions**, rotating perspectives → ambiguity score = 1−(0.35·goal+0.25·boundary+0.20·constraint+0.20·acceptance), **gate ≤0.20** + per-dimension minimums, recomputed every round → **edge-probe: compiled `edge-probe.cjs`, closed 8-category taxonomy (boundary/adjacency/empty/encoding/ordering/precision/idempotency/concurrency), fail-closed exit 2** → prohibition probe (must-NOT acceptance criteria; LLM-only by ADR-550) → SPEC.md (Current/Target/Acceptance per req, mandatory In/Out-of-scope lists, pass/fail checkboxes only) | LLM self-score + compiled engine | ambiguity gate (LLM-scored); edge engine (deterministic); dismissals require reasons; `--auto` never auto-dismisses |
| `/gsd:discuss-phase N` | 3–4 phase-specific gray areas (never generic) → 4 single-question turns each; loads ≤3 prior CONTEXT.md, **never re-asks decided questions**; Context7 for library choices → CONTEXT.md with **D-NN decision IDs** + deferred-ideas list | AskUserQuestion, Context7 | scope guardrail (phase boundary FIXED) |
| `/gsd:plan-phase N` (~15 steps) | phase-researcher (firecrawl/exa/tavily/ref/jina/perplexity MCPs; **package-legitimacy audit** — registry + official docs required; Open Questions must be RESOLVED or checker blocks) → planner (task anatomy read_first/action/verify/done, no subjective language, 2–3 tasks/plan, waves, must_haves; scope-reduction language banned) → **plan-checker adversarial loop: 12+ dimensions, max 3 iterations, stall detection, structured severities** → **deterministic exit-1 gates:** `check.decision-coverage-plan` (every D-NN cited in ≥1 plan), `ui-plan-gate`, `verify.plan-structure` | 3 agent roles + `gsd-tools.cjs` CLI + 2 compiled engines | checker loop (LLM); decision-coverage (script, exit 1); scope-reduction = auto-BLOCKER |

### 1.3 Spec Kit (`github/spec-kit` v0.8.16 · 106k★ · ⚠ no pushes since 2026-05-27)

| Stage | Process | Tools | Gates |
|---|---|---|---|
| `/speckit.constitution` | project principles → `.specify/memory/constitution.md` | — | — |
| `/speckit.specify` | branch+dir scaffold (script; `NNN-slug`); spec: P1–P3 user stories w/ Independent Test + **Given/When/Then scenarios**, FR-### MUSTs, **SC-### measurable tech-agnostic success criteria**, Assumptions section; `[NEEDS CLARIFICATION]` cap 3 (informed-guess default) | `create-new-feature.sh` | marker cap; spec-quality self-checklist (LLM, max 3 iterations) |
| `/speckit.clarify` | scan against **11-category coverage taxonomy** (scope/data/UX/NFR/integrations/edge-cases/constraints/terminology/completion signals/…) → **max 5 questions, one at a time**, impact×uncertainty ranked, multiple-choice w/ Recommended → answers logged to `## Clarifications` AND applied to spec sections → coverage table | — | coverage table (LLM) |
| `/speckit.plan` | Technical Context → Phase 0 `research.md` → Phase 1 `data-model.md`/`contracts/`/`quickstart.md`; **Constitution Check gate** (re-checked after design) + Complexity Tracking (violations must be justified) | `check-prerequisites.sh` | script = file-existence exit 1 only; constitution gate = LLM |
| `/speckit.tasks` → `/speckit.analyze` | phases per user story w/ Checkpoints, `[P]` parallel markers, MVP-first; tests **optional** (only if spec requests); analyze = 6 LLM detection passes, severity table, ≤50 findings | — | **analyze is read-only, never blocks**; implement's checklist gate = yes/no override |

### 1.4 BMAD-METHOD (`bmad-code-org/BMAD-METHOD` v6.10.0 · 50.4k★ · 159 contributors)

| Stage | Process | Tools | Gates |
|---|---|---|---|
| Phase 1 Analysis (optional) | brainstorming, market/domain/technical research, product-brief, PRFAQ | 6 persona agents (Analyst/PM/Architect/Dev/UX/TW) | — |
| Phase 2 Planning | PRD skill, elicitation-first ("Fight the urge to do the thinking for them"): brain dump → stakes calibration (hobby/internal/launch scales depth) → Fast path (`[ASSUMPTION]` tags) or Coaching path; FR/NFR stable global IDs, counter-metrics required; `.decision-log.md`; **step-file architecture** ("NEVER skip steps", `stepsCompleted` frontmatter) | Advanced Elicitation menu (pre-mortem, inversion, red-team…) | menus halt for user; all overridable |
| Phase 3 Solutioning | create-architecture → `ARCHITECTURE-SPINE.md`; epics+stories w/ complete ACs; **check-implementation-readiness**: 6 LLM step-files → READY/NEEDS WORK/NOT READY; PRD Validate = reviewer subagents + rubric walker | Architect persona, reviewer subagents | **advisory** — step-06: "you may choose to proceed as-is" |
| Phase 4 handoff | sprint-status.yaml; context-complete `story-[slug].md` per story ("extract, don't ingest" via subagents) | — | — |

### 1.5 Superpowers (`obra/superpowers` v6.1.1 · 253k★) — 2 skills, ~14 steps

| Stage | Process | Tools | Gates |
|---|---|---|---|
| brainstorming | explore context → clarifying questions **one per message** → 2–3 approaches w/ recommendation → design presented per-section w/ approval each → doc committed (`docs/superpowers/specs/`) → inline self-review (placeholder/consistency/scope/ambiguity) | git, conversation | **`<HARD-GATE>`: no code/scaffold until design approved — "EVERY project regardless of perceived simplicity"** + anti-rationalization table; user review gate (verbatim script); **terminal state = writing-plans only, alternate exits banned** |
| writing-plans | **2–5 minute tasks** (each carries its own test cycle), exact file paths + line ranges, **Global Constraints copied verbatim from spec** ("Every task's requirements implicitly include this section"), per-task **Interfaces block (Consumes/Produces exact signatures)** — implementer sees only its own task; no-placeholder ban list (TBD, "similar to Task N", undefined types) | — | self-review checklist ("not a subagent dispatch"); handoff choice (subagent-driven recommended vs inline) |

Enforcement: **1 SessionStart hook, text-injection only; zero blocking anywhere — by design** (persuasion, measured via out-of-repo eval harness).

### 1.6 gstack (`garrytan/gstack` v1.60.1.0) — 2–3 skills per kickoff, 5–6 phases each

| Stage | Process | Tools | Gates |
|---|---|---|---|
| `/office-hours` | YC diagnostic (Six Forcing Questions, anti-sycophancy) → premise challenge → landscape WebSearch (privacy-gated) → **cross-model codex second opinion** → alternatives MANDATORY (2–3) → visual mockup → design doc + adversarial spec-review subagent (max 3, "quality bonus, not a gate") | codex CLI, `$D` design binary, `$B` browser daemon, WebSearch | HARD no-implementation gate; STOP after every question |
| `/spec` | 5 "why" questions → scope lock → technical interrogation (**must read code first**) → **codex 0–10 quality score loop** (score <7 → max 3 revisions, advisory) → **fail-closed regex secret-redaction (HIGH blocks, no disable flag)** → GitHub issue + archive | gh, codex, redact-audit script | redaction = deterministic block; "Do NOT produce an issue after the first message" |
| `/autoplan` | CEO → Design → Eng → DX persona reviews sequential, consensus tables, decision audit trail; auto-decides everything **except** premise confirmation + user-challenges | 4 persona skills, codex dual-voice, subagents | **EXIT PLAN MODE GATE (blocking self-check):** report format + exact `NO UNRESOLVED DECISIONS` final line + review-log call verified before ExitPlanMode allowed |
| question layer (unique) | every question = "decision brief" (ELI10, stakes-if-wrong, ≥2 pros/1 con per option, exactly one `(recommended)`); **learned never-ask/always-ask enforced by real PreToolUse/PostToolUse hooks** in `~/.claude/settings.json`; one-way doors always ask | `gstack-settings-hook`, question-log/preference hooks | **deterministic hooks on question behavior — the only framework with real hooks in planning** |

### 1.7 Agent OS (`buildermethods/agent-os` v3.0.0, 2026-01-20 · 5k★) — 2 commands

| Stage | Process | Tools | Gates |
|---|---|---|---|
| `/plan-product` | 3 questions → `mission.md`, `roadmap.md` (MVP/post-launch lists), `tech-stack.md` | AskUserQuestion | none |
| `/shape-spec` | must run inside Claude Plan Mode; 9 steps → `plan.md`/`shape.md`/`standards.md`/`references.md`; Task 1 always "save spec docs" | Plan Mode native | plan-mode approval (native) only |

**v3 deliberately deleted its planning machinery** (requirements.md, tasks, verification, decisions.md, subagents — all removed; CHANGELOG: spec writing "now best handled using Plan mode"). No acceptance criteria, no risks/assumptions, no verification plan, no ADRs, zero scripts/hooks. 4 architecture rewrites in 18 months. Counter-thesis to arc's whole category: "native plan mode + frontier models make spec machinery obsolete."

### 1.8 Harnessed (`easyinplay/harnessed` v4.28.0 · 2★ · solo) — 2 kickoff stages composing upstreams

| Stage | Process | Tools | Gates |
|---|---|---|---|
| `/discuss` | 3 **parallel** subs: strategic (gstack office-hours → ceo-review, opus) · phase (GSD discuss-phase, sonnet) · subtask (Superpowers brainstorming, opus); persist `findings.md`; bootstrap `.planning/` skeleton (ROADMAP/STATE/REQUIREMENTS) if missing | upstream skills + `harnessed gates` CLI | **gate YAMLs = expr-eval boolean expressions over facts** (`phase.open_decisions >= 2`…) — deterministic eval, but facts are LLM-supplied; gates route, never block |
| `/plan` | serial: plan-architecture (gstack eng-review, fires on `is_complex_architecture`) → plan-phase (GSD plan-phase → planning-with-files) → `task_plan.md` + `progress.md` | upstream | **evidence guard: sha256 + existence, fail-closed exit 1** (existence, not content); serial-order guard; TypeBox schema CI |

Honest note: the engine is real (vitest, 3-OS CI, ADR-conservation gate, signed releases) but README's `pause: human_review` claim **does not exist in code** (verified negative), the `/auto` complexity judge is a hardcoded `'medium'` stub, and adoption is zero (2 stars, bus factor 1).

---

## 2. Stage-by-stage verdict

| # | Stage | Winner | Why — and where arc stands |
|---|---|---|---|
| S0 | Brownfield / preflight | **GSD** | 4 parallel mappers → 7 verified docs consumed by every later stage. BMAD 2nd (document-project). arc = one grep/Graphify pass into one PLAN section; arc's never-overwrite+archive discipline is unique but survey depth clearly loses. |
| S1 | Clarification / elicitation | **GSD** (depth) · gstack (mechanics) · Spec Kit (best fit for arc) | GSD: 3 layers, rotating perspectives, never re-asks decided questions. gstack: decision-brief format + question preferences enforced by real hooks — nobody else. Spec Kit: 11-category taxonomy × max-5 = systematic coverage per question budget. **arc's weakest formal stage:** max-5 + defaults is good cost discipline, but question *selection* is pure model judgment — no coverage guarantee. |
| S2 | Research | **GSD**, big gap | 4-dimension parallel research + synthesizer + package-legitimacy audit (anti-slopsquatting, deterministic check) + Open-Questions-must-be-RESOLVED blocker. arc's narrow research gate wins on cost (GSD kickoff is easily 10–50x tokens), loses on capability; arc's "findings land in ADR" is clean but Evidence quality has no gate. |
| S3 | Requirements / spec | **split:** content GSD · format Spec Kit · enforcement **arc** | GSD's edge-probe is a compiled engine that systematically expands spec content (8 edge categories, fail-closed) + prohibitions = negative acceptance criteria (arc has neither). Spec Kit's Given/When/Then + SC-### is the best human format. arc has the strongest requirement *hygiene enforcement* (vague-lint, lifecycle, phase bijection — all script) but the thinnest content model (one acceptance cell vs scenarios/edges). |
| S4 | Decisions / architecture | **GSD edges arc** | arc's ADR record format (options+consequences+lint-checked index) is the better *record*. GSD's `decision-coverage` exit-1 gate — every D-NN must be cited in some plan or the script blocks — is the better *consumption guarantee*. arc verifies ADR files exist, not that decisions flow into phases: "decided but never planned" hole is open in arc, closed in GSD. |
| S5 | Risk / premise | **arc**, clear | Retro-seeded pre-mortem (compounding) + assumptions ≤7 w/ mandatory falsification triggers + kill criteria + conditional premise block. Verified: no other framework combines any two of these. gstack premise challenge 2nd; Spec Kit assumptions are trigger-less; GSD's PITFALLS.md is research-side only. **arc's genuine moat stage.** |
| S6 | Breakdown + verification planning | **phase-level arc** · task-level Superpowers/GSD | arc: risk-first ordering + Phase-0 steel-thread-on-fakes + expected-fail-first = sharpest phase discipline. Superpowers: best micro-task format (2–5 min tasks, exact signatures, Global Constraints verbatim). GSD: deepest plan machinery (task anatomy, Nyquist sampling, waves). arc mandates no task-level anatomy at all. Spec Kit's optional tests = weak. |
| S7 | Plan quality gate | **axis-dependent:** trust **arc** · depth GSD | arc: the only 100%-script *content* gate (exit 1, zero LLM judgment). GSD: adversarial checker (12+ dims, revision loop, stall detection) + deterministic satellites — far broader coverage, but the core checker is an LLM (route-around risk, which GSD acknowledges). Spec Kit analyze never blocks; BMAD advisory; Superpowers self-checklists; Harnessed checks existence not content. ⚠ **arc's lint itself has zero committed tests** — see §4. |
| S8 | Approval / handoff | tie: arc (simplicity) · GSD (configurability) · Superpowers (wording) | arc: one clean STOP. GSD: 8 configurable confirm-gates + YOLO collapse. Superpowers' "terminal state" pattern (alternate exits explicitly banned) is a one-line idea arc lacks. |

**Score honestly:** GSD 3–4 stages, arc 2–3 stages (S5 outright; S7 on the trust axis; S6 phase-half), rest split. GSD's wins are bought with ceremony arc's identity refuses. **Per-dollar discipline: arc. Per-stage capability: GSD.**

---

## 3. Upgrade suggestions (within arc's anti-slop rules — gates/caps/one-liners only)

| # | Change | Borrowed from | What it is |
|---|---|---|---|
| 1 | **Lint fixture tests** (highest priority — own gap, not a borrow) | — | `tests/kickoff-lint.bats`: good-PLAN fixture passes; broken fixtures (vague acceptance, unmapped REQ, 8 assumptions, trigger-less row, missing kill criteria…) each FAIL on the named check — mutation style. Promised in `kickoff-upgrade-plan.md` verification, never committed. The gate's credibility depends on this. |
| 2 | **Decision-consumption check** `[adr-wired]` | GSD `check.decision-coverage-plan` | New lint group: every ADR NNNN in the PLAN index must be referenced in ≥1 `phases/phase-*-spec.md` (grep). Closes the records→plans wiring hole. ~15 lines. |
| 3 | **Non-negotiables verbatim-copy** | Superpowers Global Constraints | Phase-spec template gets `## Non-negotiables (verbatim from PLAN)`; lint checks presence. Superpowers' measured finding: verbatim copy reaches context-isolated executors, references don't. |
| 4 | **Question coverage taxonomy** (prompt-side, no gate) | Spec Kit `/clarify` | Max-5 stays; one line in step 2: pick the 5 against the 11-category coverage table (scope/data/UX/NFR/integrations/edge-cases/constraints/terminology/completion/…). Systematic coverage, same cost. |
| 5 | **Brownfield survey structure** | GSD map-codebase (arc-weight) | `## Current state` requires 4 fixed sub-headings: Stack · Entry points · Conventions · Danger zones; lint checks all 4 non-empty when brownfield. Structure borrowed, not the 4 agents. |
| 6 | **Banned-exits line at STOP** | Superpowers terminal-state | Step 9, one line: "Until approval: no product code, no /arc-change, no other command." |
| 7 | **Package-legitimacy line in research gate** | GSD anti-slopsquatting | Step 2b, one sentence: any package/library cited by research must carry a registry + official-docs verification line in the ADR Evidence. |

**Rejects that stand (with reasons):** GSD ambiguity-scoring gate (LLM-judged gate — violates anti-slop rule #2; prior reject correct) · GSD edge-probe full engine (compiled-engine maintenance too heavy solo; #4 partially covers) · gstack question-tuning hooks (infra weight disproportionate to kickoff frequency) · Harnessed composition (unchanged: near-zero adoption, doc/code drift verified — though note its engine is more real than the 2026-07-09 "MVP docs" note implied).

---

## 4. What "top 1" would actually take (honest)

The 7 changes above close credibility gaps; they do not change the ranking. Three reasons:

1. **No single axis exists.** GSD's stage wins come from a 10–50x spend arc's one-session identity refuses. Beating GSD there means becoming GSD. On arc's own axis (script-gated, one-session, risk discipline) arc is already the only occupant — verified.
2. **The distance is evidence, not design.** GSD: 549 test files, 17 runtimes. Superpowers: 253k stars and prose changes driven by a measured eval harness. arc: N=1 user, 1 project, and an untested gate. arc's own rule decides this: evidence is the rank, features aren't. What would move the rank: fixture tests (#1), planted-gap/A-B kickoff evals (arc-kickoff vs raw-Claude vs GSD on the same goal — Phase 06 philosophy applied to kickoff), outcomes accumulating in `retro-log.md`.
3. **Reach.** The moat ("every gate is a script") is invisible at zero distribution. Candidate wedge: release `kickoff-lint` as a standalone npm package — "your AI's plan, mechanically linted" — adoptable on top of GSD/Spec Kit/anything, without adopting arc. (Same move as GSD's mcp-server.)

Accepted cost, not bug: S1/S2 depth stays conceded to GSD.

---

## 5. Sources

- **arc:** `.claude/commands/arc-kickoff.md` · `.claude/scripts/kickoff-lint.mjs` · `docs/build-playbook.md` §9 · `docs/templates/PLAN-template.md` · `docs/kickoff-upgrade-plan.md` (all read 2026-07-12; `tests/` enumerated — no kickoff-lint tests).
- **GSD:** raw `commands/gsd/{new-project,map-codebase,discuss-phase,spec-phase,plan-phase}.md` + workflows via npm tarball `@opengsd/gsd-core@1.7.0-rc.6` (`gsd-core/workflows/*`, `agents/gsd-*.md`, `templates/*`, `bin/gsd-tools.cjs`, `bin/lib/edge-probe.cjs`).
- **Spec Kit:** repo API + raw `templates/{spec,plan,tasks}-template.md`, `templates/commands/{specify,clarify,analyze,implement}.md`, `scripts/bash/{check-prerequisites,create-new-feature}.sh`, CHANGELOG. Criticism: Scott Logic 2025-11-26 review; Discussions #1784.
- **BMAD:** repo + docs.bmad-method.org; raw `src/bmm-skills/2-plan-workflows/bmad-prd/SKILL.md`, `3-solutioning/bmad-check-implementation-readiness/SKILL.md` + step-06, `bmad-create-epics-and-stories/SKILL.md`.
- **Superpowers:** clone @ v6.1.1 — `skills/{brainstorming,writing-plans,subagent-driven-development,using-superpowers}/SKILL.md`, `hooks/hooks.json`, RELEASE-NOTES (v6.0.0 2026-06-16 Global Constraints/Interfaces).
- **gstack:** clone @ v1.60.1.0 — `{office-hours,spec,autoplan,plan-*-review,plan-tune}/SKILL.md(.tmpl)`, `scripts/resolvers/review.ts` (EXIT PLAN MODE GATE), `hosts/claude/hooks/*`, `bin/gstack-settings-hook`.
- **Agent OS:** repo + raw `commands/agent-os/{plan-product,shape-spec,discover-standards}.md`, CHANGELOG (v3.0.0 2026-01-20), buildermethods.com docs.
- **Harnessed:** raw README, `docs/WORKFLOW.md`, `workflows/judgments/*.yaml`, `workflows/{discuss,plan}/*/workflow.yaml` + SKILL.md, `src/cli/{gates,checkpoint,next,advance}.ts`, `src/checkpoint/evidence.ts`, `src/workflow/*.ts`, CI; npm registry (v4.28.0, 2026-07-12).

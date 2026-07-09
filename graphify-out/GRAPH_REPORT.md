# Graph Report - arc  (2026-07-09)

## Corpus Check
- 97 files · ~39,285 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 572 nodes · 440 edges · 166 communities (66 shown, 100 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `317fa114`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Subagents & Review Concepts|Subagents & Review Concepts]]
- [[_COMMUNITY_Build Playbook & Docs|Build Playbook & Docs]]
- [[_COMMUNITY_Settings & Hook Config|Settings & Hook Config]]
- [[_COMMUNITY_Review & Lifecycle Commands|Review & Lifecycle Commands]]
- [[_COMMUNITY_Toolchain Health Script|Toolchain Health Script]]
- [[_COMMUNITY_Browser QA Stack (agent-browser)|Browser QA Stack (agent-browser)]]
- [[_COMMUNITY_Ship & QA Commands|Ship & QA Commands]]
- [[_COMMUNITY_MCP Server Config|MCP Server Config]]
- [[_COMMUNITY_Statusline Script|Statusline Script]]
- [[_COMMUNITY_Coverage Gate Script|Coverage Gate Script]]
- [[_COMMUNITY_Review Ledger Script|Review Ledger Script]]
- [[_COMMUNITY_PostToolUse Hook|PostToolUse Hook]]
- [[_COMMUNITY_PreCompact Hook|PreCompact Hook]]
- [[_COMMUNITY_PreToolUse Hook|PreToolUse Hook]]
- [[_COMMUNITY_PreToolUse-Edit Hook|PreToolUse-Edit Hook]]
- [[_COMMUNITY_SessionEnd Hook|SessionEnd Hook]]
- [[_COMMUNITY_SessionStart Hook|SessionStart Hook]]
- [[_COMMUNITY_Docs-Drift Script|Docs-Drift Script]]
- [[_COMMUNITY_Freeze-Check Script|Freeze-Check Script]]
- [[_COMMUNITY_Diagram Command|Diagram Command]]
- [[_COMMUNITY_User Manual -- Sample Structure (arc- system)|User Manual -- Sample Structure (arc- system)]]
- [[_COMMUNITY_`.claude` — where Claude Code looks|`.claude/` — where Claude Code looks]]
- [[_COMMUNITY_PROJECT_NAME — CLAUDE|<PROJECT_NAME> — CLAUDE.md]]
- [[_COMMUNITY_Product runbook — idea → shipped, using every part of this template|Product runbook — idea → shipped, using every part of this template]]
- [[_COMMUNITY_The Build Playbook|The Build Playbook]]
- [[_COMMUNITY_gstack vs arc — Detailed, Honest Comparison|gstack vs arc — Detailed, Honest Comparison]]
- [[_COMMUNITY_7. FULL PIPELINE -- step by step (idhu dhaan main event)|7. FULL PIPELINE -- step by step (idhu dhaan main event)]]
- [[_COMMUNITY_PLAN.md — arc v2 World-Best Upgrade|PLAN.md — arc v2 "World-Best" Upgrade]]
- [[_COMMUNITY_common.sh|common.sh]]
- [[_COMMUNITY_test_helper.bash|test_helper.bash]]
- [[_COMMUNITY_Claude Code — Canonical Project Folder Structure (Template)|Claude Code — Canonical Project Folder Structure (Template)]]
- [[_COMMUNITY_Stripe Setup|Stripe Setup]]
- [[_COMMUNITY_Deployment|Deployment]]
- [[_COMMUNITY_How this structure works — the mental model|How this structure works — the mental model]]
- [[_COMMUNITY_ADR NNNN — decision title|ADR NNNN — <decision title>]]
- [[_COMMUNITY_Phase NN — name|Phase NN — <name>]]
- [[_COMMUNITY_Phase 00 — Steel thread arc-scan skeleton + CI on arc itself|Phase 00 — Steel thread: arc-scan skeleton + CI on arc itself]]
- [[_COMMUNITY_Phase 01 — Credibility & hygiene|Phase 01 — Credibility & hygiene]]
- [[_COMMUNITY_Phase 02 — Gate engine v1 manifest, baseline, suppression, evidence|Phase 02 — Gate engine v1: manifest, baseline, suppression, evidence]]
- [[_COMMUNITY_Phase 03 — Security pipeline|Phase 03 — Security pipeline]]
- [[_COMMUNITY_Phase 04 — QA pipeline|Phase 04 — QA pipeline]]
- [[_COMMUNITY_Phase 05 — Phase ratchet + docs gate v2|Phase 05 — Phase ratchet + docs gate v2]]
- [[_COMMUNITY_Phase 06 — Measured agent quality (cut-line phase)|Phase 06 — Measured agent quality (cut-line phase)]]
- [[_COMMUNITY_Phase 07 — Adversarial orchestration (cuttable)|Phase 07 — Adversarial orchestration (cuttable)]]
- [[_COMMUNITY_Phase 08 — Distribution (NEXT CYCLE — placeholder spec)|Phase 08 — Distribution (NEXT CYCLE — placeholder spec)]]
- [[_COMMUNITY_PROGRESS.md — arc v2 World-Best Upgrade|PROGRESS.md — arc v2 "World-Best" Upgrade]]
- [[_COMMUNITY_Changelog|Changelog]]
- [[_COMMUNITY_code-reviewer|code-reviewer.md]]
- [[_COMMUNITY_design-reviewer|design-reviewer.md]]
- [[_COMMUNITY_security-auditor|security-auditor.md]]
- [[_COMMUNITY_SEO Article Writer|SEO Article Writer]]
- [[_COMMUNITY_ADR 0001 — SARIF as single findings format; one arc-scan runner with adapters|ADR 0001 — SARIF as single findings format; one arc-scan runner with adapters]]
- [[_COMMUNITY_ADR 0002 — Noise defense is a prerequisite, not polish|ADR 0002 — Noise defense is a prerequisite, not polish]]
- [[_COMMUNITY_ADR 0003 — Trivy over Snyk for SCA|ADR 0003 — Trivy over Snyk for SCA]]
- [[_COMMUNITY_ADR 0004 — CodeQL as optional adapter; semgrep is the SAST spine|ADR 0004 — CodeQL as optional adapter; semgrep is the SAST spine]]
- [[_COMMUNITY_ADR 0005 — Mutation score replaces coverage as the primary test-quality gate|ADR 0005 — Mutation score replaces coverage as the primary test-quality gate]]
- [[_COMMUNITY_ADR 0006 — Hook tier vs CI tier split; heavy tools in docker|ADR 0006 — Hook tier vs CI tier split; heavy tools in docker]]
- [[_COMMUNITY_ADR 0007 — bats-core self-tests; CI matrix ubuntu + windows Git Bash|ADR 0007 — bats-core self-tests; CI matrix ubuntu + windows Git Bash]]
- [[_COMMUNITY_ADR 0008 — Gates block by default; warn is the opt-in downgrade|ADR 0008 — Gates block by default; warn is the opt-in downgrade]]
- [[_COMMUNITY_Branding  Social  Contact|Branding / Social / Contact]]
- [[_COMMUNITY_Plugins|Plugins]]
- [[_COMMUNITY_product-challenger|product-challenger.md]]
- [[_COMMUNITY_qa-tester|qa-tester.md]]
- [[_COMMUNITY_sarif.sh|sarif.sh]]
- [[_COMMUNITY_triage.sh|triage.sh]]
- [[_COMMUNITY_log-analyzer|log-analyzer.md]]
- [[_COMMUNITY_researcher|researcher.md]]
- [[_COMMUNITY_arc-audit|arc-audit.md]]
- [[_COMMUNITY_gitleaks.sh|gitleaks.sh]]
- [[_COMMUNITY_semgrep.sh|semgrep.sh]]
- [[_COMMUNITY_arc-scan.sh|arc-scan.sh]]
- [[_COMMUNITY_version-gate.sh|version-gate.sh]]
- [[_COMMUNITY_Session log|Session log]]
- [[_COMMUNITY_arc-canary|arc-canary.md]]
- [[_COMMUNITY_arc-design|arc-design.md]]
- [[_COMMUNITY_arc-docs|arc-docs.md]]
- [[_COMMUNITY_arc-qa|arc-qa.md]]
- [[_COMMUNITY_arc-second-opinion|arc-second-opinion.md]]
- [[_COMMUNITY_api|api.md]]
- [[_COMMUNITY_stripe|stripe.md]]
- [[_COMMUNITY_supabase|supabase.md]]
- [[_COMMUNITY_testing|testing.md]]
- [[_COMMUNITY_ui-conventions|ui-conventions.md]]
- [[_COMMUNITY_arc-canary command|/arc-canary command]]
- [[_COMMUNITY_arc-change command|/arc-change command]]
- [[_COMMUNITY_arc-commit command|/arc-commit command]]
- [[_COMMUNITY_arc-docs command|/arc-docs command]]
- [[_COMMUNITY_arc-fix-issue command|/arc-fix-issue command]]
- [[_COMMUNITY_arc-freeze command|/arc-freeze command]]
- [[_COMMUNITY_arc-kickoff command|/arc-kickoff command]]
- [[_COMMUNITY_arc-phase-done command|/arc-phase-done command]]
- [[_COMMUNITY_arc-pr command|/arc-pr command]]
- [[_COMMUNITY_arc-qa command|/arc-qa command]]
- [[_COMMUNITY_arc-resume command|/arc-resume command]]
- [[_COMMUNITY_arc-retro command|/arc-retro command]]
- [[_COMMUNITY_arc-review command|/arc-review command]]
- [[_COMMUNITY_arc-second-opinion command|/arc-second-opinion command]]
- [[_COMMUNITY_arc-ship command|/arc-ship command]]
- [[_COMMUNITY_arc-toolcheck command|/arc-toolcheck command]]
- [[_COMMUNITY_arc-unfreeze command|/arc-unfreeze command]]
- [[_COMMUNITY_codegraph MCP|codegraph MCP]]
- [[_COMMUNITY_AI Slop (Design Anti-Patterns)|AI Slop (Design Anti-Patterns)]]
- [[_COMMUNITY_OWASP Top 10|OWASP Top 10]]
- [[_COMMUNITY_STRIDE Threat Model|STRIDE Threat Model]]
- [[_COMMUNITY_arc-audit Command|/arc-audit Command]]
- [[_COMMUNITY_arc-design Command|/arc-design Command]]
- [[_COMMUNITY_arc-kickoff Command|/arc-kickoff Command]]
- [[_COMMUNITY_arc-review Command|/arc-review Command]]
- [[_COMMUNITY_Build Playbook (docsbuild-playbook.md)|Build Playbook (docs/build-playbook.md)]]
- [[_COMMUNITY_Graphify Knowledge Graph|Graphify Knowledge Graph]]
- [[_COMMUNITY_ARC_REQUIRED_REVIEWS|ARC_REQUIRED_REVIEWS]]
- [[_COMMUNITY_Stripe Webhook Signature Verification|Stripe Webhook Signature Verification]]
- [[_COMMUNITY_Row Level Security (RLS)|Row Level Security (RLS)]]
- [[_COMMUNITY_Toolchain Health Artifact Template (smart table)|Toolchain Health Artifact Template (smart table)]]
- [[_COMMUNITY_agent-browser CLI (Vercel Labs)|agent-browser CLI (Vercel Labs)]]
- [[_COMMUNITY_code-reviewer Subagent|code-reviewer Subagent]]
- [[_COMMUNITY_OpenAI Codex CLI|OpenAI Codex CLI]]
- [[_COMMUNITY_Definition of Done|Definition of Done]]
- [[_COMMUNITY_Deploy-Guard Hook|Deploy-Guard Hook]]
- [[_COMMUNITY_design-reviewer Subagent|design-reviewer Subagent]]
- [[_COMMUNITY_Docs-Drift Gate|Docs-Drift Gate]]
- [[_COMMUNITY_Golden Loop|Golden Loop]]
- [[_COMMUNITY_Graphify Knowledge Graph|Graphify Knowledge Graph]]
- [[_COMMUNITY_Klein Pre-Mortem|Klein Pre-Mortem]]
- [[_COMMUNITY_qa-tester Subagent|qa-tester Subagent]]
- [[_COMMUNITY_researcher Subagent|researcher Subagent]]
- [[_COMMUNITY_Review Ledger (review-ledger.sh)|Review Ledger (review-ledger.sh)]]
- [[_COMMUNITY_security-auditor Subagent|security-auditor Subagent]]
- [[_COMMUNITY_toolchain-health.sh|toolchain-health.sh]]
- [[_COMMUNITY_Change Intake|Change Intake]]
- [[_COMMUNITY_Definition of Done (DoD)|Definition of Done (DoD)]]
- [[_COMMUNITY_The Golden Loop|The Golden Loop]]
- [[_COMMUNITY_Offline-First  Interface+Fake+Real Pattern|Offline-First / Interface+Fake+Real Pattern]]
- [[_COMMUNITY_Quality & Safety Gates|Quality & Safety Gates]]
- [[_COMMUNITY_3-Layer Tracking System|3-Layer Tracking System]]
- [[_COMMUNITY_Walking Skeleton (Phase 0)|Walking Skeleton (Phase 0)]]
- [[_COMMUNITY_Deploy Flow with pre-deploy-guard|Deploy Flow with pre-deploy-guard]]
- [[_COMMUNITY_Five-Layer Memory Stack|Five-Layer Memory Stack]]
- [[_COMMUNITY_Three Loading Behaviors|Three Loading Behaviors]]
- [[_COMMUNITY_Plugin Anatomy|Plugin Anatomy]]
- [[_COMMUNITY_Growing the Setup|Growing the Setup]]
- [[_COMMUNITY_Promptly (worked example SaaS)|Promptly (worked example SaaS)]]
- [[_COMMUNITY_Stripe Webhook Idempotency|Stripe Webhook Idempotency]]
- [[_COMMUNITY_Klein Pre-Mortem|Klein Pre-Mortem]]
- [[_COMMUNITY_Design System Reuse Convention|Design System Reuse Convention]]
- [[_COMMUNITY_The Arc Twist|The Arc Twist]]
- [[_COMMUNITY_arc vs gstack Division of Labor|arc vs gstack Division of Labor]]
- [[_COMMUNITY_Review Ledger + Gates|Review Ledger + Gates]]

## God Nodes (most connected - your core abstractions)
1. `User Manual -- Sample Structure (arc- system)` - 14 edges
2. `Product runbook — idea → shipped, using every part of this template` - 12 edges
3. `agent-browser → arc integration plan` - 11 edges
4. ``.claude/` — where Claude Code looks` - 11 edges
5. `7. FULL PIPELINE -- step by step (idhu dhaan main event)` - 11 edges
6. `emit_all()` - 10 edges
7. `<PROJECT_NAME> — CLAUDE.md` - 10 edges
8. `PLAN.md — arc v2 "World-Best" Upgrade` - 10 edges
9. `The Build Playbook` - 10 edges
10. `gstack vs arc — Detailed, Honest Comparison` - 10 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (166 total, 100 thin omitted)

### Community 0 - "Subagents & Review Concepts"
Cohesion: 0.18
Nodes (10): Appetite, Architecture (C4 concepts, Mermaid flowchart), Goal, Key decisions (ADR index), No-gos (explicitly out of scope), Non-negotiables, Phases (risk-ordered), PLAN.md — <PRODUCT NAME> (+2 more)

### Community 1 - "Build Playbook & Docs"
Cohesion: 0.29
Nodes (6): Auth, Env, Local dev, Migrations, RLS pattern, Supabase Setup

### Community 2 - "Settings & Hook Config"
Cohesion: 0.10
Nodes (19): arc, coverageFloor, coverageMode, coverageSummary, docsGate, hooks, PostToolUse, PreCompact (+11 more)

### Community 4 - "Toolchain Health Script"
Cohesion: 0.29
Nodes (14): emit_all(), env_has(), fix_add(), have(), man_add(), R_ENV(), R_MISS(), R_NG() (+6 more)

### Community 5 - "Browser QA Stack (agent-browser)"
Cohesion: 0.17
Nodes (11): 10. Rollout order, 1. What it is (one screen), 2. Why arc wants it — the moat, 3. Design principle (non-negotiable), 4. Two ways arc will use it, 5. File-by-file changes (this session, after approval), 6. Optional stretch (NOT this session — needs its own nod / `/arc-change`), 7. Prerequisites (owner runs once, to opt in) (+3 more)

### Community 7 - "MCP Server Config"
Cohesion: 0.21
Nodes (11): STRIPE_SECRET_KEY, SUPABASE_ACCESS_TOKEN, npx, context7, playwright, stripe, supabase, @playwright/mcp (+3 more)

### Community 21 - "User Manual -- Sample Structure (arc- system)"
Cohesion: 0.08
Nodes (25): 0. Idhu enna? (One-minute picture), 10. Cheat-sheet (ella command onnu paarvaila), 11. Troubleshooting / FAQ, 12. arc enna pannaadhu (idhukku gstack use pannu), 1. Mental model -- 3 madhiri load aagum (idha purinjika, ellame puriyum), 2. Folder structure (ipo iruka mold), 3. One-time setup (pudhu project start panna), 4. Background machinery -- nee kupidaadha, thaana nadakkuradhu (+17 more)

### Community 22 - "`.claude/` — where Claude Code looks"
Cohesion: 0.09
Nodes (22): `agents/` — subagents with their own isolated context, Blueprint — complete overview of every folder & file, Born at runtime (created by `/arc-kickoff`, committed with the code), `CLAUDE.local.md`, `CLAUDE.md`, `.claude/` — where Claude Code looks, `commands/` — you invoke with `/name`, `docs/` — deep detail, linked from CLAUDE.md (+14 more)

### Community 23 - "<PROJECT_NAME> — CLAUDE.md"
Cohesion: 0.13
Nodes (14): Architecture, Build process  <!-- full method → docs/build-playbook.md -->, Code standards, Commands, Database  <!-- stack note → docs/supabase-setup.md -->, Environment variables, Extended docs — Claude, READ these when the work touches them, Git & deployment (+6 more)

### Community 24 - "Product runbook — idea → shipped, using every part of this template"
Cohesion: 0.15
Nodes (12): Cheat sheet — situation → action, Growing the setup — when the project signals, Product runbook — idea → shipped, using every part of this template, Stage 0 — machine ready (once, ever), Stage 1 — scaffold + wire (Day 0, ~10 min), Stage 2 — plan the build, Stage 3 — Phase 0: walking skeleton (offline-first), Stage 4 — core phases (the daily loop, repeated) (+4 more)

### Community 25 - "The Build Playbook"
Cohesion: 0.17
Nodes (11): 1. The Golden Loop — repeat for every phase, 2.1 Change intake — mid-build changes go through the structure, not straight into code, 2. Phase structure — walking skeleton first, 3. Principles, 4. The 3-layer tracking system, 5. Quality & safety gates (don't skip), 6. Engineering patterns worth reusing, 7. Working with an AI build partner (+3 more)

### Community 26 - "gstack vs arc — Detailed, Honest Comparison"
Cohesion: 0.18
Nodes (10): 1. What each one is, 2. Commands / Skills, 3. Agents / subagents, 4. Hooks — arc's home turf, 5. MCP & ecosystem, 6. Maturity, quality, honesty, 7. Weaknesses, both sides, no mercy, 8. Final answer (+2 more)

### Community 27 - "7. FULL PIPELINE -- step by step (idhu dhaan main event)"
Cohesion: 0.18
Nodes (11): 7. FULL PIPELINE -- step by step (idhu dhaan main event), Mid-build-la pudhu idea vandhaa? (eppavum), Oru build, commands-la (summary), Stage 1 -- Plan pannu, Stage 2 -- Phase 0 = walking skeleton (FAKE data), Stage 3 -- Oru phase build pannu (Golden Loop -- idhu repeat aagum), Stage 4 -- Review gates (phase close panradhukku munnadi), Stage 5 -- Docs sync (+3 more)

### Community 28 - "PLAN.md — arc v2 "World-Best" Upgrade"
Cohesion: 0.18
Nodes (10): Appetite, Architecture (C4 concepts, Mermaid flowchart), Goal, Key decisions (ADR index), No-gos (explicitly out of scope), Non-negotiables, Phases (risk-ordered), PLAN.md — arc v2 "World-Best" Upgrade (+2 more)

### Community 29 - "common.sh"
Cohesion: 0.29
Nodes (6): arc_fingerprint(), arc_gitleaks_bin(), arc_have(), arc_jq_bin(), arc_semgrep_bin(), common.sh script

### Community 31 - "Claude Code — Canonical Project Folder Structure (Template)"
Cohesion: 0.25
Nodes (7): Claude Code — Canonical Project Folder Structure (Template), How to use, Keeping projects in sync with the template, Root files (MUST stay in project root, not inside `.claude/`), Structure, Template vs project — where does the app code live?, Two ideas worth remembering

### Community 32 - "Stripe Setup"
Cohesion: 0.29
Nodes (6): Checkout, Env, Local testing, Products & prices, Stripe Setup, Webhooks

### Community 33 - "Deployment"
Cohesion: 0.33
Nodes (5): Deployment, Don'ts, Flow, Rollback, Target: Vercel

### Community 34 - "How this structure works — the mental model"
Cohesion: 0.33
Nodes (5): How this structure works — the mental model, Per-project checklist, The memory stack — five layers, each with one job, The three behaviors, Worked example — "add Stripe checkout"

### Community 35 - "ADR NNNN — <decision title>"
Cohesion: 0.33
Nodes (5): ADR NNNN — <decision title>, Consequences, Context, Decision, Options considered

### Community 36 - "Phase NN — <name>"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase NN — <name>, Rabbit holes in this phase, Your-setup / pending

### Community 37 - "Phase 00 — Steel thread: arc-scan skeleton + CI on arc itself"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 00 — Steel thread: arc-scan skeleton + CI on arc itself, Rabbit holes in this phase, Your-setup / pending

### Community 38 - "Phase 01 — Credibility & hygiene"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 01 — Credibility & hygiene, Rabbit holes in this phase, Your-setup / pending

### Community 39 - "Phase 02 — Gate engine v1: manifest, baseline, suppression, evidence"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 02 — Gate engine v1: manifest, baseline, suppression, evidence, Rabbit holes in this phase, Your-setup / pending

### Community 40 - "Phase 03 — Security pipeline"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 03 — Security pipeline, Rabbit holes in this phase, Your-setup / pending

### Community 41 - "Phase 04 — QA pipeline"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 04 — QA pipeline, Rabbit holes in this phase, Your-setup / pending

### Community 42 - "Phase 05 — Phase ratchet + docs gate v2"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 05 — Phase ratchet + docs gate v2, Rabbit holes in this phase, Your-setup / pending

### Community 43 - "Phase 06 — Measured agent quality (cut-line phase)"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 06 — Measured agent quality (cut-line phase), Rabbit holes in this phase, Your-setup / pending

### Community 44 - "Phase 07 — Adversarial orchestration (cuttable)"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done), Out of scope for this phase, Phase 07 — Adversarial orchestration (cuttable), Rabbit holes in this phase, Your-setup / pending

### Community 45 - "Phase 08 — Distribution (NEXT CYCLE — placeholder spec)"
Cohesion: 0.33
Nodes (5): Exit criteria (Definition of Done) — draft, Out of scope, Phase 08 — Distribution (NEXT CYCLE — placeholder spec), Rabbit holes, Your-setup / pending

### Community 46 - "PROGRESS.md — arc v2 "World-Best" Upgrade"
Cohesion: 0.33
Nodes (5): Done log, North-star metric, Now, Phases, PROGRESS.md — arc v2 "World-Best" Upgrade

### Community 47 - "Changelog"
Cohesion: 0.40
Nodes (4): [0.2.0] — unreleased, Added, Changelog, [Unreleased]

### Community 48 - "code-reviewer.md"
Cohesion: 0.40
Nodes (4): Evidence & severity, Output, Pass 0 — scanner sweep (proven tools first, judgment second), Passes 1–4 — the judgment layer (what scanners can't see)

### Community 49 - "design-reviewer.md"
Cohesion: 0.40
Nodes (4): AI-slop detection (flag and kill these), Output, Score these dimensions 0-10 (say what a 10 looks like for each), Then fix (this is why it beats a pure reviewer)

### Community 50 - "security-auditor.md"
Cohesion: 0.40
Nodes (4): Every finding MUST include, Method, Output, Zero-noise discipline (this is why the audit is trusted)

### Community 51 - "SEO Article Writer"
Cohesion: 0.40
Nodes (4): Inputs, Output, SEO Article Writer, Workflow

### Community 52 - "ADR 0001 — SARIF as single findings format; one arc-scan runner with adapters"
Cohesion: 0.40
Nodes (4): ADR 0001 — SARIF as single findings format; one arc-scan runner with adapters, Consequences, Context, Decision

### Community 53 - "ADR 0002 — Noise defense is a prerequisite, not polish"
Cohesion: 0.40
Nodes (4): ADR 0002 — Noise defense is a prerequisite, not polish, Consequences, Context, Decision

### Community 54 - "ADR 0003 — Trivy over Snyk for SCA"
Cohesion: 0.40
Nodes (4): ADR 0003 — Trivy over Snyk for SCA, Consequences, Context, Decision

### Community 55 - "ADR 0004 — CodeQL as optional adapter; semgrep is the SAST spine"
Cohesion: 0.40
Nodes (4): ADR 0004 — CodeQL as optional adapter; semgrep is the SAST spine, Consequences, Context, Decision

### Community 56 - "ADR 0005 — Mutation score replaces coverage as the primary test-quality gate"
Cohesion: 0.40
Nodes (4): ADR 0005 — Mutation score replaces coverage as the primary test-quality gate, Consequences, Context, Decision

### Community 57 - "ADR 0006 — Hook tier vs CI tier split; heavy tools in docker"
Cohesion: 0.40
Nodes (4): ADR 0006 — Hook tier vs CI tier split; heavy tools in docker, Consequences, Context, Decision

### Community 58 - "ADR 0007 — bats-core self-tests; CI matrix ubuntu + windows Git Bash"
Cohesion: 0.40
Nodes (4): ADR 0007 — bats-core self-tests; CI matrix ubuntu + windows Git Bash, Consequences, Context, Decision

### Community 59 - "ADR 0008 — Gates block by default; warn is the opt-in downgrade"
Cohesion: 0.40
Nodes (4): ADR 0008 — Gates block by default; warn is the opt-in downgrade, Consequences, Context, Decision

### Community 60 - "Branding / Social / Contact"
Cohesion: 0.40
Nodes (4): Brand, Branding / Social / Contact, Contact, Social

### Community 61 - "Plugins"
Cohesion: 0.40
Nodes (4): Anatomy (if you ever author one), Install, Plugins, Plugins this project relies on

### Community 62 - "product-challenger.md"
Cohesion: 0.50
Nodes (3): Six forcing questions (make the user answer with specifics, not hypotheticals), The arc twist -- output becomes the plan, not a memo, Then

### Community 63 - "qa-tester.md"
Cohesion: 0.50
Nodes (3): Driver, Method, Output — exactly this

## Knowledge Gaps
- **343 isolated node(s):** `PostToolUse.sh script`, `PreCompact.sh script`, `PreToolUse-edit.sh script`, `PreToolUse.sh script`, `SessionEnd.sh script` (+338 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **100 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User Manual -- Sample Structure (arc- system)` connect `User Manual -- Sample Structure (arc- system)` to `7. FULL PIPELINE -- step by step (idhu dhaan main event)`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `7. FULL PIPELINE -- step by step (idhu dhaan main event)` connect `7. FULL PIPELINE -- step by step (idhu dhaan main event)` to `User Manual -- Sample Structure (arc- system)`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `PostToolUse.sh script`, `PreCompact.sh script`, `PreToolUse-edit.sh script` to the rest of the system?**
  _365 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Settings & Hook Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `User Manual -- Sample Structure (arc- system)` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should ``.claude/` — where Claude Code looks` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `<PROJECT_NAME> — CLAUDE.md` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
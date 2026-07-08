# Graph Report - .  (2026-07-08)

## Corpus Check
- Corpus is ~24,115 words - fits in a single context window. You may not need a graph.

## Summary
- 180 nodes · 247 edges · 20 communities (8 shown, 12 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.78)
- Token cost: 238,575 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Subagents & Review Concepts|Subagents & Review Concepts]]
- [[_COMMUNITY_Build Playbook & Docs|Build Playbook & Docs]]
- [[_COMMUNITY_Review & Lifecycle Commands|Review & Lifecycle Commands]]
- [[_COMMUNITY_Settings & Hook Config|Settings & Hook Config]]
- [[_COMMUNITY_Toolchain Health Script|Toolchain Health Script]]
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

## God Nodes (most connected - your core abstractions)
1. `README.md (Template Structure Guide)` - 17 edges
2. `Blueprint — Complete Structure Map` - 15 edges
3. `User Manual — Sample Structure (arc- system)` - 12 edges
4. `emit_all()` - 10 edges
5. `CLAUDE.md (Project Brain)` - 10 edges
6. `The Build Playbook` - 10 edges
7. `Product Runbook — Idea to Shipped` - 9 edges
8. `row()` - 7 edges
9. `code-reviewer Agent` - 7 edges
10. `hooks` - 6 edges

## Surprising Connections (you probably didn't know these)
- `product-challenger Agent` --semantically_similar_to--> `Phase Spec Template`  [INFERRED] [semantically similar]
  .claude/agents/product-challenger.md → docs/templates/phase-spec-template.md
- `product-challenger Agent` --references--> `Appetite (Shape Up)`  [EXTRACTED]
  .claude/agents/product-challenger.md → docs/templates/PLAN-template.md
- `product-challenger Agent` --references--> `Klein Pre-Mortem`  [EXTRACTED]
  .claude/agents/product-challenger.md → docs/templates/PLAN-template.md
- `README.md (Template Structure Guide)` --references--> `terse Output Style`  [EXTRACTED]
  README.md → .claude/output-styles/terse.md
- `README.md (Template Structure Guide)` --references--> `Supabase Rules`  [EXTRACTED]
  README.md → .claude/rules/supabase.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Security-Sensitive Review Chain (RLS + webhook verification + audit gate)** — claude_agents_security_auditor, claude_rules_security_sensitive, claude_rules_api, claude_rules_stripe, claude_rules_supabase [INFERRED 0.85]
- **Build Tracker Template Trio (PLAN + ADR + Phase Spec)** — docs_templates_plan_template, docs_templates_adr_template, docs_templates_phase_spec_template [EXTRACTED 1.00]
- **UI Quality Gate (rule -> /arc-design -> design-reviewer)** — claude_rules_ui, claude_arc_design_command, claude_agents_design_reviewer [EXTRACTED 1.00]
- **Review-Ledger Stamping Commands** — _claude_commands_arc_audit, _claude_commands_arc_design, _claude_commands_arc_docs, _claude_commands_arc_qa [EXTRACTED 1.00]
- **Phase Planning & Closure Cycle** — _claude_commands_arc_kickoff, _claude_commands_arc_change, _claude_commands_arc_phase_done [INFERRED 0.85]
- **Ship Pipeline & Post-Deploy Gates** — _claude_commands_arc_ship, _claude_commands_arc_second_opinion, _claude_commands_arc_canary [INFERRED 0.75]
- **Three Loading Behaviors Documented Across Multiple Docs** — docs_how_it_works_three_loading_behaviors, docs_blueprint, docs_how_it_works, docs_usermanual [EXTRACTED 0.95]
- **Golden Loop Defined and Applied** — docs_build_playbook_golden_loop, docs_product_runbook, docs_usermanual [INFERRED 0.85]
- **Quality Gate Enforcement System** — docs_build_playbook_quality_gates, docs_usermanual_review_ledger_gates, docs_deployment_deploy_guard_flow [INFERRED 0.85]

## Communities (20 total, 12 thin omitted)

### Community 0 - "Subagents & Review Concepts"
Cohesion: 0.11
Nodes (35): CLAUDE.md (Project Brain), code-reviewer Agent, codegraph MCP, design-reviewer Agent, AI Slop (Design Anti-Patterns), log-analyzer Agent, product-challenger Agent, qa-tester Agent (+27 more)

### Community 1 - "Build Playbook & Docs"
Cohesion: 0.12
Nodes (30): Blueprint — Complete Structure Map, Branding / Social / Contact, The Build Playbook, Change Intake, Definition of Done (DoD), The Golden Loop, Offline-First / Interface+Fake+Real Pattern, Quality & Safety Gates (+22 more)

### Community 2 - "Review & Lifecycle Commands"
Cohesion: 0.11
Nodes (20): /arc-audit command, /arc-change command, /arc-commit command, /arc-fix-issue command, /arc-kickoff command, /arc-phase-done command, /arc-resume command, /arc-retro command (+12 more)

### Community 3 - "Settings & Hook Config"
Cohesion: 0.10
Nodes (19): arc, coverageFloor, coverageMode, coverageSummary, docsGate, hooks, PostToolUse, PreCompact (+11 more)

### Community 4 - "Toolchain Health Script"
Cohesion: 0.29
Nodes (14): emit_all(), env_has(), fix_add(), have(), man_add(), R_ENV(), R_MISS(), R_NG() (+6 more)

### Community 5 - "Ship & QA Commands"
Cohesion: 0.17
Nodes (13): /arc-canary command, /arc-design command, /arc-docs command, /arc-freeze command, /arc-pr command, /arc-qa command, /arc-ship command, /arc-unfreeze command (+5 more)

### Community 6 - "MCP Server Config"
Cohesion: 0.21
Nodes (11): STRIPE_SECRET_KEY, SUPABASE_ACCESS_TOKEN, npx, context7, playwright, stripe, supabase, @playwright/mcp (+3 more)

## Ambiguous Edges - Review These
- `/arc-canary command` → `Deploy-Guard Hook`  [AMBIGUOUS]
  .claude/commands/arc-canary.md · relation: conceptually_related_to

## Knowledge Gaps
- **48 isolated node(s):** `PostToolUse.sh script`, `PreCompact.sh script`, `PreToolUse-edit.sh script`, `PreToolUse.sh script`, `SessionEnd.sh script` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `/arc-canary command` and `Deploy-Guard Hook`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `/arc-audit command` connect `Review & Lifecycle Commands` to `Ship & QA Commands`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `Review Ledger (review-ledger.sh)` connect `Ship & QA Commands` to `Review & Lifecycle Commands`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Blueprint — Complete Structure Map` (e.g. with `Stripe Webhook Idempotency` and `RLS Default-Deny Pattern`) actually correct?**
  _`Blueprint — Complete Structure Map` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PostToolUse.sh script`, `PreCompact.sh script`, `PreToolUse-edit.sh script` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Subagents & Review Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.11260504201680673 - nodes in this community are weakly interconnected._
- **Should `Build Playbook & Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.12413793103448276 - nodes in this community are weakly interconnected._
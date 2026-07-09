# GSD vs Superpowers vs arc — Detailed, Honest Comparison

**Date:** 2026-07-09 · **Sources:** full clones of `open-gsd/gsd-core` @ v1.7.0-rc.4 (2,438 files) and `obra/superpowers` @ v6.1.1 (171 files), vs `arc` @ Phase 01 closed (v2 initiative live). Claims verified against actual files. Companion doc: `gstack-vs-arc-comparison.md`.

---

## TL;DR — the honest verdict

Three completely different bets on the same problem (AI agents drift, forget, and lie about quality):

- **GSD** bets on **context engineering + a spec-driven state machine**, backed by shockingly serious engineering. This is **the closest real competitor to arc's discipline axis** — much closer than gstack was. It HAS a phase-gated loop with fail-closed gates.
- **Superpowers** bets on **persuasion**: 14 empirically-tuned skills that talk the model into discipline. Zero deterministic enforcement, by design. Best distribution of the three (Anthropic's official plugin marketplace, 10 hosts, commercial support).
- **arc** bets on **deterministic runtime enforcement + tool-verified evidence**. Still the only one of the three that *mechanically blocks* a bad deploy at the tool-call layer with real scanner output — but it is also, by far, the least mature artifact.

**Install-one-today verdict: GSD.** Most complete system, phase discipline built in, 549 self-test files, 26 CI workflows, mutation-tested, 17 host runtimes.
**Methodology-layer verdict: Superpowers** — orthogonal to everything, composes with anything, costs nothing.
**arc's moat survives, but it narrowed.** Against gstack, arc's enforcement story was unique. Against GSD, the honest statement is: GSD enforces at the *workflow/CI* layer (fail-closed prose gates + CI), arc enforces at the *runtime tool-call* layer (PreToolUse blocks with real scanners). arc's remaining genuinely-unique combo: synchronous deploy-guard with live test/scanner runs, commit-SHA review ledger, unified SARIF scanner pipeline, evidence bundles, CWV-rollback canary, and (planned P04/P06) mutation-gating of *user* code + planted-bug agent evals.

---

## 1. What each one is

| | **GSD** (`open-gsd/gsd-core`) | **Superpowers** (`obra/superpowers`) | **arc** |
|---|---|---|---|
| One-liner | Spec-driven dev system fighting "context rot" via fresh-context subagents + durable file state | "A complete software development methodology" as 14 composable skills + persuasion prose | Enforcement/evidence mold: hooks block, tools verify, tracker remembers |
| Version | 1.7.0-rc.4, strict SemVer, changesets | 6.1.1, 50 releases in ~9 months | v2 initiative, Phase 00–01 closed |
| Author/scale | OpenGSD community: 4 code owners, Discord, 4 translated README+docs trees | Jesse Vincent + Prime Radiant: hiring, commercial support, official Anthropic marketplace | Solo (Ashiq) |
| Install | npm installer (mandatory — converts artifacts per-runtime), **17 host runtimes** | Plugin manifests for **10 harnesses** (Claude Code, Codex, Cursor, Kimi, Pi, OpenCode…) | Copy/sync mold (bash + PS twins), Claude Code only |
| Core loop | `spec → discuss → plan → execute (parallel waves) → verify → ship` | `brainstorm → write-plan → subagent-driven-development → review → verify → finish` | Golden Loop: `kickoff → change → build w/ gates → phase-done → retro` |

## 2. Commands / Skills

**GSD: 71 commands + 71 mirrored plugin skills.** The loop is genuinely sophisticated: `/gsd-spec-phase` runs a Socratic interview and **scores ambiguity across 4 weighted dimensions** (gate: ≤0.20 before a spec locks); `/gsd-plan-phase` orchestrates researcher → planner → plan-checker verify-loop; `/gsd-execute-phase` runs **wave-based parallel executors**, each with a fresh 200k context while the orchestrator stays at ~15%; `/gsd-verify-work` does conversational UAT with auto-diagnosed gap plans; `/gsd-ship` refuses unless verification == `passed`. Plus 35 composable **capabilities** (tdd, security, ui, graphify, mempalace…) installable from third parties behind a sha512-integrity + consent trust gate. This is the deepest command surface of any stack reviewed so far, gstack included.

**Superpowers: 14 skills, ruthlessly curated** (they reject most skill contributions). The famous ones: `brainstorming` (Socratic spec, `<HARD-GATE>` — no code until design approved), `writing-plans` (2–5 min tasks, no placeholders), `subagent-driven-development` (fresh implementer per task → reviewer with two verdicts → fix loop → one broad end review; file-based handoffs so diffs never pollute the controller's context), `test-driven-development` ("Iron Law: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST" — code before test → *delete it*), `systematic-debugging`, `verification-before-completion` (bans "should/probably/Done!" without fresh command output). Skills chain via `REQUIRED SUB-SKILL:` markers deliberately *not* auto-loaded — context frugality is a design religion here.

**arc: 20 commands** pointed at one spine (kickoff/change/phase-done/retro + stamped review gates + ship chain + rollback canary). Smallest surface, but every command terminates in a committed artifact + a ledger stamp — neither GSD nor Superpowers stamps a commit-SHA ledger.

**Honest call:** breadth + orchestration sophistication → **GSD**. Prose quality per skill and context economy → **Superpowers** (their skills are the best-written process prose in the ecosystem, and they can prove it — see §6). Artifact/gate discipline per command → **arc**.

## 3. Agents / subagent orchestration

- **GSD: 34 agent definitions** (planner, executor, plan-checker, verifier, phase-researcher with firecrawl/exa/tavily/perplexity MCPs, security-auditor, nyquist-auditor, ui-auditor, debugger, mempalace-curator…). Model tiers resolved via a runtime model-catalog rather than pinned per-agent. Cross-AI review convergence exists (`--codex/--gemini/--ollama/--lm-studio` adapters).
- **Superpowers: zero agent files** — orchestration is prompt-template-driven (implementer-prompt, task-reviewer-prompt with `DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT` states). Their v6.0 finding is worth stealing: cutting two reviewers per task to one-reviewer-two-verdicts + one end review saved ~50% tokens at equal quality — *they measured it*.
- **arc: 7 agents**, explicit models + tool whitelists, scanner-integrated code-reviewer with Graphify blast radius, zero-noise security-auditor.

**Honest call:** GSD wins count and orchestration machinery; Superpowers wins measured efficiency of the review loop; arc wins tool-groundedness (its reviewer runs semgrep/gitleaks/osv, GSD's agents mostly reason over source + regex scans, Superpowers' reviewers reason over diffs).

## 4. Hooks & enforcement — the decisive axis, precisely

- **Superpowers: 1 hook, SessionStart, pure text injection.** Nothing blocks, ever, by design. Enforcement = injection + persuasion prose (Iron Laws, rationalization tables cataloguing every excuse agents made in baseline tests, Cialdini principles applied deliberately, citing Meincke et al. 2025: persuasion doubled compliance 33%→72%). It is honest about being probabilistic.
- **GSD: 18 managed hooks, but only ONE hard runtime block by default** (worktree-path-guard, exit 2). Commit-format blocking and injection-HIGH blocking exist but are opt-in. The real teeth are elsewhere: **fail-closed workflow gates** (`/gsd-ship` refuses without `verification: passed`; security ship gate blocks if `threats_open != 0` — fail-closed on missing/malformed values) and **truly blocking CI** (secret scan, injection scan, dependency integrity). Critical honesty: those workflow gates are *prose evaluated by the orchestrator against gsd-tools queries* — hardened, but a pressured model can route around them; only the path guard and CI are external.
- **arc: 6 hooks, deterministic at the tool-call layer.** PreToolUse physically blocks destructive commands and intercepts deploys — runs the actual test suite, coverage gate, SHA-keyed review-ledger `require`, docs-drift, and (v2) `arc-scan` with real SARIF findings, synchronously, exit 2. The model cannot "decide" to skip it. Block-by-default profiles shipped in Phase 01.

**Honest call:** this is a spectrum, not a knockout. Superpowers = persuasion only. GSD = prose-gates + CI (strong but orchestrator-mediated in-session). arc = runtime mechanical blocks (strongest in-session guarantee, smallest overall system). arc's claim "the agent *cannot* forget" remains true and unique; GSD's counter is that its CI layer is vastly more built-out than arc's single workflow.

## 5. MCP & external tooling

- **GSD:** ships its own **MCP server** (`gsd-mcp-server`, hand-rolled stdio JSON-RPC — any MCP host can drive GSD) — clever distribution move. Agents consume context7/firecrawl/exa/tavily/perplexity. No SAST/DAST/SCA of user code; security scanning is regex/pattern-based (their injection scanner self-describes as "NOT a semantic guard").
- **Superpowers:** zero MCP, zero dependencies, zero scanners — tells the agent to use the project's own tools. Purity is the feature.
- **arc:** supabase/playwright/context7/stripe MCPs + Graphify/codegraph/claude-mem/agent-browser/Codex ecosystem + the v2 SARIF pipeline (semgrep, gitleaks live; Trivy/CodeQL/ZAP/Stryker per plan).

**Honest call:** arc is the only one wiring *industry verifier tools* into gates. GSD's gsd-mcp-server idea is worth stealing for arc's Phase 08.

## 6. Maturity, quality, self-honesty

| Signal | GSD | Superpowers | arc |
|---|---|---|---|
| Self-tests | **549 test files** (node:test), 17 property-based (fast-check), sharded cross-platform runner | Infra self-tested (node:test + bash); *behavior* tested via out-of-repo LLM eval harness driving real tmux sessions | 43 bats tests (13 scan + 11 profile + 6 sync + …), growing |
| Mutation testing | **Stryker on its own lib**, ratcheted thresholds — honestly discloses ~48% exclusion incl. central modules | n/a | planned for *user* code (P04) |
| CI | **26 workflows** incl. security-scan, install-smoke, mutation, governance automation | pre-commit lint only (evals live in a separate repo) | 1 workflow, 2-OS matrix (3-OS in P02) |
| Versioning | Strict SemVer, changesets, manifest-drift regression test | 50 dated releases / 9 months | VERSION + CHANGELOG since Phase 00 |
| Self-honesty | High: mutation blind spot disclosed, scanner limits disclosed | Very high: "94% PR rejection", enforcement admitted probabilistic, failed wording experiments documented | High in docs; short track record |
| Community | 4 translated doc trees, Discord, code owners | Official Anthropic marketplace, commercial support, hiring | none (bus factor 1) |

**Honest call:** GSD is the most heavily engineered prompt-system repo reviewed in this whole exercise — it out-engineers gstack on self-testing rigor (property-based tests, mutation ratchet, custom ESLint rules for portability). Superpowers is the most *scientifically* honest: it treats prompt-writing as an empirical discipline with baselines and controls (their "prohibitions backfire on output-shape failures" finding is a real, tested insight). arc is earliest, but its Phase 00/01 pattern (CI catching a real Windows bug on day one) shows the right trajectory.

## 7. Weaknesses, no mercy

**GSD:** no browser/E2E QA of user products (ui-audit is code-only if no dev server); no SAST/DAST/SCA — security is regex scans + review prose; in-session gates orchestrator-mediated; evidence = JSONL trace + git, no tamper-evident ledger; enormous surface (71 commands, 35 capabilities, 160 TS modules) with correspondingly heavy conceptual load; memory is grep-over-predicates, not semantic.

**Superpowers:** nothing is guaranteed — a pressured model can skip everything; no scanners, no gates, no tracker beyond a git-cleanable markdown ledger; behavioral CI lives outside the repo, so forks fly blind; 10-harness manifest sprawl is a maintenance tax (their own recent bugs prove it); flagship SDD degrades hard on harnesses without subagents.

**arc:** 43 tests vs their hundreds; one CI workflow; zero users beyond the author; the deepest planned differentiators (mutation gate, eval corpus, saboteur) are still *plans* (P04/P06/P07); heavy external tool surface each a degrade point; no distribution story until Phase 08.

## 8. Final answer — which is best, and why

- **Best complete system to adopt today: GSD.** It pairs a real methodology with real engineering and multi-host reach. If arc didn't exist and you wanted discipline, this is what you'd install.
- **Best methodology layer / best prose engineering: Superpowers.** It composes with anything (including arc — its TDD/brainstorming/debugging skills + arc's gates are perfectly complementary, since one shapes *judgment* and the other constrains *actions*).
- **Best on the enforcement+evidence axis: still arc** — runtime mechanical blocks with industry-tool verdicts and committed evidence is a combination neither has, and neither is architecturally pointed at it (Superpowers rejects determinism philosophically; GSD chose orchestrator-mediated gates deliberately).
- **The strategic warning:** GSD, not gstack, is arc's real competitor. It already owns spec-discipline, parallel execution, multi-host, and massive self-testing. arc's survival depends on shipping the things GSD structurally lacks: the SARIF verifier pipeline (P02–03), mutation-gating of user code (P04), planted-bug agent evals (P06), and the evidence bundle chain (P02). Those four, delivered, make arc defensible; as plans, they're just a roadmap.

**Worth stealing** (route via `/arc-change` if wanted): GSD's spec ambiguity-scoring gate (kickoff upgrade), GSD's gsd-mcp-server distribution trick (P08), GSD's property-based tests for gate scripts, Superpowers' persuasion-tuned prose + rationalization tables for arc's agent prompts, Superpowers' one-reviewer-two-verdicts token finding, and their eval-harness-drives-prose-changes method — which is exactly arc's Phase 06 philosophy applied to skill text.

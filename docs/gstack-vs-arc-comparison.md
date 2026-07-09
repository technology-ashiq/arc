# gstack vs arc — Detailed, Honest Comparison

**Date:** 2026-07-09 · **Sources:** full clone of `github.com/garrytan/gstack` @ v1.58.5.0 (1,169 files) vs `E:\Work_Hub\01_Automemory\arc` @ commit `b79caef` (3 commits). Every claim below was checked against actual files, not READMEs alone.

---

## TL;DR — the honest verdict

**They are not the same kind of thing, and arc itself knows this** (usermanual §12: "throwaway/preview → gstack | decision/gate/tracked deliverable → arc").

- **As an engineering artifact / product: gstack wins, and it isn't close.** v1.58.5.0, 280 test files, 10 CI workflows, LLM-judge + e2e evals, a ~890KB changelog with pre-registered success metrics, a compiled browser daemon, multi-model overlays, a real prompt-injection defense stack. arc has 3 commits, zero tests, zero CI, and its "battle-tested" claim is asserted, not demonstrated in-repo.
- **As a build-discipline layer: arc wins on the one axis gstack structurally lacks — deterministic enforcement.** gstack's own ethos is "AI models recommend, users decide"; almost everything is advisory. arc's soul is "hooks enforce": deploy is *blocked* if tests fail, coverage drops, required reviews are unstamped, or docs drifted. gstack has no phase-gated build state machine, no change-management intake, no commit-SHA review ledger, no rollback-on-regression canary. These are real gaps gstack's design philosophy will probably never fill.
- **Recommendation: use both, which is exactly what arc was designed for** (`arc-` prefix is deliberately collision-free). If forced to pick exactly one today: **gstack** — more capability, vastly more tested, maintained by a team. But then you lose the enforcement spine, which is the only genuinely novel thing arc adds.

---

## 1. What each one is

| | **gstack** | **arc** |
|---|---|---|
| Nature | Open-source skill suite: "virtual engineering team" as slash commands | Personal project **template/mold**: copied into each project, then synced |
| Author/scale | Garry Tan + contributors; public, versioned, telemetry, community | Solo (Ashiq); 3 commits; Tanglish usermanual |
| Install | Global `~/.claude/skills/gstack` + optional team mode w/ auto-update SessionStart hook | Per-project copy; `sync-to-project.ps1` (PowerShell/robocopy, Windows-only) |
| Philosophy | "Boil the Ocean" completeness; **user sovereignty — advisory by default** | "CLAUDE.md guides · **hooks enforce** · docs hold depth · tracker remembers"; artifact + gate + resumable state |
| Hard technical core | Compiled Bun+Playwright browser daemon (~100-200ms calls) | Bash hook gate chain + commit-SHA review ledger |

---

## 2. Commands / Skills

**gstack: ~54 skills** (each 60–127KB — huge, template-generated, eval-covered). Standouts:

- Planning: `spec` (127KB, intent→executable spec), `autoplan` (auto-runs CEO+eng+design+DX reviews with auto-decision principles), `office-hours` (YC-style interrogation), 4 persona plan-reviews with an exit-plan-mode gate, `plan-tune` (learns your question-sensitivity via hooks).
- Quality: `review` (Review Army — parallel specialist subagents with **adaptive gating**: specialists with 0 findings in 10+ dispatches get auto-skipped; security/data-migration never gated), `qa`/`qa-only`, `design-review` (AI-slop hunting), `cso` (14-phase OWASP+STRIDE), `investigate`, `retro`, `health`, `devex-review`.
- Design exploration: `design-shotgun` (multi-variant generation + comparison board), `design-html`, `design-consultation`, `diagram` (→ excalidraw).
- Browser: `browse`, `scrape`, `skillify` (codifies a successful scrape into a permanent skill), `pair-agent` (remote agent ↔ your browser over ngrok, dual-listener security), cookie import.
- iOS on real devices: `ios-qa`/`ios-fix`/`ios-design-review`/`ios-clean`/`ios-sync` (devicectl + DebugBridge, no simulator/XCTest). **Nothing like this exists in arc.**
- Ship: `ship`, `land-and-deploy` (auto-detects Fly/Vercel/Netlify/Render/Railway), `canary`, `document-release`, `make-pdf`.
- Memory: `setup-gbrain`/`sync-gbrain` (semantic code search + call graph + cross-session memory, PGLite or Supabase), `learn`, `context-save/restore`.
- Safety: `careful`, `freeze`/`unfreeze`, `guard` — and note, these ARE hook-enforced (skill frontmatter registers PreToolUse command hooks; edits outside the boundary are blocked, not warned).

**arc: 20 commands**, all pointed at one spine:

- **The Golden Loop — gstack has no equivalent:** `/arc-kickoff` (appetite, risk-ordered phases, walking skeleton, pre-mortem, ADRs — STOPS before code) → `/arc-change` (every mid-build idea, including Claude's own, must get a tracked home BEFORE code) → `/arc-phase-done` (DoD gate: tests green + live demo + exit criteria, **refuses to close** otherwise) → `/arc-retro` (repeated corrections become permanent setup upgrades).
- Review gates that **stamp a commit-SHA ledger**: `/arc-review`, `/arc-audit`, `/arc-qa` (every bug fix requires a fail-before/pass-after regression test), `/arc-design`, `/arc-docs`, `/arc-second-opinion` (Codex CLI; critical disagreement blocks ship; refuses to fake a second opinion if Codex is absent).
- Ship chain: `/arc-commit` → `/arc-pr` → `/arc-ship` (deploy-guard re-checks everything) → `/arc-canary` (**CWV baseline diff + rollback on regression — arc's docs correctly claim gstack has no equivalent; verified true**).
- Utility: `/arc-toolcheck` (pinned smart-table artifact), `/arc-freeze` (persistent state-file boundary vs gstack's session-scoped skill), `/arc-resume`, `/arc-diagram`, `/arc-fix-issue`.
- Skills: arc has exactly **one** (`seo-article-writer`, unrelated utility). gstack's 54-vs-1 here is not a fair fight and doesn't need to be — arc's units of work are commands.

**Honest call:** breadth, depth-per-skill, and eval coverage → gstack, decisively. Build-lifecycle discipline (kickoff→change→phase-done→retro, DoD gates, change intake) → arc, and it's not a niche win: this is the layer that stops AI-driven projects from becoming ad-hoc sprawl. Several arc pieces are frankly gstack-inspired (`product-challenger` ≈ office-hours, `security-auditor` ≈ cso, `arc-second-opinion` ≈ codex, freeze/canary names match) — arc even credits this in its own files.

---

## 3. Agents / subagents

- **gstack:** no standalone agent .md files. The Review Army spawns `general-purpose` subagents from specialist definitions (testing, maintainability always-on; security, performance, data-migration, api-contract, red-team scope-gated), with usage-statistics-driven adaptive gating — genuinely clever. Multi-model is first-class: Codex CLI (review/challenge/consult modes), Gemini in CI evals, per-model behavior overlays (`gpt.md`, `o-series.md`, `gemini.md`…), cross-model benchmarking.
- **arc:** 7 dedicated agents with explicit models and tool whitelists. `code-reviewer` (opus) runs a scanner sweep (semgrep, gitleaks, osv-scanner, knip — missing tools marked SKIPPED, never silent) + blast-radius via the Graphify/codegraph knowledge graph. `security-auditor` (opus) has a zero-noise rule gstack's cso lacks: report only ≥8/10-confidence, exploitable findings with a concrete exploit path. `qa-tester`, `design-reviewer` (fixes code, before/after screenshots), `product-challenger`, `researcher` (Context7-first, ≥2-source triangulation), `log-analyzer` (differential diagnosis).

**Honest call:** architecture sophistication and multi-model reach → gstack. Per-agent craft is comparable — arc's agents are well-designed and the scanner-integration + graph-based blast radius in `code-reviewer` is something gstack's review doesn't do (gstack has no code-graph; GBrain's call-graph search is the closest but isn't wired into review). Slight edge gstack for adaptive gating + eval-tested behavior.

---

## 4. Hooks — arc's home turf

- **gstack:** SessionStart auto-update (team mode), plan-tune question-capture/preference hooks (opt-in), and skill-scoped freeze/careful/guard hooks. That's it — deliberate, per its sovereignty ethos. **Nothing blocks a bad ship.** `ship` runs tests inside the skill flow, but that's the model following instructions, not an interceptor.
- **arc:** 6 lifecycle hooks + 5 gate scripts, always on. PreToolUse blocks destructive commands (rm -rf, force-push, DROP TABLE — even mid-pipe) and intercepts deploys: run tests → coverage floor → required-review ledger → docs-drift, any failure = exit 2 = blocked. PostToolUse auto-formats. PreCompact/SessionStart/SessionEnd maintain resumable state and a session log. The review ledger is keyed to commit SHA — new commit resets it, so stale approvals can't leak forward. This is a genuinely different enforcement model: the agent *cannot* forget.

**Honest caveat that cuts against arc:** out of the box `coverageMode` and `docsGate` ship as `"warn"` and `ARC_REQUIRED_REVIEWS` is unset — so the famous moat is **advisory by default** until you flip it. In default config, the practical enforcement gap between the two is smaller than arc's docs imply. Destructive-command blocking and test-on-deploy are truly on by default, though.

**Honest call:** arc wins clearly. This is its reason to exist.

---

## 5. MCP & ecosystem

- **gstack:** ships no `.mcp.json`; registers only the gbrain MCP at setup. Explicitly *forbids* claude-in-chrome MCP — browser goes through its own daemon (faster, more controlled). GBrain gives semantic code search + call graph + cross-session memory with per-repo trust policies.
- **arc:** `.mcp.json` with supabase (read-only), playwright (fallback), context7, stripe; sentry/github documented-optional. Plus a machine-level stack: Graphify knowledge graph (committed `graphify-out/`, auto-refreshed at session start, mandated for impact questions), claude-mem, codegraph, agent-browser (Vercel Labs CDP CLI) as primary browser muscle, Codex CLI. Everything degrades gracefully to grep with an explicit "degraded" note.

**Honest call:** roughly even, different bets. gstack's browser daemon is far more engineered than agent-browser integration; GBrain vs Graphify+claude-mem+codegraph is a one-tool-vs-three-tools tradeoff (gstack simpler, arc's graph is wired into review/log-analysis which GBrain isn't). arc's stack has more moving parts to break — mitigated by `/arc-toolcheck`, but 8+ optional external installs is real fragility.

---

## 6. Maturity, quality, honesty

| Signal | gstack | arc |
|---|---|---|
| Version | 1.58.5.0, version-gate CI | none (3 commits) |
| Tests of itself | 280 test files, Bun runner | **zero** |
| CI | 10 GitHub workflows + GitLab, e2e evals, LLM-judge, cross-model, Windows e2e | **none** |
| Changelog | ~890KB, pre-registered metrics | none |
| Security engineering | L1-L6 prompt-injection defense, redaction engine, pre-push secret guard, attempt logging | secrets denied via permissions + gitleaks in review; no injection defense of its own |
| Self-consistency | high, generated docs | high in docs, but: `/arc-review` doesn't auto-stamp `code` (known, unwired), agent-browser doc says "PROPOSED" while feature is committed, stray `.writetest` files |

**Honest call:** gstack, by an order of magnitude. arc preaches evals, coverage floors, and CI in its build-playbook while shipping none of its own — the template's discipline is aimed at target projects, but a mold that doesn't test itself is a mold that will drift. This is arc's single biggest credibility gap.

---

## 7. Weaknesses, both sides, no mercy

**gstack:**
1. No enforcement — everything can be skipped/forgotten; sovereignty ethos precludes hard gates.
2. No phase/change discipline, no DoD, no tracked build state, no review ledger.
3. No DB workflow (data-migration is just a review specialist); no post-deploy observability beyond canary; no rollback automation.
4. Context tax: 60–127KB per skill invocation, heavy shared preamble.
5. Windows second-class (chronic path/cookie fixes); iOS suite is macOS-only.
6. Ideology baked in ("Boil the Ocean", 810× framing) — doesn't fit every risk posture.

**arc:**
1. Zero self-testing/CI/evals — its quality claims about itself are unverified.
2. Gates default to warn; the enforcement story requires manual opt-in flips.
3. Solo-shaped and Windows-coupled (PowerShell-only sync; hooks need Git Bash).
4. Heavy external dependency surface (semgrep/gitleaks/osv/knip/graphify/agent-browser/claude-mem/codex…) — each a silent-degrade point.
5. Small internal inconsistencies already at 3 commits (unwired code-stamp, PROPOSED-vs-shipped doc drift) — mildly ironic for a system with a docs-drift gate.
6. No community, no second user, no upstream — bus factor 1.

---

## 8. Final answer

**"Which is best?" depends on what you're buying:**

- Buying a **capability suite** (design exploration, browser automation, iOS QA, plan reviews, multi-model, memory) → **gstack**. It's the more serious piece of software by every measurable signal.
- Buying **discipline for your own builds** (nothing ships untested/unreviewed, every change tracked, every phase gated, resumable state) → **arc**. gstack cannot do this and, philosophically, won't.
- **Best real-world setup: both together** — gstack for exploration and throwaway work, arc as the gate/tracker/enforcement layer on deliverables. This is literally arc's design intent and the prefixes don't collide.

**If arc wants to stop being second place overall, the path is clear:** (1) flip gates to block by default, (2) add a self-test suite + minimal CI for the hooks/scripts (they're bash — bats tests are cheap), (3) wire the `/arc-review` code-stamp, (4) a bash version of sync, (5) version + changelog the mold. Items 1–3 are a weekend. The enforcement idea is genuinely good; right now the execution maturity doesn't match the design quality.

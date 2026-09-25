# Blueprint — complete overview of every folder & file

What each piece is, why it exists, its benefit, and how to use it. The full map.

> One sentence: **CLAUDE.md guides · hooks enforce · commands/agents/skills/rules load on
> demand · docs hold the depth · tracker files remember the build** — so every session,
> Claude behaves like a senior dev who's been on the project since day one.

**Six products, one umbrella.** `core` · `plan` · `review` · `qa` · `git` · `council`. `core` is
the base; every other product requires it. A target installs any subset —
`./sync-to-project.sh <project> --products plan,review` — and receives only those products'
commands, agents, scripts and docs. `/arc` reports what's installed from
`.claude/arc-registry.json`. Read every section below as "*if that product is installed*".

---

## Root files (project-wide, must stay at root)

### `CLAUDE.md`
The brain. Loads into Claude's context **every session automatically**: project goal, stack,
rules, commands, architecture, links to deeper docs.
**Benefit:** you never re-explain the project.
**Use:** fill the TODOs on day 0; add a line whenever you correct Claude twice on the same
thing. Keep under ~200 lines — overflow goes to `docs/` with a link.

### `CLAUDE.local.md`
Same idea, but private and **gitignored**: your port, package manager, local DB creds,
personal preferences.
**Use:** machine-specific stuff only; anything team-relevant belongs in CLAUDE.md.

### `README.md`
For humans, not Claude: the six products and what each one carries, the install and selective-
install commands, the arc-repo-vs-project rule, core concepts.
**Use:** read once, point teammates at it.

### `.mcp.json`
Registers MCP servers so Claude gets real capabilities in chat: **Supabase** (your DB),
**Stripe** (payments), **Playwright** (real-browser fallback for qa-tester — the primary
browser muscle is the **agent-browser CLI**, invoked via Bash), **Context7**
(current, version-specific library docs — powers researcher). Must be at root.
**Benefit:** "how many users signed up?" answered from real data; docs always current.
**Use:** set `SUPABASE_PROJECT_REF` in env, delete servers you don't use. Secrets via `${VAR}`
only. Optional add-ons when you have accounts: Sentry MCP (prod errors), GitHub MCP (PRs/issues).

### `.env.example`
The env contract: every variable named, no values.
**Use:** copy → `.env.local`, fill real secrets. New variable? Add it here too.

### `.gitignore`
Keeps `.env.local`, `CLAUDE.local.md`, `settings.local.json`, build junk and `.claude/state/`
out of git.
**Benefit:** secrets can't leak by accident. Don't fight it.

### `sync-to-project.sh` / `sync-to-project.ps1` (live in the arc repo only)
The installer, as two equivalent twins — both drive the same resolver (`arc-products.mjs`), so
neither can drift into its own idea of what a product contains.

```bash
./sync-to-project.sh <project>                      # every product
./sync-to-project.sh <project> --products plan,qa   # subset; core follows as a dependency
./sync-to-project.sh <project> --list               # the six product names
./sync-to-project.sh <project> --prune-report       # read-only: what's there that arc didn't install
```

Syncs `.claude/` + `docs/templates/` + meta docs; never touches CLAUDE.md, PLAN/PROGRESS, ADRs,
reviews, or code. Writes `.claude/arc-registry.json` into the target (products, versions, file
lists, source commit) — the file `/arc` reads to report status. Restart the project's Claude
Code session after. Good `/arc-retro` findings flow the other way by hand.

**Never deletes.** There is no delete path in either twin. `--prune-report` lists unowned files
and exits 0; because "unowned" means "arc did not install it", the consumer's own files appear
there too, and the output says so. Automated quarantine was built and scope-cut for exactly
that reason — see `docs/adr/0023-*`.

---

## `.claude/` — where Claude Code looks

### `settings.json`
Shared config: permission allow/deny lists (safe commands pre-approved; `git push` and `.env`
reads denied), hook registry, statusline pointer.
**Benefit:** no permission-nagging, but dangerous actions stay impossible.
**Use:** add allow rules when a safe command keeps asking.

### `settings.local.json`
Personal overrides (model choice, extra allows like `pnpm`). Gitignored.
**Use:** personal taste here, never in the shared file.

### `statusline.sh`
Prints dir · branch · model at the bottom of the UI. **Use:** nothing — it just runs.

### `hooks/` — deterministic, fire every time (Claude cannot forget these)

| Hook | Fires | What it does for you |
|---|---|---|
| `SessionStart.sh` | session open | Injects branch, last commit, dirty files + PROGRESS.md `## Now`, then a **one-line toolchain summary** (`N ready / N need action`) from the shared `scripts/core/toolchain-health.sh --brief`. Kept light + fast — full per-tool detail and one-command fixes live in `/arc-toolcheck`. Report-only, never launches processes, so startup stays instant |
| `PreToolUse.sh` | before any bash | Destructive-guard (blocks `rm -rf ~`, force-push, `DROP TABLE` — even chained) + deploy-guard (re-runs tests before deploy; red = blocked) |
| `PostToolUse.sh` | after any edit | Prettier + eslint on the touched file — always formatted, zero effort |
| `PreCompact.sh` | before context compaction | Snapshots state to `.claude/state/` so long sessions keep continuity |
| `SessionEnd.sh` | session close | Appends branch/commit/position to `docs/session-log.md` — the committed, team-visible session trail (complements Claude's machine-local native auto memory) |

**Use:** nothing daily — they're the adult in the room. Extend when something *must
always/never* happen.

### `commands/` — you invoke with `/name`

All 22, grouped by the product that owns them. A target has only the commands of its
installed products — `/arc` prints which those are.

| Command | Product | When | What it does |
|---|---|---|---|
| `/arc` | core | any time | Umbrella status: per-product INSTALLED/HEALTH read from `.claude/arc-registry.json`, plus the exact install command for anything absent. Zero file-presence guessing |
| `/arc-toolcheck` | core | fresh machine / a tool acting up | Runs `scripts/core/toolchain-health.sh` — every tool's status (installed/missing/stale) with the exact fix, rendered as the project's pinned **smart-table artifact** (template: `.claude/templates/toolchain-health-artifact.html`, stable URL in `.claude/state/toolcheck-artifact-url`), then offers to install the missing ones (with your OK) |
| `/arc-resume` | core | session picked back up | Rebuilds position, health, scoreboard, risks and the one next action from the committed tracker. Read-only — resume never writes state |
| `/arc-freeze <dir>` | core | debugging | Limits edits to one directory; the PreToolUse-edit hook enforces the boundary |
| `/arc-unfreeze` | core | done debugging | Removes the boundary |
| `/arc-kickoff <goal>` | plan | new build | Appetite → researched forks (researcher agent) → ADRs → PLAN.md (C4 Mermaid, no-gos, rabbit holes) → pre-mortem → risk-first phases → PROGRESS.md — then stops for your OK |
| `/arc-change <what>` | plan | mid-build change / idea / suggestion | Routes it through the structure first — triage → new phase spec / ADR / current-phase note → confirm → then build via the Golden Loop. No ad-hoc code edits |
| `/arc-phase-done <n>` | plan | phase feels done | Enforces DoD: tests green + live demo + tracker updated, or refuses |
| `/arc-retro [n]` | plan | phase closed | Repeated corrections → proposed CLAUDE.md/rule/hook upgrades (as diffs) |
| `/arc-diagram <what>` | plan | a diagram would help | English → committed Mermaid, into PLAN/ADR/docs |
| `/arc-review [base]` | review | before merge | Delegates diff to the code-reviewer agent, relays Critical/Warning/Nit, archives to `docs/reviews/` (committed audit trail; resolutions appended) |
| `/arc-audit [scope]` | review | auth / payments / data diff | security-auditor agent: OWASP Top 10 + STRIDE with a concrete exploit scenario per finding; high-severity becomes a tracked issue |
| `/arc-second-opinion` | review | critical logic | Cross-model check of the diff via the codex CLI; critical disagreement blocks ship |
| `/arc-docs [scope]` | review | public surface changed | Fixes documentation drift against the diff; clears the docs ship-gate |
| `/arc-qa [url]` | qa | UI / flow work | qa-tester agent drives a real browser; every fix ships with a regression test |
| `/arc-design [route]` | qa | UI phase | design-reviewer agent scores each dimension 0-10, kills AI slop, then fixes |
| `/arc-canary <url>` | qa | after deploy | Watch loop over errors / vitals / visual diff; failure rolls back or blocks promote |
| `/arc-commit` | git | work worth saving | Grouped conventional commits, never pushes |
| `/arc-pr [base]` | git | branch ready | GitHub PR with summary + test plan; push needs your approval |
| `/arc-fix-issue <n>` | git | bug ticket | Root cause → failing test → fix → verify |
| `/arc-ship` | git | go live | lint → build → test → `vercel --prod` (guard re-checks) |
| `/arc-council <q>` | council | a consequential decision | Research → adversarial debate (advocate / skeptic / neutral) → matched domain experts → verifier-graded synthesis → one recorded decision |

**Benefit:** multi-step workflows become one keystroke, always executed the same way.

### `agents/` — subagents with their own isolated context

Each agent = proven tools (the muscle) + a named methodology (the method) + the right
model tier (the brain):

- `code-reviewer.md` (**opus**) — armed with **semgrep/opengrep** (SAST), **gitleaks** (secrets),
  **osv-scanner** (dep vulns), **knip** (dead code), lint + tests. Scanner sweep first,
  then 4-pass judgment review (OWASP-mapped security → correctness → performance →
  conventions). Honest severity rubric.
- `researcher.md` (sonnet) — armed with **Context7 MCP** (current version-specific docs)
  + web search. Decompose → source hierarchy → triangulate (≥2 independent sources) →
  confidence labels + dates. Steelmans both sides of comparisons.
- `log-analyzer.md` (sonnet) — first-error principle + differential diagnosis (≥2
  hypotheses, seek disconfirming evidence) → root cause vs trigger vs symptom → fix +
  prevention. Uses **Sentry/hosting MCPs** as primary evidence when connected.
- `qa-tester.md` (sonnet) — armed with **agent-browser** (Vercel Labs' native browser CLI:
  `@ref` snapshots, `batch` flows, console/network evidence, Web Vitals; falls back to
  Playwright MCP if missing), **@axe-core/playwright** (WCAG 2.1 AA scans), **Lighthouse**
  (launch perf scores). Happy path → sad paths → boundaries → exploratory tours →
  evidence-only reporting.

The rest, by owning product — 23 in total, and a target receives only its products':

- **review** — `security-auditor` (**opus**): OWASP Top 10 + STRIDE, one concrete exploit
  scenario per finding, zero noise. Behind `/arc-audit`.
- **qa** — `design-reviewer` (sonnet): scores each design dimension 0-10, detects AI slop,
  then fixes it with atomic commits and before/after screenshots. Behind `/arc-design`.
- **plan** — the kickoff panel that keeps a plan honest by attacking it from fresh context:
  `product-challenger` (interrogates a fuzzy idea before kickoff), `question-planner` (picks
  the highest-information fork questions), `plan-attacker` (adversarial pass over the drafted
  PLAN), `plan-simulator` (tries to execute Phase 0 from the plan alone; every gap is a
  blocker), `codebase-surveyor` (brownfield preflight survey).
- **council** — 12 roles behind `/arc-council`: `council-advocate`, `council-skeptic` and
  `council-neutral` always sit; `council-verifier` grades the *evidence* behind each point
  rather than the conclusions; `council-researcher` builds the shared fact pack; and the Chair
  convenes whichever domain experts match the question (`strategist`, `engineer`, `designer`,
  `marketer`, `risk-analyst`, `policy-analyst`, `life-counselor`).

**Benefit:** heavy exploration happens elsewhere; your main context stays clean.
**Use:** `/arc-review` triggers the first; ask for the others by name.
**Rule:** a review command binds its subagent **explicitly** and never falls back to
`general-purpose` — that agent is where the scanners and the method live. If the subagent is
absent, the command stops and tells you which product to install.

### `skills/` — model-invoked workflows

- `seo-article-writer/SKILL.md` — full SEO article pipeline (keywords → outline → draft → meta).
  Claude triggers it itself when the ask matches.

**Benefit:** consistent, deterministic output structure.
**Use:** just ask for a blog post; add new skills for any repeatable *output* workflow.

### `rules/` — path-scoped, auto-load via frontmatter `paths:` globs

- `api.md` — rate-limit, authz, zod validation, no PII in logs. Loads on `app/api/**`.
- `supabase.md` — RLS everywhere, migrations only, server-only keys. Loads on `lib/supabase/**`.
- `stripe.md` — Checkout only, idempotent webhooks, entitlement map. Loads on stripe paths.
- `testing.md` — pure logic, deterministic fakes, no network in unit tests. Loads on `**/*.test.*`, `tests/**`, `e2e/**`.

**Benefit:** domain rules appear exactly when relevant — zero context cost otherwise.
**Use:** add a rule file when one folder/domain accumulates its own conventions.

### `output-styles/`
- `terse.md` — optional response format: code-only, no prose.
**Use:** activate with `/output-style terse` when you want zero chatter.

### `scripts/<product>/` — shared shell the hooks and commands call

Scripts sit in a directory per owning product, so a product's code has a **physical**
boundary rather than a naming convention. A target only receives the directories of the
products it installed.

| Dir | Holds |
|---|---|
| `core/` | `toolchain-health.sh`, `arc-products.mjs` (the resolver both installer twins drive), `arc-profile.sh`, `arc-gates.sh`, `arc-status.sh`, `review-ledger.sh`, `product-lint.mjs`, `freeze-check.sh`, `arc-settings-merge.mjs`, `statusline.sh`, `common.sh` |
| `plan/` | `kickoff-lint.mjs`, `arc-bytediff.sh`, `arc-evidence.sh` |
| `review/` | `arc-scan/`, `coverage-gate.sh`, `docs-drift.sh`, `rls-gate.sh`, `arc-tools-image.sh` |
| `council/` | `council-lint.mjs`, `council-juror.mjs`, `council-calibrate.mjs` |

`git` and `qa` ship no scripts — they are commands and agents over tools that already exist.

The one to know: **`toolchain-health.sh`** — single source of truth for "is my toolchain
ready?". Checks every tool (git/node, scanners, graph + memory, MCP servers, env contract) and
prints each as READY or the exact fix command. The SessionStart hook runs it `--brief` (one
line); `/arc-toolcheck` runs it full and offers to install what's missing.

**Benefit:** the toolchain is never silently half-installed, and the hook stays light.
**Use:** add a future tool as ONE `check_req`/`check_opt` line in `emit_all()` — it then
self-reports in the session-start brief and in `/arc-toolcheck`, each with its own fix command.
Adding a *script* means adding it to its product's `products/<name>/manifest.json` too;
`product-lint.mjs` fails the build if a synced file is unmapped or double-mapped.

---

## `docs/` — deep detail, linked from CLAUDE.md

| Doc | Role |
|---|---|
| `blueprint.md` | This file — the complete map |
| `templates/` | Proven planning formats `/arc-kickoff` fills in: `PLAN-template.md` (Shape Up pitch fields + C4-concept Mermaid + Klein pre-mortem), `adr-template.md` (Nygard/MADR decision records → `docs/adr/NNNN-*.md`), `phase-spec-template.md` (DoD with appetite) |
| `how-it-works.md` | Mental model — the six products, then the three loading behaviors |
| `usermanual.md` | The long-form walkthrough (Tanglish): every command, hook, agent and the full pipeline |
| `build-playbook.md` | Engineering method — Golden Loop, DoD, 3-layer tracker, naming convention |
| `product-runbook.md` | Idea → shipped: stages, exact prompts, growing-the-setup signals, cheat sheet |
| `plugins.md` | What plugins are, why they're not committed, anatomy |
| `gstack-vs-arc-comparison.md` | Where arc ends and gstack begins — one owner per job |
| `adr/` | One immutable decision record per resolved fork; superseded, never edited |
| `trial-ledger.md` / `retro-log.md` | Why a lint gate is allowed to block (evidence, not opinion), and what each retro changed |
| `reviews/` · `evidence/` · `council/` | Committed audit trails: review archives, per-phase evidence bundles, council sessions |
| `session-log.md` | Auto-appended session trail (SessionEnd hook) |
| `supabase-setup.md` / `stripe-setup.md` / `deployment.md` | Stack references Claude reads when work touches them |
| `ui-conventions.md` / `branding.md` | Component/styling rules, brand assets and voice |

---

## Born at runtime (created by `/arc-kickoff`, committed with the code)

- `PLAN.md` — goal, appetite, C4-concept architecture diagram, ADR index, no-gos,
  rabbit holes, pre-mortem, risk-ordered phases (from the template).
- `docs/adr/NNNN-*.md` — one decision record per resolved fork (never edited — superseded).
- `PROGRESS.md` — status table, done-log, `## Now` pointer (the SessionStart hook reads this).
- `phases/phase-NN-spec.md` — per-phase Definition of Done (zero-padded, phase-first naming).
- `docs/session-log.md` — auto-appended session trail (SessionEnd hook).
- Claude's **native auto memory** also accumulates per-project learnings automatically at
  `~/.claude/projects/<project>/memory/` — machine-local, not in git; inspect with `/memory`.

**Benefit:** build state lives in files, not in anyone's memory — any session, any machine,
any teammate resumes instantly.

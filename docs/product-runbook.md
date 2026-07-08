# Product runbook — idea → shipped, using every part of this template

Copy-paste runbook. Follow top to bottom for any real product. The *worked example* threaded
through is **"Promptly"** — a prompt-library SaaS (save/organize AI prompts, Supabase auth+DB,
$29 one-time Pro via Stripe, Vercel) — swap in your product everywhere you see it.

Legend: `$` = terminal · `>` = what you type to Claude · ⚙ = fires automatically, no action needed.

---

## Stage 0 — machine ready (once, ever)
- [ ] Claude Code installed + logged in · Windows: Git Bash · plugins you like installed globally.
- [ ] Agent toolchain (arms code-reviewer with real scanners). Missing tools aren't fatal —
      agents mark them SKIPPED and continue.
      **macOS/Linux:** `brew install gitleaks osv-scanner pipx && pipx install semgrep`
      **Windows (PowerShell, non-admin):**
      ```powershell
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
      Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
      scoop install gitleaks osv-scanner python pipx
      pipx install semgrep
      semgrep --version; gitleaks version; osv-scanner --version   # verify
      ```
      Semgrep trouble on Windows? Use **Opengrep** (rule-compatible fork, self-contained binary):
      `irm https://raw.githubusercontent.com/opengrep/opengrep/main/install.ps1 | iex`
- [ ] Memory recall (recommended): `$ npx claude-mem install` — hooks-based session memory,
      local, no API keys, works across all projects. Verify: `claude-mem status`.
      (Coexists fine with this template's SessionStart/SessionEnd hooks — hooks compose.)
- [ ] Code knowledge graph (recommended): install **Graphify** once per machine:
      `pipx install graphifyy` (or `uv tool install graphifyy`), then `graphify install`
      (Windows: `graphify install --platform windows`) to register the skill.
      Verify: `graphify --help`.
- [ ] Once a project exists, run `/arc-toolcheck` inside it — one report shows all of the above as
      READY or the exact install command for anything still missing (and offers to install).

## Stage 1 — scaffold + wire (Day 0, ~10 min)

```
$ npx create-next-app@latest promptly --ts --tailwind --app
$ cd promptly && git init
$ <copy this template's files into the repo root>
$ chmod +x .claude/hooks/*.sh .claude/statusline.sh        # mac/linux only
```

- [ ] Fill every TODO in `CLAUDE.md` — for Promptly: goal ("save & organize AI prompts"),
      stack, pricing ($29 one-time), gating (free = 20 prompts, pro = unlimited).
- [ ] `.env.example` → `.env.local`, fill Supabase + Stripe test keys. `SUPABASE_PROJECT_REF` too.
- [ ] `CLAUDE.local.md`: your port, pnpm/npm, OS quirks.
- [ ] Rules globs match your layout? (`app/api/**` etc. in `.claude/rules/*.md`)
- [ ] `$ npm i -D knip @axe-core/playwright` — dead-code detection for reviews, WCAG scans for QA.
- [ ] Code graph (one-time per project, ~2 min): in Claude Code run `/graphify .` (builds
      `graphify-out/` — commit it), then `$ graphify hook install` (auto-rebuild on every
      commit, AST-only, free) and `$ graphify claude install` (query-first nudge).
      From then on it's fully automatic; the SessionStart hook reports status and catches
      up if the graph ever falls behind.

**Wiring check (2 min):** open `claude` →
⚙ statusline shows dir/branch/model · ⚙ SessionStart prints git heads-up + a one-line toolchain summary
```
> /arc-toolcheck                              # full tool status + the fix for anything missing
> what are this project's rules?          # answers from CLAUDE.md, no file reads
> run: echo hi && git push -f             # destructive-guard must BLOCK
```

## Stage 2 — plan the build

```
> /arc-kickoff Promptly — a prompt library SaaS: save, tag and search AI prompts; $29 one-time Pro
```
Claude will: ask your appetite (total time budget) → real forks only (researcher agent
triangulates the uncertain ones; each decision → `docs/adr/`) → `PLAN.md` from the template
(C4 Mermaid diagram, no-gos, rabbit holes) → **pre-mortem** ("it failed — why?") → phases
by risk → `phases/phase-NN-spec.md` + `PROGRESS.md` → STOP.

- [ ] Read `PLAN.md`. Push back NOW — changing a plan is free, changing code isn't.
- [ ] Check phase order = risk order. For Promptly the scary part is search + entitlement
      gating, not the landing page — those go early.
- [ ] Confirm: `> plan approved, start phase 0`

## Stage 3 — Phase 0: walking skeleton (offline-first)

Goal: the WHOLE flow runs end-to-end on fake data — fake auth, in-memory prompt store,
fake payment flag. No keys, no network.

```
> build phase 0 per phases/phase-00-spec.md. Interfaces + fakes for Supabase and Stripe.
```
⚙ every edit auto-formatted (PostToolUse) · ⚙ `rules/api.md` loads when it touches `app/api/`

Then the close ritual — same for EVERY phase:
```
> /arc-review          # code-reviewer agent, isolated — fix Criticals, judge Warnings
> /arc-commit          # grouped conventional commits
> /arc-phase-done 0    # tests green + live demo + PROGRESS.md flipped — or it refuses
```

## Stage 4 — core phases (the daily loop, repeated)

Each morning: `claude` → ⚙ SessionStart prints branch + PROGRESS.md `## Now` → continue.

```
> continue phase 2 — real Supabase adapter behind the existing interface
```
⚙ `rules/supabase.md` auto-loads (RLS on every table, migrations only, typed clients).

Use the right helper at the right moment:
| Moment | Do this |
|---|---|
| A new idea / change / scope-creep mid-phase | `> /arc-change <it>` — files it in a phase spec or ADR first, updates the tracker, then builds step-by-step. Never straight into code |
| Unknown tech choice mid-phase ("full-text search: pg or Algolia?") | `> use the researcher agent to compare X vs Y for <use case>` — summary comes back, context stays clean |
| Error / stack trace you don't understand | `> use the log-analyzer agent on this error: <paste>` → Symptom → Root cause → Fix |
| A GitHub issue exists for it | `> /arc-fix-issue 12` — root cause + failing test first, then the fix |
| Need live-demo evidence for `/arc-phase-done` | `> use the qa-tester agent on the phase's flows` — clicks through the real app, returns ✅/❌ per flow |
| Claude repeated a mistake twice | Add one line to CLAUDE.md (or the matching rule file) right then. Third time = never |
| Suite getting slow / session long | Let it compact — ⚙ PreCompact snapshots state; SessionStart restores context tomorrow |

Close every phase with the Stage-3 ritual. Never skip `/arc-phase-done` — it's the only thing
keeping "done" honest.

## Stage 5 — payments phase (Promptly: $29 Pro)

```
> phase 4: Stripe checkout + webhook entitlements per phases/phase-04-spec.md
```
⚙ `rules/stripe.md` auto-loads (Checkout only, webhook = source of truth, idempotent).
- [ ] Local webhook test: `$ stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] Buy in test mode end-to-end; verify the entitlement flips in the DB — *verify in the real place*.

## Stage 6 — polish + content

```
> /arc-review main            # full-branch review before launch prep
> run the e2e suite and fix what breaks
> use the seo-article-writer skill: landing page copy, keyword "AI prompt library"
```
(Skills fire on their own when the ask matches — naming it just removes ambiguity.)

## Stage 7 — launch day

```
> /arc-pr                      # if working on a branch: PR with summary + test plan (push = you approve)
> /arc-ship                    # lint → build → test → vercel --prod
```
⚙ deploy-guard re-runs tests before `vercel --prod` — red tests = deploy physically blocked.
- [ ] Smoke-test the production URL — `> use the qa-tester agent against <prod-url>: signup, save a prompt, buy Pro` (live mode, refund after).
- [ ] Rollback ready: `vercel rollback <url>` (see `deployment.md`).
- [ ] Flip PROGRESS.md's launch phase via `/arc-phase-done N`. 🎉

## Stage 8 — after launch (steady state)

- Bugs: file a GitHub issue → `> /arc-fix-issue <n>` → `/arc-review` → `/arc-commit` → `/arc-ship`.
- Incidents: paste logs to the **log-analyzer** agent first, patch second (diagnose > patch).
- Content/SEO week: **seo-article-writer** skill, one article per target keyword.
- New feature = new phase: append to PLAN.md, add `phases/phase-NN-spec.md`, same loop forever.
- End of every phase: `> /arc-retro` — it scans for repeated corrections and proposes permanent
  CLAUDE.md/rule/command/hook upgrades as diffs. The setup improves with the product.

---

## Growing the setup — when the project signals

| Signal you notice | Add this | Where |
|---|---|---|
| Repeated the same instruction 3rd time | A line in CLAUDE.md — or a rule if area-specific | `CLAUDE.md` / `.claude/rules/` |
| Rules only relevant to one folder/domain | Path-scoped rule with `paths:` globs | `.claude/rules/x.md` |
| You type the same multi-step request often | Slash command (`description`, `argument-hint`, least-privilege `allowed-tools`; `$1` = arg) | `.claude/commands/x.md` |
| A reusable *output* workflow Claude should self-trigger | Skill | `.claude/skills/x/SKILL.md` |
| Exploration floods your context | Subagent — returns only the summary | `.claude/agents/x.md` |
| Something must ALWAYS / NEVER happen | Hook — `exit 2` + stderr blocks; copy a shipped hook as the pattern | `.claude/hooks/` + `settings.json` |
| A safe command keeps asking permission | Allow rule | `settings.json` (team) / `settings.local.json` (you) |
| New external tool (DB, payments, browser) | MCP server | `.mcp.json` |
| CLAUDE.md creeping past 200 lines | Move detail out, keep a link | `docs/*.md` |

**Anti-patterns:** one workflow duplicated as skill + agent + command (pick ONE owner) ·
secrets anywhere except `.env.local` · personal taste in shared `settings.json` (that's
`settings.local.json`) · a hook that's really a preference (→ CLAUDE.md) · a CLAUDE.md rule
Claude keeps breaking (→ hook).

## Cheat sheet — situation → action

| Situation | Action | Piece used |
|---|---|---|
| New product | `/arc-kickoff <goal>` | command → PLAN.md, phases, PROGRESS.md |
| Mid-build change / new idea | `/arc-change <what>` | command → tracker (spec/ADR) first, then Golden Loop |
| Session opens | nothing — read the heads-up | ⚙ SessionStart hook |
| Writing code | just talk | ⚙ rules (path match) + ⚙ PostToolUse format |
| Finished a chunk | `/arc-review` | command → code-reviewer agent |
| Ready to save work | `/arc-commit` | command (never pushes) |
| Phase feels done | `/arc-phase-done <n>` | command — enforces DoD |
| Need a PR | `/arc-pr [base]` | command (push needs your OK) |
| Go live | `/arc-ship` | command + ⚙ deploy-guard |
| Bug ticket | `/arc-fix-issue <n>` | command |
| "Compare X vs Y" | researcher agent | isolated research |
| Scary error | log-analyzer agent | root cause, not noise |
| Demo/smoke-test evidence | qa-tester agent | real-browser flows via Playwright |
| Phase closed | `/arc-retro` | corrections → permanent upgrades |
| Marketing copy | seo-article-writer skill | model-invoked |
| Dangerous command attempted | nothing — it's blocked | ⚙ destructive-guard |
| "What did we do last session?" | read `docs/session-log.md`; deeper: `/memory` | ⚙ SessionEnd hook + native auto memory |
| Fresh machine / a tool isn't working | `/arc-toolcheck` | command → toolchain-health.sh (status + fixes) |
| Repeated instruction | move it into CLAUDE.md / a rule | grows the brain |

**The whole game in one line:** plan with `/arc-kickoff`, build in risk-ordered phases, close each
with `/arc-review → /arc-commit → /arc-phase-done`, ship with `/arc-ship`, and let the hooks be the adult in the room.

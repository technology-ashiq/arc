# How this structure works — the mental model

Everything in this template belongs to one of **three loading behaviors**. Knowing which is
which tells you where any new rule or automation should live.

```
                    ┌──────────────────────────────┐
                    │  Claude Code session starts  │
                    └───────────┬──────────────────┘
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────────┐  ┌───────────────────┐  ┌────────────────────────┐
│ ALWAYS IN CONTEXT │  │  RUNS ON EVENTS   │  │    LOADS ON DEMAND     │
│    (advisory)     │  │ (deterministic)   │  │   (context-efficient)  │
├───────────────────┤  ├───────────────────┤  ├────────────────────────┤
│ CLAUDE.md         │  │ SessionStart.sh   │  │ commands/  you type /x │
│  team rules/brain │  │  injects git ctx  │  │ skills/    model picks │
│ CLAUDE.local.md   │  │ PreToolUse.sh     │  │ agents/    isolated ctx│
│  private notes    │  │  blocks bad cmds  │  │ rules/     path match  │
│ settings.json     │  │ PostToolUse.sh    │  │ docs/      linked from │
│  permissions+hooks│  │  formats edits    │  │            CLAUDE.md   │
│ statusline.sh     │  │ PreCompact.sh     │  │                        │
│  bottom bar       │  │  state snapshot   │  │                        │
└───────────────────┘  └───────────────────┘  └────────────────────────┘

Root files (shared infra): .mcp.json (MCP servers) · .env.example (→ .env.local) · .gitignore
```

## The three behaviors

1. **Always in context (advisory).** `CLAUDE.md` + `CLAUDE.local.md` load every session —
   you never re-explain the project. Advisory means Claude *should* follow it but can
   occasionally forget, especially deep into long sessions.

2. **Runs on events (deterministic).** Hooks are shell scripts fired by triggers, every
   single time, at the shell level. Claude cannot forget a hook. `PreToolUse.sh` carries two
   guards: a destructive-guard (blocks `rm -rf ~`, force-pushes, `DROP TABLE` — even chained
   mid-command) and a deploy-guard (re-runs tests before any deploy; failing tests = blocked).
   Gate strictness is **block-by-default**: the `arc.profile` key (`starter`/`standard`/`strict`)
   in `settings.json` switches coverage, docs, and scan gates as a set — resolved by
   `.claude/scripts/core/arc-profile.sh`, which each gate consults for its warn-vs-block mode.

3. **Loads on demand.** Keeps the context window lean:
   - `commands/` — **you** invoke (`/arc-ship`, `/arc-commit`, `/arc-pr`, `/arc-review`, `/arc-fix-issue`)
   - `skills/` — the **model** invokes when a task matches the skill description
   - `agents/` — run in an **isolated context**; only the summary returns to your session
   - `rules/` — auto-load when Claude touches a file matching their frontmatter `paths:` globs
   - `docs/` — Claude reads them when CLAUDE.md says the work touches that area

> **The golden rule:** if it's a *guideline*, put it in CLAUDE.md. If it *must* happen
> every time, make it a hook. One owner per job — never duplicate a workflow as
> skill + agent + command; pick one and have the others delegate.

## The memory stack — five layers, each with one job

| Layer | Holds | Lives | Maintained by |
|---|---|---|---|
| `CLAUDE.md` + `.claude/rules/` | Rules & conventions | Repo (committed) | You, via `/arc-retro` |
| `PLAN.md` + `docs/adr/` | Decisions & why | Repo (committed) | `/arc-kickoff`, ADRs |
| `PROGRESS.md` + `phases/` | Build state, "## Now" | Repo (committed) | `/arc-phase-done` |
| **Native auto memory** | Claude's own learnings (gotchas, patterns) | `~/.claude/projects/<project>/memory/` — machine-local, NOT in git | Claude, automatically (on by default; view via `/memory`) |
| `docs/session-log.md` | What each session touched | Repo (committed) | ⚙ SessionEnd hook, automatically |

File-based, git-versioned memory is the verified best practice for per-project coding —
diffable, portable, zero infra. Vector/graph memory servers (mem0, Zep, Letta) are for
cross-project or team memory pools; the committed files above stay the source of truth.
Machine-level extensions (installed once, runbook Stage 0 — not per repo):

- `claude-mem` — hooks-based session recall ("what did we do in March?"). Local, no keys.
- `Graphify` (optional, skill) — indexes the whole repo (code + SQL schema + infra + docs)
  into ONE queryable knowledge graph. Researcher checks it for prior conclusions;
  code-reviewer uses it for blast radius incl. schema-dependent queries.
- `codegraph` MCP (optional) — code-structure graph: callers, dependencies, impact paths.
  The code-reviewer and log-analyzer use it when connected.

All three degrade gracefully: not connected → agents fall back to grep/files and say so.

## Worked example — "add Stripe checkout"

| Step | What you do | What fires invisibly |
|------|-------------|----------------------|
| 1 | `claude` (open project) | SessionStart injects branch + last commit; CLAUDE.md loads |
| 2 | "add Stripe checkout" | CLAUDE.md rules shape the plan (strict TS, RLS, no push) |
| 3 | Claude edits `app/api/checkout/` | `rules/api.md` + `rules/stripe.md` auto-load on path match |
| 4 | — | PostToolUse runs prettier + eslint on every edited file |
| 5 | `/arc-review` | code-reviewer agent audits the diff in isolation, returns summary |
| 6 | `/arc-commit` | grouped conventional commit; pushing still needs your explicit ask |
| 7 | `/arc-ship` | lint → build → test → `vercel --prod`; deploy-guard re-runs tests and **blocks** if they fail |

What you never had to do: explain the stack, ask for validation on API routes, request
formatting, or worry about deploying broken code.

## Per-project checklist

1. Copy this folder into the new project root.
2. Fill every `TODO` in `CLAUDE.md` (name, goal, stack, architecture, pricing).
3. Copy `.env.example` → `.env.local`, fill real secrets (gitignored).
4. Adjust `rules/` globs if your folder layout differs.
5. On macOS/Linux: `chmod +x .claude/hooks/*.sh .claude/statusline.sh`. On Windows: Git Bash required for hooks.

Day-to-day you'll only ever touch `CLAUDE.md`, and add a `rules/*.md` when a new domain
needs its own conventions.

# Claude Code — Canonical Project Folder Structure (Template)

A reusable, production-grade Claude Code setup, mapped to the canonical `.claude/` layout.
Copy this folder into any new project, replace `<PROJECT_NAME>`, fill the `TODO`s, and Claude
Code behaves like a 10x developer instead of a generic chatbot.

> **CLAUDE.md is advisory. Hooks are deterministic. Skills load on demand.**

## Structure
```
your-project/
├── CLAUDE.md                 # Project rules / brain — < 200 lines (advisory)
├── CLAUDE.local.md           # Personal overrides — gitignored
├── .gitignore                # Ignores *.local.* and secrets
├── .mcp.json                 # MCP servers — MUST be at root
├── .env.example              # Env contract (copy to .env.local)
└── .claude/                  # Where Claude Code looks first
    ├── hooks/                # Deterministic — fire every time
    │   ├── SessionStart.sh   #   load git/build context + brief toolchain health
    │   ├── PostToolUse.sh    #   format (or auto-commit) after edits
    │   ├── PreToolUse.sh     #   destructive-guard + deploy-guard (block on failing tests)
    │   ├── PreCompact.sh     #   save state before context compaction
    │   └── SessionEnd.sh     #   append session trail to docs/session-log.md
    ├── commands/             # Slash commands (user-invoked)
    │   ├── arc-ship.md           #   /arc-ship — lint, build, test, deploy in one go
    │   ├── arc-commit.md         #   /arc-commit — grouped conventional commits
    │   ├── arc-pr.md             #   /arc-pr — open a GitHub PR
    │   ├── arc-review.md         #   /arc-review — delegates to the code-reviewer agent
    │   ├── arc-kickoff.md        #   /arc-kickoff — plan + phases + tracker (build playbook)
    │   ├── arc-change.md         #   /arc-change — route a mid-build change through the structure
    │   ├── arc-phase-done.md     #   /arc-phase-done <n> — enforce Definition of Done
    │   ├── arc-retro.md          #   /arc-retro — corrections → permanent setup upgrades
    │   ├── arc-fix-issue.md      #   /arc-fix-issue <n>
    │   └── arc-toolcheck.md      #   /arc-toolcheck — full toolchain status + one-command fixes
    ├── skills/               # Model-invokable workflows, load on demand
    │   └── seo-article-writer/   # SKILL.md
    ├── agents/               # Subagents — isolated context window
    │   ├── code-reviewer.md  #   reviews diffs, returns summary
    │   ├── researcher.md     #   web fetch + synthesis
    │   ├── log-analyzer.md   #   parses errors / crash logs
    │   └── qa-tester.md      #   real-browser flow tests via the agent-browser CLI (Playwright MCP fallback)
    ├── output-styles/        # Custom response formats
    │   └── terse.md          #   code-only, no prose
    ├── rules/                # Path-scoped — load on frontmatter `paths:` glob match
    │   ├── api.md            #   loads only for src/api/**
    │   ├── supabase.md       #   loads for lib/supabase/**
    │   ├── stripe.md         #   loads for stripe paths
    │   └── testing.md        #   loads for **/*.test.*, tests/**, e2e/**
    ├── scripts/              # Shared shell scripts that hooks + commands call
    │   └── toolchain-health.sh  #   tool status + fixes — /arc-toolcheck & SessionStart --brief
    ├── statusline.sh         # Bottom-bar display config
    ├── settings.json         # Permissions, hook registry, statusLine (shared — no model pin)
    └── settings.local.json   # Personal — model choice, extra allows. Gitignored
└── docs/                     # Extended docs CLAUDE.md links to (keeps it slim)
    ├── templates/            # PLAN / ADR / phase-spec formats that /arc-kickoff fills in
    └── blueprint · how-it-works · build-playbook · product-runbook · supabase-setup · stripe-setup · deployment · ui-conventions · branding · plugins
```

## How to use
> Building a real product end-to-end (Day 0 → daily loop → shipped, with exact prompts): **`docs/product-runbook.md`**

1. Copy this folder to your new project root (or copy pieces in).
2. Replace `<PROJECT_NAME>` and fill every `TODO` in `CLAUDE.md`.
3. Put real secrets in `.env.local` (gitignored). Never in `CLAUDE.md` or `.mcp.json`.
4. Make scripts executable: `chmod +x .claude/hooks/*.sh .claude/statusline.sh`
5. Open in Claude Code — `CLAUDE.md`, hooks, statusline and settings load automatically.

## Template vs project — where does the app code live?
**Same repo, same root.** This folder is only the *mold* — it is not a project and never gets
pushed anywhere. Each real project = your app code (`app/`, `lib/`, `package.json` …) **plus**
these template files, merged at the root of ONE git repo. Don't split them: rules path-match
against your code paths, hooks run inside the repo, CLAUDE.md describes *that* codebase.

Commit & push everything — `.claude/`, `CLAUDE.md`, `docs/`, `PLAN.md`, `PROGRESS.md`, `phases/`
are team config and should be versioned with the code. The only exceptions are personal/secret
files, and `.gitignore` already excludes them: `CLAUDE.local.md`, `.claude/settings.local.json`,
`.env.local`.

## Keeping projects in sync with the template
The mold improves over time (via `/arc-retro` learnings). Projects do NOT auto-sync — that's
intentional (no silent changes). To push template updates into an existing project:

```powershell
& "<this-folder>\sync-to-project.ps1" -Target "E:\path\to\your-project"
```

It syncs the machinery (`.claude/`, `docs/templates/`, meta docs) and never touches anything
project-specific (CLAUDE.md, PLAN/PROGRESS, ADRs, reviews, code, personal settings). Restart
the project's Claude Code session afterwards. Reverse direction: when a project's `/arc-retro`
produces a good improvement, copy it back into the mold by hand — then every future sync
carries it. (Alternative for solo devs: move generic agents/commands to `~/.claude/` —
machine-wide, zero sync — but keep hooks per-repo so they don't fire in unrelated projects.)

## Root files (MUST stay in project root, not inside `.claude/`)
| File | Purpose |
|------|---------|
| `CLAUDE.md` | The brain. Shared with the team. Keep **under ~200 lines**. Advisory. |
| `CLAUDE.local.md` | Your **private** machine notes (ports, local creds). Gitignored. |
| `.gitignore` | Keeps `.env`, secrets, and the two `*.local.*` files out of git. |
| `.mcp.json` | MCP servers — lets Claude talk to Supabase/Stripe/Playwright in chat. |

## Two ideas worth remembering
- **CLAUDE.md vs hooks** — CLAUDE.md is documentation Claude *should* follow but can forget.
  **Hooks run at the shell level on a trigger, every time** (e.g. `PreToolUse.sh` blocks a deploy
  when tests fail). When something *must* happen, make it a hook.
- **Skill vs plugin** — a **skill** is one reusable workflow (one tool); a **plugin** is an
  installable bundle of skills + agents + hooks + commands + MCP servers (a toolbox).
  Plugins install globally from marketplaces — they are never committed here. See `docs/plugins.md`.
- **One owner per job** — review logic lives in ONE place (the `code-reviewer` agent);
  `/arc-review` just delegates to it. Don't duplicate the same workflow as skill + agent + command.

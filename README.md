# arc — a Claude Code build system, shipped as six installable products

A production-grade Claude Code setup, mapped to the canonical `.claude/` layout. Install it
into any project — all of it, or only the parts you want — and Claude Code behaves like a
10x developer instead of a generic chatbot.

> **CLAUDE.md is advisory. Hooks are deterministic. Skills load on demand.**

## The six products

arc is not one blob. It is six products under one umbrella; `core` is the base and every
other product requires it. Install any subset.

| Product | Requires | Commands |
|---|---|---|
| `core` | — | `/arc` `/arc-toolcheck` `/arc-resume` `/arc-freeze` `/arc-unfreeze` |
| `plan` | core | `/arc-kickoff` `/arc-change` `/arc-phase-done` `/arc-retro` `/arc-diagram` |
| `review` | core | `/arc-review` `/arc-audit` `/arc-second-opinion` `/arc-docs` |
| `qa` | core | `/arc-qa` `/arc-design` `/arc-canary` |
| `git` | core | `/arc-commit` `/arc-pr` `/arc-fix-issue` `/arc-ship` |
| `council` | core | `/arc-council` — a multi-agent advisory council for hard decisions |

```bash
# everything
./sync-to-project.sh /path/to/your-project

# only what you want — core comes along automatically as a dependency
./sync-to-project.sh /path/to/your-project --products plan,review
```

Run **`/arc`** inside a target to see which products are installed, their health, and the
exact command to add the missing ones. That dashboard reads `.claude/arc-registry.json`,
which every sync writes into the target — so the answer is looked up, never guessed.

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
    ├── commands/             # Slash commands (user-invoked) — 22, one owner product each
    │   │                     #   see the product table above for which command ships with what
    │   ├── arc.md            #   /arc — umbrella status: installed products + health (core)
    │   ├── arc-kickoff.md    #   /arc-kickoff — plan + phases + tracker (plan)
    │   ├── arc-review.md     #   /arc-review — delegates to the code-reviewer agent (review)
    │   └── …                 #   a target only receives the commands of its installed products
    ├── skills/               # Model-invokable workflows, load on demand
    │   └── seo-article-writer/   # SKILL.md
    ├── agents/               # Subagents — isolated context window
    │   ├── code-reviewer.md  #   reviews diffs, returns summary (review)
    │   ├── qa-tester.md      #   real-browser flow tests via the agent-browser CLI (qa)
    │   ├── plan-attacker.md  #   adversarial pass over a drafted PLAN (plan)
    │   ├── council-*.md      #   12 debate/expert roles behind /arc-council (council)
    │   └── …                 #   researcher, log-analyzer, security-auditor, design-reviewer …
    ├── output-styles/        # Custom response formats
    │   └── terse.md          #   code-only, no prose
    ├── rules/                # Path-scoped — load on frontmatter `paths:` glob match
    │   ├── api.md            #   loads only for src/api/**
    │   ├── supabase.md       #   loads for lib/supabase/**
    │   ├── stripe.md         #   loads for stripe paths
    │   └── testing.md        #   loads for **/*.test.*, tests/**, e2e/**
    ├── scripts/              # One directory per product — physical boundaries, not one flat bag
    │   ├── core/             #   toolchain-health.sh, arc-products.mjs, arc-profile.sh, review-ledger.sh …
    │   ├── plan/             #   kickoff-lint.mjs, arc-bytediff.sh, arc-evidence.sh
    │   ├── review/           #   scanner + gate scripts
    │   └── council/          #   council session scripts
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

## arc repo vs your project — where does the app code live?
**Same repo, same root.** This repo is where the six products are *developed*; it is not
itself one of your projects. Each real project = your app code (`app/`, `lib/`,
`package.json` …) **plus** the products you installed, merged at the root of ONE git repo.
Don't split them: rules path-match against your code paths, hooks run inside the repo,
CLAUDE.md describes *that* codebase.

Commit & push everything — `.claude/`, `CLAUDE.md`, `docs/`, `PLAN.md`, `PROGRESS.md`, `phases/`
are team config and should be versioned with the code. The only exceptions are personal/secret
files, and `.gitignore` already excludes them: `CLAUDE.local.md`, `.claude/settings.local.json`,
`.env.local`.

## Installing and updating a project
arc improves over time (via `/arc-retro` learnings). Projects do NOT auto-sync — that's
intentional (no silent changes). Two equivalent twins do the install; use whichever your
shell prefers:

```bash
./sync-to-project.sh /path/to/your-project --products plan,review
```
```powershell
& "<this-folder>\sync-to-project.ps1" -Target "E:\path\to\your-project"
```

Both write `.claude/arc-registry.json` into the target — products, versions, file lists,
source commit — so `/arc` can report what's installed instead of guessing from file presence.
Re-running a sync updates it. Omit `--products` to install everything.

It syncs the machinery (`.claude/`, `docs/templates/`, meta docs) and never touches anything
project-specific (CLAUDE.md, PLAN/PROGRESS, ADRs, reviews, code, personal settings). Restart
the project's Claude Code session afterwards.

**Nothing is ever deleted from a target.** To see files in a target that arc did not install —
including copies left behind when arc reorganised its own layout — run:

```bash
./sync-to-project.sh /path/to/your-project --prune-report
```

It lists and exits 0. It mutates nothing, and there is no delete path in either twin. Read
its output carefully: "not installed by arc" includes every file *you* wrote, so the list is
a visibility aid, not a delete list.

Reverse direction: when a project's `/arc-retro` produces a good improvement, copy it back
into arc by hand — then every future sync carries it. (Alternative for solo devs: move generic
agents/commands to `~/.claude/` — machine-wide, zero sync — but keep hooks per-repo so they
don't fire in unrelated projects.)

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
- **Block-by-default, with an escape hatch** — gates enforce (block) out of the box under the
  `standard` strictness profile. One key in `settings.json` (`arc.profile`: `starter` | `standard` |
  `strict`) switches every gate as a set; `bash .claude/scripts/core/arc-profile.sh show` prints the active modes.

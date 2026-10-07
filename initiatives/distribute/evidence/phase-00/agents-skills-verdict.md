# Phase 00 — the main clone's local `.codex/`, `.agents/`, `AGENTS.md` (ADR-2004, ADR-2014)

Read on 2026-10-07. These files were never in git: `.gitignore:75-78` has ignored them since `ab501994` (2026-07-11), and
they existed only in the main clone `E:/Work_Hub/01_Automemory/arc`.

## The move (scope step 1)

`mv .codex .agents AGENTS.md ~/.arc-private/distribute/local-2026-07-11/` moved them out of the main clone. They were
moved, not deleted, so A-06 can restore them. After the move, `git -C E:/Work_Hub/01_Automemory/arc status --porcelain
--ignored -- .codex .agents AGENTS.md` printed nothing (exit 0).

## Skill comparison (scope step 2)

Each skill's body (after the frontmatter, `\r` stripped) was compared line-set-wise against the current source.
`source-command-arc-<n>` was compared with `.claude/commands/arc-<n>.md`, and `seo-article-writer` with
`.claude/skills/seo-article-writer/SKILL.md`.

| Local skill | Verdict | Skill lines | Source lines | Only in skill | Only in source |
|---|---|---|---|---|---|
| seo-article-writer | DIVERGED | 16 | 58 | 9 | 39 |
| source-command-arc-commit | DIVERGED | 16 | 19 | 3 | 8 |
| source-command-arc-pr | DIVERGED | 15 | 9 | 3 | 0 |
| source-command-arc-resume | DIVERGED | 14 | 33 | 9 | 29 |
| source-command-arc-retro | DIVERGED | 21 | 72 | 7 | 56 |
| source-command-arc-review | DIVERGED | 32 | 64 | 5 | 32 |
| source-command-arc-second-opinion | DIVERGED | 19 | 13 | 4 | 1 |
| source-command-arc-ship | DIVERGED | 15 | 13 | 3 | 4 |
| source-command-arc-unfreeze | DIVERGED | 9 | 3 | 7 | 1 |

**0 of 8 command skills are faithful.** Each one opens with a wrapper ("Use this skill when the user asks to run the
migrated source command `arc-<n>`"), and the commands have changed since 2026-07-11. Design-source assumption A-05
("they are a faithful down-conversion") is **falsified**. No `codex-seed` golden is created, and the P03 `codex`
adapter produces the `codex` golden fresh. The tracked `.claude/skills/seo-article-writer/` is the newer version, so
the local copy is dropped (it stays only in the private archive).

## The boundary attacker's exhibit (DST-K)

The local `.codex/hooks.json` hard-codes absolute Windows paths, wrapped in single quotes, for every event:

```
'E:\\Work_Hub\\01_Automemory\\arc\\.codex\\hooks\\PreToolUse.sh'
'E:\\Work_Hub\\01_Automemory\\arc\\.codex\\hooks\\PreToolUse-edit.sh'
'E:\\Work_Hub\\01_Automemory\\arc\\.codex\\hooks\\PostToolUse.sh'
'E:\\Work_Hub\\01_Automemory\\arc\\.codex\\hooks\\PreCompact.sh'
'E:\\Work_Hub\\01_Automemory\\arc\\.codex\\hooks\\SessionStart.sh'
```

It also has no `PreToolUse-read` and no `SessionEnd` entry, even though `SessionEnd.sh` exists in `.codex/hooks/`. The
local `.codex/agents/` held 7 `.toml` agents (code-reviewer, design-reviewer, log-analyzer, product-challenger,
qa-tester, researcher, security-auditor), against 32 in `.claude/agents/`.

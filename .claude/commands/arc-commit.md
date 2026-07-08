---
description: Stage related changes and write a conventional commit.
allowed-tools: Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Commit the current work properly:

1. `git status` + `git diff` — understand exactly what changed. Never commit blind.
2. If the changes are unrelated, split them into separate commits (stage per group).
3. Message: conventional commit (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:`).
   Subject ≤ 72 chars, imperative. Body (if needed) explains WHY, not what.
4. Never `git add .` when untracked junk is present — stage explicit paths.
5. Commit. Do NOT push (pushing always needs my explicit ask).

Reply with the commit hash(es) and one line per commit.

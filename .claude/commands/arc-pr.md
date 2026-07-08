---
description: Open a GitHub PR for the current branch.
argument-hint: [base-branch (default main)]
allowed-tools: Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(gh pr:*)
---

Open a pull request for the current branch (base: ${1:-main}).

1. Verify we're NOT on main and everything is committed (`git status`).
2. Summarize the branch: `git log ${1:-main}..HEAD --oneline` + `git diff ${1:-main}...HEAD --stat`.
3. Pushing is gated — ask me to approve the `git push -u origin <branch>` before creating the PR.
4. `gh pr create --base ${1:-main}` with:
   - Title: conventional-commit style, ≤ 72 chars.
   - Body: **Summary** (what & why, 2-4 bullets) + **Test plan** (how it was verified).
5. Reply with the PR URL only.

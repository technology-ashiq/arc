---
description: Investigate and fix a GitHub issue by number.
argument-hint: [issue-number]
allowed-tools: Bash(gh issue view:*), Bash(npm run test:*), Bash(npm run lint)
---

Fix issue #$1.

1. Read it: `gh issue view $1`.
2. Find the ROOT cause in the codebase — don't patch symptoms.
3. Write a failing test that reproduces it, then make it pass.
4. Run `npm run test` and `npm run lint`.
5. Summarize the fix and propose a conventional-commit message. Do NOT push.

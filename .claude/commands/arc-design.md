---
description: UI/UX review-and-fix via the design-reviewer subagent -- scores 0-10, kills AI slop, fixes with atomic commits + before/after screenshots. Archives to docs/design/, stamps the ledger.
argument-hint: "[route-or-component]"
allowed-tools: Task, Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(bash .claude/scripts/core/review-ledger.sh:*), Read, Edit, Write
---

Review and fix the design of: **$ARGUMENTS** (default: the UI changed in this diff).

1. **Invoke the `design-reviewer` subagent explicitly** -- Task tool, `subagent_type: "design-reviewer"`. It scores each design dimension 0-10, flags AI slop, and fixes what it finds with atomic commits + before/after screenshots. Do NOT fall back to general-purpose; if it is missing, STOP and tell me to sync the template.

## Always finish by
- Archiving to `docs/design/YYYY-MM-DD-<route>.md` (scores, fixes, before/after image paths).
- Committing fixes as `style(ui): ...` / `fix(ui): ...` (never push).
- Stamping the ledger only if the verdict is `design: PASS`:
  ```bash
  bash .claude/scripts/core/review-ledger.sh stamp design
  ```

For UI-bearing phases, add `design` to `ARC_REQUIRED_REVIEWS` so /arc-ship is gated on it.

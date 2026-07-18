---
description: Detect and fix documentation drift against the diff (README/ARCHITECTURE/CLAUDE.md/rules), Diataxis-aware. Clears the docs-drift ship gate; stamps the ledger.
argument-hint: "[scope] (default: diff since main)"
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

Sync documentation to what you just shipped. Scope: **$ARGUMENTS** (default: diff since `main`).

1. Run the drift check first to see what is stale:
   ```bash
   bash .claude/scripts/docs-drift.sh
   ```
2. Read every doc that could be affected -- `README*`, `docs/**`, `ARCHITECTURE*`, `CLAUDE.md`, `.claude/rules/*` -- and cross-reference against the diff.
3. Update whatever drifted: API changes, new env vars (mirror into `.env.example`, key names only), new commands, changed behaviour. Apply the Diataxis lens (reference / how-to / tutorial / explanation) and note gaps you did not fill.
4. Keep `CLAUDE.md` under its line budget -- link out to `docs/`, do not inline.

## The arc twist
- `docs-drift.sh` runs inside the deploy-guard, so stale docs can gate ship. Running `/arc-docs` is how you clear it.
- Commit doc updates on their own: `docs(scope): ...` (never push).
- Stamp the ledger:
  ```bash
  bash .claude/scripts/core/review-ledger.sh stamp docs
  ```

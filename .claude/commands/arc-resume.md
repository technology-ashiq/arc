---
description: Reconstruct where we left off from the committed tracker + last snapshot (the git-backed version of gstack context-restore).
allowed-tools: Read, Bash, Glob, Grep
---

Reconstruct session state:

1. Read `PROGRESS.md` `## Now` -- the single source of truth for current state.
2. Read the latest snapshot in `.claude/state/` (written by the PreCompact hook).
3. Read the active `phases/phase-NN-spec.md` for its Definition of Done.
4. Summarise: which phase we're in, what's done, what's next, and the exact next action -- then resume the Golden Loop.

State comes from files in git, not loose WIP commits -- so a resume is always reproducible.

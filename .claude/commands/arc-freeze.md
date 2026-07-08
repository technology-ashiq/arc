---
description: Lock edits to one or more directories -- a deterministic edit-boundary enforced by the PreToolUse hook (freeze-check.sh). The can't-forget version of gstack /freeze.
argument-hint: <dir> [more-dirs...]
allowed-tools: Bash
---

Lock all edits to: **$ARGUMENTS**

```bash
mkdir -p .claude/state
printf '%s\n' $ARGUMENTS > .claude/state/freeze
echo "Frozen. Edits allowed only under: $ARGUMENTS"
```

From now the PreToolUse hook blocks any Edit/Write outside these directories until `/arc-unfreeze`. Use it while debugging so unrelated code can't be "helpfully" changed. `/arc-investigate`-style flows should auto-freeze to the module under investigation.

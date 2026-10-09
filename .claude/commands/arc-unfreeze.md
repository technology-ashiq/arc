---
description: Remove the /arc-freeze edit-boundary.
allowed-tools: Bash
targets: claude-code
---

```bash
rm -f .claude/state/freeze && echo "Unfrozen -- edit boundary removed."
```

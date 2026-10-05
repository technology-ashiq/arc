---
description: Hunt a niche for real pain -- mine HN, normalize, dedupe and cluster into an evidenced shortlist; council judges the finalists and an owner-approved one leaves as a venture.yaml (ADR-1900..1912).
argument-hint: "<niche>"
allowed-tools: Bash(node .claude/scripts/discover/arc-discover.mjs:*), Read
---

Hunt: **$ARGUMENTS**

```bash
node .claude/scripts/discover/arc-discover.mjs hunt "$ARGUMENTS"
```

Print the output as-is. Exit 2 means the verb refused, and the first stderr line says why. A hunt is
human-started (no scheduler), reads public endpoints only (ADR-1904), and never invokes `arc launch`:
an approved idea becomes `products/launch/ventures/<slug>.venture.yaml`, and the owner runs
`arc launch new` (PLAN no-gos).

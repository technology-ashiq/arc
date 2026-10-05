---
description: Hunt a niche for real pain -- mine HN, normalize, dedupe and cluster into an evidenced shortlist; council judges the finalists and an owner-approved one leaves as a venture.yaml (ADR-1900..1915).
argument-hint: "<niche>"
allowed-tools: Write, Bash(node .claude/scripts/discover/arc-discover.mjs hunt --niche-file .claude/state/discover/niche.txt), Read
---

The niche is the argument this command was given. It never goes on a command line: a quote, backtick or `$(` in it would reach the shell.
Write it with the Write tool to `.claude/state/discover/niche.txt`, exactly as given and nothing
else, then run:

```bash
node .claude/scripts/discover/arc-discover.mjs hunt --niche-file .claude/state/discover/niche.txt
```

Print the output as-is. Exit 2 means the verb refused, and the first stderr line says why; the CLI
also refuses a niche outside its grammar. A hunt is human-started (no scheduler), reads public
endpoints only (ADR-1904), and never invokes `arc launch`: an approved idea becomes
`products/launch/ventures/<slug>.venture.yaml`, and the owner runs `arc launch new` (PLAN no-gos).

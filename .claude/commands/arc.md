---
description: arc orchestrator — read-only per-product install/health dashboard
allowed-tools: Bash(bash .claude/scripts/core/arc-status.sh:*)
---

# /arc — the orchestrator umbrella

Run `bash .claude/scripts/core/arc-status.sh` and render its table verbatim, then add a
one-line reading.

The table shows every arc product (core · plan · review · qa · council · git) and its
INSTALLED state in this repo:

- **file-presence detection** in Phase 0 (are the product's manifest files present?),
- **registry-backed** from Phase 2 (reads `.claude/arc-registry.json` ground truth).

For anything not fully installed, the script prints the exact
`sync-to-project.sh <target> --products …` command to add it.

This command is **read-only** — it never writes, mutates the tracker, or runs a gate.
It routes; it does not act. To install a product, run the printed sync command yourself.

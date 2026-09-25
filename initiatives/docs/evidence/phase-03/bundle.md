# Phase 03 evidence — drift, staleness, counts, three narratives

Lane `docs`, Cycle 17. PR #281, merged as `e5b0a6bd`. Approved to start by `decision.recorded`
`01M3CS928BYBK005FAJY4CGVA8`.

## What shipped

- `wiki-drift.mjs` — BLOCK. Every hand-written narrative is read; an ADR, command, script or
  driver it names that the tree no longer has fails CI, naming `file:line` and the reference
  (REQ-05). Windows spellings, dot segments and mis-cased paths are dangling, never silently fine.
  A four-arm `--mutant-selftest`.
- `wiki-stale.mjs` — WARN, exit 0. Each narrative's first line is a per-fact fingerprint; when a
  fact moves, the WARN names the key. `--print <dir>/<id>` gives the author the current line;
  nothing rewrites a narrative (ADR-1505).
- `wiki-build --audit-counts` — REQ-07: all 4185 numbers on the 132 pages re-derived from
  `wiki.json`. On its first run it caught a real drift (the docs manifest had grown two scripts
  before the pages were regenerated).
- Narratives for the `engine` and `git` products and the `portfolio` lane — drafted from tree
  facts with every claim cited, **accepted by the owner on 2026-09-25** (ADR-1508's
  "draft assistance a human accepts"). `wiki-drift` caught the first draft citing `/arc-run`,
  a command that does not exist, before it shipped.

## CI (read per job)

| Run | Head | Result |
|---|---|---|
| `36174149306` | `70c0dceb` | **19 of 19 success**, first run, head SHA confirmed |
| `36176304618` | `e5b0a6bd` (merged `main`) | dispatched to verify the merged tree |

## Adversarial pass (one round)

`attack-4a2ebb9-r1-boundary.json`: 14 findings (7 medium, 7 low) — the mediums fixed before the
push, the lows in the debt ledger. The logic surface did not run (429), the standing gap.

## Shard weight

`docs-drift.bats` 20 s (Windows shard of `36174149306`; the 60 s placeholder replaced).

`demo.txt`: the self-test's four arms, drift and stale on the real tree (3 narratives, 15
references, 0 stale), audit-counts, and coverage with 3 narratives.

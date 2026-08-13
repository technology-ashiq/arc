# Phase 00 — cross-lane check

Two runs, kept side by side. Evidence accumulates: the first run is what was true before slice
01 touched anything, and overwriting it would delete the only record of the state that
authorized those commits.

---

## Run 2 — 2026-08-13, before slice 09 (the steel thread)


`.claude/rules/lanes.md` § *Shared files, when two lanes are live*: before editing a shared CI or
company file mid-cycle, run `git log origin/main --oneline -5 -- <path>`. If another lane has
touched it since the branch point, you are **already** in a merge conflict — handle it now, in one
place, rather than at merge time in two.

- **Date:** 2026-08-13
- **Lane:** bench
- **Branch:** `feat/arc-bench-phase-00-rest`
- **Branch point:** `1f66836` (`feat(bench): Phase 00 slice 08 — the coverage gate counts DECLARED fixtures (#179)`)
- **Worktrees live on this box:** 16 (`git worktree list`) — absorb, develop, engine, evolve,
  executor, growth, leads ×2, ledger, legal, memory, model, policy, scheduler.

## The five authorized paths (PLAN § touch-with-care)

`git log origin/main --oneline -5 -- PATH`, run at the branch point:

| Path | Most recent touches on `origin/main` | Another lane since branch point? |
|---|---|---|
| `.claude/scripts/engine/drivers/**` | `9fa4812` bench slice 03 · `e7dc4a8` bench slices 01–02 · `8734cf5` policy · `b9a9e9f` engine Cycle 6 | **no** — the last two touches are bench's own |
| `tests/fixtures/engine/evals/**` | `9b843f6` bench slice 07 · `7b00a63` bench slice 06 · `e63e559` bench slice 04 · `b9a9e9f` engine | **no** |
| `.claude/scripts/engine/arc-run.mjs` | `e7dc4a8` bench slices 01–02 · `141ea9b`/`dc01480`/`6755768`/`73cd2a5` policy | **no** — policy's run ended before the branch point |
| `.claude/scripts/engine/arc-bench.mjs` | `1f66836`, `9b843f6`, `7b00a63`, `e63e559` — all bench | **no** — the file is bench's own |
| `processes/commit-msg-draft.process.yaml` | `9b843f6` bench slice 07 · `b9a9e9f` engine Cycle 6 | **no** |

**Verdict on the authorized paths: clean.** Every touch since engine's Cycle 6 is bench's own.
Engine is IDLE and its last commit on these paths predates this lane entirely.

## The shared organs this phase also edits

These belong to no lane and are edited by all of them (`.claude/rules/lanes.md` § Shared files).
Bench writes all four, so they are checked the same way — and here the answer is **not** clean.

| Path | Why bench writes it | On `origin/main` since branch point | In an UNMERGED sibling branch |
|---|---|---|---|
| `tests/shard-timings.json` | M10 — a new/heavier bats file must be re-weighed | no (last touch `7b00a63`, bench's own) | **yes** |
| `tests/fixtures/sync-golden/tree-manifest.txt` | byte-identity CI gate over the synced tree | no (last touch `1f66836`, bench's own) | **yes** |
| `products/engine/manifest.json` | every new `.claude/**` file must be mapped or product-lint exits 2 | no (last touch `e63e559`, bench's own) | no |
| `tests/bench-harness.bats` | slice 09's tests | no — bench's own file | no |

`git log origin/main..BRANCH -- <the three shared organs>`, across every live sibling branch:

| Sibling branch | Shared-organ commits ahead of `origin/main` | New `tests/*.bats` touches |
|---|---|---|
| `feat/arc-scheduler-cycle-12` | **14** | **11** |
| `feat/arc-growth-cycle-14` | **2** | **6** |
| `feat/evolve-retro-c7` | 1 | 0 |
| `feat/absorb-req-table-truth` · `feat/history-adr-attribution` · `feat/arc-leads-slice06-position` · `feat/good-shape-definition` · `feat/arc-policy-phase-04-close` | 0 | 0 |

## What this obliges, and when

**Nothing to handle now.** The collision is not yet real: no sibling has landed on `origin/main`,
so at the branch point bench is the last writer of all four organs. Acting now would mean merging
against a tree that does not exist.

**What it obliges at merge time** — and this is the whole reason the check is recorded rather than
merely performed:

1. **`tests/shard-timings.json` is a MEASURED table.** `.claude/rules/lanes.md`: when two branches
   both regenerate a measured table, *the merge invalidates BOTH* — re-measure on the merged tree.
   If scheduler or growth lands first, bench's regenerated weights are stale on contact and
   `weigh-tests.yml` must be re-run against the merged tree, not reconciled by hand.
2. **Unmeasured entries must surface as a COUNT, never absorbed into `_default_weight`.** Six files
   once came out of a merge with no entry at all, riding a 16s default against real costs up to
   123s, because a missing entry reads as a default rather than as an error.
3. **`tree-manifest.txt` is byte-identity, so it cannot be merged — only regenerated.** Any
   text-level conflict resolution there produces a file that matches neither tree.
4. **Take the STRONGER version, not the earlier one.** The 2026-08-03 collision was resolved by
   taking the other lane's assertion because it checked more, not because it landed first.

Bench merges at the end of Phase 00 as one PR, so this check is re-run against `origin/main` HEAD
immediately before that merge — the table above is true of the branch point, not of the future.

---

## Run 1 — 2026-08-12, before slice 01 (verbatim)


Run 2026-08-12T10:07:21Z before touching any of the five authorized paths.
Rule: .claude/rules/lanes.md — a touched-since-branch-point result is an in-flight merge conflict.

## .claude/scripts/engine/drivers
```
  8734cf5 feat(policy): gate the driver entry point -- arc-run was never the only door
  b9a9e9f Cycle 6 engine: model-agnostic foundation — processes/ + arc-compile 3/3 byte-identical + arc-run with 3 drivers (#103)
```

## tests/fixtures/engine/evals
```
  b9a9e9f Cycle 6 engine: model-agnostic foundation — processes/ + arc-compile 3/3 byte-identical + arc-run with 3 drivers (#103)
```

## .claude/scripts/engine/arc-run.mjs
```
  141ea9b test(policy): walk the promotion chain for real, and stop claiming a demotion that never happens
  dc01480 fix(policy): close the gate bypasses a second adversarial surface proved
  6755768 fix(policy): a root with no policy file is NOT IN FORCE, not denied
  73cd2a5 feat(policy): phase 01 -- the headless gate, before any driver starts
  b9a9e9f Cycle 6 engine: model-agnostic foundation — processes/ + arc-compile 3/3 byte-identical + arc-run with 3 drivers (#103)
```

## .claude/scripts/engine/arc-bench.mjs
```
```

## processes/commit-msg-draft.process.yaml
```
  b9a9e9f Cycle 6 engine: model-agnostic foundation — processes/ + arc-compile 3/3 byte-identical + arc-run with 3 drivers (#103)
```


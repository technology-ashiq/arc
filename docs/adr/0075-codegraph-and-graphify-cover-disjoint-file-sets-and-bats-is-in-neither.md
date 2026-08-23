# ADR 0075 — codegraph and graphify cover disjoint file sets, and `.bats` is in neither

**Status:** accepted
**Date:** 2026-08-23
**Product:** `company` — arc-wide (ADR-0053)
**Reversibility:** two-way
**Revisit trigger:** either index gains the other's file types (a codegraph release that parses
`.md`/`.sh`, or a graphify release that parses `.yaml`), **or** anything starts parsing `.bats`
— at which point the split below stops describing the tools and starts misdescribing them.

## Context

PR #213 (2026-08-22) declared codegraph the impact index and wrote into `.gitignore` that
graphify "does NOT rebuild itself here". That was correct about the symptom. It rested on two
beliefs about the cure, and **one of them was false**. Both were tested on 2026-08-23.

**Belief 1 — refreshing graphify costs real tokens.** False. `graphify --help` states
`update <path>  re-extract code files and update the graph (no LLM needed)`. Run against arc:

```
AST extraction: 1817/1817 files (100%) [16 workers]
Rebuilt: 11552 nodes, 14766 edges
input_tokens: 0 | output_tokens: 0
```

Roughly two minutes, zero LLM. The ~238k-token figure on record belongs to the *initial semantic*
`/graphify .` extraction, not to a refresh. LLM cost enters only through community labelling
(`cluster-only` / `label`), which `--no-cluster` skips.

**Belief 2 — codegraph already does graphify's job.** False. The two indexes overlap on JS/TS
and are otherwise disjoint. Measured the same day, on the same tree (2517 tracked files):

| File type | tracked | codegraph | graphify |
|---|---:|---:|---:|
| `.md` | 1141 | **0** | **1087** |
| `.sh` | 98 | **0** | **97** |
| `.json` | 388 | 0 | 102 |
| `.mjs` + `.js` | 268 | 268 | 264 |
| `.yaml` | 145 | **151** | **0** |
| `.bats` | 165 | **0** | **0** |
| files indexed | — | 427 | 1565 |

arc is roughly half shell and markdown. Retiring graphify would have surrendered 1087 ADR/plan/rule
files and 97 harness scripts to grep, for free, in order to avoid a cost that does not exist.

**They are also different *kinds* of index.** codegraph returns an exact symbol with its file, line
and callers. graphify runs a heuristic BFS over the graph: asked which scripts call `lane-resolve`,
it returned the correct core — `resolveLane() → validLaneName() / laneStatus() / isEligible()` with
line numbers — alongside four unrelated `scripts` nodes from `products/*/manifest.json`, an `EXIT`
node from `arc-bench.mjs`, and a scheduler week-log. Precision belongs to codegraph; breadth and
discovery belong to graphify. Neither substitutes for the other.

**Freshness is not symmetric either.** codegraph runs a daemon file-watcher and reported
`[OK] Index is up to date` unprompted. graphify had no refresh path wired at all: its own
`graphify hook install` (post-commit + post-checkout) had never been run here, and
`.git/hooks/` held nothing but samples. `docs/product-runbook.md` had told us to run it since
day one; nobody had, and no check failed loudly enough to notice for a month.

**Installing that hook is not safe by default in this repo.** `core.hooksPath` is unset, so hooks
resolve to `$GIT_COMMON_DIR/hooks` — **shared by all 21 arc worktrees**. graphify ships
`post-checkout` with a `[ ! -d "graphify-out" ] && exit 0` guard and ships `post-commit`
**without it**. Unguarded, every commit in every lane worktree would have spawned a rebuild in a
tree that has no `graphify-out/`, seeding twenty junk partial graphs an agent could later query
and read as "nothing found".

## Options considered

1. **Retire graphify** (the standing recommendation until the cost was measured). Cheap, and
   consistent with PR #213 — but it trades away 1087 md + 97 sh files to save nothing.
2. **Keep both, undifferentiated.** What we had. Produces the failure this ADR exists to stop:
   an agent asks codegraph about a shell function, gets silence, and reads silence as
   "no dependents, safe to change".
3. **Split by file type, and name what neither covers.** Chosen.

## Decision

**Two indexes, two jobs, one named gap.**

| Question | Tool | Covers |
|---|---|---|
| Callers, callees, blast radius, exact line | **codegraph** | `.mjs` `.js` `.ts` `.tsx` `.yaml` |
| Which doc/ADR/rule/script mentions this | **graphify** | `.md` `.sh` `.json` |
| Anything in `tests/*.bats` (165 files) | **grep** | neither index parses bats |

Four consequences of that split are binding:

1. **Silence from an index is not evidence of absence.** codegraph returning nothing about a
   `.sh` or `.bats` symbol means it never looked. Before concluding "no dependents", confirm the
   file type is in that index's column.
2. **Both indexes are main-clone-only.** `.codegraph/` and `graphify-out/` are gitignored and
   exist at `E:/Work_Hub/01_Automemory/arc` alone. A query from a lane worktree answers from
   **main's tree**, not from the branch in hand — so a symbol added on a lane branch is invisible
   to both.
3. **graphify refreshes via post-commit, guarded to the main clone.** `graphify hook install` was
   run on 2026-08-23 and the missing `[ -d "graphify-out" ] || exit 0` guard was added to
   `post-commit` by hand, mirroring the guard graphify already ships in `post-checkout`. Verified
   both directions: traced, the guard line executes and exits 0 in a worktree with no junk dir
   created; in the main clone the hook launches its rebuild. A sweep of all 21 worktrees found
   exactly one carrying a graph.
4. **The guard does not survive a graphify upgrade.** Re-running `graphify hook install`
   overwrites the hook file and drops the guard. Re-apply it after any graphify upgrade, and
   check with `graphify hook status` plus a `grep graphify-out .git/hooks/post-commit`.

## Consequences

- `CLAUDE.md`'s impact-question rule now names both tools and both blind spots, rather than
  pointing at codegraph without saying what it cannot see.
- `codebase-surveyor` routes by question type instead of "graphify first".
- `/arc-phase-done` step 8 loses its instruction to skip when the git hook is installed — the
  hook is now installed, and the step was silently doing nothing for a month regardless.
- `toolchain-health.sh` stops recommending a command as if it were missing, and its graphify
  check no longer misreports from a worktree, where the relative `graphify-out/` path cannot
  resolve by construction.
- `docs/product-runbook.md` stops telling a reader to commit `graphify-out/`, which PR #213 had
  made a direct contradiction of `.gitignore` the day before.
- The `.bats` gap is now written down rather than discovered per-incident. Closing it needs a
  bats parser in one of the two tools; until then that column reads grep, and 165 files is a
  large enough share of arc that this is worth revisiting rather than accepting forever.
- Cost of the whole arrangement: zero tokens, recurring. Both refreshes are AST-only.

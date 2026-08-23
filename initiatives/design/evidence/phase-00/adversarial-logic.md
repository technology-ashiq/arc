# Phase 00 — adversarial pass, surface 1: DECISION LOGIC

**Agent:** fresh, had not seen the implementation. Given the source, ADR-1402 and ADR-1417, the
bats suite (told to treat it as a **suspect, not a reference**), and this lane's running list of
already-fixed defects with the instruction to check each one in every *other* file.
**Ran against:** the PR that ships the gate (#222), not the phase close.
**Returned:** 14 findings. Every one executed against the real script in a throwaway sandbox.

Two surfaces were run because a single attacker's blind spot is structural, not a matter of
effort — measured twice in this repo (Cycle 6, and bench 2026-08-13). The overlap with surface 2
was **one finding** (the argument-loop hang), which both found independently.

| # | Finding | Disposition |
|---|---|---|
| 1 | A value-taking flag given last spins the argument loop **forever** — `shift 2` with one arg left fails and shifts nothing, `set -e` off, so `$1` is re-read until the CI leg dies. Measured exit 124 on all five flags. | **FIXED** — arity guard per branch, `${2:-default}` removed (it hid the arity error). Pinned: *a value-taking flag given last REFUSES instead of looping forever*, run under a wall-clock bound so a regression fails instead of hanging. |
| 2 | Slug collision bypassed case 1: two routes sharing a slug meant the second route's **first ever** render came out exit 0 with `unchanged: true` while the first route's PNG vanished. | **FIXED** — the previous meta's `route` is read before `PREV_SHA` is trusted; a mismatch refuses. Pinned: *a slug collision REFUSES instead of silently overwriting the other route*. Slug left non-injective deliberately — see Accepted below. |
| 3 | The guard glob `*/*.json` **cannot see the flat legacy metas** at `renders/<slug>.json`, which are the only population that genuinely lacks a session. ADR-1417's fail-closed path was unreachable for exactly the files it was written for — and the suite's fixture was planted in a subdirectory production never produced, passing by avoiding the real path. | **FIXED** — both depths globbed; the suite's fixture moved to the flat path. |
| 4 | Route written JSON-escaped, read back with a regex that does not unescape: `docs\one.html` compared unequal to itself, so a same-route iteration was classed as a stale page and **deleted**. | **FIXED** — metas are parsed (`_meta_field`), not regexed, when node is present. |
| 5 | `design-critique.sh` forwards `"$@"` to a renderer whose output path those flags now move, while hardcoding the read path — the critic would judge a stale PNG and seal it into a receipt. | **FIXED** — `--session`/`--iter`/`--mode` are refused as non-forwardable, with the scope boundary released before exit. |
| 6 | `--iter ""` skipped validation entirely and overwrote the base render path. | **FIXED** — `ITER_GIVEN` tracks the flag, not the value. Pinned in *--iter outside 1-3 refuses, and an EMPTY --iter is not the same as no --iter*. |
| 7 | `--session ""` silently became `design-critic` in critique mode, and reported "required" in explore mode when one **was** given. | **FIXED** — `SESSION_GIVEN`; the grammar rejects `""` with the right message. Pinned. |
| 8 | The no-node `printf` branch wrote unescaped routes: unparseable JSON, and a crafted URL route injected a `session` key **ahead** of the real one — a guard-disabling write. | **FIXED** — the branch refuses a route it cannot escape, and now emits the same shape as the node branch (`url` and `png` were missing). |
| 9 | A **revert** read as unchanged: A → B → A reported `unchanged: true`. | **FIXED**, and this one was caught by CI rather than by the fix: the iteration comparison was correct, and the guard's case-2 branch then overwrote it. Pinned: *a REVERT is not unchanged*. |
| 10 | `head -1` let a decoy `route`/`session` line ordered ahead of the real one decide the comparison. | **FIXED** — the no-node reader anchors to a whole pretty-printed line and refuses when more than one matches; the node reader parses. |
| 11 | `grep … || continue` could not tell **no match** from **could not read**. | **FIXED** — the status is read; unreadable is its own named refusal. |
| 12 | Two differing values for one flag: last wins, silently. `lanes.md` already ruled this shape an operator error for `--lane`, and the session **is** this script's lane. | **FIXED** — refuses. Pinned. |
| 13 | Suite: the concurrency test could not fail if session isolation were deleted (the fake dropped `--session`); the just-fixed catch-all had no test; `cross-route-duplicate` could not tell case 1 from case 3. | **FIXED** — the fake records sessions and a test asserts each render used its own; tests added for the unknown flag and for case 1's distinguishing clause. |
| 14 | `mkdir -p` ran before the route-existence check, so every refusal left an empty session directory and falsified "refusing publishes nothing". | **FIXED** — moved below route resolution. Pinned: *a refusal leaves no empty session directory behind*. |

## Explicitly accepted, not fixed

- **`_slug()` stays non-injective.** Making it injective (appending a hash of the route) would
  ripple through every hardcoded path in two suites and through `design-critique.sh`, which
  duplicates the function byte-for-byte. The hole is closed at the point that matters — a
  collision now **refuses** instead of silently overwriting — so the residual cost is a refusal
  on an exotic route pair, not data loss. Revisit if a real route pair ever trips it.

## Categories the attacker probed and found clean

`"session": null` and `"session": ""` both fail closed · `--mode ""` refuses correctly ·
`--iter 0/4/01` refuse · no ordering bug inside the guard loop (`UNCHANGED` is only ever set
true, every refusal branch exits) · no vacuous gate printing its own contract · no exit code
read through a pipe · `case "$m" in "$META")` is quote-safe against glob metacharacters.

# debt-ledger.md — LOW leftovers and accepted findings (ADR-2011)

One row per finding that was not fixed in its PR, with the reason and the trigger that reopens it.

| # | Source | Finding | Disposition | Reopen when |
|---|---|---|---|---|
| 1 | attack ca7ba9a r2 boundary B2 (low) | a pass-through line that begins `arc-run: ` can still pose as arc-run's own reason | accepted: drivers' stderr reaches bench only through arc-run, which prefixes driver lines with the driver name, and the reason is display text that gates nothing | a scorecard reason is ever read by a gate rather than a person |
| 2 | attack ca7ba9a r2 boundary B6 (low) | `retry.why` is interpolated raw into a stderr line, so a newline in it splits the reason | accepted: `why` comes from the schema validator's own message (a JSON path plus a rule), not from model text | a validator message is ever built from the answer's own strings |
| 3 | attack ca7ba9a r2 boundary B5 (low) | the trial early exit could skip cleanup shared with the normal exit | accepted: it calls the same `emitRun` and `process.exit(1)` as the tier-change path below it, so there is no cleanup that one runs and the other skips | a `finally`/exit hook is added to the schema-stop path |
| 4 | attack a59752e r1 logic L6, ca7ba9a r2 logic L9 (low) | `--strict-mcp-config` fails a benched run that needs a project-scoped MCP server | accepted: no benched process uses MCP, and the fixture repo carries no `.mcp.json` | a benched process declares an MCP tool |
| 5 | attack ca7ba9a r2 logic L7 (low) | hermes withholds the contract when its canonical read failed | accepted: an unreadable canonical file has no `output` to show, and hermes already says NO PROCESS BRIEF on that path | — |
| 6 | attack a522a4e r1 logic L5 (low) | the checkout fingerprint hashes ref names and objects, not annotated-tag messages | accepted: a re-annotated tag gets a new object id, which is in the hash | a tag is ever moved without its object changing |
| 7 | attack a522a4e r1 logic L8, boundary B8 (low) | MUTANT C makes a branch through `-C ROOT`, not a commit through a wrong cwd | partly closed: the probe now checks a commit on the current branch and a commit reset back; the cwd path itself is pinned in `engine-driver-contract.bats` | a new driver spawns a CLI |
| 8 | attack a522a4e r1 boundary B7 (low) | the ADR-0916 driver test's control run writes a marker into the checkout under test | accepted: it is removed on every path, and the control has to land in arc to prove the check can tell | the suite runs in parallel inside one checkout |
| 9 | attack 680e889 r2 logic L3 to L15 (medium, accepted) | a model can expire the reflog after committing and resetting back | accepted: the fingerprint is a tripwire for the 2026-10-14 accident, not a boundary against a model hiding its tracks; containment is the driver running in the work root (ADR-0916) | a benched process is ever run with a model treated as adversarial |
| 10 | attack 680e889 r2 boundary B6 (low) | a missing work root is reported as a missing CLI | accepted: arc-run refuses a missing or non-directory `--work-root` before any driver starts | a driver is spawned other than through arc-run |
| 11 | attack 680e889 r2 boundary B8 (low) | an unreadable read reports the command, not only the failure | partly closed: the reason now carries the git command, its exit status and its first stderr line | — |
| 12 | attack 461984d r1 boundary B3 (medium, accepted in part) | a sibling session's write to a shared config section other than `branch.<name>` and `remote.<name>` (`submodule.*`, `filter.lfs.*`, `core.*`) still stops a run | accepted: that direction is a false STOP, never a false pass, and costs only what the run spent so far; the two sections sibling sessions write routinely are excluded | a run is stopped by a sibling's config write again |
| 13 | attack 461984d r1 boundary B5 (low) | `config --local` reads the shared `.git/config`, never a worktree's own `config.worktree` | accepted: `extensions.worktreeConfig` is off in arc's clones | worktree config is turned on in the owner's clones |

Rejected (ADR-0067 taxonomy): a59752e L1 and ca7ba9a L1 (an indented contract line; arc-run prints
both at column 0), a59752e L3 and ca7ba9a L5 (control characters in `--trial-model`; `MODEL_RE`
refuses them before the run starts), a59752e L4 and ca7ba9a L6 (a schema posing as the header; the
schema is the repo's canonical file), ca7ba9a L4 (whitespace-only stderr already yields the exit
status), and ca7ba9a L10 (a test-wording observation, not a defect).

Rejected, attack a522a4e r1: L2 (two nulls equal means no git repo at either read, which has no refs
to move), B2 (`git()` already drops GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_COMMON_DIR and the
global config before it runs), B6 (the `.sh` wrappers `cd` only inside a subshell to find their own
directory; no other driver spawns a CLI), and L7, L9 to L15 (repeats of L6, fixed with it).

Rejected, attack 680e889 r2: L2 (git objects are content-addressed, so a ref with the same object id
points at the same content). Fixed in the same round: L1 (local config is in the fingerprint), B1
(dirty files by content), B2 and B3 (null only on "not a git repository"; fallbacks only on exit 1),
B4 (scoped to the worktree), B5 (a contaminated attempt writes no capture), B7 (no optional locks).

Rejected, attack 461984d r1: L3 and B6 (a detached HEAD has no branch section of its own to keep), L4 and L7 (git refuses to check out one branch in two worktrees, so no sibling owns this worktree's section), L6 (removing this worktree's own section changes the digest; nothing collapses to empty unnoticed). Fixed in the same round: L1, L2 and B2 (the subsection is matched exactly), B1 (section-level `branch.*` keys count again), L5 and B4 (`config -z`, one entry per key), B3 in part (`remote.<name>.*` excluded too).

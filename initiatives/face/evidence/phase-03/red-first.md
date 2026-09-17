# Red first — Phase 03, command ring

The tests went to CI before the code (face v2 Cycle 16, Phase 03). Commit `4e943611` carried the
refined verification plan, the new suites and the new assertions, and no implementation; draft PR
#239 fired arc-ci run **35238219201**, which concluded `failure` — 6 jobs failed (ubuntu Node 18, 20
and 22, macOS shard 1/3, windows shards 1/12 and 6/12), 13 succeeded, read per job with
`gh run view 35238219201 --json jobs`.

What was red, read from the ubuntu Node 20 job's log (job 105259566942), and why each is the red the
plan names:

| test | how it failed | the missing piece it names |
|---|---|---|
| `face v2: face-facts FAILs a planted facts bundle under face/src, WARNs its heuristics, and the tree is clean` | `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../.claude/scripts/core/face-facts.mjs` — no RAN line | the facts-bundle lint (slice 09) |
| `face/ imports nothing from .claude, so the repo split stays a directory move` | `an excused file is missing: .../.claude/scripts/core/face-facts.mjs` | the same lint, named in the importer scan's exclusions before it exists |
| `face v2: the module frame attaches both ways, agrees with face-coverage, and no shell file names a room` | `FAIL READ HOST: door.mjs names the door's routes and registry.mjs exports the read host (vacuous-pass guard)` | the read host: `DOOR_ROUTES`, `readKey`, `payloadsFor` and the rest (REQ-05) |
| (same suite) | `FAIL SHIPPED RING command: <id>'s View mounts no Cycle 15 renderer from face/src/rooms/` — for all six of today, inbox, map, spine, board, ask-arc | the six v0.7 ports (slice 01) |
| (same suite) | `FAIL NOT SERVED LIST command: evidence/phase-03/not-served-command.md exists`, and the list-equals-folds check | the derived NOT SERVED list (slice 03) |
| `face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods` | `no not-served line for mood=dark (harness exit 0)` — the smoke itself was green, and the new assertion was what failed | the smoke's per-mood NOT SERVED count (REQ-05's browser half) |

The Node 18 job failed on the same node-only suites; the browser suite is its counted skip there. The
macOS and windows shard failures are the shards those suites land on.

One assertion was added with the implementation rather than before it, and is recorded here rather
than hidden: the heading check (`smoke: heading mood=M rings=command checked=N miss=0`, the "opened"
debt row's pay-down) and its mutant controls in `tests/face/cdp-client.mjs` arrived in `f87db315`.

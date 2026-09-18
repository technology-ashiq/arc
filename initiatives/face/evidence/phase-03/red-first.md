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

# Red first — Phase 03, kernel ring

Commit `46b876ce` listed `kernel` as a shipped ring in `tests/face/module-frame.mjs`, raised the
browser suite's heading floor to fourteen checked rooms across `command,kernel`, and named the
kernel arms in `tests/face-l3.bats` — with no kernel module, no list and the smoke still checking one
ring. Draft PR #240 fired arc-ci run **35250457456**, which concluded `failure`: 5 jobs failed
(ubuntu Node 18, 20 and 22, macOS shard 1/3, windows shards 1/12 and 6/12), 14 succeeded, read per
job with `gh run view 35250457456 --json jobs`.

What was red, read from the ubuntu Node 20 job's log (job 105301232425):

| test | how it failed | the missing piece it names |
|---|---|---|
| `face v2: the module frame attaches both ways, agrees with face-coverage, and no shell file names a room` | `FAIL SHIPPED RING kernel: its module folders are modules-v2.json's ids for the ring have= want=absorb,bench,engine-room,evolve,memory,model-policy,policy,scheduler` | the eight kernel modules |
| (same suite) | `FAIL NOT SERVED LIST kernel: evidence/phase-03/not-served-kernel.md exists`, and the list-equals-folds check | the derived kernel NOT SERVED list |
| `face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods` | `heading check missing, too few checked, or a miss` on `smoke: heading mood=dark rings=command checked=6 miss=0` — every kernel room opened (`ok engine-room`, `ok scheduler`, ...) through the generic module, so the smoke was green and the floor was what failed | the kernel ports drawing their served sentence, and `SENTENCE_RINGS` naming the ring |

The windows shard 1/12 and macOS shard 1/3 failures are the browser suite's legs; windows shard
6/12 is the module-frame suite's. Node 18 counts the browser suite as its skip and failed on the
module frame alone.

# Red first — Phase 03, factory ring

Commit `d208a561` listed `factory` as a shipped ring in `tests/face/module-frame.mjs` and in the
smoke's `SENTENCE_RINGS`, raised the browser suite's heading floor to nineteen rooms across
`command,kernel,factory`, and named the ring's three list checks in `tests/face-l3.bats` — with one
factory module folder present (the Phase 02 `council-chamber` shim, which still mounted the Cycle 15
renderer) and neither evidence list written. Draft PR #242 fired arc-ci run **35266298427**, which
concluded `failure`, read per job with `gh run view 35266298427 --json jobs`.

What was red, read from the windows shard 6/12 job's log (job 105347240958):

| test | how it failed | the missing piece it names |
|---|---|---|
| `face v2: the module frame attaches both ways, agrees with face-coverage, and no shell file names a room` | `FAIL SHIPPED RING factory: its module folders are modules-v2.json's ids for the ring have=council-chamber want=council-chamber,design-studio,develop,review-ship,toolbelt` | the four missing modules |
| (same suite) | `FAIL SHIPPED RING factory: council-chamber's View mounts no Cycle 15 renderer from face/src/rooms/` | the real council port, and the deletion of `face/src/rooms/CouncilRoom.tsx` |
| (same suite) | `FAIL NOT SERVED LIST: evidence/phase-03/not-served-factory.md exists` and `FAIL VERBS PENDING LIST: evidence/phase-03/verbs-pending-factory.md exists` | the ring's two derived lists |

The browser suite's heading floor (nineteen) failed on the same run for the four rooms that were
still generic; macOS shard 1/3 and windows shard 1/12 are the legs that carry it.

# Red first — Phase 03, money ring

Commit `8691cc88` listed `money` as a shipped ring in `tests/face/module-frame.mjs` and in the smoke's
`SENTENCE_RINGS`, raised the browser suite's heading floor to twenty-seven rooms across
`command,kernel,factory,money`, added the REHEARSAL list check, the F3 arm (every planned room folded with
nothing loaded and with every read it asks for answered, and required to carry no LIVE word), the new
`tests/face/lane-room.mjs` suite (the factory ring's debt row) and the smoke checks for the planned,
rehearsal and runner-error lines -- with only the two carried money folders present (`money`, `ventures`,
still mounting their Cycle 15 renderers) and no list written. Draft PR #244 fired arc-ci run
**35311533655**, which concluded `failure`, read per job with `gh run view 35311533655 --json jobs`: six
jobs red (ubuntu Node 18, 20 and 22, macOS shard 1/3, windows shards 1/12 and 6/12), thirteen green.

What was red, read from the ubuntu Node 20 job's log (job 105494415502) and the windows shard 6/12 job's
(105494415484), which print the same FAIL lines:

| test | how it failed | the missing piece it names |
|---|---|---|
| `face v2: the module frame attaches both ways, agrees with face-coverage, and no shell file names a room` | `FAIL SHIPPED RING money: its module folders are modules-v2.json's ids for the ring have=money,ventures want=discover,growth,leads,legal,money,ops,trader,ventures` | the six money modules not yet ported |
| (same suite) | `FAIL SHIPPED RING money: money's View mounts no Cycle 15 renderer from face/src/rooms/` (and ventures') | the two real ports, and the deletion of `MoneyRoom.tsx` and `VenturesRoom.tsx` |
| (same suite) | `FAIL NOT SERVED LIST: evidence/phase-03/not-served-money.md exists`, the same for `verbs-pending-money.md` and `rehearsal-money.md`, and `rows=0` on the rehearsal vacuous-pass guard | the ring's three derived lists |
| (same suite) | `FAIL F3: ops has a module to fold` (and trader, discover) | the three planned modules |
| `face v2: the shared lane-room fold answers every loaded-page branch, and its seven toolbelt mutants FAIL` | the load guard (`catalogueOf` absent) and six `MANIFEST:` arms, e.g. `FAIL MANIFEST: a fold handed NO manifest fails closed -- every read refused, none planned` with both reads still planned | the manifest-bound shared fold and the one-pass catalogue |
| `face v2: the browser harness client logic runs with no install and no Chrome` | `FAIL the smoke exports the planned, rehearsal and runner-error lines (money ring)` | the smoke's new lines and the runner class |
| `face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods` | `mood=dark: the browser drew '' rehearsal cards, the lists name 0` (windows shard 1/12, macOS shard 1/3, ubuntu Node 20 and 22) | the rehearsal line, and the list it is judged against |

The red run also caught one wrong expectation in the red commit itself: `FAIL REHEARSAL LIST:
evidence/phase-03/rehearsal-command.md exists` and `FAIL F3: chat-mcp has a module to fold`. The command
ring's `chat-mcp` is a planned room the ring left to the generic module, so it has no fold to rehearse or
put through the module arm. The rehearsal list is now required only for a ring whose MODULES include a planned
room, and a generic planned room is held instead by its badge (`stateBadge` says planned whatever its kinds
did, in the rail and in the generic head) and by the smoke's planned line, which marks it `data-planned` too.

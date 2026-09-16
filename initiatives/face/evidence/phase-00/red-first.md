# Red first -- the browser harness tests before the harness existed

CI run `35147671002` on `cde59e3b` (branch `feat/face-v2-00-redfirst`: the Phase 00 tests plus the product-lint fix, with NO `face/scripts/`). Dispatched 2026-09-17. Conclusion: failure, 6 of 19 jobs; the 13 green jobs are shards that did not hold the face suites.

## Every failing test, by job

```
selftest (macos-latest, 20, shard 1/3) :: not ok 1088 face-browser: the node floor is reported, and only Node 18 may skip
selftest (macos-latest, 20, shard 1/3) :: not ok 1089 face-browser: the lockfile carries this platform's native packages (offline)
selftest (macos-latest, 20, shard 1/3) :: not ok 1090 face-browser: a planted console error and exception are seen over REAL Chrome
selftest (macos-latest, 20, shard 1/3) :: not ok 1091 face-browser: npm ci and vite build succeed in a copy of face/
selftest (macos-latest, 20, shard 1/3) :: not ok 1092 face-browser: door + preview + smoke open every openable room with 0 errors
selftest (macos-latest, 20, shard 1/3) :: not ok 1111 face/ imports nothing from .claude, so the repo split stays a directory move
selftest (macos-latest, 20, shard 1/3) :: not ok 1122 face v2: the browser harness client logic runs with no install and no Chrome
selftest (ubuntu-latest, 18) :: not ok 1275 face-browser: the node floor is reported, and only Node 18 may skip
selftest (ubuntu-latest, 18) :: not ok 1276 face-browser: the lockfile carries this platform's native packages (offline)
selftest (ubuntu-latest, 18) :: not ok 1277 face-browser: a planted console error and exception are seen over REAL Chrome
selftest (ubuntu-latest, 18) :: not ok 1278 face-browser: npm ci and vite build succeed in a copy of face/
selftest (ubuntu-latest, 18) :: not ok 1279 face-browser: door + preview + smoke open every openable room with 0 errors
selftest (ubuntu-latest, 18) :: not ok 1300 face/ imports nothing from .claude, so the repo split stays a directory move
selftest (ubuntu-latest, 18) :: not ok 1311 face v2: the browser harness client logic runs with no install and no Chrome
selftest (ubuntu-latest, 20) :: not ok 1275 face-browser: the node floor is reported, and only Node 18 may skip
selftest (ubuntu-latest, 20) :: not ok 1276 face-browser: the lockfile carries this platform's native packages (offline)
selftest (ubuntu-latest, 20) :: not ok 1277 face-browser: a planted console error and exception are seen over REAL Chrome
selftest (ubuntu-latest, 20) :: not ok 1278 face-browser: npm ci and vite build succeed in a copy of face/
selftest (ubuntu-latest, 20) :: not ok 1279 face-browser: door + preview + smoke open every openable room with 0 errors
selftest (ubuntu-latest, 20) :: not ok 1300 face/ imports nothing from .claude, so the repo split stays a directory move
selftest (ubuntu-latest, 20) :: not ok 1311 face v2: the browser harness client logic runs with no install and no Chrome
selftest (ubuntu-latest, 22) :: not ok 1275 face-browser: the node floor is reported, and only Node 18 may skip
selftest (ubuntu-latest, 22) :: not ok 1276 face-browser: the lockfile carries this platform's native packages (offline)
selftest (ubuntu-latest, 22) :: not ok 1277 face-browser: a planted console error and exception are seen over REAL Chrome
selftest (ubuntu-latest, 22) :: not ok 1278 face-browser: npm ci and vite build succeed in a copy of face/
selftest (ubuntu-latest, 22) :: not ok 1279 face-browser: door + preview + smoke open every openable room with 0 errors
selftest (ubuntu-latest, 22) :: not ok 1300 face/ imports nothing from .claude, so the repo split stays a directory move
selftest (ubuntu-latest, 22) :: not ok 1311 face v2: the browser harness client logic runs with no install and no Chrome
selftest (windows-latest, 20, shard 10/12) :: not ok 315 face/ imports nothing from .claude, so the repo split stays a directory move
selftest (windows-latest, 20, shard 10/12) :: not ok 326 face v2: the browser harness client logic runs with no install and no Chrome
selftest (windows-latest, 20, shard 6/12) :: not ok 287 face-browser: the node floor is reported, and only Node 18 may skip
selftest (windows-latest, 20, shard 6/12) :: not ok 288 face-browser: the lockfile carries this platform's native packages (offline)
selftest (windows-latest, 20, shard 6/12) :: not ok 289 face-browser: a planted console error and exception are seen over REAL Chrome
selftest (windows-latest, 20, shard 6/12) :: not ok 290 face-browser: npm ci and vite build succeed in a copy of face/
selftest (windows-latest, 20, shard 6/12) :: not ok 291 face-browser: door + preview + smoke open every openable room with 0 errors
```

## Why they failed -- the reason the spec named

```
#     throw new ERR_MODULE_NOT_FOUND(
#   code: 'ERR_MODULE_NOT_FOUND'
#   code: 'ERR_MODULE_NOT_FOUND',
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/runner/work/arc/arc/face/scripts/cdp.mjs' imported from /home/runner/work/arc/arc/tests/face/cdp-client.mjs
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/runner/work/arc/arc/face/scripts/cdp.mjs' imported from /Users/runner/work/arc/arc/tests/face/cdp-client.mjs
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\a\arc\arc\face\scripts\cdp.mjs' imported from D:\a\arc\arc\tests\face\cdp-client.mjs
# Error: Cannot find module '/home/runner/work/arc/arc/face/scripts/lockfile-platforms.mjs'
# Error: Cannot find module '/home/runner/work/arc/arc/face/scripts/node-floor.mjs'
```

The `face/ imports nothing from .claude` failure in this run is NOT red-first: it came from a substring match (`arcface/src` inside a reference path in `face-modules-contract.mjs`) and was fixed by bounding that grep (fixed-defects.md, Phase 00).

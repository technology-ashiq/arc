# Attacker reports — face v2 Phase 00

Two passes, each two fresh agents with different surfaces (decision logic; shell/OS boundary),
each handed `initiatives/face/fixed-defects.md` with the instruction to check every line in every
OTHER file. Every hole below was fixed and pinned; the defect lines are in `fixed-defects.md`.

## Pass 1 — the first harness (fixed in `78b65cb3`)

The two reports of this pass were returned to the session on 2026-09-17 and were **not saved as
files**; that is recorded here rather than reconstructed. What survives is primary: the fix commit
`78b65cb3`'s body lists all 22 holes by surface (decision logic 12, shell/OS 10), and
`fixed-defects.md`'s "Phase 00 harness" section carries one line per fix.

## Pass 2 — the fixes for CI run D (attacked commit `f9805720`, fixed in `ca6e26b6`)

Both agents were general-purpose, started with no conversation context, told to attack commit
`f9805720` and the TESTS that protect it, forbidden to edit the repo or run any suite, and given
private scratch directories. Reports below are verbatim except that local scratch paths are
removed.

### Decision logic

I found 7 real holes in the two modules and 7 mutants that the checks in `tests/face/cdp-client.mjs` don't catch. Every item below comes from a probe or mutant I ran. I edited no repo files.

**How I tested the checks.** I copied cdp-client.mjs lines 216–276 (lockfile, 42 checks) and 305–363 (network watch, 16 checks) word for word into scratch runners. Both sets pass on unmodified copies of the modules. Two deliberate breaks are caught: dropping the version check fails 4 checks, and dropping the loaderId filter fails 2. So the runners can fail.

**Holes in `face/scripts/lockfile-platforms.mjs`**
- **H1 (lines 31, 48, 55): an unknown ABI ending counts as "any libc".** Names ending in `-linux-arm-musleabihf` (a real rollup binding) or `-linux-arm64-ohos` read as `libc: null`, and `matches()` accepts null for every host. `@img/sharp-linuxmusl-x64` isn't recognised at all and drops out of its family.
  - Input: `rollup` declares `-gnueabihf` and `-musleabihf`; only `@rollup/rollup-linux-arm-musleabihf@4.0.0` is present, with no libc field; target linux/arm/glibc.
  - Expected FAIL, got `ok: true`. The entry's libc field is the only guard, so a lockfile from an older npm (the case the suite itself models) passes.
  - Fix: after the cpu token, allow only end-of-name or a known ABI. Report an unknown ending by name, add `musleabihf` as musl.
- **H2 (lines 121–123): a malformed `optionalDependencies` quietly removes the family.**
  - Input: the tracked lockfile, with `@rolldown/binding-linux-x64-gnu` deleted and rolldown's `optionalDependencies` turned into an array.
  - Expected FAIL, got `ok: true, families: 1`. Fix: a non-object entry or declaration gets a named "malformed" line in `missing`.
- **H3 (line 82): prerelease under `*`.** `satisfiesSpec("1.2.5-rc.1", "*")` and `(…, "")` return ok. This contradicts the "prerelease under a range fails closed" claim, because the `*` shortcut runs before the prerelease guard on line 90. Real impact is nil, since npm's resolver treats `*` as always valid. Fix the order or the comment.
- **H4 (lines 60–67): huge numbers compare equal.** `satisfiesSpec("1.2.9007199254740993", "1.2.9007199254740992")` returns ok. Low impact. Fix: reject any part above `Number.MAX_SAFE_INTEGER`, as semver does.

**Holes in `face/scripts/smoke.mjs` (`NetworkWatch`)**
- **H5 (line 109): the fix for fixed-defects #83 wasn't applied to the early-request path.** If a request from the old page (loaderId OLD) is held while navigating and finishes before `begin`, the clock moves to 800. The same finish after `begin` leaves it at 0. No verdict changes today, because `from` (`renderedAt`) always comes after `begin`. Fix: store the finish time on the held entry and apply it only if that entry is adopted.
- **H6 (line 88): no loaderId means nothing is watched.** Chrome's DevTools protocol leaves loaderId out for a same-document navigation. After `navigate`/`begin(undefined)`, a live request gives inflight 0 and `quiet(3010, 3910) = true`, with `events: 0`.
  - Trigger: a `--base` containing `#` makes every room after the first a same-document navigation.
  - cdp-client.mjs:348–351 pins this as intended. It breaks pattern #51 (a measurement over nothing counts as passed).
  - Fix: keep the previous loaderId, or mark the room unmeasured.
- **H7 (`pathOf`, lines 44–51): the path is published whole.** `/api/inbox;token=SECRET` and `/a%3Ftoken=SECRET` both come through unredacted. There's no live leak today, because the face sends the token only as a Bearer header (`face/src/lib/door.mjs:241`). But nothing in the code enforces "never carries a token". Fix: redact the known token and cut the path at `;`.

**Mutants that pass every copied check (gaps in `tests/face/cdp-client.mjs`)**

| Mutant | What it breaks | Check to add |
|---|---|---|
| ML1: delete the os/cpu/libc field checks (lines 138–140) | musleabihf with `libc: ["musl"]` on a glibc arm host goes from fail to pass | an entry whose fields contradict its name must fail |
| ML2: skip a family with no binary for the target (lines 127–129) | the tracked lockfile on linux/riscv64 goes from FAIL to ok | an unsupported target fails with "declares no binary" |
| ML3: start the lookup one level above the parent | a wrong-version `node_modules/rolldown/node_modules/@rolldown/binding-linux-x64-gnu@0.0.1` goes from fail to pass | a wrong-version binding in the parent's own node_modules fails |
| ML4: read `>` and `<` like `^` (line 83) | `satisfiesSpec("1.2.5", ">1.0.0")` passes; only `>=` is pinned, and it fails parsing for an unrelated reason | cases for `>1.0.0`, `<2.0.0`, `1.2`, `1.x` |
| ML5: prerelease guard on `^` only (line 90) | `1.2.5-rc.1` vs `~1.2.0` passes | the same case under `~` |
| MN1: delete `this.inflight.clear()` from `navigate` (line 78) | a room-1 request that never reports `loadingFailed` keeps room 2 from ever settling. This reintroduces fixed-defects #81, the Windows "never settled" bug. Every check uses a fresh watch and navigates once | one watch reused across two navigations, with an abandoned request |
| MN2: publish the full URL for protocols other than http and data | `blob:http://127.0.0.1:1/x?token=SECRET` comes through whole; only `http:` and `data:` are tested | cases for `https:`, `blob:`, `ws:` |

**`fixed-defects.md` patterns violated here:**
- #70 ("unknown is never a default"): H1.
- #46/#47 (malformed input must be a named finding, not an omission): H2.
- #83 (a filter on one event of a pair applies to its twin): H5.
- #51 (a measurement over nothing counts as passed): H6.
- The #81 fix is in the code, but no test would catch its removal (MN1).

These held up:
- Both main guards compare real paths on both sides (#16).
- Unknown, `--flag=value`, value-starting-with-`--`, repeated and empty flags are all refused (#17–19, #71).
- `Object.hasOwn` is used for lockfile lookups (#29).
- `process.exitCode` is used instead of `process.exit` (#21).
- The resolved entry's version is checked (#82).
- Early requests are adopted after `begin` (#84).

### Shell/OS boundary

I found three real holes on the OS/Chrome side, all low to medium. None of them lets a failing run pass: the final `[ "$status" -eq 0 ]` check in the bats file still decides the verdict. I read the code, the CDP protocol file and Chromium's `page_handler.cc`, and ran three small node/sed probes. I ran no tests, Chrome, door or vite.

**H1: two of the five bats extractions are not anchored (the defect on fixed-defects.md line 78, left in its twin)**
- **Where:** `tests/face-browser.bats:100-101`. `unsettled` and `expected` start with a greedy `.*`, so they read the last match in the line. The comment at :95-96 says the opposite.
- **Input:** `smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=2 expected=33 not-opened=t excluded-errors=0 unsettled=0 expected=99 z` (a template id containing spaces).
- **Expected vs actual:** should read `unsettled=2 expected=33`; actually reads `unsettled=0 expected=99`.
- **Second input:** a template id containing a newline puts a second `smoke: opened=` line after the real one, and `tail -1` then reads every field from the injected line.
- **Reach:** only a door-served id can do this. Today's ids are all kebab-case, so it is not reachable now.
- **Fix:** anchor both from `^smoke: opened=[0-9]* openable=[0-9]* errors=[0-9]* excluded-errors=[0-9]* `. In `openableRooms`, refuse ids that don't match `^[a-z0-9][a-z0-9-]*$`.

**H2: the dev token reaches the CI log on the door-failure path (old code)**
- **Where:** after `listen`, `.claude/scripts/hq/arc-dash.mjs:858-859` writes `open http://127.0.0.1:PORT/#token=T` and `token T` to stderr. `harness-run.mjs:76` and `:84` put `door.stderrTail().slice(-600)` into the error, which goes through `console.error`, then `echo "$output"`, into the public log.
- **When:** the door starts listening, then dies or never answers `/api/health` with 200 within 20 s.
- **Impact:** almost none. The token is `face-browser-<pid>`, loopback-only, and dies with the runner. But it contradicts the "no token in the CI log" claim.
- **Not affected:** the new CDP evidence cannot carry the token. It is only in the URL fragment and the `Authorization` header (`face/src/lib/door.mjs:241`), and CDP's `Request.url` is documented as "without fragment". `pathOf` is an extra guard.
- **Fix:** replace the token with `<redacted>` in `stderrTail()` output in harness-run, or have the door skip printing it when `ARC_DASH_TOKEN` comes from the environment.

**H3: any CDP error throws away all the evidence (the defect on line 85, on its throw path)**
- **Where:** `smoke.mjs:288-315` runs every room with no try/catch, and room lines are only logged after the loop (`:319-324`). `until()` (`:248-255`) doesn't catch when the `rendered` check rejects.
- **Trigger:** a `Runtime.evaluate` 30 s call timeout (`cdp.mjs:257-260`), a CDP error (`:282`) or the socket closing (`:243-248`, e.g. a renderer crash).
- **Result:** the run ends with one `harness-run: unexpected: CDP ...` line and exit 2. No room lines, no `settle-ms`, no at-cap evidence, no report. I have not shown that macOS actually stalls a renderer for 30 s; the code path itself is certain.
- **Also:** the 15 s render cap can stretch to 45 s, because the cap is only checked between calls.
- **Fix:** log each room line inside the loop as soon as that room finishes. Catch errors per room and record them as `(cdp-error: msg)`.

**Checked and not holes:**
- **Output parsing:** Node writes plain `\n` (no CR on Windows). Child stdout is ignored and stderr is piped, so Chrome, the door and vite can't interleave with the smoke's output. The at-cap evidence is JSON-escaped, and room lines start with `ok`/`XX`. The summary line is always printed after the error lines. Bats prefixes captured output with `# `, so a page can't inject a `::workflow-command::` line.
- **Missing `loaderId`:** Chromium omits it on same-document navigations and on `ERR_ABORTED` (`DispatchNavigateCallback` and `Navigate()`). `smoke.mjs:294` also ignores `errorText`. My probe shows the watch then reports quiet with a request still in flight. It can't cause a false pass here: `?r=${i}` makes every hop cross-document, and the old page can't show the new room's id. A `--base` ending in `#` makes hops same-document, but then the app never routes to the room at all.
- **Requests the watch can't see:** worker requests carry `loaderId ""`, and WebSocket/EventSource have their own event types. My probe confirms worker requests are ignored, but `face/src` has no Worker, EventSource, WebSocket or service worker.
- **Early and old requests:** requests from the old page that arrive during navigation are dropped when `Page.navigate` answers. That answer comes when the navigation leaves the frame, so the Document request is always adopted.
- **Job time:** `ci.yml` has no `timeout-minutes` (GitHub's default is 360 min) and `BATS_TEST_TIMEOUT` is unset. The worst case, 33 × (15 + 10 + 20) s, is about 25 min, which kills nothing. Only the sharder's 200 s weight for this file goes stale.
- **`lockfile-platforms.mjs`:** against the real lockfile it passes for linux-x64-glibc, linux-x64-musl, darwin-arm64 and win32-x64, with 2 families each. The CLI refuses a repeated, empty or `--`-prefixed `--lock` with exit 2, and exit codes 0/1/2 match what bats expects. Outside the CI matrix only: `linux-arm-musleabihf` is read as having no libc, so it would satisfy a glibc ARM machine. Adding `musleabihf` to the alternatives fixes that.

**fixed-defects.md patterns in these files:**
- **Line 78** (anchor each extraction): violated, see H1.
- **Line 85** (a timeout reports what it waited on): violated on the throw path, see H3.
- **Line 51** (a measurement over nothing is UNMEASURED): the watch's missing-`loaderId` fallback, but it can't cause a false pass.
- Every other line is held in smoke, harness-run, cdp, lockfile-platforms and the bats file.

## What became of pass 2

All 10 holes and all 7 surviving mutants fixed in `ca6e26b6`, each mutant now killed by a named
check in `tests/face/cdp-client.mjs`; the shell/OS H1 twin also got a room-id grammar check in
`openableRooms`. The two surfaces shared no findings.

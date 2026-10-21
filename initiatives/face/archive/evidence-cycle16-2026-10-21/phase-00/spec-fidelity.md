# Phase 00 fidelity report: lane `face`, `c5dabfbc23..8542dc02`

> Filed verbatim from the `spec-fidelity` agent (fresh context; spec + diff only), 2026-09-17.
> Dispositions for every finding are in `handoff.md` § Spec-fidelity, not here.

I read only the spec and the diff. I did not open `phase-00-tasks.md`, `handoff.md` or `PROGRESS.md`. The one exception: I searched the `PROGRESS.md` diff for an approval ULID and found nothing.

## 4. Non-negotiables

None is clearly broken. Five are touched in ways worth knowing:

- **"The served registry is the only room list … the four extra rooms are exempted by name only."**
  - Held for Phase 00, but not in the named form. `.claude/scripts/hq/face-modules-contract.mjs` accepts an extra room when v0.7's registry marks it `extra: true`, not because of its name.
  - The count of four is pinned by `--check` and by `tests/face/modules-contract.mjs` (`counts.extra === 4`). Rerunning the script without `--check` would quietly accept a fifth.
  - Orphans only fail one way (a v0.7 room with no served id). A served room with no module is listed in `servedWithoutModule` and does not fail. No modules exist yet, so nothing is broken today, but Phase 03 should not copy this.
- **"Tokens have one source … `face/src/tokens.css` is generated and never hand-edited."** Both `docs/design/system/tokens.css` and `face/src/tokens.css` get the same one-line comment change (`arcface` → `arcface-v0.4`). That is what a regeneration would produce, but I cannot tell from the diff whether it was regenerated or typed.
- **"No new surface outside `.claude/scripts/` this cycle."** `face/scripts/` did not exist at the base; it now holds six files. The spec itself names `face/scripts/cdp.mjs` and `smoke.mjs`, so this is allowed on the spec's terms. Still, the plain wording of the rule and the spec's file placement pull against each other, and the diff adds four files there that the spec never named.
- **"The ported harness's frozen strings are the bar."**
  - Kept: v0.7's `THREE.Clock` filter, word for word.
  - Not ported: v0.7's `SENTENCE` table and its rendered-`h1` check (`docs/design/reference/face-hq/assets/arcface/scripts/smoke.mjs` around line 88). Phase 00's criteria don't ask for them, so this holds for now.
- **"No PII in git, the door or the intake."** I scanned every added line in the diff:
  - No email addresses and no key patterns.
  - No phone numbers. The only 10-digit matches are pieces of `9007199254740992/3` inside a version-number test.
  - The owner's first name appears in the intake, but it was already in the v0.4 tree at the base, and it is not on the spec's PII list.
  - The LexOS private values I cannot check from these two files.
- **"Zero product-code writes before explicit owner approval."** I cannot tell. The only sign in the diff is the `PORTFOLIO.md` line "CYCLE 16 APPROVED 2026-09-17"; no approval ULID appears in any added line.

Not touched: `/api/decide` parity, spine kinds, branch-only writes, the WORK and SESSION doors, provider keys, facts bundles under `face/src/**`, real vs simulated, moods, REQ-10. The `face-l3.bats` import grep was narrowed to `(^|[^[:alnum:]_-])face/src`. Real imports like `../face/src` are still caught, so that is not a weakened lint.

## 1. Built what the spec says?

**Intake**
- **Copy, exclusions, v0.4 move, superseded notes:** satisfied.
  - 108 files in `arcface/`, with no `node_modules/`, `dist/`, `.shots/` or `.gstack/`.
  - Every file from the base `arcface/` is in `arcface-v0.4/`. Autonomy and Portfolio show as identical (R100) moves.
  - The three SUPERSEDED.md notes (`arcface-v0.4/` and explore v1 and v2) are present, and nothing was deleted.
  - Whether the copy matches the `E:` source byte for byte: `SOURCE.md` says so, but I can't confirm it from the diff.
- **PII grep:** satisfied as far as the diff shows. The scan result is recorded in `SOURCE.md` and nothing was excluded.
- **`SOURCE.md` rewrite:** satisfied. It has form, where and what, plus all four corrections.
- **`hq-design-system-v0.7.md`:** present. Whether it is an exact copy I cannot tell.

**Contract**
- **`modules-v2.json`:** satisfied, with the drift in 3d below. It is script-derived with 36 = 29 + 3 + 4, the served ring wins on conflict (0 conflicts), the class field is right, `chat-mcp` and `lane` are listed, and `--check` runs in `tests/face-l3.bats`.
- **`delta-report.md`:** satisfied. It names the three renames, four extras, three served-planned rooms and the two served entries with no v0.7 design.
- **`fixed-defects.md`:** present, one line per defect in the three-part form, and later attacker passes appended to it. Whether it holds every Cycle 15 hole in `initiatives/face/archive/**` I cannot tell: the seed cites fix commits and retro rows, not the archive.
- **`baseline-shots.json`:** satisfied.
  - 72 rows (36 rooms × dark/light), each with a sha256. Viewport 1440×1000 and Chrome 152.0.7977.83 are recorded once for the whole file.
  - The PNGs are in `.playwright-mcp/`, which the root `.gitignore` ignores.
  - Side note: the reference's own default output folder, `arcface/.shots/`, is not ignored inside the repo.

**Harness**
- **`cdp.mjs`:** satisfied. It has its own RFC 6455 client with masking, launch, navigate, evaluate, and the console and exception streams. Searching for a `WebSocket` global finds nothing.
- **`fake-cdp.mjs` + `cdp-client.mjs`:** built, and run by a new test in `face-l3.bats` that needs at least 60 checks. `red-first.md` shows that test on all 5 configurations, but only failing, before the code existed. The diff has no per-configuration evidence of it passing.
- **`smoke.mjs`:** mostly satisfied; see 3g.
- **`face-browser.bats`, items (2) to (7):** satisfied. (7) prints `not-opened=lane`. Item (3) runs in a copy of `face/`.
- **Item (1):** partly satisfied; see 3g.
- **Item (8):** partly satisfied. The RAN line prints and is forwarded to fd 3, and the sharder picks the file up. **"The evidence lists that line per job" is missing:** there is no `ci-jobs.json` and no `smoke-log-excerpts.md` in the diff.
- **Vacuous-pass guard:** partly satisfied; see 3a.
- **No inline program strings:** partly satisfied; see 3b.
- **Main-guards:** satisfied for `smoke.mjs`, backed by the link fixture and a naive-guard control. `cdp.mjs` is a library with no `main()`, so there is no guard to check.
- **Throwing v1 rooms:** the list exists and is "MEASURED EMPTY"; see 3c.
- **Shard weight:** `"face-browser.bats": 350` is committed. Whether `git log origin/main` was run before editing the table I cannot tell.

**Close**
- **CI green per job with head SHA = local HEAD:** I cannot tell from the diff. The committed evidence names run `35186922293` on `65e6ec05`, not on `8542dc02`.
- **Two fresh attackers:** partly evidenced. Commit messages, `fixed-defects.md` entries and pinned tests show attack passes happened. The attacker reports are not in the diff, so I can't confirm the agents were fresh or were given the defect list.
- **`/arc-phase-done 00`:** open, as expected.

## 3. Exit-criteria drift

**a. The vacuous-pass guard was proven at a different layer than written.**
- **Stub control.**
  - Spec: *"a stub smoke that never navigates is kept as the mutant control and FAILs"*, and the Verification plan expects the bats arm to fail `opened=0 openable=33`.
  - Diff: the control is `tests/fixtures/face/smoke-stub-report.json`, a JSON report passed to `judge()` inside `cdp-client.mjs`. The bats arm's own extraction and ordering have never failed against a stub.
  - `red-first.md` shows the red run failing on `ERR_MODULE_NOT_FOUND`, not on `opened=0 openable=33`.
- **Planted page.**
  - Spec: *"a planted page … is opened over REAL Chrome … and the suite FAILs on it"*.
  - Diff: `smoke.mjs --probe-file` runs a separate `runProbe` path, and the suite *passes* when the probe exits 1.
  - That proves the real socket and listeners detect errors. It does not prove the room path (`runSmoke` → counted errors → `judge` → the bats `errors=0` check) fails on a real error.

**b. The inline-program probe was never extended.**
- Spec: *"`tests/embedded-program-probe.mjs` … scans the new files (its `scanned=` count rises), extended if it does not already reach them."*
- Diff: the probe is unchanged. `face-browser.bats` passes the files to it by name, so the count goes up. But the probe only looks for single-quoted `node -e '` and `python -c '`. It cannot see a double-quoted program in a `.bats` file or a `spawn` argument array in a `.mjs` file.
- The extension was pushed to `initiatives/face/debt-ledger.md`, row 1. Today the files do contain no inline programs; I searched for that directly.

**c. The one throw that happened was fixed by changing the browser for every room.**
- Spec: *"otherwise it goes on a named baseline list … never a global relaxation."*
- Diff: the first macOS run opened 0 of 33 rooms because the stage failed to create WebGL. The fix was `--use-angle=swiftshader --enable-unsafe-swiftshader` for every room on every OS (`face/scripts/cdp.mjs`). The product-side guard is debt row 3.
- The assertion was not loosened, but "0 exceptions" now means "0 exceptions on software WebGL".
- Two gaps in the exclude mechanism:
  - `--exclude` is not tied to the delta-report list in code.
  - It drops console errors as well as exceptions.

**d. The contract's `reads` come from a third source typed by hand.**
- Spec: *"derived by a script from `src/hq/roomRegistry.js` + `rooms.generated.json` … v0.7 `reads`"*.
- Diff: `reads` are parsed from `docs/strategy/plans/PLAN-face-v2.md` § 5.2, the plan's planned door routes. I can't tell whether that table is what "v0.7 reads" meant, because reading the PLAN is off-limits to me. The spec should say where `reads` come from.

**e. "Opened" is weaker than v0.7's check.**
- The port counts a room as opened when `section[data-room]` names it (`face/src/App.tsx`). The app shell sets that attribute from routing, whether or not the room body rendered anything.
- v0.7 required a rendered `h1`. A room that renders blank without logging an error now counts as opened.

**f. The per-job evidence is missing.** The spec asks for the RAN line per job, `ci-jobs.json` and `smoke-log-excerpts.md`. The diff's only per-configuration evidence is one sentence in `delta-report.md` quoting the summary line.

**g. Smaller narrowings:**
- **Runner image:** printed by `harness-run.mjs`, not by `smoke.mjs` or bats test (1). The Node 18 job never prints it.
- **The skip rule:** it keys on the Node major version, not the job's identity. A job meant for Node 20 that actually got Node 18 would skip instead of fail.
- **JSON report:** `SMOKE_REPORT` removes `rooms` and `errors`.
- **Chrome lookup:** broader than ADR-1335. It adds `LOCALAPPDATA`, `~/Applications`, `google-chrome-stable` and `/usr/bin`. A set-but-wrong `CHROME_BIN` falls through to another Chrome instead of failing.
- **Stale ledger:** debt-ledger row 4 still says "provisional 200 s", though 350 is committed.

## 2. Scope creep

- **A network-settle gate** in `face/scripts/smoke.mjs` (`NetworkWatch`: 900 ms minimum watch, 300 ms quiet, SLOW past 10 s, FAIL past 30 s). The suite asserts `unsettled=0`. That is a new pass/fail condition no criterion asked for, and its own comment calls it "ours". It is well argued, but it is new.
- **The `vite preview` port change** in `face/vite.config.ts`, which fixes a manual `npm run preview` problem. The harness doesn't need it: it already passes both `--port` and `ARC_FACE_APP_PORT`.

These are fair helpers, not creep:
- the `data-room` attribute and the `proc.mjs`, `node-floor.mjs` and `harness-run.mjs` helpers
- the lockfile check's version, ABI and libc handling
- the new manifest and sync-golden rows, and the comment path updates
- the `face-l3.bats` grep boundary, and `debt-ledger.md`

## 5. User-visible behaviour change

The face looks and works as before; the only change a person would notice is that `npm run preview` in `face/` now serves on the dev port (5180 by default, and refuses if it is taken) instead of 4173, and stamping now works there.

FIDELITY: drift found

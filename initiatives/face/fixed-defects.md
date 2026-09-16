# Fixed defects — the face lane's running list

Every attacker prompt this cycle carries this file, with one instruction: **check each line in
every OTHER file you are shown, not only the file it was fixed in.** A defect fixed in one place
and left in its twin is the lane's most repeated failure (CLAUDE.md, retro-log 2026-08-19,
2026-08-24). Every attacker pass appends its fixed holes here, one line each.

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

Seeded 2026-09-17 (face v2 Phase 00) from Cycle 15's fix commits (`3cb02359`, `a2dec4d8`,
`d107f3e7`, `d77b7e42`, `b0f3a4ef`, `9ea04e48`, `f93a8f84`, `fd5be897`, `846cd95a`, `292f0ce5`, `182d155c`, `60ee2ef6`, `8ea1e09a`) and the
arc-face rows of `docs/retro-log.md`.

## Process lifecycle and CLI

- **Main guard compared `argv[1].endsWith(...)`** and no-opped behind a rename or symlink — `arc-event.mjs` and two gates (`a2dec4d8`, retro 2026-08-19) — *every new script with a `main()`: realpath BOTH `argv[1]` and `import.meta.url`.*
- **No unknown-flag guard; near-miss flags fell through to the worst default** — `arc-dash.mjs` (`b0f3a4ef`) — *every CLI refuses an unknown flag by name with exit 2.*
- **`--flag=VALUE` accepted and silently ignored** — `face-dogfood --journal=DIR` (`b0f3a4ef`) — *a flag form the parser does not read is an error, never a no-op.*
- **A flag consumed the NEXT flag as its value** — `--transcript-dir --dry-run` (retro 2026-08-23, engine) — *a value that starts with `--` is refused.*
- **The door exited 0 when it failed to BIND**; an uncaughtException backstop swallowed it (`b0f3a4ef`) — *a server that cannot listen exits non-zero and says why.*
- **`process.exit()` raced libuv teardown on Windows** (retro 2026-07-16, reintroduced 2026-08-24) — *set `process.exitCode` and let the loop drain.*
- **Pre-flighted the APP port and not the DOOR port** (`b0f3a4ef`) — *any twin resource (two ports, two children, two temp dirs) gets the same check twice.*
- **An inline `node -e` path mangled by sed on the Windows leg** (`f93a8f84`) — *no program text inside a shell string; a path is passed as argv, never interpolated into code.*
- **`npm` spawned through its `.cmd` shim without a shell** on Windows; install ran before discovering the door could not start (`9ea04e48`, `tests/face-l3.bats`) — *spawn npm the way Node permits per OS, and check cheap preconditions before an expensive install.*

## HTTP door

- **Host header never validated (only Origin)** → a DNS-rebinding page reached the door (`3cb02359`) — *every local HTTP surface validates Host AND Origin.*
- **`FILE_ALLOW[id]` resolved inherited keys** (`constructor`, `__proto__`) → 500 with a TypeError echoed (`3cb02359`) — *allow-list lookups use `Object.hasOwn`.*
- **Malformed percent-encoding → generic 500** (`3cb02359`) — *decode errors are a named 400.*
- **`send()` could double-write after a partial response** → `ERR_HTTP_HEADERS_SENT` (`3cb02359`) — *one response per request, guarded.*
- **A sync-throw fix with an un-twinned async sibling** (`3cb02359`) — *fix the async body callbacks too.*
- **`--app-port` silently killed `/api/decide`**: the app's origin allow-list was hardcoded (`b0f3a4ef`) — *a port or origin that is configurable in one place is configurable in every place that checks it.*

## Gates, parsers and selftests

- **A coverage gate checked KEYS, not values; its FAIL message named "regenerate" as the fix**, so regenerating made corruption green (`292f0ce5`, retro 2026-08-19) — *when a generator mirrors a contract, the gate validates values independently of the mirror, and a count pins key-count, never truth.*
- **The route-enumeration gate was circular** — it read back the `mutates` flag it was meant to check (`a2dec4d8`) — *a gate never derives its expectation from the thing under test.*
- **A parity "recompute check" never recomputed**; it asserted two values were equal (`a2dec4d8`) — *a recompute arm calls the computation.*
- **The same day-cut logic lived twice, byte-identical** (`arc-inbox` + `arc-dash`, `a2dec4d8`) — *import the one implementation; never copy it.*
- **A completeness gate's expected set was its own contract keys**, blind to nine surfaces (retro 2026-08-24) — *derive the expected set from the source on disk.*
- **`gather()` was an untested seam** — selftests mutated its output, reader suites drove readers directly (`b0f3a4ef`, retro 2026-08-24) — *one test arm crosses every wiring layer end to end.*
- **A text scanner's comment stripper read `/*` inside a path, a `//` comment and a string**, silently blanking 99 lines (`fd5be897`, retro 2026-08-24) — *a parser reports when it stops scanning; it never goes quiet.*
- **A fixed list of 17 where a derived list belonged** (`roomRegistry` `byRoom`, `b0f3a4ef`), fixed in the renderer and left in the generator (retro 2026-08-24) — *grep the pattern forward into the generator and every consumer.*
- **An exclusion by PREFIX where the stated reason was one file** (`treePlans`, `b0f3a4ef`); exclusion sentences that decayed twice (retro 2026-08-24) — *an exclusion names the file or criterion that makes it true, and its numbers are grepped across docs AND comments when retired.*
- **A malformed id dropped silently** (`adrBandMap`, `b0f3a4ef`) — *malformed input is a named finding, never an omission.*
- **A wrong-shaped source returned an empty inventory** (gates/jobs, `b0f3a4ef`) — *empty because absent and empty because unreadable are different results.*
- **Selftests printed FAIL while passing**, turning CI red on its own controls (`182d155c`) — *a selftest's expected failures are labelled as expected.*
- **A selftest left a bogus registry behind on a tree that had none** (`face-sections`, `b0f3a4ef`) — *a mutant runs in a scratch copy and cleans up.*
- **A torn SPINE line was a footnote while a torn JOURNAL line was a reason**, so five clean days read MET (`b0f3a4ef`) — *the same corruption is handled the same way on both inputs.*
- **`face-dogfood --days abc` read MET over an empty journal and an empty spine** (`b0f3a4ef`) — *a measurement over nothing is UNMEASURED, never MET.*
- **The dogfood harness read a journal directory the door never writes to** (`846cd95a`) — *a reader's default path is asserted against the writer's.*
- **A `phases/` containment check used `isFile()`**, which a symlink passes (`b0f3a4ef`) — *containment resolves realpaths first.*

## Fixtures and numbers

- **A fixture quoted three numbers that could not all be true** (49 / 41 / "the only two") (retro 2026-08-19) — *derive every figure through the owning reader when it is written down.*
- **The coverage suite pinned a summary line that was later widened** (`60ee2ef6`); a third hard-coded count (`8ea1e09a`) — *assert a marker and a floor, not an exact prose line.*

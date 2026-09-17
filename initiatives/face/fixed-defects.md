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

## Face v2 Phase 00 — two fresh attackers + the first CI runs (2026-09-17)

- **A lockfile check inferred the expected set from the siblings present**, so a lockfile stripped to the one Windows binding passed — `face/scripts/lockfile-platforms.mjs` — *the expected set comes from the parent's declaration (`optionalDependencies`), keyed by the parent's own path.*
- **A smoke judged the door's room list against itself** — `face/scripts/smoke.mjs`, `harness-run.mjs` — *the expected set is read from the contract file (`rooms.generated.json`), never from the service under test.*
- **"Settled" could mean 0 ms of watching, and an unsettled room passed** — `smoke.mjs` — *a minimum observation window, a drain after the last item, and "never settled" is a failure.*
- **A test's timeout message matched the close-rejection it claimed to prove** — `tests/face/cdp-client.mjs` — *assert elapsed time and the specific reason, not only the method name.*
- **Round-trip tests ran a codec against itself** — `cdp-client.mjs` — *every length path crosses the independent implementation.*
- **A host `path.join` was used for another platform's lookup** — `face/scripts/cdp.mjs` findChrome — *use `path.posix` / `path.win32` for the platform being asked about.*
- **`existsSync` accepted a directory as an executable, and a spawn error was an unhandled `'error'` event** — `cdp.mjs` — *require `isFile()`, and every spawned child gets an `'error'` listener before anything else.*
- **A registry parser read one line per row, so a wrapped row vanished; `extra: true` inside a string counted as a key** — `.claude/scripts/hq/face-modules-contract.mjs` — *count declarations independently and refuse a mismatch; read keys as tokens, not substrings.*
- **An unparseable plan row became `null` and an unknown mark became "served"** — same file — *every table row parses or is a named error; unknown is never a default.*
- **Repeated flags were last-wins and an empty value resolved to the cwd** — `smoke.mjs`, `harness-run.mjs`, `lockfile-platforms.mjs` — *a repeated or empty flag is refused by name.*
- **A child killed by a signal has `exitCode === null` and was waited out** — `cdp.mjs`, `harness-run.mjs`, `smoke.mjs` — *death is `exitCode !== null || signalCode !== null` (`face/scripts/proc.mjs isDead`).*
- **One SIGTERM, no escalation, and a bats `run` that let children inherit fd 3** — `face/scripts/*`, `tests/face-browser.bats` — *kill the process tree with escalation, destroy the child's pipes, and `3>&-` on every `run` that starts a long-lived child.*
- **A `sleep(5000)` raced against `'exit'` was never cleared** — `harness-run.mjs`, `smoke.mjs` — *a race timer is cleared or `unref()`ed.*
- **A temp directory that would not delete was dropped silently** — same files — *a surviving directory is a WARN naming the path and error.*
- **The door was started from the caller's cwd while the harness read its own repo** — `harness-run.mjs` — *every child that resolves a repo gets `cwd` set explicitly.*
- **`vite preview` listened on 4173 while the origin allow-list followed APP_PORT**, so every stamp 403'd — `face/vite.config.ts` — *a port that is configurable is configured in every server block that checks it.*
- **A greedy `sed 's/.*opened=…'` could read `not-opened=`** — `tests/face-browser.bats` — *anchor each extraction to its position in the line.*
- **A `grep 'face/src'` matched `arcface/src` inside a reference path** — `tests/face-l3.bats` — *a path grep is bounded on the left.*
- **The smoke port dropped the reference's own `THREE.Clock` exclusion** — `smoke.mjs` — *a port keeps the reference's frozen filters verbatim.*
- **A request cancelled by the next navigation reported no `loadingFailed` on Windows**, so no later room ever settled — `smoke.mjs` — *track only the current navigation's `loaderId`.*
- **A lockfile check accepted a binding by PRESENCE where node resolves it**, so a nested `lightningcss@9.9.9` passed on the hoisted `-linux-x64-gnu@1.33.0` it cannot load (CI run `35150543730`) — `face/scripts/lockfile-platforms.mjs` — *what a resolution finds must also be the VERSION the parent declared; a spec the check cannot read fails closed, by name.*
- **The loaderId filter guarded `requestWillBeSent` but not `loadingFinished`/`loadingFailed`**, so a dead page's straggling finish reset the current room's quiet clock — `face/scripts/smoke.mjs` (`NetworkWatch`) — *a filter on one event of a pair applies to its twin; "validate one read, compare another" again.*
- **Requests sent before `Page.navigate` answered with its loaderId were dropped**, so the new document's earliest requests never counted as in flight — `face/scripts/smoke.mjs` (`NetworkWatch`) — *an event that can arrive before the id it is keyed by is held and adopted, never discarded.*
- **"never settled" carried no evidence**, so one red macOS leg could only be guessed at — `face/scripts/smoke.mjs` — *a timeout verdict reports what it was still waiting on and whether it ended later, without changing the verdict.*
- **An ABI suffix the platform regex did not list (`musleabihf`, `ohos`) read as "no ABI", i.e. any libc**, so a musl arm binding satisfied a glibc arm host — `face/scripts/lockfile-platforms.mjs` — *a token parsed from a name is read whole and anchored; an unknown value matches nothing and is named, never a wildcard.*
- **`optionalDependencies` written as an array made its family silently drop out** — `lockfile-platforms.mjs` — *a malformed container is a named finding in the result, never a `continue`.*
- **`*` accepted a prerelease and a 17-digit version compared equal to its neighbour** — `satisfiesSpec` — *a shortcut branch obeys the guards the long branch obeys; a number past MAX_SAFE_INTEGER is unreadable, not rounded.*
- **A finish held during navigation moved the clock even when its request belonged to the old document** — `smoke.mjs` `NetworkWatch` — *a held event is judged by the SAME filter once its key is known, never by arrival time.*
- **A navigation with no loaderId watched nothing and reported quiet** — `smoke.mjs` — *a measurement over nothing is UNMEASURED and fails; `--base` with `?`/`#` is refused so it cannot happen by argument.*
- **The two later `sed` extractions in `face-browser.bats` were still greedy `.*`**, the twin of the anchored three beside them — `tests/face-browser.bats` — *every extraction from one line is anchored the same way; and ids printed into a parsed line are grammar-checked (`openableRooms`).*
- **The door's stderr tail, carrying `#token=`, went into a SetupError and the public CI log** — `harness-run.mjs` `waitHttp` — *every child stderr bound for an error passes through `redactSecrets`; so do page error texts.*
- **One CDP error mid-run threw away every room already measured; room lines printed only after the loop** — `smoke.mjs` — *print each finding when it is final, and catch per item so one failure is a finding, not the end of the evidence.*
- **An awaited `delay()` and `waitExit()` timeout were `unref()`ed**, so with nothing else alive node exited with code 13 before the await resumed — the client suite stopped mid-file with no FAIL line and no `RAN:`, hidden behind run D's lockfile FAIL; `removeDir`'s retry after a dead Chrome had the same exit (CI run `35183482747`) — `face/scripts/proc.mjs` — *an AWAITED timer holds the process; a RACE timer is cleared when the race settles (`settleWithin`); a suite whose output stops before its `RAN:` line is a crash, never read as the FAIL above it.*
- **A 10 s settle FAIL measured runner and CDN weather, not a stuck room**: the macOS first cold load held a Google Fonts download and late CDP events for 11.2 s while every warm room settled in ~0.9 s (runs `35150543730`, `35183482747`) — `face/scripts/smoke.mjs` — *a timing gate FAILS only on what it exists to catch (network that never ends: 30 s cap) and prints the slow middle band as SLOW with its evidence; a threshold is set from measured evidence, never raised blind.*

## Face v2 Phase 01 — two fresh attackers (decision logic · shell/OS boundary), 2026-09-17

- **A gate read only the three exact mood selectors**, so a token re-declared under `html.hq-light.hq`, `HTML.hq.hq-light`, `@supports`, `@media all`, a nested rule, or with `!important` applied in Chrome and passed at 1.46:1 — `tests/face/tokens-contrast.mjs` (`scopes`) — *a gate that reads part of a file refuses, by name, what it does not read.*
- **A comment stripper read `/*` inside an unquoted `url()` as a comment**, hiding the declaration between two urls — `tokens-contrast.mjs` (`stripComments`) — *a CSS scanner honours url() the way it honours strings; the 99-line blanking twin.*
- **A law compared exact RGBA values taken from the file under test**, so a council one step off violet "never renders violet" — `tokens-contrast.mjs` (laws) — *a meaning is checked by the reference it is spelled through AND by an independent property (a hue band), never by equality with the thing under test.*
- **The colour parser accepted `rgb(255 255, 255)`, which Chrome rejects**, and the header claimed 5.47:1 for a pair Chrome drew at 3.30:1 — `tokens-contrast.mjs` (`parseColor`) — *a parser for a browser-read value is exactly as strict as the browser.*
- **The measured pairs came from fixed lists**, so `--focus-ring`, the legacy aliases (`--faint`) and every `--on-X` fill were never measured — `tokens-contrast.mjs` — *every value of a kind carries a declared role, and a value with no role is a finding (the fixed-list-of-17 twin).*
- **Chips were measured over one surface and translucent surfaces composited over bg-0 only** — `tokens-contrast.mjs` — *measure over every backdrop a value is drawn on; a surface is opaque or refused.*
- **Check and `--write` disagreed on CRLF and on markers outside a comment**, and the writer produced a file its own reader refused — `tokens-contrast.mjs` — *a writer re-reads what it wrote before writing it, and both modes normalise the same way.*
- **`face-tokens.mjs` wrote through a symlink or junction onto its own source**, prepending a banner to the source of truth on every run — `.claude/scripts/core/face-tokens.mjs` — *a writer realpaths its destination and refuses its source (the containment-realpath twin).*
- **`face-tokens.mjs` took an empty or a second repo argument and a repeated flag silently, and called `process.exit()`** — same file — *the flag rules above apply to positionals too; exitCode, never exit().*
- **`_` counted as a word character**, so `shadow-[0_0_0_1px_#fff]`, `shadow-[inset_0_0_0_1px_white]` and `shadow-[0_1px_2px_rgba(0,0,0,.5)]` evaded the colour lint — `.claude/scripts/core/face-colour-literal.mjs` — *a boundary class follows the tokenizer of the language read: Tailwind reads `_` as a space.*
- **The palette rule missed Tailwind 4.3's mauve/olive/mist/taupe and any prefix after a hyphen** (`inset-ring-red-500`, `var(--color-rose-600)`, `theme(colors.red.500)`) — same file — *a list copied from a dependency is re-derived from the pinned version, and a pattern matches the family, not a list of prefixes.*
- **Escaped spellings evaded the lint** (`&#35;ffffff`, `\x23ffffff`, `#\66 ff`) — same file — *scan the decoded text as well as the raw.*
- **The function rule judged only the first character of the arguments**, so `rgb(none 0 0)`, `rgb(calc(255) ...)`, `rgb(/**/255,...)` and `rgb(from var(--x) 255 255 255)` passed — same file — *judge a call by every number its arguments carry, alphas excepted.*
- **A missing or re-cased default root, two spellings of one root, a root inside another, and a device as a root all passed or double-counted** — same file — *a root is required, exact-case, distinct, and a real directory; anything else is a named finding or a refusal.*
- **The CSS property `white-space` matched the word white** — same file — *a word rule names its non-colour exceptions and pins them with a near-miss.*
- **`moodHolds` split classes on JS `\s`**, so `hq<NBSP>hq-light` held while Chrome applied no mood — `face/scripts/smoke.mjs` — *parse a browser value with the browser's grammar (ASCII whitespace).*
- **A page error carrying a newline printed a forged `smoke: opened=... mood=light mood-miss=0` line** that the bats verdict passed — `smoke.mjs` (`errorLine`), `harness-run.mjs` — *every free text bound for a parsed log is one line (JSON-escaped); the ids-are-grammar-checked twin.*
- **`judge` passed a report naming no mood, or carrying no expected room set**, and the standalone smoke judged the door against itself — `smoke.mjs` — *a verdict refuses a report that omits what it must measure (a measurement over nothing is UNMEASURED).*
- **One mood's throw skipped the other mood, and `--moods dark` exited 0** — `face/scripts/harness-run.mjs` — *catch per item; a partial run is never a pass.*
- **The build test's "Tailwind scanned the wrong tree" check could not fail for that reason, and `hq-light` was satisfied by the token copy's selector** — `tests/face-browser.bats` — *a failure message names only what its failure proves, and a marker is one only the thing under test emits (`--color-white`).*
- **The face/src mention exclusion matched a basename anywhere, and excused an excused file importing from face/src** — `tests/face-l3.bats` — *an exclusion names the full path and excuses only the reason it states.*
- **The lockfile check's floor was a family COUNT**, so a lockfile stripped of the whole oxide family passed — `tests/face-browser.bats`, `face/scripts/lockfile-platforms.mjs` — *require the families the dependencies need, by name.*

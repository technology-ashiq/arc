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

## Face v2 Phase 02 — two fresh attackers (decision logic · shell/OS boundary), 2026-09-17

- **A lexer's idea of whitespace was narrower than node's**, so `import<EM SPACE>React` and `<EM SPACE>typeof` read as one identifier and the import or keyword vanished from the scan — `.claude/scripts/core/face-pure.mjs` (`isSpace`, `NAME_START`/`NAME_PART` as ECMAScript ID_Start/ID_Continue) — *a scanner of a language uses that language's own character classes; the ASCII-whitespace twin, now in a lexer.*
- **A `//` comment ended only at LF**, so `// x<U+2028>import React` (or a CR) hid a whole statement node runs, and a name could swallow a U+2028 — `face-pure.mjs` (`isLineBreak` in `skipTrivia`, `skipJsxSpace`, strings, regexes) — *every line terminator the language has ends what a line ends.*
- **A percent-encoded relative specifier resolved to one file in the lint and another in node** (`path.resolve` keeps `%2e%2e`, the ESM loader decodes it) — `face-pure.mjs` (`classifySpec`) — *a path checked by one resolver and loaded by another is refused when the two can disagree.*
- **A lookup keyed by data after `}` and a computed key were not lookups** (`{...}[f.state]`, `{ [f.state]: x }`) — `face-pure.mjs` (`scanView`, the `[` rule) — *a rule about indexing covers every token an index can follow, and every way a key can be computed.*
- **A property spelled like a keyword was read as the keyword** (`f.default < x` opened a JSX element, `f.new(x)` skipped the call rule) — `face-pure.mjs` (`prop` on name tokens) — *after `.` a name is a property, whatever it spells.*
- **An `onX` method on any receiver passed as a handler, and an IIFE was not a call** — `face-pure.mjs` (the call rule) — *a permission granted by name is scoped to the receiver it was meant for.*
- **The standalone `!` rule had no test of its own**: deleting it left the suite green — `tests/face/face-pure.mjs` — *every rule has a case only it decides (the vacuous-pass rule, one rule down).*
- **An import path's spelling was checked only below face/src**, so `../../../../SRC/lib/x.mjs` passed on a case-insensitive disk and read as "outside" on APFS — `face-pure.mjs` (`specSpelledExactly`, before containment) — *check every segment the specifier names, and check spelling before containment so every OS gives one answer.*
- **Attaching modules used a plain object**, so a served id `constructor` drew as a module it did not have — `face/src/lib/registry.mjs` (`Object.create(null)`, `Object.hasOwn`); the twin in `rooms.mjs` `byRing` (`RING_LEDE`) — *the `FILE_ALLOW[id]` twin: a lookup by an id from outside uses own keys only.*
- **The browser and the gate classified an exempted ADR-1327 extra differently** (gate: fine; browser: orphan) — `registry.mjs` `attachModules` (third argument), `face-coverage.mjs` `moduleFindings` (`exempted`) — *two readers of one question are crossed on every input the contract allows, not only on today's tree.*
- **The "no shell file names a room" scan read a hand-kept file list** — `tests/face/module-frame.mjs` — *derive what is scanned; exclude by name, with the reason, what is not.*
- **The render verdict counted every module folder**, so an exempted extra the door never serves would turn the browser red while the gate stayed green — `tests/face-browser.bats` (`render_verdict` now takes face-coverage's module-half line) — *a verdict about agreement reads the other reader's answer, not a proxy for it.*
- **A throw inside the proof skipped the scaffold's rollback**, leaving a half-module (an unreadable ring, a name the OS cannot stat) — `.claude/scripts/hq/face-module.mjs` (the proof in try/catch), `.claude/scripts/core/face-coverage.mjs` (`treeModules` walk → UNREADABLE) — *every step after a write is inside the path that undoes the write.*
- **A rollback crashed on a locked file and named nothing** — `face-module.mjs` (`rollback` retries and returns what would not go) — *cleanup reports what it could not clean; it never throws past the verdict.*
- **The scaffold wrote through a linked `face/src`, modules or ring folder**, GREEN with the module outside `--root` — `face-module.mjs` (lstat + realpath containment before writing) — *the writer-realpaths-its-destination twin (face-tokens), for a scaffold.*
- **An unreadable exemption or extras list became "not exempt"**, a refusal for the wrong reason; a modules root that is a file was an unhandled throw read as exit 1 — `face-module.mjs` — *unreadable is exit 2 naming the file, never a default.*
- **A folder name or finding carrying a newline could print a verdict line of its own** — `face-pure.mjs` (`oneLine`), `face-coverage.mjs`, `face-module.mjs` — *the one-line rule applies to names read off a disk, not only to page errors.*
- **`face-coverage` still called `process.exit()`**, racing the pipe that carries the line a caller parses — `face-coverage.mjs` — *`process.exitCode`, as fixed-defects already says.*
- **Nine `ops.mjs` exported `Object.freeze([])` untyped**, and the first `tsc --noEmit` on CI refused them — `face/src/modules/*/*/ops.mjs`, the scaffold template — *a new gate is run over the code written in the same change before it is pushed as green-bound.*
- **A literal NUL written into a test source** made grep call the suite binary; **`\u` escapes written through the editor tool became invisible literal characters** in the lint — `tests/face/face-pure.mjs`, `face-pure.mjs` — *build control and invisible characters from char codes in the source.*

## Face v2 Phase 03 (command ring) — two fresh attackers (decision logic · shell/OS boundary) + the first CI run, 2026-09-17

- **An import on the line after `x++`, `debugger` or TypeScript's `x!` was invisible**, because the import scan asked the ASI heuristic whether a statement began there — `.claude/scripts/core/face-pure.mjs` (`importStatements`: a reserved `import`/`export` outside a property always begins a statement) — *a keyword that can only start a statement needs no statement-boundary guess; the lane's "parser that goes quiet" class, in the shared lexer both lints read.*
- **Literal values outside an object or array literal were never counted** (3,600 exported constants, 1,200 rows of JSX text, calls holding literals) — `.claude/scripts/core/face-facts.mjs` (file totals of leaves and characters) — *a size rule measures every literal the file carries, not only the ones in the shape the author pictured.*
- **"JSON.parse or atob of a literal" saw only a string directly inside the call** (a `+` chain, a template split by `${""}`, parentheses, `globalThis.JSON.parse`) — `face-facts.mjs` — *a text rule judges the text, however it is spelled or reached.*
- **A regex literal could carry any amount of text** (the lexer stored only `v: "regex"`) — `face-pure.mjs` (`raw` on the regex token), `face-facts.mjs` — *every literal kind the language has is a literal.*
- **The stylesheet exception counted uses inside one file** and could be read through an export, a namespace import or single-quoted JSON — `face-facts.mjs` (`styleLiterals`, `JSON_MEMBER`) — *an exemption is scoped to what the scanner can see all of.*
- **A package-style specifier climbed out of face/src through a `..` segment** (`pkg/../../docs/facts.mjs`, in an import, an export-from, an `import()` and a CSS `url()`) — `face-facts.mjs` (`climbs`) — *a containment check applies to every specifier form, not only the relative one.*
- **`require()` and `import x = require()` had no rule** — `face-facts.mjs` — *a loader the rule does not name is a loader the rule does not check.*
- **The fetch rule read only a literal's text** (`/api/../x`, `%2e%2e`, `window.fetch`, a computed `["fetch"]`, `new Request`, `XMLHttpRequest`) — `face-facts.mjs` (`plainApi`, `literalHead`, global bases) — *a network rule covers every way the page can reach the network.*
- **A `.css` file had no blob or JSON rule** while the same text in a style constant FAILed; `@import"x"` with no space and `@import/**/"x"` passed; Tailwind `@plugin`/`@config` were unread — `face-facts.mjs` (`scanStyle`) — *two carriers of one text get one rule.*
- **`face/package.json` fields that map a name to a file were unread** (`browser`, `exports`, `workspaces`, `overrides`, a tarball, a drive or home path, `FILE:` in capitals) and **the lockfile was unread** — `face-facts.mjs` (`checkPackage`, `pathSpec`, `checkLockfile`) — *a resolver's inputs are the lint's inputs.*
- **`vite.config` `define` and `resolve.alias` inlined facts from outside face/src** — `face-facts.mjs` (`checkViteConfig`) — *the build config is part of the bundle's provenance.*
- **A TypeScript return type turned a function body into an "object" literal** and a `?worker` import, a worker `new URL` and a glob `import` option FAILed — `face-facts.mjs` (`isDataBracket`, worker and glob allowances) — *a false FAIL on the platform's standard pattern is a defect too.*
- **A specifier holding a colon (an NTFS stream) and one matching a folder only case-insensitively passed, and `..` resolved from the link path, not the real one** — `face-facts.mjs` (`relativeProblem`, `caseProblem`, real `fromDir`) — *the twin of face-pure's Phase 02 spelling fix, which had not been made here: a fix is applied in every file that resolves paths.*
- **An extensionless import under macOS's `/var` → `/private/var` read as leaving face/src** (CI run 35241805573) — `face-facts.mjs` (`realish`) — *compare a realpath with a realpath: resolve every existing ancestor.*
- **A negated letter range in a new regex** (`[^0-9A-Za-z]`) — `face-facts.mjs` (lookarounds) — *tests/portability.bats's locale-collation rule applies to lint code as much as to shell.*
- **The read host checked one read of a getter and keyed another**, and **a mutable manifest widened its routes after the check** — `face/src/lib/registry.mjs` (`snapshotRead`, a frozen manifest copy) — *"validate one read, compare another", now in the read host: copy once, then judge and use the copy.*
- **An unpaired surrogate or a dot-segment id passed `readProblem` and then threw or climbed in `readPath`**; **a lane named `act` survived `dropReads`**; **a later `poll: true` on a repeated read was lost**; **`notServedOf` missed Map/Set and recursed forever through a getter**; **an act on an undeclared route poisoned every later fold** — `registry.mjs` — *a key's shape, not a coincidence of its fields, says what it is.*
- **After a stamp the room sat on "reading" until the next poll, a poll in flight brought the stamped approval back, and an as-of change hid a stamp that had landed** — `face/src/shell/RoomFrame.tsx` (a read epoch, `dropAll` bumping the load effect, acts not tied to the door's abort) — *a write that reached the door is shown, and a read older than the write is thrown away.*
- **The heading check compared the door with itself, a run that checked zero rooms passed, and an unreadable NOT SERVED count became 0** — `face/scripts/smoke.mjs` (the contract's frozen sentence, a zero floor in `judge`, `panels=unread`), `face/scripts/harness-run.mjs`, `tests/face-browser.bats` (the browser's count EQUAL to the shipped rings' lists) — *a smoke judged against the door it tests is the Phase 00 defect again.*
- **The smoke's `oneLine` and face-pure's left ESC and other controls in a printed line** — `face-pure.mjs`, `smoke.mjs` — *one-line means no terminal control either.*
- **Typecheck errors pushed to CI** (`door.mjs` untyped default, a `never[]` union, an `unknown` argument) — found on CI run 35241805573 — *a typecheck is run over a changed lib before the push that relies on it.*

## Face v2 Phase 03 (kernel ring) — 2026-09-18

Two fresh attackers, one on the decision logic and one on the shell/OS and browser boundary, carrying
this file. 20 holes; every one is fixed below or carries a debt row.

- A 200 that is not a lane, or is a body about ANOTHER lane, drew "reading the lane…" for ever →
  `BAD_BODY` / `WRONG_LANE` refusals with codes (`lane-room.mjs`). The twin of the `BAD_BODY` fix made
  twenty lines above it in the same file: a fix is not applied until it is attacked where it was not made.
- A spine body with no `events` list read as an EMPTY spine ("No receipt of … on the spine") → the
  shape is checked before the count becomes a sentence; `BAD_BODY` names it.
- A file body about another id drew under the requested id's card → `WRONG_FILE`; an empty file read
  as "1 line" → 0 lines.
- A partial page (`more: true`, and the door pages from the OLDEST receipt) was drawn as complete: a
  "last fire", run counts, "drivers seen" and "all time" subtitles → every figure derived from a page
  now says which page it is a figure of, counts carry `+`, and the last fire says it is the newest on
  that page, which has more past it.
- A kind the registry does not home here was counted as `0` → unread (`—`), and the three rooms that
  group run receipts gate on the kind being homed.
- `sourceFile` read `sha256` three times (validate one read, display another) → every field read once
  into a copy, then judged and drawn from the copy. `room.holds` was read 21 times per fold → once.
- A malformed ADR band vanished; a kind carrying a comma WIDENED what the room asked the door for; a
  kind list of the wrong shape was indistinguishable from "homes no kind"; a second lane was dropped
  silently → each is named on screen now, and a kind that is not a kind is never sent.
- `laneCard` threw on `phases: [null]`, taking the whole room to a Failure → unreadable rows are
  dropped and counted in the panel's note.
- A job name escaped in a receipt and decoded in the registry drew the same job twice → names are
  decoded once, on both sides; a job listed twice in the registry is listed once.
- `runsBy` took the last ARRAY ENTRY as the newest run and sliced an unreadable timestamp into a
  clock → newest by timestamp, and a timestamp this shell cannot read prints "time unreadable".
- The lane meter drew 0% for a lane with no measured burn (a progressbar telling a screen reader the
  one thing `burnMeter` refuses to say) → `hasMeter`, and no bar without a measurement.
- `roomLink` counted planned and template rooms as openable, the fourth reader of that question and
  the only one without the filter → same predicate as the rail.
- `laneCard` and the folds unescaped text the shell had already decoded (`&amp;lt;` became `<`) →
  decoded once, where the door's escapes are undone.
- The NOT SERVED list checked three of its four columns, and the fourth had already drifted → the
  sentence is compared too; `verbPending` had no gate at all → `verbPendingOf`, a derived
  `verbs-pending-kernel.md`, a module-frame arm and a per-room browser count.
- The browser compared only the TOTAL number of NOT SERVED panels: a panel deleted in one room and
  duplicated in another passed → both derived lists are compared PER ROOM, in both directions.
- The two readers of an evidence list disagreed by construction (grep breaks on `\n`; a /m regex also
  breaks on CR, U+2028, U+2029) and duplicates were invisible → one reader, held to one row shape.
- `tests/face/cdp-client.mjs` pinned `rings=command` and asserted a kernel room is NOT heading-checked
  → updated, with the negative control re-pointed at a ring no module has shipped in.
- `judge()` had no clause for either derived count, so a page drawing none of them exited 0 → a count
  that could not be read is a refusal.
- A module declaring `/api/spine` while claiming `asOf: false` had its numbers cut by a scrub the
  shell then greyed out → every manifest's `asOf` now matches whether the scrub reaches its routes,
  pinned by a module-frame arm (this moved `board` and `ask-arc` too — the class, not the file).
- Declared, with a debt row each: the page contract beyond the four marks CI counts, and kit
  decisions that `face-pure` cannot see.

## Face v2 Phase 03 (factory ring) — 2026-09-18

One fresh attacker on the ring's new decision logic, carrying this file. 18 findings; the ones that
put a fact on screen the door did not serve are fixed here, three are debt rows with a named pay-down.

- The lane FIGURE read `card.isRead` while the badge read `isRefused`, so a body the panel refused as
  `WRONG_LANE` still drew ANOTHER lane's status in the instrument strip — two readers of one question
  inside one file, the exact class this lane keeps paying for. Both ask `isRefused` first now.
- The trail drew receipts of kinds the room never asked for: `WRONG_LANE` and `WRONG_FILE` were built
  for the lane and file bodies, and the spine body — the one that fills every ring room's trail — had
  no equivalent. `WRONG_KINDS` names it, with both kind lists in the sentence.
- A page whose `count` exceeded the receipts it carried was called complete when `more` was false. A
  count larger than its page is a partial page whatever the flag says.
- `heldAcrossRooms` threw away `heldBy`'s `unreadable`, so the toolbelt's catalogue shrank silently —
  in the room whose own copy says it cannot drift from arc. Every section and every figure it feeds
  reads `—` when a room carried its list unreadably, and the room names which room.
- The two lane-less rooms said the registry homes NO agent / NO gate / NO workflow when it had homed
  one unreadably; the council's badge also bypassed `holdsCount` and `fmtInt`, printing a count the
  strip beside it refused to print. Both say "unread" now, through the same helper.
- A registry row with no id produced an ENABLED button labelled "undefined" that opened `undefined`.
  A row whose room this shell cannot name is dropped and counted.
- A name the registry listed twice was counted twice and drawn under a duplicate React key (the
  catalogue already deduped, one file away); an entry that renders as nothing — spaces, a zero-width
  character — was counted as a thing arc has. Both are gone.
- A section nobody searched printed "nothing here matches": absent, unreadable and unmatched are three
  sentences, and the section now picks the right one.
- The catalogue sorted case-sensitively while the find box folds case, so one command appeared in
  three places in one alphabetical list.
- `hasLane:false` (new this ring, for the two rooms the registry gives no lane) made a MISSING lane
  silent for lane rooms too: the panel drew its title and hint over nothing. It says why now.
- The evidence list's "Routes named by this ring: 4" was prose nothing derived; the count is gone and
  the table is the claim.
- Debt rows, each with a named pay-down in the money ring's PR: `lane-room.mjs` has no unit suite
  (seven mutants of one fold survived every gate); a fold can ask for a read its manifest does not
  declare if the REGISTRY changes under it; the catalogue is rebuilt per keystroke and reads each
  room's holds nine times per fold.

## Face v2 Phase 03 (money ring) — 2026-09-18

Two fresh attackers, one on the ring's decision logic and one on the shell/OS boundary, each carrying this
file. 16 shell findings (5 bugs, 7 test holes) and 18 logic findings plus 7 test holes; at the ring's head
all seventeen mutants the logic attacker built survived every gate. Everything that could put a fact on
screen the door did not serve is fixed here and pinned by `tests/face/money-ring.mjs` (new),
`tests/face/lane-room.mjs`, `tests/face/module-frame.mjs`, `tests/face/cdp-client.mjs` and the browser
suite's new mutant control.

- **A fix claimed one ring ago was not true.** The factory ring wrote that an entry which "renders as
  nothing -- spaces, a zero-width character" is not counted; `trim()` leaves U+200B, the word joiner and
  the soft hyphen standing, so it still was. `heldBy` strips them first and counts a repeated name once.
  The same pass found `planned-room.mjs` decoding the file's strings twice -- the kernel ring's "decoded
  once" rule, broken in a new file.
- The real P&L's substance was trusted by default: `readPnl` calls any body "real" unless it says
  "simulated" exactly, so `model.mode` of "SIMULATED", "sim", missing, or a body that was no P&L at all
  drew as real revenue in green. The real read must name "real" and the simulated read "simulated";
  anything else is `WRONG_SUBSTANCE`.
- An unreadable `/api/health` read as "revenue.received has never fired" -- `readHealth` coerces a
  missing kinds list to an empty one. A health body with no kinds list is refused, and the gate says
  health did not answer.
- Green could be spent on a door reading a simulated spine. The gate now also asks the door's data mode:
  on anything but a live spine, real money's colour stays unspent, whatever kinds the fixture fired.
- A kill panel that measured nothing -- the criteria file unreceipted -- showed "0 kill lines crossed"
  and drew every venture as having "no kill lines" when the file declares them. Its counts are unread,
  no roster is drawn from it, and the refusal is drawn once rather than twice. Which ventures are
  declared now has one reader, the kill panel, not the panel and the registry's inventory.
- F3 reached a planned room by two more routes: the legacy `stateBadge` (the rail's label and a generic
  room's head) still said live for ops, trader, discover and chat-mcp when a homed kind fired, and the
  header's as-of control drew "live" on every room -- a planned one included -- whose numbers have no
  scrub at all. A planned room's badge is "planned" everywhere, and the header draws "live" only where
  the scrub applies.
- The LIVE check matched `LIVE` case-sensitively over a whole room's text, so "● Live" passed and prose
  tripped it. It is now a pill-shaped rule -- a short text saying live as a word of its own, in any case,
  invisible characters removed -- shared by the smoke (in the page) and module-frame (in the folds),
  which also refuses a boolean named for liveness.
- The planned verdict counted rooms, not which rooms: one losing its mark while another gained one
  passed. The smoke compares the contract's planned ids to the marked ones.
- The runner class was wider than the one line it names and had no ceiling: any `console.error` or log
  text merely CONTAINING the phrase was excluded on windows, and five hundred of them would have passed.
  It is now Chrome's exact log line, whole, on win32 alone, at most two in one room per mood --
  `classifyErrors` is the one filter, and a test holds it. The largest-body line could not see the body
  the class exists to measure: a failed load reports no size, so its bytes are summed as they arrive.
- The rehearsal list was required for the command ring, whose planned room (chat-mcp) has no module; the
  CI red run caught it. A stray list file for an unshipped ring would have widened what the browser is
  judged against; module-frame now fails one, and a list must end with a newline because the browser
  suite reads each kind in one stream.
- Lists were compared as SETS, so a card a fold returned twice was invisible; they are multisets now.
- Also fixed: a receipt with no kind, or a kind with a trailing space, passed `WRONG_KINDS`; a page
  counting fewer receipts than it carried drew both numbers; a timestamp shaped right with no real instant
  won "newest", and the date printed came from a second field; a lane or kinds list carried unreadably
  read as "no lane" / "no trail"; a planned list with a damaged entry printed its short count; the seal
  rule matched one spelling of "(the word)"; two planned rows, unreadable rows and an empty room id each
  fell to a guess; a room id outside the grammar linked another room's rows; a refusal said "the door
  refused" when the module's own manifest had; the heading floor refused 28 and 29.
- Accepted, with reasons: the header's data-mode chip ("Live spine" on a live door) names the door's mode
  for every room and is not the room's pill, so the F3 scan stays inside the room; a CRLF smoke line
  would compare differently on windows, but the smoke never writes one. Carried as debt rows: the browser
  suite's "no inline program text" grep catches only `node -e` (a Phase 00 gate, widened in its own
  change).
- The first CI run on the fixed tree (arc-ci **35317532261**, 12bf81c3) was red in six jobs on two
  defects of the fix batch itself, read per job: the browser suite's own @test floor still said 10 after
  the batch added its eleventh test (the floor is the guard against bats dropping a test, and it did its
  job), and `money-room.mjs` read the health payload's key as the quoted string `"spine"`, which the
  module frame's shell scan reads as a room named from shell code. The floor now says 11, and the key is
  read as a property, so the scan has nothing to excuse; the scan's exclusion list was not widened.
- The shot review (0 VIOLATION, 0 BELOW-BAR) found three WEAKNESS rows; all three are paid in this PR,
  not carried: the ventures stat tiles repeated one refusal code three times (the cause is now named on
  the first tile only, and a test holds that), and the header's as-of field showed its `dd-mm-yyyy` mask
  in every shot (live now draws a `pick a day` button, and a room that is not day-scoped says so in the
  field's place -- the command ring's debt row for the same mask is paid with it). The review's
  "review-ship AGENTS still dim" reading is a viewport effect, not the kit: `Holds` draws every group in
  one ink, and that row sits under the dock's bottom gradient at 1000 px.

## Face v2 Phase 03 (company ring and the four extras) — 2026-09-18

Two fresh attackers, one on the decision logic and one on the shell/OS boundary, each handed the lane's running
list of fixed defects with the instruction to try every class again in the new files. The logic attacker found 13
holes (2 HIGH, 6 MED, 5 LOW, 11 of them putting an unsupported fact on screen); the shell attacker found 10
(0 HIGH, 2 MED, 8 LOW). Every one is fixed and pinned in `tests/face/company-ring.mjs` (the `ATTACK` checks),
`tests/face/cdp-client.mjs` (the extras verdict) or `tests/face-browser.bats` (the heading and extras mutant
controls); none is ledgered.

- **The parser that goes quiet, again (HIGH).** A constitution section written in a shape the reader could not
  read -- articles as `###` headings, prose where a list was expected -- printed "0 Working articles"; a logbook
  glance table with a column removed printed "0 Initiatives" and the false sentence "carries no glance table".
  The readers now answer ABSENT, UNREADABLE or read, never two: an unreadable section is "—" with its own
  sentence, a malformed table row is counted, never dropped, prose is read as its paragraphs, and a dash is read
  as well as a middle dot between an article's id and name.
- **One entry's code beside another's date (HIGH).** The story's lag paired the first coded chapter with the
  newest date across all entries, and the book's two C6s and two C7s hid the lag entirely. The newest chapter is
  now the entry with the latest REAL calendar date, named with its own code, and the lag counts the glance rows
  with no chapter by code AND name.
- **F1's band map (MED).** Any backticked token at the start of a band cell became a lane: `model-policy`'s,
  a room id, the device name `con`. A lane is now a name that stands as the row's owner, passes the lanes rule,
  and is on the board; any other name is drawn as what it is and listed. A malformed band row, a century claimed
  twice and a second table in the section are named rather than silently dropped, merged or counted.
- **Board rows (MED).** A nameless, path-like or repeated lane became a live plan with a path like
  `initiatives//PLAN.md`. `boardLanes` keeps each lane once, each a lane name, and the rest are counted out loud.
  Lanes now link through the room that homes them, so `engine` opens the engine room.
- **Two readers of the exemption rows (MED).** The shell drew a row the gate refuses -- a ring its module is not
  in, or no module at all. `withExtras` now takes the modules the bundle found and draws an extra only where its
  module lives, naming every row it leaves out. The shell also held nothing of the refusal: a door that does not
  serve the file left the extras missing from the rail without a word, and a deep link said "There is no room
  called executor" from a failed read. The rail now says the extras are not all drawn, and a deep link says the
  rows are unread or refused, never that the room does not exist.
- **A partial roster (MED)** drew 18 of 30 agents silently when one room's agents were unreadable; it now says
  it is partial beside what it draws. An agent homed twice is counted once.
- **The adoption line (MED)** glued any later blockquote onto "Adoption status"; it now reads to the end of its
  own quote only. The version is the document's own title line, never a later heading.
- **Invisible names (LOW)** passed both the gate and the shell; both now strip invisible characters first.
- **`fileText` read the body twice (LOW)** -- validate one read, draw another: a getter could pass as one file
  and draw another's text. The body is copied once, field by field, and both provenance and text come from the
  copy. `extraRooms` does the same and requires the file's path and hash.
- **The glossary (LOW)** counted non-object entries as terms and an empty station as a station, and read a term
  homed in the lane-room template as homed. Each is fixed and counted.
- **Dates (LOW)** were shape-checked only; `2026-19-45` won "newest". `realDate` round-trips the calendar.
- **The smoke (MED, LOW).** `judge()` passed a report with no extras block, an opened room the file does not
  list, and a repeated id; each now fails, and the line counts distinct ids. `expectedExtras` accepted an id
  listed twice (the shell kept the first copy, the smoke the last); it is now a setup error, as a repeated served
  id is. The extras were excluded by the openable list, so a row naming the lane-room template became an extra;
  they are now excluded by every served id. The heading check undid a door escape the exemption file never had;
  the smoke now escapes the row's sentence the way the door would, and module-frame feeds the shell's reader the
  door-escaped text.
- **The browser verdicts (MED, LOW).** `tests/face/company-ring.mjs` ended with `process.exit()`, the pipe race
  fixed twice before; it sets `process.exitCode`. The heading check grepped every line, so a miss followed by a
  clean line passed, and Git Bash accepted a carriage return that Linux rejected; `heading_verdict` now reads the
  LAST heading line in pure bash -- no grep and no command substitution, both of which strip a carriage return on
  Git Bash -- refuses a CR on every OS, and has seven mutant controls. `extras_verdict` refuses zero-padded counts
  and a rooms field that does not name as many rooms as opened. The fd-3 progress echo now carries the extras
  line, and face-coverage.bats reads the exemption count with an anchored pattern.
- **Found by the ring's own CI run, not an attacker:** five suites red on test fixtures the ruling moved -- the
  scaffold suite's refusal ran on a tree that now carries the extra's row and folder, the contract suite counted
  four extras, module-frame's agreement test added a second copy of an extra the tree already has, cdp-client's
  heading line named four rings, and the factory verbs list carried a sentence changed after it was derived.
  Each fixture now builds from the tree it tests.
- **Found while writing the fixes:** two edit scripts lost a regex backslash (a quoted heredoc and an inline
  program), and one inserted `$'` into a replacement string, which `String.replace` expands. Every edit since
  goes through a script written with the file tool, with function replacements.

## Face v2 Phase 04 (door read routes) — two fresh attackers (decision logic · HTTP/OS boundary) + the first CI run, 2026-09-18

- **A shared lib helper indexed a door body by a served room id** (`k["ventures"]`) — the first CI run's one red, all five legs, `face/src/lib/served.mjs` — *no room id literal in a shell or lib file, even as a data key; a room's own projection lives in its module's fold.*
- **Validate one read, serve another, at the door**: `fileAt` hashed a file, then the lane parser re-read it by path (`loadJobs`, `loadCaps`, `readCeilings`, the kill panel); 722 of 4,100 polls served one version's sha beside another's data — `reads.mjs` — *parse the text you hashed; where a lane parser takes only a path, read before and after the call and refuse (SOURCE_CHANGING) when the bytes moved; compare the kill panel's digest with the parsed file's.*
- **Lane and loader messages forwarded verbatim** carried `C:\Users\<account>\...` into 503 and 200 bodies; an untyped error answered 500 with its message — `reads.mjs` (`lib`, `invalid`, `budgetsRefused`), `arc-dash.mjs` INTERNAL — *never forward a message you did not write: scrub it or name the code; INTERNAL answers a fixed sentence and logs the detail.*
- **Directory walks with no containment and no type check**: a junction at `docs/adr` or `phases/` served off-tree content; a file where a directory belongs was a 500 — `reads.mjs` (`contained`, `dirAt`) — *every file AND directory a route reads is realpath-contained and type-checked, exactly as `lanePhases` is.*
- **A spine line that parses to a non-object (`null`) was kept as an event** — every consumer reading `.kind` threw; 12 routes answered 500 — `spine.mjs` scan and the sqlite read path — *a JSON line that is not an object is torn, in every engine.*
- **An address written where a lead id belongs, and paths in free-text receipt fields, reached the wire** — `reads.mjs` — *serve an id only when it matches its lane's own grammar (`LEAD_ID_RE`); scrub every free-text receipt field.*
- **A test-only env door swapped the file a server served** (`ARC_BENCH_CEILINGS`, `ARC_VENTURES_FILE`) while `sources` named the tree's file — `reads.mjs` — *a server refuses an env override of its sources by name.*
- **A repeated query key or an off-set value was silently resolved**: `?simulated=true` answered the REAL model — `arc-dash.mjs` apiPnl — *a key given twice, or a value outside its set, is BAD_ARGS.*
- **The serializer recursed without a cap and ASSIGNED keys** (`__proto__` dropped) — `arc-dash.mjs` escapeDeep — *cap depth with a sentence; define keys, never assign them.*
- **A wrong-shaped source read as empty**: jobs as a mapping, a misspelt `gates:`, a router with no tiers drew "declares no …" — `reads.mjs` — *a required list or mapping that is absent is SOURCE_INVALID, never `[]` (twin of the Phase 03 gates/jobs defect).*
- **A fold ignored a count the door served about what it could not read** (`errors`, `conflicts`, `strayArms`, `damaged`, unmeasured cost lines, torn spine lines) — develop, evolve, money folds and `served.mjs` — *every count a body carries about what was not read is drawn.*
- **A KPI counted the raw list beside a table that refused or dropped entries** — model-policy, executor, learn — *a figure beside a table counts what the table drew.*
- **The door folded receipts the owning lane screens first** (evolve's `admit`) — `reads.mjs` — *where a lane screens receipts before folding, the door screens with the same function.*
- **The door re-decided a guard's call** (a touch after the clock read as outside the window) — `reads.mjs` leads — *surface the lane's refusal classes; never re-decide them.*
- **V8 rolls 2026-09-31 into October 1** — `deriveDaily`, `/api/learn` — *a date is real only if it round-trips.*
- **The tests: 20 of 21 decision mutants survived**, a panel could sit in both derived lists, and the by-day arm asserted a window holding no data — `tests/face/phase04-folds.mjs` (new), module-frame, dash-doors — *pin each decision with a body shaped to kill its mutant; check derived list pairs disjoint; a series test puts fixture data inside the window it reads.*

### Round 2 — the same two attackers re-run against the round-1 fixes, carrying the list above, plus the CI red on 4cfc7002

- **The twin of a fixed hole, left open one route over**: `/api/ventures` refused `ARC_VENTURES_FILE` and made the kill path repo-relative; `/api/pnl` served the same `deriveKillPanel` result raw, with `C:\Users\<account>\...` in `kill.path` — `arc-dash.mjs` apiPnl — *a fix to a shared deriver's output is applied at EVERY route that serves it; grep the deriver's name, not the route.*
- **The resolver's answer was passed through**: `arc-profile.sh mode` echoes a settings value it does not validate, and an address reached the wire as a gate's mode; `ARC_SETTINGS` pointed it at another file under this tree's name — `reads.mjs` apiGates — *serve only the closed vocabulary (`warn`, `block`); refuse the env override of a SOURCE by name, as `ARC_BENCH_CEILINGS` already was.*
- **A path stopped at its first space**: `C:\Users\John Smith\...` served `Smith\...`; `file://` and UNC shapes were not paths at all — `reads.mjs` scrub — *withhold from the first absolute-path start to the end of the text; over-withholding a sentence tail is the recoverable direction.*
- **Validate one read, compare another, again**: the round-1 `readStable` re-read the file around a path-taking parser, and a writer between the two reads still paired one sha with another's data — `reads.mjs` — *parse a temp COPY of the exact bytes you hashed (`readCopy`); a parser that takes only a path never sees the live file.*
- **Envelope fields passed through unvalidated**: an `id` that is not a ULID and a `ts` in another shape reached every table — `reads.mjs` — *every envelope id and ts is served only in its grammar (`idOf`, `tsOf`).*
- **A receipt with no payload object reached the lanes' folds**, which read its fields and threw — `reads.mjs` spineRead — *a receipt is an object with a kind AND a payload object; anything else is skipped and counted, like a torn line.*
- **A lane's fold threw and the door answered 500** — `reads.mjs` (`laneFold`, `laneFoldAsync`) — *a lane function's throw is that lane refusing its input: SOURCE_INVALID, scrubbed, never INTERNAL.*
- **A misspelt `levels:` drew a ladder with no rung** — the parser accepts unknown keys, so the door's check is the only one — `reads.mjs` apiPolicy — *a required mapping is required at the door even when the parser is lenient (third twin of the round-1 required-list line).*
- **A junctioned lane vanished from the develop table**: `Dirent.isDirectory()` is false for a junction, so the filter dropped it before containment could name it — `reads.mjs` apiSlices — *keep links in a listing and let containment decide; a filter before the fence hides what the fence should refuse.*
- **One ts-less cost line was counted under both substances** — `pnl.mjs` deriveDaily, `arc-dash.mjs` by=day — *count revenue rows per call and cost lines once; name each unplaceable count by what it counts.*
- **A fold drew a refusal the door had named as an empty state** (`kill.refused` read as "ventures.yaml is not on this tree"), and three counts the door served were not drawn (`unplaceable`, learn's and today's `malformed`) — board, money, learn, today folds — *every refusal and every count a body carries is drawn; round 1's rule, applied to the fields round 1 added.*
- **A note set the unplaceable sends BESIDE today's figures** when the lane counts them IN every window — leads fold — *a note about a lane's count uses the lane's arithmetic, read from its code (`guard.mjs foldSends`).*
- **A shell file named a served room as a data key, twice** (`ventures`, then `spine` as `body["spine"]`) — `served.mjs` — *the module-frame scan reads keys too; name the field for what it holds (`unreadLines`).*
- **A negated letter range in a sanitizer** (`[^A-Za-z0-9_]`) — the portability gate's locale-collation trap — `reads.mjs` lib() — *a positive whitelist, tested whole (`/^[A-Za-z0-9_]{1,64}$/`), never a negated range.*
- **The tests: 5 more mutants survived round 1's suite** (evolve without `admit`, the day clock, the learn week's real-day filter, the seal order, the day series' two reads) — `tests/face/phase04-folds.mjs` — *each pinned by a check built to fail when its decision is removed, with a positive control where the check is an absence.*

### Round 3 — a fresh verification pair against the round-2 fixes, carrying both sections above

- **The twin one layer DOWN the stack**: every Phase 04 route scrubbed its own refusals, and the door's shared catch forwarded any other typed error verbatim -- NO_VENTURES answered 500 with the account path, and a brief child's stderr rode out as BRIEF_FAILED — `arc-dash.mjs` catch — *scrub at the one place every refusal passes, not in each route that raises one.*
- **Phase 04's rules held on Phase 04's routes only**: the door's older routes kept serving a sim spine's root and the journal as machine paths (`/api/health`), read `/api/file`, `/api/lane` and `/api/board` with no containment (a junction served another tree's retro log and a LIVE lane), answered 200 to unread and repeated keys, and took an asof that is no day — `arc-dash.mjs` — *a door-wide rule (ADR-1312) is checked on every route of the door, not on the routes a phase added.*
- **The resolver was fed another repo**: `GIT_DIR`/`GIT_WORK_TREE` in the door's env pointed `arc-profile.sh` at a different repo's settings — `reads.mjs` profileSays, `arc-dash.mjs` shellBrief — *a child the door runs inherits the door's env minus git's location variables (`childEnv`).*
- **Path shapes the scrub did not know**: `/c/Users/...` (Git Bash), `/cygdrive/c/...`, a lowercase `\users\`, a drive glued to a word (`failedC:\Users\...`) — `reads.mjs` ABS_START — *a drive and a backslash is a path wherever it starts; match case-insensitively.*
- **A shape check where a real-day check belongs, twice more**: `tsOf` served `2026-02-31T10:00` and `deriveDaily` let a `2026-06-31` receipt fall into no bucket and no count — `reads.mjs`, `pnl.mjs` — *the round-1 real-day rule applied to every date a door serves or buckets, grep `slice(0, 10)`.*
- **The lane's free-text field rode through a field the door never checked**: `leads[].last` served a `submitted_at` carrying an address and a path because the lane's day check reads ten characters — `reads.mjs` apiLeads — *a ts the door serves goes through `tsOf`, whatever the lane accepted.*
- **The junction twin, again**: `apiEvolve` filtered products on `isDirectory()` before containment could decide — `reads.mjs` — *round 2's apiSlices line, in the one other directory walk that had it.*
- **A day file the reader could not open was skipped**: 35 of 90 receipts missing beside `torn: 0` — `spine.mjs` scanAll — *an unopenable day file is reported (`unreadable`), counted by the door, and drawn; the spine room never says "every line parsed" over it.*
- **A bad test clock hung the door**: an unreadable `ARC_SPINE_NOW` threw outside the request's catch, so every authenticated read hung — `arc-dash.mjs` boot — *read the clock at boot and refuse by name; a body built on a forced clock says so (`clockForced`).*
- **A fold drew a count the lane never computed, or dropped one it did**: disabled and unreadable-cadence jobs read "0 missed"; a closed experiment read its old verdict; the council's excluded outcomes, model-policy's router faults and the kill panel's future-dated revenue went undrawn — scheduler, evolve, council, model-policy and board folds, `/api/ventures` — *draw what the lane's own renderer draws, in its order; a question the lane did not ask is "—".*
- **The tests: 29 of 52 mutants survived round 2's suite** — `tests/face/phase04-folds.mjs` (130 checks) — *every round-1 and round-2 fix now has a check that fails when it is removed; the one that cannot be killed deterministically (the private-copy parse, a race) is a debt row.*

### Round 4 — a narrower pair on the round-3 diff alone

- **A fix in a helper no screen calls**: the spine room's "every line parsed" was corrected in `lib/spine.mjs tornView`, which nothing rendered, and its check passed on text no room drew — `command/spine/fold.mjs` (and `tornView` deleted) — *fold the ROOM in the test, never a helper; a lib function with no production caller is dead code carrying a second copy of the judgment.*
- **A boot check narrower than the call that fails**: the clock was validated with `nowMs()`, and a value it accepts (year 33658) broke `formatIst()` inside every request's error path — `arc-dash.mjs` boot — *validate the exact call the hot path makes.*
- **Round 3's rules applied one step short**: an empty filter value (`?kind=`) read the whole log, and `date` was never held to a real day; `/api/rooms` was left unfenced; `/api/file` fenced the resolved path and read the unresolved one (a flipped junction served another tree in 3 of 41 reads); `childEnv` dropped `GIT_*` and not `BASH_ENV`, `NODE_OPTIONS` or the source overrides; `/api/ask` spawned with the full env — `arc-dash.mjs`, `reads.mjs` — *a rule closed on one route is checked on every route of the door in the same commit.*
- **Path shapes, again**: `failedC:/Users/...`, `//server/home/...`, and a SIBLING of the repo cut to its tail (`-evil\x`) by the repo-prefix strip — `reads.mjs` scrub — *strip the repo only at a separator; a forward-slash drive is a path unless a second slash makes it a scheme.*
- **"Not asked" has more than two states**: the scheduler drew "0 missed" for an unreadable last receipt and for a never-run job the spine gives no window — `reads.mjs judged`, `scheduler/fold.mjs` — *read every branch of the lane's own function, not the first two.*
- **A caveat the door carried and a room dropped**: the day series skipped unopenable day files silently; the council note dropped `pending` above the floor and out of the lane's order; the org room missed the board's off-tree rows — `arc-dash.mjs` by=day, council, org folds — *the same count on every surface that shows the same thing, in the lane's order.*

## face v2 Phase 05 -- the work door (PR 1, two fresh attackers, 2026-09-19)

- **A receipt found by "newest of the kind" is anybody's receipt**: six concurrent captures came back with each other's ids, and a tool that wrote nothing was credited with another writer's event -- `lib/face/work-door.mjs findReceipt` -- *attribute by the id the TOOL PRINTED, checked on the spine for kind, process and newness; no printed id, no receipt, never a guess.*
- **A reader on engine "auto" reads a stale index**: once arc-replay built `derived/state.db`, every apply read "no receipt" and the owner would run it again, paying twice -- `work-door.mjs` -- *a read that must see a write made a second ago names the scan engine.*
- **Name filters compared case-sensitively on an OS whose env is not**: `git_dir`, `node_options` and `arc_settings` in lowercase passed `childEnv` and the child honoured them on Windows -- `reads.mjs childEnv` -- *normalise case before every env-name comparison.*
- **A timeout that kills the child and not its children**: bench's driver kept running, and spending, after the door called the run over -- `work-door.mjs runTool` -- *kill the TREE: a detached POSIX group and -pid, taskkill /T on Windows.*
- **A dry run's `=` form fell into hook mode**: `--dry-run=0` was refused by pushing an error but not marking the run a dry run, so the refusal quarantined -- a WRITE from a command that asked for none -- and exited 0 -- `arc-event.mjs walkArgs` -- *every spelling of a safety flag sets the flag, including the spelling that is refused.*
- **An env override silently turned a door "live"**: `ARC_SPINE_ROOT` with no `--spine` pointed live mode at a scratch spine, and live mode is the one that lets a paid op spend -- `arc-dash.mjs` boot -- *a door over a named spine is sim mode; the override is refused by name in live.*
- **Last-one-wins JSON bodies**: a duplicate key in an op body was accepted -- `arc-dash.mjs` (op routes parse with `parseStrictJson`) -- *the repeated-query-key rule applies to bodies.*
- **"One line" that allowed ESC, VT, FF and U+2028**: an ANSI clear sequence reached the spine -- `face-ops.mjs ONE_LINE` -- *one line refuses every `\p{Cc}` and the Unicode line breaks, not only CR, LF and NUL.*
- **A path argument read with no fence**: the growth seal opened a UNC share, blocked on a pipe or read an unbounded file whole -- `arc-growth.mjs cmdSeal` -- *a path a caller supplies is checked before it is opened: no `\` or `//` prefix, a regular file, a size cap.*
- **An unbounded fragment beside a capped buffer**: output with no newline grew the pending line past the cap everything else obeys -- `work-door.mjs runTool` -- *cap the line as well as the buffer.*
- **Output dropped by a cap with nothing saying so**: a plan's and a refusal's first lines vanished silently -- `work-door.mjs`, `lib/ops.mjs`, `OpsDock.tsx` -- *every body carries what its cap dropped, and the page draws it.*
- **A stale answer landing on a newer card**: an edit during planning let the old plan come back, and a late apply refusal landed under a newer plan -- `OpsDock.tsx setValue`, `lib/ops.mjs applyFailed` -- *every async answer is keyed to the attempt or plan it was for; fields lock while a plan or a run is live.*
- **An op id whose room half disagreed with its room passed coverage** -- `face-coverage.mjs opFindings` -- *an id that encodes a place is checked against the place.*
- **`process.exit()` in a new CLI** -- `face-ops.mjs` -- *set `process.exitCode`; the Windows teardown race is still live.*

### PR 2 -- the same two surfaces re-attacked, carrying the list above (round 2, 2026-09-19)

Every row here is a TWIN: a PR 1 fix applied in the file the attacker named and left open one file over.

- **The stale-index read, one file over**: the work door read receipts by scan, and the inbox, `decide` and every other door read stayed on "auto" -- after one `arc-replay` an approval an op had just raised was not in the inbox and `decide` answered UNKNOWN_APPROVAL -- `arc-inbox.mjs loadApprovals/decide`, `arc-dash.mjs` boot (`ARC_SPINE_ENGINE=scan` for the door, its libraries and its tools) -- *a read that must see a write names the scan engine, in every reader of that write, not in the one that was attacked.*
- **"Newest of the kind", one tool over**: bench credited an attempt with the newest `run.completed` since its snapshot, so a concurrent face ask was committed against the cap (35 rupees against a mock run) -- `arc-run.mjs` prints `arc-run: receipt run.completed <id>`, `arc-bench.mjs runAttempt` takes that id -- *attribution is by the id the writer named, in every consumer of a shared kind.*
- **An empty value read as an absent one**: `--spine ""` and a trailing `--spine` fell through `if (flags.spine)` to LIVE mode -- `arc-dash.mjs` flag loop (no value, a flag as a value, a repeat and a bare word are each refused) -- *a value flag without a value is an error, never a default.*
- **One test door refused, four left open**: `ARC_SPINE_ROOT` was refused in live mode and `ARC_SPINE_NOW` reached the tools, sealing a real idea into a past day's file -- `arc-dash.mjs` live boot refuses all five test doors -- *refuse the CLASS the comment names, not the member the attacker used.*
- **Strict bodies on two routes, lenient on the write**: `/api/decide`, the door's one direct spine write, recorded "approve" from a body whose first verdict was "reject" -- `arc-dash.mjs parseBody`, one parser for every POST -- *a parsing rule is a property of the door, not of a route.*
- **Case-sensitive env deletes, one tool over**: bench's `gitEnv` deleted `GIT_DIR` and kept `git_dir` -- `arc-bench.mjs gitEnv` -- *normalise before comparing, everywhere a name is filtered.*
- **The execFile timeout, one route over**: `/api/ask` ended arc-run alone on timeout -- `arc-dash.mjs apiAsk` runs through `runTool` -- *every child the door starts is ended as a tree.*
- **A late refusal still landed**: `applyFailed` turned any card holding no plan into an error, replacing the tool's own plan refusal -- `lib/ops.mjs applyFailed` -- *a card that did not send the call ignores its answer.*
- **Characters split across chunks**: each chunk was decoded alone, and a split euro sign became three U+FFFD -- `work-door.mjs runTool` (a StringDecoder per stream) -- *decode a stream, not its chunks.*
- **A descendant outliving a settled run**: a tool that exited left an in-group grandchild running -- `work-door.mjs` finish ends the POSIX group whatever the exit (Windows and `setsid` remainders are debt rows) -- *a run is over when its tree is.*
- **Ctrl-C orphaned a running tool**: "exit" does not fire on a signal -- `work-door.mjs` SIGINT/SIGTERM handlers, armed only while a tool runs -- *a cleanup on exit covers the signals too.*
- **Check-then-open on a caller's path**: the seal stat the name and then read it, so a swap put a FIFO or a growing file behind it -- `arc-growth.mjs readArticleBounded` (one fd, fstat, O_NONBLOCK, a read one byte past the cap) -- *decide on the descriptor you read from.*
- **Usability refusals**: a tab refused with no name, a Tamil text refused in bytes while the owner counted characters, a bidi override accepted, CRLF JSON refused -- `face-ops.mjs validateInput`, `lib/ops.mjs fieldCount`, `arc-dash.mjs parseBody` -- *a refusal names what it refused, in the unit the owner sees.*

### PR 2 -- its own two fresh attackers, carrying every row above (2026-09-19)

- **A settle that waits on the pipes**: a descendant that left the tool's group while inheriting stdout held the run open past its own timeout -- `work-door.mjs runTool` (after exit or timeout, the pipes get a 2 s grace, then the run ends with what arrived) -- *a run ends when its tool does, not when the last holder of its pipe lets go.*
- **A directory stamp for a file's change**: `phases/` and `docs/adr` were statted as directories, whose own stat does not move when a file inside is rewritten -- `reads.mjs apiPulse` (entry by entry) -- *fingerprint what changes, not its container.*
- **A watch list written by hand**: the gates file, the rooms registry, bench's ceilings, the leads config and the product manifests were read by rooms and watched by nothing, and those rooms do not poll -- `reads.mjs contained()` records every source a route reads; the pulse stamps them all -- *the watch list is the read list, recorded where every read passes.*
- **A pulse used up by a read in flight**: a read begun before the change landed the old answer and nothing re-read it; the abort-and-restart consumers starved a read slower than the pulse -- `registry.mjs pulseDirty/readsToLoad(force)`, `RoomFrame.tsx`, `shell/usePulseRead.ts`, `App.tsx` -- *mark the read in flight and run it again when it lands; never abort a read for a pulse.*
- **A failed re-read replacing a good answer**: pulse re-reads meet half-written sources, and the panel flipped to an error -- `registry.mjs keepOnRereadFailure`, `usePulseRead` -- *a re-read that fails keeps the last good answer and says so.*
- **The empty-value hole, one file over**: `arc-face --spine ""` booted a live door, and repeats took the first -- `arc-face.mjs flagValue` -- *the twin of the arc-dash flag fix; grep the pattern in every launcher.*
- **A value checked for presence, not validity**: `arc-dash --port abc` threw past the bind handler and exited 0 with nothing bound; `0x10` bound port 16 -- `arc-dash.mjs boot`, `arc-face.mjs portValue` -- *a port is decimal digits in 1..65535.*
- **Four test doors refused, the rest of the class open**: `ARC_DRIVER_FAKE`, the mocks, the leads fakes and clock, the absorb seal dir reached a live door's tools; `ARC_SPINE_ACTOR`/`PROCESS` could rename who acted -- `arc-dash.mjs` live boot, `reads.mjs childEnv` -- *refuse the class by the list every lane keeps, and strip identity overrides from the owner's click.*
- **One overflow refusing another stream's answer**: a failed driver's long stderr threw away a complete, paid ask answer; the new cap was also smaller than execFile's -- `runTool` counts drops per stream and takes a cap; `/api/ask` refuses only stdout's, at 4 MiB -- *a cap belongs to the stream it bounds.*
- **The one-line class, left open by its own field and by the decision**: the article field kept the old pattern, `decision.reason` took U+202E, and invisible format characters and lone surrogates passed everywhere -- `face-ops.mjs ONE_LINE` (every `\p{Cf}` but ZWNJ/ZWJ, `\p{Cs}`), `validate.mjs` decision reason -- *a text rule is one class, used by every field that carries text.*
- **A blocking sweep of pinned bytes**: every pulse statted every closed day -- `spine.mjs spineStamp` (a closed day is its name) -- *never re-measure what is pinned.*
- **Valid JSON refused**: a lone CR is JSON whitespace -- `arc-dash.mjs parseBody` -- *normalise the whole whitespace class the spec allows.*
- **A data stream behind a file name**: `article.mdx:hidden` sealed a stream the listing never shows -- `arc-growth.mjs cmdSeal` -- *a colon past the drive letter is a stream, not a file.*
- **stderr order as proof**: a descendant's later forged receipt line could still be popped -- `arc-bench.mjs runAttempt` also requires the receipt's process and driver to be the attempt's -- *attribution is by name AND by what the named thing says it is.*

### PR 3a -- the kernel ring's two fresh attackers, carrying every row above (2026-09-19)

- **An apply re-derived from a moved world**: main or the spine moved between the plan the owner read and the click, and the apply wrote something else (a router change reverted; a cap exceeded by three planned opens; a second verdict; a measurement after the verdict) -- `core/plan-expect.mjs`, `face-ops.mjs expectFrom` and `expect: true`, `work-door.mjs` appends `--expect`, `arc-evolve.mjs` and `propose.mjs` re-derive and refuse PLAN_STALE, `proposal-branch.mjs` refuses BASE_MOVED -- *an apply writes the digest the plan showed, or nothing; every check runs again at apply.*
- **Counting receipts the fold does not keep**: conclude walked every admitted receipt, not the post-supersede set, counted zero-observation receipts, and took the max of a 0 and a 1 -- `wire.mjs planConclude` (the fold's `kept`, `unit_count > 0`, CONFLICTING_VALUES) -- *read the set the board reads; the twin of "validate one read, compare another".*
- **Trusting a receipt's own claim**: a unit's arm and cohort were read off the measurement, so one unit counted in both arms and generation units scored as verdict; completeness was judged across cohorts -- `wire.mjs` re-places every unit with `assign()` (COHORT_VIOLATION), windows judged on the verdict cohort -- *a receipt's claim is checked against the function that decided it.*
- **ADR rules no code enforced**: direction, the manifest's alpha, TTL, canonical drift on conclude, two arms -- `wire.mjs`, `verdict.mjs configHash` (metric + direction) -- *every clause of the ADR the wiring cites is a check or a refusal, by name.*
- **A formula two derivations agreed on**: Newcombe's terms paired for p1 - p2 on a d = p2 - p1 test, reproduced by both independent vector derivations -- `verdict.mjs newcombeWilsonDifferenceAtZ`, `tests/fixtures/evolve/newcombe-exact.mjs`, ADR-0311 correction -- *anchor a method on a published worked example, never on derivations that can share a misreading.*
- **A redeclaration hidden by a sort**: the board compared a new open's arms with its SORTED union, so a swap into sorted order read as no change -- `board.mjs declaredArms`, `wire.mjs` refuses ARMS_REDECLARED / OPENED_TWICE -- *compare what was declared, in the order it was declared.*
- **spawnSync around git**: the timeout killed the launcher and left git.exe holding the temp index; a backgrounded hook held the pipes 60 s past a 700 ms write -- `core/spawn-bounded.mjs`, now shared by `runTool` and the proposal writer -- *one bounded spawn, used by every caller: the fix is made once.*
- **Owner config that runs or hides**: fsmonitor ran and left a daemon, split index wrote into `.git`, a per-user `*.yaml -diff` hid the plan's diff -- `proposal-branch.mjs safety()` -- *override every config key that can run a program, write beside the index, or change what a diff shows.*
- **A case-insensitive ref shadow**: a loose `feat/face-p2-f` shadowed the owner's packed `feat/face-P2-F` -- `proposal-branch.mjs clashOf` (without case, and as a directory prefix) -- *compare names the way the filesystem does.*
- **A lossy read of main**: a Latin-1 byte became U+FFFD on the branch while the diff showed one line -- `baseText` strict UTF-8, the diff's base side raw bytes -- *decode strictly or refuse; never through a replacement character.*
- **Cleanup replacing the outcome**: an rmSync that threw after update-ref turned a written proposal into exit 1 with a stack; a missing TMP was a raw ENOENT -- `removeQuietly`, `tempDir`, propose's `written` flag -- *litter is not a failure; the exit code says whether the effect happened.*
- **Refusals under the wrong name**: exit 128 read as "no main"; a stale `.lock` read as "the branch appeared" -- `mainCommit` ok [0, 1], `update-ref` failure re-checked -- *a refusal names its real cause, in git's own words when git is the cause.*
- **Windows names a proposal could reach**: `hq.policy.yaml.`, `.git./config`, device names, a leading dash -- `checkFiles` -- *refuse a name another OS reads as a different one.*
- **A secret scanner reading an identifier**: `face-ask` plus `-` made `sk-` inside the branch name, and the approval was refused AFTER the branch was written -- `propose.mjs branchFor` (class last), approval judged by the spine before the write -- *judge the receipt before the effect it describes.*
- **A safety flag in another spelling**: `-dry-run`, an em dash, a Unicode minus, a second positional, another command's flag -- `arc-jobs.mjs` (dash class, COMMAND_FLAGS, one job name) -- *the safety flag's every spelling is refused, not only the one the check was written for.*
- **process.exit after the last line the door parses**: -- `arc-evolve.mjs` main() with exitCode, `arc-jobs.mjs` writeSync before its exits -- *set the code; never force an exit behind an asynchronous pipe.*
- **Tests keyed on the flag they verify; refusals accepted by any name**: a row with touchesFiles dropped passed and a sim door wrote a branch; flows accepted any refusal; parity compared sixty characters on another spine -- `work-door.mjs` derives the effect from the tool (both ways, with a mutant), `flows.mjs REFUSALS`, whole-line parity on one spine -- *a test derives what it checks from somewhere the code under test does not set.*

### PR 3a -- round 2: two fresh attackers on the round-1 fixes, carrying every row above (2026-09-19)

- **The original read, not the one the fold keeps (again)**: a superseded `experiment.opened` still governed measure and conclude, and a re-open restarted the TTL -- `wire.mjs liveExperiment` counts every admitted open (OPENED_TWICE / ARMS_REDECLARED), TTL from the one open's own receipt -- *the third instance of validate-one-read-compare-another; the fix counts every copy, superseded or not.*
- **A re-check with no lock**: three planned opens applied at the same moment each read a spine without the others -- `arc-evolve.mjs` apply reads, checks, compares and writes inside one `.evolve-apply.lock` (scanAll inside withLock) -- *a re-check is only a check if nothing can land between it and the write.*
- **A no-verdict that writes nothing is a test you can re-run until it wins**: -- `wire.mjs planConclude` records a computed-at-floor no-verdict as `experiment.verdict` outcome no-verdict; only an uncomputable test is refused -- *fixed horizon means the first computed answer is final, whichever way it went.*
- **A cycle guard that broke chains**: "a dropped superseder has no effect" brought the head of every two-link chain back -- `board.mjs applySupersedes` refuses only supersedes inside a real cycle -- *break the cycle you can prove, not every chain that looks like one.*
- **An unbound apply mode**: a row that lost its expect flag fell into propose's "no plan" mode and wrote against a moved main -- `propose.mjs` refuses an apply without `--expect`; the work-door suite reads the binding off what the tool printed, both ways -- *the safe default is the tool's, not the registry's.*
- **A digest over part of the write**: `--why` rode into the commit and the approval outside the digest -- propose's digest covers the message and the approval -- *a digest covers every byte the apply writes, or it binds nothing.*
- **Empty read as absent (again)**: `arc-jobs register ""` acted on every enabled job -- empty-name refusal -- *the empty-value twin, in the one argument that picks the target.*
- **Config hooks**: `hook.<name>.command` in the owner's config ran inside every write, could veto it, and left a `.lock` -- `proposal-branch.mjs withHooks` lists them and disables each by name -- *core.hooksPath is one of two ways git runs a hook.*
- **Our own branch called someone else's**: update-ref committed, the call then failed, and the writer reported BRANCH_EXISTS and exit 2 -- the catch re-reads the ref and returns it when it is ours -- *before naming a cause, check whether the effect already happened.*
- **SIGKILL before a nested tool can clean up**: the door's group kill never reached propose's own git groups -- `spawn-bounded.mjs killTree` SIGTERMs first and SIGKILLs at the settle; SIGHUP handled -- *a parent that kills must leave its child time to end its own children.*
- **A list-valued env var from a path**: a delimiter in TMP split `GIT_CEILING_DIRECTORIES` -- refused as NO_TEMP -- *a path placed in a list variable must not contain the list's separator.*
- **Commit encoding from the owner's config**: -- `-c i18n.commitEncoding=UTF-8` -- *override every config key that changes the bytes a write produces.*
- **The emitter's own id line behind process.exit**: -- `arc-event.mjs` writes the id with writeSync -- *the twin of the process.exit row, in the one line every caller parses.*

### PR 3b -- the kernel ring's second half: two fresh attackers, carrying every row above (2026-09-19)

- **A plan card that shows the result it does not record**: conclude's plan printed the bound and wrote nothing, so the owner could plan again as the data grew and apply only the plan that won; a missing-window refusal carried the bound too -- `wire.mjs planConclude` returns `planLines` (computable, over what) and binds the test's INPUTS; `decide()` keeps `outcomeReasons` apart; `arc-evolve.mjs` prints the result after the receipt lands -- *compute-once holds at every surface that can show the number, not only at the write.*
- **A scanner whose verdict is random**: the emitter's clock-made idem joined the caller's strings in the adjacency views, so one payload judged 48 times was refused twice and a dry run did not predict its emit; an actor ending in "sk-" sat beside the idem every time -- `redact.mjs` joins `joinFrom`, `arc-event.mjs seal` passes the event without id/ts/idem/sha -- *a judgment that must predict a later one may only read what the later one will read.*
- **Judging a draft instead of the payload**: trial judged the longest labels and a zero commitment; the real seal drew other labels and was refused after it burned its correlation and wrote its branch -- `judgement.mjs seal --judge` asks the spine about the real payload before the nonce is written; `writeProposal({ beforeRef })` lets propose and pin judge the approval with the REAL commit before the ref exists -- *judge the receipt itself, before the effect; a stand-in is a different receipt.*
- **A guard reading the wrong tree**: trial's reused-bundle check read the owner's checkout while the branch is cut from main -- `trial.mjs` reads `mapping.json` and `commitment.txt` on main (baseText) -- *check the tree the write is based on.*
- **Key-shaped text outside the branch name**: "risk-assessment" made "sk-" in pin's branch and, with spaces removed, in its `what` -- `proposal-branch.mjs proposalBranch` defuses sk-/xox?- in every branch (propose, pin, trial), `checkBranch` refuses one that kept it; pin's `what` leads with the report's path -- *the propose twin one field over: grep every string an identifier reaches, including the one with its spaces removed.*
- **A git -c key that git splits**: a config hook NAMED `x=y` was never disabled -- `offEnv` passes the disables as `GIT_CONFIG_COUNT/KEY/VALUE` -- *a key with the separator in it goes through the channel that has no separator.*
- **A case-only twin of main's own file**: `Casey.md` beside main's `casey.md` made a branch no Windows or macOS checkout can hold -- `caseClash` walks main's tree per directory (CASE_CLASH), and a file/directory conflict is BAD_PATH -- *the clash rule for refs, applied to paths.*
- **A pre-check missing one of the writer's refusals**: trial's pre-seal check lacked NO_TEMP, so the seal burned and the write then refused -- `checkTemp` in checkProposal, planProposal and writeProposal -- *a pre-check is every refusal the write can make, or the burn happens between them.*
- **"Nothing sealed" after a half seal**: a failed commitment write exited 2 with the nonce on disk -- `trial.mjs` reports exit 1 when the seal file exists -- *after a failure, look at what exists before naming the exit.*
- **An id line that throws after the write**: EPIPE on the id quarantined a LANDED event and exited 2 (a regression of the writeSync fix) -- `arc-event.mjs` and `arc-jobs.mjs` guard the write after the effect -- *the line after the effect can be lost; it can never turn the effect into a refusal.*
- **A lock the readers do not know**: a killed evolve apply left `.evolve-apply.lock` in events/, and the leads reader refused every fold (the scheduler's `.job-*.lock`, older, the same) -- `spine-read.mjs KNOWN_NON_DAY_RE` lists both -- *a new file in a shared directory is a change to every reader of that directory.*
- **Bench's --from, one class of hole at a time**: the dry run never asked the spine (a driver name holding "sk-" was planned, written, refused, exit 0, no receipt); the de-dup key ignored the champion and marked unraised artifacts; "different runs" compared spellings; the store sat two levels above the spine (in a repo's tree when the spine was at its top); an unguarded rmSync after the approval landed (and its two twins in the file); refused dry runs leaked their temp dir; six new `process.exit` after `console.error` -- `arc-bench.mjs` --from rebuilt: one dry proposal judged by `spineRefusal` with `--process`, key = candidate AND champion, `approval.id` written only once landed, content comparison, `<spine>/bench/proposals`, every cleanup guarded, exitCode everywhere -- *every row above, re-found in the one file that had not been attacked yet.*
- **A report that records the owner's home**: the scaffold's Identity line was the source's relative (or, on another drive, absolute) path -- `study.mjs` names a root outside the repo by its folder name -- *a committed file in a public repo carries no path from the owner's machine.*
- **A pause that did not shrink with depth**: parent and child both paused 300 ms, so the parent's SIGKILL could land before the child ended its git groups -- `spawn-bounded.mjs` hands each child `ARC_SPAWN_PAUSE_MS` 200 ms shorter -- *each level ends its own tree before the level above ends it.*
- **Tests that could not fail, or could not pass**: bench's unbound check ran after the proposal existed and could not pass; a constant digest passed every bench check; the config-hook fixture used a name `-c` can say; the update-ref catch had no foreign-branch case; the race needed three starts to overlap -- kernel-ring (fresh unbound, evidence swap, held-lock), proposal-branch (x=y hook, foreign branch, beforeRef) -- *the mutant is the negative control; write the check it fails.*
- **A plan the owner's page cannot read (CI, PR 3b)**: bench printed "champion from <absolute path>;" and pin printed study's scratch path, and the door withholds an absolute path AND everything after it -- the plan's summary, its diff and its digest line vanished from the page (the work-door and flow suites saw nothing after it) -- `arc-bench.mjs shown()` prints repo-relative or the run's own name, pin carries only study's counts -- *a tool's plan output is read through the scrubber: print paths the owner's page can show, or none.*
- **Line-number allowlists move with every edit (CI, PR 3b)**: three `[^a-z0-9-]` in new or moved lines tripped the locale-range gate -- spelled out -- *in a file the portability gate reads, spell a class's letters out, even in JavaScript.*

### PR 3b -- round 2: two fresh attackers on the round-1 fixes, carrying every row above (2026-09-19)

- **A check and a write with a spawn between them**: `--judge` put an emitter call between "no seal exists" and the nonce write, and two seals of one correlation both won -- the stored nonce was the loser's, so the approval that landed could never be revealed -- `judgement.mjs` creates the nonce with `flag: "wx"` -- *a new step between a check and its write is a new race; make the write itself the check.*
- **A hook name the parser could not read**: CR, U+2028, U+2029, the empty name and a non-UTF-8 byte slipped a line-split, lossy, `.+` parse and ran six times inside a write -- `withHooks` reads `-z`, decodes strictly (refusing a name that is not UTF-8, HOOK_NAME), matches with `[\s\S]*`, and `assertHooksOff` proves every hook reads back disabled before anything is written -- *after disabling, read the setting back; a disable you did not verify is a hope.*
- **One commit for every writer of one plan**: three writers in one second computed one commit, and the update-ref catch told each the branch was theirs -- three approvals -- `writeProposal` adds a per-call `Proposal-Nonce` trailer -- *"the ref holds my commit" proves ownership only if nobody else can make that commit.*
- **Four steps with no lock (bench `--from`)**: the mark check, the set-aside, the emit and the mark raised two approvals from one plan, and a failed mark write exited 0 -- a per-store `wx` lock, an `approval.pending` mark before the emit, a failed id mark is PARTIAL -- *the PR 3a round-2 row, re-found in the tool that was not in that PR.*
- **The spine's answer revealing the result**: a conclude judged in the outcome it would record passed for a no-verdict and refused a verdict (`x-ghp_` + "verdict" + a hash is a token shape) -- both spellings are judged, always -- *if a check reads the secret, its refusal is the secret.*
- **A result left on disk by a refusal**: a conclude refused at append was quarantined with its bound and delta in plain text -- `experiment.verdict` is quarantined as a stub -- *a quarantine is a read path; treat it as one.*
- **Excluding too much**: the round-1 scanner fix dropped a caller-supplied `--idem` and an event file's id from the joins, so a key split across them passed -- only the fields THIS call generated are left out -- *narrow a fix to the cause it names.*
- **Byte comparison where content was meant (bench)**: a re-indented copy, and a second run of the same subject, were "different runs"; the files were read three times -- canonical content, subject equality, each file read once and handed to the digest, the key and the build -- *compare the thing, not its serialisation, and read it once.*
- **Twins of round-1 rows**: bench's per-attempt `cleanup()` one line below the guarded one; trial's main-tree guard missing in pin (a report main holds was replaced by a scaffold) and blind to an open trial branch (`openProposalsHolding`); a symlink or gitlink on main edited as text; a relative TMP; study relative to the cwd, not the repo; the spine asked through argv while bench emits through a file; a crash's stack carried into a refusal; `close-day`, the register path and `judgement die()` still writing asynchronously before `process.exit`; a pause read from the owner's environment (now a depth proved by the parent's pid); bench's approval naming classes it wrote no diff for; the conclude card's hint promising a no-verdict "writes nothing".
- **A regex that depends on the machine's locale (CI, PR 3b round 2)**: git's `--get-regexp` runs the locale's regex, and under a UTF-8 locale `.` does not match a byte that is not UTF-8 -- the hook with such a name was never listed and ran inside the write on Linux and macOS, while Windows refused it -- `withHooks` and `assertHooksOff` read `--list -z` and filter the key's bytes -- *a check that filters by a pattern must not borrow the platform's pattern engine for bytes it cannot decode.*

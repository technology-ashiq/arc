# Fixed defects — the docs lane's running list

Every attacker prompt this cycle carries this file, with one instruction: **check each line in
every OTHER file you are shown, not only the file it was fixed in.** Every attacker pass appends
its fixed holes here, one line each.

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

Seeded 2026-09-25 at kickoff from the rows of `initiatives/face/fixed-defects.md` and
`docs/retro-log.md` that apply to a tree reader, a generator and a coverage gate. That file stays
the fuller source; read it too.

## Reading the tree

- **Validate one read, compare another** — `verdict.mjs`, `lineage.mjs`, `arc-run.mjs`, face `reads.mjs` (`fileAt` hashed one version, served another) — *every fact is read once and that one read is both checked and used.*
- **`gather()` was an untested seam**: selftests mutated its output while reader suites drove readers directly, so a disconnected reader printed "0 … all covered" (face `b0f3a4ef`) — *one test arm crosses every wiring layer end to end.*
- **An exclusion whose stated reason was measured false** hid a real uncovered file (ADR-1317) — *an exclusion names the file that makes it true, and is re-checked.*
- **A containment check used `isFile()`, which a symlink passes** (face `b0f3a4ef`) — *resolve realpaths before any containment decision.*
- **Case-insensitive match on one OS leg only** (`processes/` vs `Processes/`, `[!a-z0-9-]` locale collation) — *compare bytes; never trust a locale or a case-folding filesystem.*

## Writing generated output

- **A writer wrote through a symlink onto its own source** (`face-tokens.mjs`) — *a writer realpaths its destination and refuses its source.*
- **Check and `--write` disagreed on CRLF**, so the writer produced a file its own reader refused (`tokens-contrast.mjs`) — *both modes normalise identically; the writer re-reads what it wrote.*
- **Sorting case-sensitively while another view folded case** (face catalogue) — *one comparator, byte order, everywhere.*

## Gates and self-tests

- **Negative controls run under bats `run` in a subshell silently passed** (legal Phase 00) — *assert the control RAN, then what it printed.*
- **Selftests printed FAIL while passing** and turned CI red on their own controls (face `182d155c`) — *expected failures are labelled as expected.*
- **A selftest left a bogus registry behind** (`face-sections`) — *a mutant runs in a scratch copy and cleans up on every path.*
- **A rule with no case only it decides** — deleting it left the suite green (`face-pure.mjs`) — *every rule has a test that fails when only that rule is removed.*

## CLI

- **Main guard compared `argv[1]` without realpath** and no-opped behind a symlink (retro 2026-08-13) — *realpath BOTH `argv[1]` and `import.meta.url`.*
- **Unknown flags fell through to the worst default** (`arc-dash.mjs`) — *refuse an unknown flag by name, exit 2.*
- **A flag consumed the NEXT flag as its value** (`--transcript-dir --dry-run`) and **a value-taking flag given last spun the arg loop forever** (design v2 Phase 00) — *a value starting `--` or a missing value is exit 2.*
- **`process.exit()` raced libuv teardown on Windows** — *set `process.exitCode` and let the loop drain.*
- **A POSIX path interpolated into a node program** went red on the Windows leg only — *pass paths as argv, never inside program text.*

## Phase 00 -- the extractor (attack 65f2423, round 1, boundary; logic surface did not run: 503)

- **A per-file read error became "unparsed" at exit 0** (B1) — `wiki-build.mjs` `readText` — *only ENOENT/ENOTDIR is absence; every other errno is a named exit 2.*
- **`statSync().isFile()` read through a tracked symlink to a file outside the tree** (B2) — `namedFile` (lstat, refuse links, realpath containment) — *every named read is a regular file inside realpath(repo).*
- **A file present only under another case was read on Windows/macOS and absent on Linux** (B3) — `namedFile` (real basename must equal the asked spelling), and the `hasPlan` twin — *compare the real spelling, never trust a case-folding disk.*
- **`--out` could overwrite a source file the extractor had just read; non-atomic write** (B4) — `writeOut` — *a writer refuses links, refuses the tree outside its own output dir, and renames a temp file into place.*
- **EPIPE on stdout surfaced as exit 1, which means "undecided inventory"** (B5) — `say()` — *a failed stdout write is its own named exit 2.*
- **The DOC-A scan was top-level-only and .mjs-only; `scanned >= 1` proved nothing** (B6) — `tests/docs/no-walker.mjs` (recursive, every file, `--expect` from `git ls-files`) — *a scan asserts it covered the count derived independently.*
- **The scan missed face-coverage's own enumerators, child_process, and aliased fs namespaces** (B7) — `no-walker.mjs` — *one mutant per spelling, in the suite.*
- **`! grep ...` mid-test never failed; the Windows path spelling was never checked** (B8) — `tests/docs-extract.bats` + `json-hygiene.mjs` with its own red controls — *a "must not" is `if ...; then false; fi`, and every spelling of a path is checked.*
- **A "behaviour-preserving" comment claimed an order that was false** (B9) — `face-coverage.mjs` `gather` (kinds, then contract, then readers; old key order) — *a claim of "as before" names what was before and keeps it.*
- **`requires` omitted the products owning runtime imports** (B10) — `products/docs/manifest.json` (+engine, +hq) — *requires lists every product whose file is imported, statically or dynamically.*
- **A UTF-8 BOM silently emptied facts** (B13) — `readText` — *strip BOM and CR on every read; a CRLF+BOM fixture must extract identical bytes.*
- **Gate names from one read, facts from a second, with no one-row check** (B14) — `readGates` — *every name resolves to exactly one row or the build stops.*
- **Fail-closed branches with no case only they decide** (B15) — `extract-probe.mjs` (10 checks) + CLI branch tests — *one test per branch, asserting the CLI exit code.*

## Phase 00 -- the first CI run (90942d6d)

- **`expected-set.json` hand-edited with `sed` left it out of canonical form** — a numeric-looking key (`"1500"`) was appended after `"0900"`, but `JSON.stringify` orders integer keys first, so `agent-scaffold` and `concept-define` refused main as non-canonical and three face ring tests went red on two OS legs — *edit a generator-owned JSON by parse → mutate → `JSON.stringify(v, null, 2) + "\n"`, never by text; then run the generator's own `--check`.*

## Phase 00 -- round 2 (attack fb17189, boundary; logic not run -- round 1's logic transport failed)

- **A link to a directory INSIDE the tree read as "absent" at exit 0** (r2 B1) — `namedFile`: only a case-only tail difference is absence; any other is a named exit 2 — *a path reached through a link is refused, wherever the link points.*
- **`--out` could rename JSON over a hand-written narrative under docs/wiki/** (r2 B2) — `writeOut`: inside the tree only `docs/wiki/wiki.json` — *a writer's allowed set inside the tree is an exact path, never a prefix.*
- **An allow-listed call text in a comment laundered a different enumerator on the same line** (r2 B3) — `no-walker.mjs` `isSanctioned` (same column in code and raw) — *an allowlist matches the CODE, never the raw line.*
- **A predictable temp name was opened with 'w', following a planted link** (r2 B7) — `writeOut` (random suffix, `wx`) — *temp files are unpredictable and exclusive.*
- **A directory or FIFO at an entity's named path read as "absent"** (r2 B12) — `namedFile` — *something there that is not a regular file is a named failure.*

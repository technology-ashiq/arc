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

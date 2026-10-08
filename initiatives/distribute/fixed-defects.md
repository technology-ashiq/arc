# fixed-defects.md — the lane's running defect list (DST-K, ADR-2011)

Every `/arc-attack` on a distribute PR carries this file. The instruction to both attackers is to check **each
class below in every distribute file**, not only in the file where the class was first fixed. A class is closed only
when a fixture pins it in every adapter and gate it applies to. Imported classes are seeded from the repo's history,
and lane finds are appended under their PR.

## Imported classes (seeded at kickoff, 2026-10-07)

- **(a) main guard.** Every CLI-shaped `.mjs` resolves both sides with `realpathSync` before comparing `process.argv[1]` with `import.meta.url`. Otherwise it silently no-ops behind a symlink or a macOS `/var` → `/private/var` temp dir.
- **(b) exit after async I/O.** Never `process.exit()` after a fetch, a spawn or a stream. Set `process.exitCode` and let the loop drain. Exiting early races libuv teardown on Windows.
- **(c) flag values.** A flag with a missing or empty value is refused by name and never consumes the next flag (`--target --dry-run` is an error, not `target = "--dry-run"`). Two copies of one flag with different values is an error, not last-wins.
- **(d) path confinement.** Each tool has one confinement function for paths that arrive from argv, a manifest or a matrix. No other `resolve()`/`join()` touches external data. `..`, an absolute path and a drive letter are refused or contained by name.
- **(e) COULD NOT SCAN.** A scanner that cannot read its input (a missing dir, an unreadable yaml, zero fragments where some must exist) prints `COULD NOT SCAN` and exits non-zero. It never reports an empty or clean result.
- **(f) validate one read, compare another.** The bytes that are validated are the bytes that are used. Never parse a file twice, and never validate a path and then open a different resolution of it.
- **(g) POSIX path into node.** `$ARC_ROOT` or any MSYS path is never interpolated into a node program string. `cd` first and pass a relative path, or pass it as argv.
- **(h) shell-string programs.** No apostrophe, backtick or `$` inside a program embedded in a shell string, in code or in comments. A program that needs one of those goes in its own file.
- **(i) missing vs empty.** A missing key is never read as an empty value, and an empty list is never read as "unrestricted" (ADR-0223). Absence and emptiness each get their own named branch.
- **(j) vacuous pass.** Every probe asserts it RAN before asserting what it printed. Every suite asserts its registered test count. `@test` names are ASCII only. `! cmd` mid-test does not fail a bats test, so use `if cmd; then false; fi`.
- **(k) derived, not hand-kept.** A gate's expected set is derived from disk, never from the table it checks, and a count is never a literal constant that another lane's edit can make stale.

## Lane finds

- **(l) ignore-check by grep.** Whether a path is ignored is asked of git (`git check-ignore --no-index` in a temp repo), never grepped from `.gitignore`: `.codex/*` and `**/AGENTS.md` walk past an exact-line grep. Fixed in `tests/distribute-birth.bats`, attack c4e1d7d B1.
- **(m) row-shape regex skips silently.** A table/row reader splits every row into cells and counts a row it cannot classify as illegal; a row the regex did not match must never vanish. Fixed in `tests/distribute/birth-probe.mjs` (verdict), attack c4e1d7d B4.
- **(n) mutant that may delete nothing.** Every mutant arm proves it changed the file (`cmp -s` original vs mutant) before running the check on it, and matches on structure (`[[:space:]]+`, cell delimiters), never on column padding. Fixed in `tests/distribute-birth.bats`, attack c4e1d7d B5/B7.
- **(o) dispatch on inherited keys.** A case table is looked up with `Object.hasOwn`, and the call is wrapped in `Promise.resolve().then(...)` so a synchronous throw reaches the catch. Fixed in `tests/distribute/birth-probe.mjs`, attack c4e1d7d B6.
- **(p) escapes in data.** A data value a test greps for carries no backslash escape; words instead (`carriage-return`). Fixed in `engine/harnesses.yaml`, attack c4e1d7d B8.
- **(q) a fixed-name set counted, not named.** A reader that expects N known items checks the names (distinct, and each in the expected set), not just the count, and a row with the wrong number of cells is illegal. Fixed in `tests/distribute/birth-probe.mjs`, attack 22fddfc L1/L2.
- **(r) the machine decides the answer.** A test that asks git runs with `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1` and reads exit codes as three states (0 / 1 / anything else = COULD NOT SCAN). Fixed in `tests/distribute-birth.bats`, attack 22fddfc B2/B3/B4.
- **(s) a mutant whose assertion is weaker than its change.** A mutant that removes every date asserts every row is reported, not "some row". Fixed in `tests/distribute-birth.bats`, attack 22fddfc B5.
- **(t) unconfined data paths at birth.** A path in a data file that a later tool reads (`golden:`) is confined when the file is born. Fixed in `tests/distribute/birth-probe.mjs`, attack 22fddfc B7.
- **(u) a mutant that exercises one probe of several.** A check with N probes plants N rules and asserts all N went red. Fixed in `tests/distribute-birth.bats`, attack 5d3f91b L3/L9 (the deleted-row mutant also pins the surviving count).
- **(v) an id that reads as a credential assignment.** An identifier ending in `secret`, `password`, `token` or `api-key` followed by `:` and a word reads as a key-colon-value credential to arc-run's `generic-credential-assignment` rule, and the whole attack input is refused before any model sees it. Name ids for the action, not the thing (`action-commit-credential`). Fixed in `engine/enforcement.yaml` and `tests/distribute-gate-parity.bats`, attack 138ad0e (both surfaces refused at input).
- **(w) a header filtered by prefix.** Diff headers are dropped by POSITION (between `diff --git` and the first `@@`), never by a `+++` prefix: an added line whose text starts `++ ` is real content. And `--text --no-textconv` with attributes off, so a change cannot hide its lines by declaring its own file binary. Fixed in `secret-diff-scan.sh`, attack 4f5dfc7 B1/B2.
- **(x) "an executable exists" read as "the tool ran".** A scanner checks the binary's version before trusting its exit 0. Fixed in `secret-diff-scan.sh`, attack 4f5dfc7 B4.
- **(y) text after a comment close.** Comment spans are removed before any decision and the remainder is judged; a marker inside a comment is not a marker; an import inside a block does not count. Fixed in `brain-drift.mjs`, attack 4f5dfc7 B5, L9-L12.
- **(z) a body bounded by the first `}`.** A bats test region runs to the next `@test`, and any `skip` word outside a comment is a gap, so a heredoc `}` cannot hide a skip. Fixed in `gate-parity.mjs`, attack 4f5dfc7 B6, L1.
- **(aa) "the line is somewhere in the hooks".** A commit-time command counts only in its own hook (pre-push vs pre-commit) and before the first `exit`. Fixed in `gate-parity.mjs`, attack 4f5dfc7 B7.
- **(ab) a fixed mutant name.** The selftest plants a pid-suffixed name and asserts it was absent first. Fixed in `gate-parity.mjs`, attack 4f5dfc7 L4.
- **(ac) an unterminated comment swallows the file.** A scanner whose comment state is still open at EOF names it as a finding. Fixed in `brain-drift.mjs`, attack 7c55982 L2.
- **(ad) a range where a ref belongs.** A `--base` value containing `..`, `:` or a leading `-` is refused before git sees it. Fixed in `secret-diff-scan.sh`, attack 7c55982 B2.
- **(ae) a malformed field read as absent.** A protection object whose fields are not objects is UNKNOWN, never MISSING. Fixed in `arc-doctor.mjs`, attack 7c55982 L6.
- **(af) a fix changes output a sibling test pins.** The round-1 fix appended a note after `clean`, and the merge-time test anchored `clean$`; CI (macOS shard 2) was the only thing that noticed. After changing any script's output, grep every `tests/distribute-*.bats` for its printed lines before pushing. Fixed in `tests/distribute-merge-gates.bats`.
- **(ag) a moved fact with readers in other lanes.** The CLAUDE.md -> AGENTS.md split moved sentences other suites read (`tests/face/face-module.mjs` counted "The other N commands" in CLAUDE.md). Before moving text out of a shared file, grep every test and script for the exact phrases being moved, not only the filename. Fixed in `tests/face/face-module.mjs` (reads AGENTS.md + CLAUDE.md).
- **(ah) a linked parent hides a scanned directory.** A directory walk matched one segment at a time lists a symlink, junction or plain file found where a directory segment belongs as a finding; it never maps it to an empty listing. Fixed in `arc-compile.mjs` (dirtyScan), attack 85d2416 B1.
- **(ai) an empty path segment matches nothing.** A data path with `//` is refused at confinement, and a scan reports how many declared directories were present, so a typo is not "scanned, clean". Fixed in `frontmatter-lint.mjs` (confineRel) and `arc-compile.mjs`, attack 85d2416 B2.
- **(aj) optional in one root, required in another.** An input a consumer root may lack is still COULD NOT SCAN where the root is arc itself (`products/engine/manifest.json` present); the skip is a named, asserted line. Fixed in `arc-compile.mjs`, attack 85d2416 B3.
- **(ak) the walk base is followed.** A walker lstat-checks its base directories too, not only the entries below them, and flags any entry that is not a regular file. Fixed in `frontmatter-lint.mjs` (sourceFiles), attack 85d2416 B4.
- **(al) errexit eats `rc=$?`.** In a bats body, `cmd; rc=$?` aborts on a non-zero status before the capture; write `rc=0; cmd || rc=$?`. Fixed in `tests/distribute-dirty.bats`, attack 85d2416 B5.
- **(am) case-folded on one side only.** When a match is case-insensitive, every comparison made on its result is case-folded too. Fixed in `arc-compile.mjs` (isForeign), attack 85d2416 B8.
- **(an) an exclusion by name honoured on a link.** A file excluded by name (a harness's own first-run file) is excluded only as a regular file; a symlink under that name is still a finding. Fixed in `arc-compile.mjs`, attack 85d2416 L7.
- **(ao) a foreign directory walked file by file.** A directory a harness owns (`node_modules/`) is a prune point, never walked; only an exact foreign FILE name is held to the regular-file rule of (an). Fixed in `arc-compile.mjs` (dirtyScan), attack a32c3ae B1.
- **(ap) one failure, two exit codes.** COULD NOT SCAN exits 2 from every stage of one tool, never 1 from one stage and 2 from another. Fixed in `arc-compile.mjs` (finish), attack a32c3ae B4.

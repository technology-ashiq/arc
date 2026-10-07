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

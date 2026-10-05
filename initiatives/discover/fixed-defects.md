# discover — fixed-defect patterns

Every `/arc-attack` prompt carries this list. An attacker checks each pattern in every OTHER file of the diff,
not only where it was fixed (twin-fix rule). One line per pattern: `pattern — where fixed — PR`.

## Seeded at birth (imported from the retro-log; check in every discover file)

- (a) realpath-both-sides main guard in `arc-discover.mjs` and every CLI-shaped file
- (b) no `process.exit()` after a fetch — set `exitCode`, then let the loop drain
- (c) a flag with a missing or empty value is refused and never consumes the next flag (`--out`, `--offline-fixture`)
- (d) one confinement function for `--offline-fixture` / `--out` paths; no other `resolve()` on external data
- (e) section regexes anchored; no `$` under `/m`
- (f) hostile fixture text lives in files, never in a shell string or a bats test name; ASCII-only test names; every bats file asserts its own test COUNT
- (g) a scan that cannot read its input reports `COULD NOT SCAN`, never an empty result
- hostile text interpolated into a shell, eval or yaml string — check every writer (clusterer, exporter, hunt.md)
- a fake whose right answer equals the failure's answer (empty list = quiet market) — check every miner path
- a validator in one read path and a different, weaker read in the other — check reader vs writer of the reject shape

## Fixed in this lane
- **a probe whose output is believed without asserting it ran** (status 0 + empty stderr first; an unreadable input must fail, never read as clean) — tests/discover-birth.bats room/manifest/process checks (8bb1a72 L1 L5 L7 B3) — *assert RAN, then assert what it said*
- **a grep that can match outside the structure it claims to check** (CATALOG word anywhere in the file) — tests/discover-birth.bats CATALOG test (B2) — *anchor the match to the structure's own line*
- **a refusal test that accepts any exit 2** — tests/discover-birth.bats stub test (L4) — *assert the exact message, on every verb, from a foreign cwd*
- **user text interpolated into a command doc's shell line** (`$ARGUMENTS` inside double quotes) — .claude/commands/arc-hunt.md (B1) — *free text goes through a file written by the Write tool, never argv*
- **a main guard whose realpath throws at module top level** — arc-discover.mjs (B4) — *wrap it: a throw means not-main*
- **the spec that instructs the defect** (phase-00-spec told the builder to run `hunt "$ARGUMENTS"` after the doc was fixed) — phase-00-spec.md (5e1d529 L10) — *a fix lands in the instruction that would regenerate the bug, not only in the artifact*
- **an allowlist prefix that permits any trailing argv** (`Bash(node …arc-discover.mjs:*)`) — arc-hunt.md (5e1d529 B1) — *allow the exact command line, nothing after it*
- **a one-direction absence check** (row absent passes; a planted row was never proven to fail) — discover-birth.bats ADR-1913 test (5e1d529 L7) — *every absence check carries a mutant that plants the thing*

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

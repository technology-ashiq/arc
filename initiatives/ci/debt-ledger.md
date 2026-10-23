# Debt ledger — ci lane

LOW attack findings parked for later, one row each. A row leaves when its fix merges.

| # | From | Finding | Why parked |
|---|---|---|---|
| D1 | attack c9aab1d B9 | `test` does not aggregate `security`; both are separate required checks | protection lists both by name (ADR-2204), so no gap today |
| D2 | attack c9aab1d B11 | `npm audit` in `face/` fails hard (ENOLOCK) if `face/package-lock.json` is ever removed | the lockfile is committed; fail-hard is the safe direction |
| D3 | attack c9aab1d L11 | `ci-install-tools.sh` runs `set -u` without `-e`, so a failed `apt-get` only shows as MISSING in the banner | best-effort by design; `security` refuses without its tools |
| D4 | attack 4e32cb7 L14 | a top-level file named exactly `face` does not set face=true | no such path exists; the rule is `face/` |
| D5 | attack 4e32cb7 L15 | floor and shard enumerators could disagree on a symlink-to-file | both now skip symlinks (`isFile`, `find -type f`); kept to re-check on Windows |

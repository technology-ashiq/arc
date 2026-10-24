# Debt ledger — ci lane

LOW attack findings parked for later, one row each. A row leaves when its fix merges.

| # | From | Finding | Why parked |
|---|---|---|---|
| D1 | attack c9aab1d B9 | `test` does not aggregate `security`; both are separate required checks | protection lists both by name (ADR-2204), so no gap today |
| D2 | attack c9aab1d B11 | `npm audit` in `face/` fails hard (ENOLOCK) if `face/package-lock.json` is ever removed | the lockfile is committed; fail-hard is the safe direction |
| D3 | attack c9aab1d L11 | `ci-install-tools.sh` runs `set -u` without `-e`, so a failed `apt-get` only shows as MISSING in the banner | best-effort by design; `security` refuses without its tools |
| D4 | attack 4e32cb7 L14 | a top-level file named exactly `face` does not set face=true | no such path exists; the rule is `face/` |
| D5 | attack 4e32cb7 L15 | floor and shard enumerators could disagree on a symlink-to-file | both now skip symlinks (`isFile`, `find -type f`); kept to re-check on Windows |
| D6 | attack 306d3d3 B6 | the pre-push 5-min cap kills only the direct `bash`; bats grandchildren can outlive it on Windows | a hung push is visible and Ctrl-C ends it; tree-kill when it is seen once |
| D7 | attack 306d3d3 B10 | a very large node file list could pass Windows' ~32k command-line limit | today 1 node lane; chunk when a lane count makes it real (Phase 04 fan-out) |
| D8 | attack 306d3d3 L14 | `npm run ci` does not parse-check every script; a typo in an untouched script waits for CI | ESLint (TRIAL) parses all of them on CI; promote when the trial ends |
| D9 | attack 1bede0b B4 | a failed fetch or merge-base replaces the change list with the core set, so the pushed lane's own files are not run | rare (offline push); CI runs everything; map HEAD's diff against the last known base when it is seen |
| D10 | attack 1bede0b B5 | paperwork under evidence/ and handoffs/ is "not a code extension", a denylist, not the allowlist asked for | the tests' own text is also asked (fixed-defect v); flip to an allowlist if a machine-read type appears there |

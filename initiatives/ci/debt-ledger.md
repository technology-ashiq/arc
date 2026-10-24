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
| D11 | attack b6fbcb0 B5 | `--ci` and `--all` run with no time cap, so one hung test hangs `npm run ci` | both are explicit, owner-started runs; Ctrl-C ends them; cap them if one is seen to hang |
| D12 | attack b6fbcb0 B6 | `npm run lint` and ci-quality.sh's `bash` steps go through npm's shell, which on Windows can resolve WSL | `npm run ci` now starts ci-quality through git's bash (fixed-defect y), and the pre-push runs under git's sh |
| D13 | attack fe6c1d2 B1/L7 | a changed bats helper (`tests/test_helper.bash`, `tests/_lib/`) selects no bats file locally, only node lanes; it prints "bats run on CI" | every bats file loads it, so the honest local run is the whole suite (~4.3 h); CI is that run. Revisit if a helper change reaches main red |
| D14 | attack fe6c1d2 B2/L5 | a stray whole-word mention of a script's basename in an unrelated bats file counts as "named", which skips the lane-whole fallback | over-selection is safe; the miss needs a test that reaches the script only through a computed path AND a stray mention elsewhere. CI runs every file |
| D15 | attack fe6c1d2 L6 | a fixture loaded through a computed `fixtures/$dir` path is not matched by its directory name | it prints "bats run on CI"; match deeper only if a fixture change reaches main red |
| D16 | attack 07e31a1 B4/L1 | the sync retire step hashes a symlinked retired path through the link and `rm -f`s the link | it removes only the link, never its target, and only when the content is byte-identical to a shipped hook; refuse symlinks if a venture reports one |
| D17 | attack 07e31a1 L3 | the retire step trusts the operator's `$TARGET` (e.g. `/`) | it deletes only the 3 fixed paths and only on an exact shipped hash; the operator already chose that target for a full copy |
| D18 | REQ-11 build | `sync-to-project.ps1` (Windows-native twin) has no RETIRED step | the ps1 is not CI-gated and copies only (its header says so); port it when a Windows venture reports a stale hook |
| D19 | attack 90fbd5d B3/B4/L7/L8 | the retire step reports "kept ... edited" when `rm` fails or no sha256 tool exists, and splits a path on whitespace | the 3 paths are fixed literals with no space; a misreport keeps a file, never deletes one |
| D20 | attack 90fbd5d L9/L11 | DROPPED.md is subtracted by count, and a kept edited hook sits outside the manifests | ci-floor already refuses a name dropped twice; a kept hook is the venture's own file by design |
| D21 | attack 721902c B2 | pre-push treats a lane's `initiatives/<lane>/*.md` as paperwork once no test file mapped, without its own "named by a test" check | a named note maps its naming bats file, so `files` is not empty and the arm never fires; CI still treats these notes as code |
| D22 | attack 721902c B3 | the ASCII @test guard also flags a tab or CR in a name, and its message calls that non-ASCII | both still break bats test names; the message prints the line, so the cause is visible |
| D23 | attack b3131cb B2-B5 | node:test steps: a failing pipeline stops at pipefail before the counts print; the `.count` check is a total, not per lane; a non-numeric `.count` is not refused; the new test-changed case does not scrub `GIT_*` env or remove its temp dir | the step is still red on a failing suite; ci-floor already refuses a malformed `.count`; the test runs in CI's clean env |

# Handoff pack — phase 06 · lane develop

15/15 slices proven.

## Prediction calibration

5 hit · 0 miss · 0 unforeseen

- **likely-failure-mode** — hit — but far worse than predicted. The scan was not merely evaded by an unforeseen input; ALL SEVEN checks fell, and the default that was supposed to carry the gate was itself defeated by one README beside a compiled blob
- **likely-regression-site** — hit — every critical finding traced to that one boundary. A newline in `name` made `grep -qxF` a multi-pattern match; `registry-record` was an attacker-chosen path; the hash was never compared; a `\` in the candidate path voided the whole scan through a sed expression
- **riskiest-file** — hit — capability-vet.sh took every one of the 23 findings across both passes; no other file had any
- **expected-blockers** — hit — madge published integrity but no attestation, and it is write-capable, so it needs Ashiq's line and no session can write it. The lock file records the refusal rather than a fabricated approval
- **expected-proof-failures** — hit — `(ba|z|d|)sh` used an EMPTY alternation branch, undefined in POSIX ERE. GNU grep accepted it, BSD grep on macOS did not, and `curl | sh` passed on exactly one of three legs

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | integration | integration — one real scout run recorded in `evidence/phase-06/scout-run.md`, plus `bats tests/develop-capability.bats` asserting the agent has no write tools and the command states its limit | 83c7db7 |
| 02 | contract | contract — `bats tests/develop-capability.bats`, one BLOCK test per condition against a fixture differing from `clean` in exactly one way | 83c7db7 |
| 03 | contract | contract — `bats tests/develop-capability.bats` asserts both directions, plus a fabricated and a future date | 98887a3 |
| 04 | contract | contract — `bats tests/develop-capability.bats` over two separate fixtures, `exfil/` and `curl-pipe-sh/` | 98887a3 |
| 05 | contract | contract — `bats tests/develop-capability.bats` over `unreadable/`, `decoy-readable/`, `nul-byte/`, `hook-in-src/`, `dynamic-require/` | 98887a3 |
| 06 | contract | contract — `bats tests/develop-capability.bats` over `self-report-lies/`, whose manifest claims read-only while its source writes | 83c7db7 |
| 07 | contract | contract — `bats tests/develop-capability.bats` asserts the existence verdict is FIRST, and that `self-certified/` cannot cite itself | 98887a3 |
| 08 | contract | contract — `bats tests/develop-capability.bats` asserts the marker file is absent, plus a grep of the script for any install verb | 83c7db7 |
| 09 | verified-real | verified-real — madge@8.0.0 fetched from npm, integrity verified byte-for-byte, run through the real gate; transcript in `evidence/phase-06/real-candidate-madge.md` | 83c7db7 |
| 10 | contract | contract — `bats tests/develop-capability.bats` over the lock row shape and five `--audit` behaviours | 98887a3 |
| 11 | contract | contract — `bats tests/develop-capability.bats` runs three PASS fixtures in the same suite as the refusals | 98887a3 |
| 12 | verified-real | verified-real — two fresh agents, 23 findings, 25 fixtures pinned in `bats tests/develop-capability.bats` | 98887a3 |
| 13 | static | static — `bats tests/develop-capability.bats` reads `products/develop/manifest.json` and asserts all three entries | 83c7db7 |
| 14 | static | static — `bats tests/develop-capability.bats` greps root `CLAUDE.md` for `/arc-capability` | 83c7db7 |
| 15 | integration | integration — CI run 30771652000 green on all 3 legs at head 6489684 | 6489684 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->

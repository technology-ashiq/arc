# Handoff pack — phase 00 · lane policy

22/22 slices proven.

## Prediction calibration

3 hit · 1 miss · 1 unforeseen

- **likely-failure-mode** — miss — 01cb4c5 (EXDEV on a cross-volume hardlink) and a6050df (prototype pollution). The prediction was schema ambiguity; the schema held on every red run, and every blocker came from the OS boundary or from a language semantic, not from the model.
- **likely-regression-site** — hit — a6050df: 6 of the 9 critical adversarial findings landed in authorize.mjs or resources.mjs, which is where the prediction pointed.
- **riskiest-file** — hit — a6050df, yaml.mjs. Right file, wrong reason: duplicate keys were caught by design from the first commit, and what nearly shipped was `__proto__`, which is INSIDE the supported subset and so was never going to be caught by rejecting what is outside it.
- **expected-blockers** — unforeseen — 2bef4f1, f32edbe, 01cb4c5. Nobody predicted any of the four: a POSIX-vs-node temp-path translation, a shadowed const, a cross-volume hardlink, and one assumption about shebangs that was simply wrong. All four were invisible on the box that wrote the code and every one came back from CI.
- **expected-proof-failures** — hit — CI run 31102122394 went red over the whole suite before any implementation existed, with both named red-firsts among the failures.

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | unit | bats tests/policy-lint.bats -- closed capability set, closed level enum, L4 refused | 3a59818 + a6050df + 01cb4c5 |
| 02 | unit | the levels table is read out of hq.policy.yaml itself, not from a doc | 3a59818 + a6050df + 01cb4c5 |
| 03 | contract | node .claude/scripts/hq/policy-lint.mjs on a violating file | 3a59818 + a6050df + 01cb4c5 |
| 04 | unit | bats tests/policy-lint.bats -- the four e2 rules, blanket scope | 3a59818 + a6050df + 01cb4c5 |
| 05 | contract | two ordered checks over ONE buffer: sha256 then parse | 3a59818 + a6050df + 01cb4c5 |
| 06 | contract | the literal E2 recipe against the real CONSTITUTION.md | 3a59818 + a6050df + 01cb4c5 |
| 07 | integration | filesystem identity, proven with REAL hardlinks | 3a59818 + a6050df + 01cb4c5 |
| 08 | unit | bats tests/policy-authorize.bats -- deny-by-default | 3a59818 + a6050df + 01cb4c5 |
| 09 | contract | bats tests/policy-reducer.bats + 5 committed JSONL streams | 3a59818 + a6050df + 01cb4c5 |
| 10 | unit | bats tests/policy-authorize.bats -- the three-valued decision | 3a59818 + a6050df + 01cb4c5 |
| 11 | unit | bats tests/policy-hardening.bats -- the total encoder | 3a59818 + a6050df + 01cb4c5 |
| 12 | contract | bats tests/policy-hostile.bats -- the corpus driver | 3a59818 + a6050df + 01cb4c5 |
| 13 | contract | node .claude/scripts/hq/policy-matrix.mjs --from .mcp.json | 3a59818 + a6050df + 01cb4c5 |
| 14 | integration | bats tests/policy-hook-matrix.bats against the REAL dispatcher | 3a59818 + a6050df + 01cb4c5 |
| 15 | static | the deny-floor assignment is derivable from the matrix | 3a59818 + a6050df + 01cb4c5 |
| 16 | static | ADR-0500 file layout | 3a59818 + a6050df + 01cb4c5 |
| 17 | integration | the full bats suite on three operating systems | 3a59818 + a6050df + 01cb4c5 |
| 18 | integration | two fresh agents, two surfaces, neither of which wrote the code | 3a59818 + a6050df + 01cb4c5 |
| 19 | contract | tests/fixtures/sync-golden/tree-manifest.txt regenerated and diff-checked | 3a59818 + a6050df + 01cb4c5 |
| 20 | static | initiatives/policy/PROGRESS.md + the spine receipt | 3a59818 + a6050df + 01cb4c5 |
| 21 | static | node .claude/scripts/plan/kickoff-lint.mjs --lane policy | 3a59818 + a6050df + 01cb4c5 |
| 22 | static | the phase-close receipt on the spine | 3a59818 + a6050df + 01cb4c5 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

<!-- paste the fidelity report here; the verdict line is the last line of its output -->

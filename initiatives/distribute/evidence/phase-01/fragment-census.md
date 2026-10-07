# Phase 01 — fragment and gate census (scope step 1), read 2026-10-07 at `c4e1d7de`

`_dispatch.sh` runs `PreToolUse`, `PreToolUse-edit` and `PreToolUse-read` in `blocking` mode, where a fragment exiting
2 blocks, the first block wins, and any other exit fails open. The other 4 events run in `advisory` mode.

## Blocking hook fragments (N = 9)

| Event | Fragment | What it actually refuses | Damage class | Merge-time twin today |
|---|---|---|---|---|
| PreToolUse | 00-destructive.sh | destructive shell command lines (whole-line scan, raw-payload fallback) | local | none, so it is advisory for non-Claude harnesses |
| PreToolUse | 10-design-composer.sh | any Bash from a `ui-composer` subagent except its own render | local (agent fence) | none |
| PreToolUse | 40-policy.sh | policy-engine L-level denials for Bash (`policy-decide.sh`) | local (agent capability) | none |
| PreToolUse | 50-deploy.sh | a deploy verb unless tests + `arc-gates.sh` pass | outward | none on the PR; deploy jobs are outside this repo's CI |
| PreToolUse-edit | 00-freeze.sh | an edit outside an `/arc-freeze` boundary | local (debug aid) | none |
| PreToolUse-edit | 10-design-critic.sh | a critic write outside `docs/design/critique/` | local (agent fence) | none |
| PreToolUse-edit | 11-design-composer.sh | a composer write outside its variant dir | local (agent fence) | none |
| PreToolUse-edit | 40-policy.sh | policy denials for Edit/Write (incl. the ADR-0502 un-grantable list) | local + repo (settings, policy files) | none |
| PreToolUse-read | 10-design-composer.sh | a composer read outside its allowlist | local (agent fence) | none |

## `arc.gates.yaml` rules (M = 7)

These are run by `arc-gates.sh`, which `50-deploy.sh` calls before a deploy. Bats suites test the gate SCRIPTS on
fixtures (`gates.bats`, `arc-scan.bats`, `rls.bats`, …), but **no CI job runs any of them against the PR's own tree or
diff.**

| Rule | Check | Mode | PR-diff run in CI today |
|---|---|---|---|
| scan | `arc-scan.sh --base main` (gitleaks/opengrep/osv/trivy) | profile | no |
| coverage | `coverage-gate.sh` | profile | no |
| reviews | `review-ledger.sh require-profile` | block | no |
| docs | `docs-drift.sh` | profile | no |
| rls | `rls-gate.sh` | block | no |
| spine-api | `spine-reader-lint.sh` | warn | no |
| design | `design-gate.sh` | warn | no |

## What this falsifies in the design source's Enforcement table

- **"Edit a generated file — Claude: `PreToolUse-edit` BLOCK"**: no fragment refuses that. The real guard is the CI dirty-diff (`engine-compile.bats` / `arc-compile --check`), so the tool-time cell is `none`.
- **"Commit a secret — Claude: `PreToolUse` BLOCK"**: no fragment scans for secrets. Gitleaks runs only inside `arc-scan.sh`, and nothing runs that on a PR. Today this row has **no enforcement at any level**.
- **"Commit straight to `main` — Claude: hook WARN"**: no fragment checks the branch. The CLAUDE.md rule is prose.

**Consequence for P01:** the merge-time column is mostly built in P01 rather than declared. That means a `selftest`
suite that runs the blocking gate commands against the PR head (`git diff origin/main...HEAD`): `arc-scan` (secrets
FAIL, not skip, on CI), `arc-compile --check --all`, and the rendered-directory dirty check. `engine/enforcement.yaml`
records each local-class fragment as `advisory` with its reason.

# Phase 08 shared-surface sweep — every existing gate against the committed self-render

Run 2026-10-14 on `feat/distribute-c3` with `.codex/`, `.opencode/`, `.agents/skills/` committed (177 files).
Local scripts here are lints, never suites. Suites ran on CI (PR #419).

| Gate | Where | Result | Exclusion needed |
|---|---|---|---|
| `arc-compile --check --all --input source --target codex/opencode/skills-only` (goldens + REQ-05 dirty scan) | local | 0 dirty, 177 files seen under the 3 rendered dirs | none: the dirty scan already matched rendered bytes (fixed-defects (bu), Cycle 2) |
| `arc-compile --check --all --target claude-code` (pre-commit line) | local | clean | none |
| `node bin/arc.mjs compile --self --check` (new) | local + pre-commit + `distribute-self-render.bats` | 0 findings | — |
| `brain-drift.mjs` | local | 16 headings, 0 drift (`AGENTS.md` untouched, sha unchanged) | none |
| `gate-parity.mjs` | local | 23 rows, 0 gaps (new row `action-stale-self-render`) | — |
| `product-lint.mjs` | local | all manifests valid (`self-render.mjs` added to `products/engine/manifest.json`) | — |
| `plan-bound-audit.mjs` | CI found it, then local | **red on the first push**: `arc-install` and `install-targets/self-render` write tracked files with no allowlist row; fixed with generator-reason rows (fixed-defects (cx)) | allowlist rows, not an exclusion |
| `wiki-build --check` | local | 153 files exact | none (the rendered dirs are not wiki inputs) |
| pre-commit secret scan (`secret-diff-scan.sh --staged`) | commit `161a384d` | passed over the 177 new files | none |
| `sync.bats` (sync golden) | CI | the rendered dirs sit outside the synced `.claude/` tree, so no rows moved for them; rows moved only for the edited synced scripts | none |
| `distribute-dirty.bats` | CI on `161a384d` | green on every leg | none |
| `docs-coverage.bats` (wiki-coverage) | CI on `161a384d` | green | none |

First CI run (`38481331638` @ `161a384d`): 13 of 19 jobs green. The 6 red jobs were 2 tests: `plan-bound-audit` (above)
and `distribute-self-render: the writer restores ...`. The second was a RAN check that knew only `--check`'s summary
line (fixed-defects (cw)). Both are fixed in the next commit.

PORTFOLIO's distribute row carries the cross-lane rule: a `.claude/{commands,agents,skills}` edit owes
`node bin/arc.mjs compile --self`, and the `--check` failure line prints that command.

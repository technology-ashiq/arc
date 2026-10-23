# REQ-04 -- `npm run ci` runs what CI's `quality` + `test` jobs run

Equal by construction, not by a kept-in-sync list: both call the same files.

| CI job step (ci.yml) | `npm run ci` |
|---|---|
| quality: `bash .claude/scripts/core/ci-quality.sh` | `bash .claude/scripts/core/ci-quality.sh` |
| test: `node .claude/scripts/core/ci-floor.mjs` | `npm run test:local` -> `... && node .claude/scripts/core/ci-floor.mjs` |
| node-test: `node --test --test-reporter=tap "tests/**/*.test.mjs"` | `npm run test:local` -> `node --test --test-reporter=tap "tests/**/*.test.mjs"` |
| (not in CI) | `npm run lint` (gate-parity, brain-drift, arc-compile --check; these run inside bats on CI) |

Missing from `npm run ci`, on purpose: the 4 bats shards (the full suite, ~4.3 h on Windows; pre-push runs the
changed lanes instead, REQ-05) and the ESLint trial step (`npm run lint:js`, WARN, CI-S). 0 gate steps missing.

## Deviations from the phase-01 spec (two-way doors, ci lane)

- ESLint lives in `tools/lint/` with its own lockfile, not as a root devDependency: arc's root must stay
  zero-dependency (distribute REQ-08, pinned by develop-capability.bats and distribute-cli.bats).
- Root `scripts.lint` and `scripts.test` are unchanged: distribute-ship-nodeploy.bats pins both, and the
  deploy guard (`PreToolUse.d/50-deploy.sh`) relies on `npm test` waiting for CI. The local suite is
  `test:local`; `ci:status` is an alias of today's `test`.
- pre-push calls `test-changed.mjs` directly: `npm run test:changed` would match distribute-ship-nodeploy's
  "npm test callers" grep over `.githooks`.
- Root `npm audit` is dropped: no dependencies, no lockfile. `security` audits `tools/lint` instead.

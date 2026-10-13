# ADR 2021 — `arc-ship` in a repo with no deploy target ships to a PR and reads CI

**Status:** accepted
**Date:** 2026-10-13
**Product:** `distribute` (edits the hand-written `.claude/commands/arc-ship.md`, synced to every consumer)
**Reversibility:** two-way
**Why two-way:** one command file, its renders and goldens; consumers with a deploy target see no behaviour change
**Revisit trigger:** arc itself gains a deploy target (the site at arc.automemory.ai moves into this repo's root), or a consumer reports `arc-ship` skipping a deploy it should have run.

## Context

REQ-03's loop ends in `arc-ship`. In arc it cannot run as written (survey 2026-10-13): `package.json` has no `scripts`, so `npm run lint|build|test` fail; there is no `vercel.json` or `.vercel/`; and AGENTS.md forbids running a test suite on this machine — "tests green" means green on CI. A REQ-03 run would either fail at step 1 or "pass" by skipping, and neither is arc's loop running.

## Options considered

1. **Drop `arc-ship` from REQ-03.** Cuts the REQ the owner asked to close.
2. **A separate `arc-ship-arc` command.** A second ship path that drifts from the one consumers get.
3. **Give arc real `lint`/`build`/`test` scripts and teach `arc-ship` one named branch: no deploy target declared → no deploy, the PR is the ship.**

## Decision

Option 3.

- **arc's scripts** (root `package.json`, no `prepare`/`install`, REQ-08 unchanged): `lint` = `node .claude/scripts/core/gate-parity.mjs && node .claude/scripts/core/brain-drift.mjs` `&& node .claude/scripts/engine/arc-compile.mjs --check --all --input source --target opencode` (lane-agnostic; `kickoff-lint` needs a lane; the compile check is the render the session runs under). **No `build` script** (amended 2026-10-13, CI on 4efbce5f): npm prepares a git dependency that declares `build`, `install`, `prepare` or `prepack` by running a full install inside it, and that broke `npm install -g <git URL>`; `arc-ship` runs `npm run build --if-present`, so a repo without one skips the step; `test` = `node .claude/scripts/review/ci-digest.mjs --wait` — it reads CI per job for the pushed head and runs nothing locally.
- **`ci-digest --wait [--timeout-min N]`** (default 20) re-reads every 60 s while the verdict is pending (exit 3) and returns the first settled verdict. If no run exists for HEAD after 5 minutes (arc's CI runs on PR and dispatch only, and a PR with `mergeable: CONFLICTING` gets no run — retro 2026-08-13) it exits 6 `NO-RUN` and prints `gh pr view --json isDraft,mergeable,state`. A timeout exits 3 with `TIMEOUT` named. Exit 4 (SHA mismatch) and every other settled code return at once and are never retried. Without `--wait` nothing changes.
- **`arc-ship` step 4** becomes: if the repo declares a deploy target (`vercel.json` or `.vercel/project.json`), deploy as today; otherwise print `deploy: none declared — the PR is the ship`, and `ship.done` carries the PR URL as `url`. Before step 3, if `gh pr view` finds no open PR for the branch, the command runs `gh pr create --fill`, since in arc the PR is what CI runs on. Steps 1–3 and the stop-at-first-failure rule are otherwise unchanged.
- The command's `allowed-tools` gains `Bash(gh pr view:*)` and `Bash(gh pr create:*)`. The wrapper's timeout for a ship run is at least the wait timeout plus 300 s. The claude-code, opencode, codex and skills-only goldens and the sync golden are regenerated in the same PR.

## Consequences

- `arc-ship` in arc does what shipping means for arc: lint, a render check, CI green per job, and a PR. The OpenCode session needs no arc-only command.
- A consumer without a deploy target now gets a named skip instead of a `vercel` error, a behaviour change listed in the PR.
- Nothing may call `npm test` from CI, a hook or a bats file: `test` waits on CI and would wait on itself. The P06 PR lists every `npm (run )?(test|lint|build)` caller found by `git grep`, the pre-deploy-guard's re-check named explicitly.
- `npm run test` in arc waits on CI, so `arc-ship` needs a pushed branch first. The REQ-03 run pushes before it ships, and the transcript shows the order.

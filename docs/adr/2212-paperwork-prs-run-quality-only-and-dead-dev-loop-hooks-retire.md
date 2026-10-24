# ADR 2212 — Paperwork PRs run quality only; dead dev-loop hooks retire; the session log is dropped

**Status:** accepted
**Date:** 2026-10-24
**Product:** `ci`
**Reversibility:** two-way
**Revisit trigger:** a docs-only PR that skipped `bats` merges a change that a bats suite would have failed (it shows up on the next code PR's run).

## Context

The 2026-10-24 dev-loop audit, filed through `/arc-change --lane ci`, found three costs:

1. 86 of 234 commits since 09-01 were docs-only PRs (57 phase close, evidence or kickoff), and each ran the full 19-job matrix.
2. Three dead hooks. `PostToolUse.d/00-format.sh` runs `npx --no-install prettier/eslint` on every edit with no `node_modules`, so it fails every time. `90-emit.sh` wrote 974 of 2,752 spine events (35%) as `tool.postuse`, and nothing reads them. `PreToolUse-read.d/10-design-composer.sh` spawns bash and git on every Read for a guard that only acts during explore runs.
3. `SessionEnd.d/00-session-log.sh` appends to the tracked `docs/session-log.md` in every session, so the tree is always dirty. Its "## Now" reads the root `PROGRESS.md`, which was last touched 07-31.

## Options considered

1. **Skip tests by a docs allowlist.** Cheap, but `kickoff-lint`, `portfolio-board`, `wiki` and `face-coverage` run as bats suites (ADR-2016), so paperwork would merge without them.
2. **Also run those five gates as scripts in `quality`, then skip `bats`/`node-test` for paperwork.** This works.
3. **Move phase evidence into PR bodies or CI artifacts** instead of a post-merge PR. Rejected: evidence bundles are committed, lane-scoped history (ADR-0055), and the change touches `/arc-phase-done` and the playbook. The skip already brings a paperwork PR down to `changes` + `quality` + `security`.

For the hooks: delete `00-format` and `90-emit`. Keep the composer read hook, which is a declared BLOCK in `engine/enforcement.yaml`, and give it an early exit when unarmed. Delete the session-log hook and untrack the file.

## Decision

Option 2 for paperwork, and the hook changes as listed. `sync-to-project.sh` gains a `RETIRED` list, so ventures lose only byte-identical stale copies, and an edited copy is reported and kept.

## Consequences

To free a REQ slot, REQ-03 (cost measurement) merges into REQ-01, which reads the same run in the same phase. REQ-11 is added, and Phase 01 grows from 1d to 1.25d out of the 0.5d slack. The five paperwork gates run twice on code PRs until their lanes migrate. That costs seconds and avoids a gap.

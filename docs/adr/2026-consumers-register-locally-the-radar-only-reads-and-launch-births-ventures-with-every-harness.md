# ADR 2026 — Consumers register locally, the radar only reads, and launch births ventures with every harness

**Status:** accepted
**Date:** 2026-10-14
**Product:** `distribute` (engine `arc-install.mjs`; `hq.jobs.yaml`; launch scaffold `products/launch/`; DST-Q)
**Reversibility:** two-way
**Why two-way:** the registry is a local file outside git, the job is one `hq.jobs.yaml` row, and the slot is one catalog row; each can be removed without touching consumers
**Revisit trigger:** a consumer path appears in any tracked file (the registry leaked into git), or the radar's fixture shows a consumer file changed after a run.

## Context

`ventures.yaml` carries kill lines and a `repository:` name, never a local path, because machine paths are banned from
anything that reaches `PORTFOLIO.md` (ADR-1735's rule; the repo is public). A loop over installed consumers needs local
paths, so it needs a registry that never enters the repo. `hq.jobs.yaml:62-70` already runs `launch-watch` as a daily
`script` job (`budget.min 30`, `policy_kind process:launch-watch`, `catchup skip`). That is the shape a weekly read-only job copies.
The launch scaffold (`products/launch/launch.slots.yaml`, coverage derived by `launch-coverage.mjs`) births ventures, but
nothing in it installs arc into the new repo.

## Options considered

1. **Registry in the repo** (`ventures.yaml` gains `path:`). Violates the machine-path ban on a public repo.
2. **No registry; the radar scans the disk for `.arc-install.json`.** Slow, and it guesses which directories are the owner's.
3. **`~/.arc-private/consumers.json`, appended by `init` and pruned by `uninstall`. A weekly ₹0 script job reads it. A
   launch `core` slot calls `arc init`.**

## Decision

Option 3.

- **Registry:** `~/.arc-private/consumers.json` = `{version:1, consumers:[{path, added}]}`. The location is overridable
  only by `ARC_PRIVATE_DIR`, a test door named in the script header like `arc-event.mjs`'s doors. `init` appends the
  realpath (deduplicated), `uninstall` removes it, and both are atomic (write temp + rename). A missing or unparseable
  registry means `outdated --all` prints `registry: none` / `registry: unreadable <reason>` and exits 3, never 0 with an
  empty list.
- **`arc outdated --all`** runs `outdated` on each path and prints one line per consumer (`behind N` / `up to date` /
  `not-installed` / `missing-dir`). It never writes inside a consumer.
- **`distribute-radar`** is a new `hq.jobs.yaml` row: `type: script`, entry `.claude/scripts/hq/jobs/distribute-radar.mjs`,
  `cadence: daily@07:45` (the grammar has only `daily@`/`weekdays@`; the script acts once per 7 days and keeps its last day in
  instance state, as `launch-watch` does), a hidden `processes/distribute-radar.process.yaml` with `job_stub: true` (ADR-0504), `catchup: skip`, ₹0 (no model). It emits one `metric.observed` receipt (`{metric:
  "distribute.consumers_behind", value:N, consumers:M}`) with no paths in the payload (the spine is tracked). The full
  per-consumer list goes only to stdout and the job log. Its row in `hq.policy.yaml` is born at L1 with its capabilities declared.
- **Launch `core` slot:** the scaffold gains a slot that runs `node bin/arc.mjs init --dir <venture>` from the arc
  checkout, so a venture is born with every harness and a v2 manifest, and the radar sees it the same week. The slot's
  name and tier are confirmed with the launch lane (a paste-ready prompt to that session, ADR-0053's cross-lane rule)
  before P10 writes the catalog row.

## Consequences

- The radar can report only what was installed by a CLI that registers. Cycle 1's `arc-sandbox` install predates the
  registry, so P10 registers it once with `arc init` re-run (idempotent) or a documented one-line append.
- A consumer moved on disk shows as `missing-dir` until the owner re-inits it. The radar never guesses a new path.

## Evidence

- `hq.jobs.yaml:62-70` (launch-watch row shape); `products/launch/{launch.slots.yaml, manifest.json}`, `launch-coverage.mjs --require-core-vetted` (survey 2026-10-14).

**Confidence:** high on the job shape; medium on the launch slot, whose catalog contract is the launch lane's and is confirmed before use.

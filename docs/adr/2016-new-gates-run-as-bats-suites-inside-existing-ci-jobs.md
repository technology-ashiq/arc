# ADR 2016 — new merge-time gates and the clean-machine proof run as bats suites inside the existing CI jobs

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way
**Revisit trigger:** a gate needs a runner the `selftest` matrix does not provide (a service container, or a secret), or the owner grants the session write access to `.github/`. A named workflow job then replaces the bats route.

## Context

The design source asks for "CI jobs named so they can be required checks" and for a "clean-runner job". The session cannot write under `.github/` (permission-denied, `github-dir-write-denied-route-gates-through-bats`). Prior lanes landed new CI gates as bats suites that the existing `ci.yml` jobs already shard across three OS legs. Every CI job runs on a fresh hosted runner. `ci.yml` today has the jobs `ci-tier` and `selftest`.

## Options considered

1. **New workflow jobs** — clean names for the required checks. But each one needs an owner edit to `.github/` per gate, which stalls every phase on a paste task (`never-hand-ashiq-code-shaped-tasks`).
2. **Bats suites in the existing shards** — no `.github/` edit. The required checks name the existing `selftest` check-runs, and a red gate turns its shard red.

## Decision

Option 2:

- **The gates.** `tests/distribute-gate-parity.bats`, `tests/distribute-brain-drift.bats`, `tests/distribute-matrix.bats` and `tests/distribute-compile-<target>.bats` run inside `selftest`.
- **The REQ-08 clean-machine proof.** `tests/distribute-install-clean.bats` runs on each OS leg's fresh runner. It runs `npm pack` into a temp dir, then `npm i -g --prefix <tmp>` from the tarball, then `npx --yes github:technology-ashiq/arc#<head-sha>`, then `arc doctor` against a temp target. It asserts each step RAN before asserting its output.
- **The required checks.** REQ-09 names every `selftest` check-run plus `ci-tier`. A gate's bats file therefore cannot go red without blocking the merge.

## Consequences

A gate's failure surfaces as "selftest (os, shard N)" rather than under its own name. The bats test name carries the gate's name, so `ci-digest.mjs` shows it. The git-URL arm needs the PR head to be fetchable from GitHub, which holds on PR runs. The memory rule `bats-shard-order-ambient-state` applies: every new suite builds its own temp tree and reads no untracked repo state.

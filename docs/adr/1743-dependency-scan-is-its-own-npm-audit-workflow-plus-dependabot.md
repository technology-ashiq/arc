# ADR 1743 — dependency-scan is its own npm-audit workflow plus Dependabot, verified by a green audit run

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a venture moves off npm, or GitHub's dependency review action becomes free on private repos

## Context

The exit criterion is "CI gate", and REQ-06 asks for "`dependency-scan` gate present on the venture CI". The ci slot
owns `arc-ci.yml` (ADR-1726). Editing it from a second slot would give one file two owners.

## Decision

- The adapter commits two files, both with this slot's trailer. `arc-ci.yml` is never touched.
  - `.github/workflows/dependency-scan.yml`: one `audit` job that runs `npm install --package-lock-only
    --ignore-scripts` and then `npm audit --audit-level=high`, on every push, every PR and weekly.
  - `.github/dependabot.yml`: weekly npm and Actions updates.
- verify checks that both files are launch's at main's head. It then finds the dependency-scan run for that head
  (polling while one is in progress) and requires its `audit` job to be `success`. The gate is present and green, as
  GitHub answers it.
- Upstream: `ci` names the repo. Row: `GITHUB_TOKEN`, `api.github.com`.

## Consequences

- A high or critical advisory in the shell's pinned dependencies fails the slot until the pin moves. That is the gate
  doing its job.

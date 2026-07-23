# ADR 0025 — SPINE-B: Spine data lives in the instance at `.claude/state/hq/`, never in the sync payload

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** two-way
**Revisit trigger:** a future cycle needs cross-instance aggregation (e.g. HQ dashboard over
multiple ventures) → new ADR for an explicit export/ingest contract; relocation is a
migration script away since the reader is the only access path (ADR-0030).

## Context

Spine events contain operational detail (actions, money, run outcomes) that is per-instance
truth, not mold content. arc's sync is manifest-driven (`sync-to-project.sh` +
`.claude/scripts/core/arc-products.mjs`); `.claude/state/` is already excluded from the
payload (a `.ps1` leak of it was a fixed Phase-0 bug), and the golden bare-sync gate asserts
byte-identical payloads.

## Options considered

1. **Instance data at `.claude/state/hq/` (events + quarantine + derived state), excluded
   like the rest of `state/`** — chosen.
2. **Repo-tracked events** — rejected: secrets/PII blast radius, payload pollution, merge
   conflicts on append, golden bare-sync gate violated.
3. **External DB/service** — rejected: no-go list (no Postgres, no HTTP listener, zero-dep).

## Decision

Spine data lives in the INSTANCE at `.claude/state/hq/` — never in the mold's payload, never
synced, excluded exactly like `state/` (golden bare-sync gate untouched). Module CODE ships
as the `hq` product (`products/hq/manifest.json` + `.claude/scripts/hq/`); module DATA never
leaves the instance.

**Evidence:** sync exclusion of `.claude/state/` verified in repo 2026-07-22; golden
bare-sync fixtures exist in `tests/fixtures/sync-golden/`. **Confidence:** high.

## Consequences

- A consumer repo gets spine capability by installing the `hq` product; its events are its own.
- Backup/retention of `.claude/state/hq/` is the instance owner's concern (day-close sha
  makes tampering detectable — ADR-0029).
- The bare-sync golden must stay byte-identical this cycle: `hq` installs only via
  `--products hq` until a deliberate golden update.

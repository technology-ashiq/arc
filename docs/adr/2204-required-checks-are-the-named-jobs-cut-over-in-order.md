# ADR 2204 — Required checks are the named jobs, cut over in the §5 order

**Status:** accepted
**Date:** 2026-10-24
**Product:** `company`
**Reversibility:** two-way
**Revisit trigger:** a PR is blocked as "expected" on a job skipped by `if:` (PLAN A-03).

## Context

ADR-2015 requires every `selftest (…)` check-run plus `ci-tier`, with `enforce_admins: true`. Once those names stop being produced, a PR can never merge, the owner's included. ADR-2016 routed new gates through bats because `.github/` was write-denied.

## Options considered

1. **Require every shard by name.** Every shard-count change then becomes a protection edit.
2. **Require the stable names `quality`, `test`, `security`, `face`, `ci-tier`.** `test` is an aggregator over the bats shards and `node-test`, so shards can change and bats can disappear without touching protection.

## Decision

Option 2, cut over in `PLAN-ci.md` §5 order. The new jobs report once on the Phase 00 PR. The session then STOPs and prints the step-2 list, and the owner removes the old names and adds the new ones in one sitting (keeping `strict`, `enforce_admins`, no force-push, no deletion). Merge follows, then a verify run on `main`'s head, and only then the visibility flip. A session never edits protection.

## Consequences

This amends ADR-2015's check list and relaxes ADR-2016's premise: gates may now be named jobs. `engine/enforcement.yaml`'s `repo:required-checks` row stays valid.

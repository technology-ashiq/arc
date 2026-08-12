# ADR 0902 — bench builds the replay test driver and the version verb, amending a no-go

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** the engine or executor lane ships its own `drivers/mock` — bench's is then
deleted, not kept in parallel, and the contract test moves to whichever survives.

## Context

Two inherited contracts bench's plan depends on do not exist:

1. **`drivers/mock` (ENG-F, pinned replay).** `PLAN-bench.md:147-149` makes it the substrate
   bench's own tests run against ("offline-first"), and names it the fake half of the ENG-D
   contract at `:178`. It was only ever *planned* —
   `PLAN-engine-process-layer.md:128` says it "ships in Phase 2", and it never did.
   `arc-run.mjs:45` registers exactly `["claude-code", "codex", "generic-api"]` and `:113`
   rejects anything else, so `--driver mock` is unroutable today.
   What exists instead is an env-var fake **on the real code path**: `ARC_DRIVER_FAKE=<dir>`
   (`drivers/common.mjs:20-24, 94-102, 180-191`) with fixtures under
   `tests/fixtures/engine/driver-fakes/{good,badschema,declined,driverfail,secret}/`. It works,
   but it is not selectable via `--driver` and cannot be named in a provenance record.
2. **Driver `--version`.** BEN-B makes "driver name + `--version`" a mandatory provenance
   field, and `docs/strategy/plans/README.md:42` claims engine C6 shipped it. It did not:
   zero `/version/i` matches in any driver file in any arc workspace, and `common.mjs:152`
   rejects every verb except `run`.

Both sit against the no-go **"no new-driver creation from inside bench (drivers = engine/
executor territory)"**. The owner's 2026-08-12 ruling (ADR-0900) forbids waiting for another
lane to supply them.

## Options considered

1. **Bench builds both** — a minimal `drivers/mock` honouring the ADR-0203 contract, plus a
   `version` verb on the three existing driver scripts.
2. **Declare both a blocking cross-lane dependency on engine** — contract-correct, and it
   stalls bench indefinitely against an explicit ruling not to wait.
3. **Skip both** — live-driver tests only (breaks offline-first, and makes bench's own test
   suite cost money), recording driver version as `unknown` forever.

## Decision

**Option 1, with the no-go amended in this file rather than quietly widened.**

The no-go's purpose is to stop bench inventing *provider integrations* — a new way to reach a
model vendor. Neither addition does that:

- `drivers/mock` reaches **no provider at all**. It replays pinned bytes from a fixture
  directory and is a test harness wearing the driver interface.
- `version` adds a **verb to scripts that already exist**, changing no provider path.

**Scope fence, so this cannot grow:** bench may add the mock driver and the `version` verb, and
may touch nothing else under `.claude/scripts/engine/drivers/`. Any change to `claude-code.mjs`
beyond reporting a version is out of scope and belongs to engine.

**The verb lands on `claude-code` and `mock` ONLY.** `codex` is not installed and
`generic-api` has no credentials, so neither produces a receipt this cycle and neither is
exercised by any REQ. Adding the verb to two unreachable drivers would buy no benching
capability while widening bench's diff on a tree it does not own — and that tree is a shared
company organ with three other lanes live in sibling worktrees.

`drivers/mock` reports version `mock@<fixture-dir-sha>` so a replay run is never mistaken for a
provider run — the "real vs simulated never mixed" non-negotiable, enforced at the one place
the two could be confused.

## Consequences

**Easier:** bench's whole suite runs offline and for free, and `--driver mock` is nameable in a
provenance tuple in a way `ARC_DRIVER_FAKE` never was.

**Harder:** these are **shared files owned by another lane**. `.claude/rules/lanes.md` applies:
run `git log origin/main --oneline -5 -- .claude/scripts/engine/drivers/` before editing, and
at any merge take the stronger version rather than the earlier one. Engine is IDLE today, which
makes the collision risk low but not zero.

**The trap this must avoid:** `docs/retro-log.md` 2026-08-03 records a fake that
short-circuited the code path it existed to exercise — `ARC_DRIVER_FAKE` returned before
`produce()` ran, so "every driver satisfies the same contract" passed for three drivers while
none of their real code executed. `drivers/mock` therefore swaps the **response**, never the
code path, and Phase 0 asserts the real path separately.

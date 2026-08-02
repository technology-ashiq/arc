# ADR 0102 — One local commit per proven slice; the session commits, never the harness

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** slices become small enough that per-slice commits bury the phase's real history,
or a checkpoint needs a baseline the working tree cannot express.

## Context

DEV-I's checkpoint health checks — complexity/coupling delta, public-API surface diff, churn — are all
defined as *deltas vs the last checkpoint*. A delta needs a baseline that survives between sessions
and that a script can name. Nothing in the design source says where that baseline comes from.

The second half of the question is authority, not mechanism: `CLAUDE.md` reserves git actions to the
owner, and `/arc-develop` writing to git on its own would cut against that.

## Options considered

1. **Commit per proven slice, made by the main session** — step 6 of the slice loop commits locally
   once proof output is pasted; the SHA goes in the ledger row. Checkpoints get a real reference and
   every proof is bound to the exact code it proved.
2. **The harness auto-commits** — least friction, guaranteed SHAs. But `/arc-develop` would write to
   git on the owner's behalf, and an auto-commit mid-slice is awkward to undo when a proof later turns
   out to be wrong.
3. **No per-slice commit; snapshot baseline** — slices accumulate uncommitted, checkpoints diff
   against a working-tree snapshot in `.claude/state/develop/`. Keeps history coarse, but it is a
   whole second baseline mechanism to build and test, gives no proof-to-code audit trail, and
   snapshots in disposable local state can vanish between sessions.

## Decision

Option 1. `develop-lint` refuses to tick a slice whose block has no `commit:` field, and
`/arc-develop` never invokes git itself.

The one reason that carried the most weight: it buys the checkpoint baseline and the proof-to-code
audit trail with a mechanism that already exists, instead of building a second one.

Push cadence is untouched and stays the owner's — this is local commit granularity only, so batching
pushes so each one buys a full CI cycle is unaffected.

Owner decision, 2026-08-02, at kickoff step 2b.

## Consequences

Easier: `git log` becomes the slice history for free; a failed proof reverts to a known SHA; churn
and API-surface diffs are a `git diff <sha>` away with no new storage.

Harder: a slice that is proven but not yet committed is a lint BLOCK, which adds a step to the loop.
Squashing before a PR becomes a deliberate act rather than a default.

What we would revisit if this goes wrong: if per-slice commits make phase history unreadable, the fix
is a squash-at-handoff step that rewrites the ledger's `commit:` fields to the squashed SHA — not a
return to snapshots.

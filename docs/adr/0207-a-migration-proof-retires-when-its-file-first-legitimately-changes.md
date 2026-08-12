# ADR 0207 — A migration proof retires when its process file first legitimately changes

**Status:** accepted
**Date:** 2026-08-11
**Product:** `engine`
**Reversibility:** two-way
**Revisit trigger:** a retired file turns out to have been changed by mistake rather than by
decision — at which point the fix is to revert the change, not to un-retire the proof, because a
proof that can be switched back on after the fact was never load-bearing.

## Context

ADR-0201/0202 migrated three hand-written commands into `processes/*.process.yaml`. To prove the
migration lost nothing, each process file pins the pilot **as it was before the flip** — a
committed fixture under `tests/fixtures/engine/pre-flip/`, cross-checked against a `sha256` in the
file's own `baseline:` block. Two gates read it: `arc-compile --against-baseline` (REQ-02) and the
block-scalar round-trip in `tests/engine-process-lint.bats`.

The proof's claim is precise: **"this process file still reproduces the hand-written command it
replaced."**

On 2026-08-11 the `memory` lane tried to add an additive step to
`processes/kickoff-plan.process.yaml` — the mechanism ADR-0704 and ADR-0201/0202 both require for
hooking a generated command. Three gates went red, correctly: once a process file gains a step, it
no longer reproduces the pre-flip command, and the proof's claim becomes false.

All three migrated files pin the same commit and **none had been edited since migration**. That
lane was the first to try, which is why this had never surfaced.

The three available responses are not equal:

- **Re-pin `baseline.sha256` to the current render.** Refused. The check would then compare a
  render against a file that render just produced. A real gate silently becomes a tautology, and
  the `[baseline-drift]` cross-check that exists specifically to stop self-certifying pins would
  be doing the opposite of its job.
- **Hand-edit the generated command instead.** Refused by ADR-0201/0202, and deleted by the next
  `arc-compile --write`.
- **Retire the proof for that file, once, at the moment it first legitimately changes.**

## Decision

**A `baseline:` block may carry `retired:` — a date and a one-line reason. Both baseline gates
then SKIP that file and report it as retired, counted separately and never folded into the
byte-identical total.**

Retirement is per-file and one-way in practice: the other two pilots keep their proof until they
too legitimately change.

ADR-0202 already framed `--migration` as *"a migration-window flag, not a permanent mode"*. This
records what closing that window looks like for one file, rather than leaving every migrated
process permanently unable to gain a step.

## Consequences

**What is kept.** The proof did its job: all three pilots were shown byte-identical to their
hand-written originals at the flip, and that fact is in git forever. The `[baseline-drift]`
cross-check still guards every file that has *not* retired, so the remaining pilots cannot quietly
re-pin themselves.

**What is given up.** For a retired file, `--against-baseline` no longer proves anything. The
protection that remains is the **codex golden** (a recorded output, which is *supposed* to move
and whose movement must be committed) and the `--check` byte-diff against the generated file. That
is the right trade: the first protects a historical claim, the second two protect the live one.

**What this unblocks.** `memory`'s REQ-03 and REQ-08 — recall arriving at kickoff and review
without being asked. More generally: **a migrated process file can be changed at all.** Without
this, the process-file mechanism was write-once, and "hooks land in process files" was a rule no
hook could follow.

**What must not happen.** Retiring a proof to make a red gate green, without a decision. The
`retired:` field carries a reason for exactly that reason: a reader can see whether the change
that retired it was one somebody chose.

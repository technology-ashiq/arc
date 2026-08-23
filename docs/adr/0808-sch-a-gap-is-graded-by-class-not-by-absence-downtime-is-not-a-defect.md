# ADR 0808 — a gap is graded by CLASS, not by absence; machine downtime is not a scheduler defect

**Status:** accepted — criterion changed now, classification mechanism deferred with ADR-0807
**Date:** 2026-08-23
**Product:** `scheduler`
**Reversibility:** two-way
**Revisit trigger:** a downtime classification is built and a real scheduler failure is ever filed under it — then the class is absorbing defects and the audit is back to grading "broke no rule".

## Context

`audit.mjs` computes CLEAN / NOT CLEAN, and NOT CLEAN means one thing: at least one expected slot
has no `run.completed` and no explanation. The explanation rule is deliberately strict, and the
comment in the code says why:

> AN EXPLANATION MUST COME FROM THE SCHEDULER ITSELF. […] seven hand-written `note.logged` events
> with a session actor turned a completely dead scheduler into a CLEAN week.

**That rule is correct and this ADR does not weaken it.** It is what stops the fire-drill's
required true positive being erased by hand.

But it has a consequence nobody wrote down. An explanation must carry the actor
`scheduler:<job>`, and **a powered-off machine emits nothing.** So a day the machine was shut down
can never be explained by anything, and any window containing one can never grade CLEAN. The
Phase-03 exit criterion — *"gap audit clean (every expected slot has either a `run.completed` or an
explained absence)"* — is, as written, **unreachable on a laptop that gets shut down.**

This is not hypothetical. The restarted proving window contains exactly such a day:

```
NOT CLEAN: 2 unexplained gap(s)
  MISSED 2026-08-20T00:15:00+05:30   (day-close-roll)
  MISSED 2026-08-20T06:00:00+05:30   (brief-materialize)
```

There is no `events/2026-08-20.jsonl` on the spine at all, and the next receipts land at
2026-08-21T14:56 — a wake-time, not a slot-time. The machine was off. Nothing arc owns failed on
2026-08-20, and yet the instrument that grades arc says the week is dirty.

**The defect is in the criterion, not in the machine and not in the audit.** An exit criterion
that cannot be met by a correct system is a criterion that will eventually be met by lowering it
quietly, which is the failure mode this whole lane is built to refuse.

## Options considered

1. **Relax the explanation rule to accept a session actor** — rejected outright. It is the exact
   hole the code comment records having already been exploited: seven hand-written notes graded a
   dead scheduler CLEAN. Reopening it to fix a criterion problem trades a real detector for a
   convenient verdict.
2. **Drop "gap audit clean" from the DoD** — pros: honest about what is measurable. Cons: throws
   away the criterion that catches the thing that matters. A week with real silent deaths would
   then close as cleanly as a week with none.
3. **Grade gaps by CLASS, and require that no gap is of the one class that indicts arc** — every
   gap keeps being reported, individually, with its slot; what changes is that the verdict asks
   *what kind* of gap, not *whether any*. The class that fails a week is **"arc was running and
   the job did not fire"**. The class that does not is **"the machine was not running"**.
4. **Infer downtime in the audit from spine silence** — a day with zero events of any kind was
   probably an off day. Rejected as the primary rule: a genuinely quiet day is indistinguishable
   from an off day, so this hands the audit a way to excuse itself.

## Decision

**Option 3.** A gap is graded by class. Concretely, two changes, and only the first lands now:

**Now — the criterion.** Phase 03's exit criterion changes from *"gap audit clean"* to: **every
gap in the window is classified, and zero gaps fall in the class "arc was running and the job did
not fire".** The audit keeps printing every gap with its slot, and keeps printing NOT CLEAN — the
verdict line does not become friendlier. What changes is which verdict closes a phase. A window
with downtime and no arc-side gap closes; a window with one arc-side gap does not, exactly as
before.

For the current window this is settled by evidence rather than by a mechanism: the absence of
`events/2026-08-20.jsonl` **combined with** the 2026-08-21T14:56 wake-time catch-up receipts
classifies 2026-08-20 as downtime. That is inference, it is written down as inference, and it is
the last time it is allowed to be — which is what the second change is for.

**Deferred — the mechanism.** Downtime stops being inferred and starts being witnessed: on its
next run a job emits one incident per slot it owed and could not serve, actor
`scheduler:<job>`, carrying `scheduled_for` and a `class`. The audit then files those under
`explainedGaps` through the existing actor-checked path, with **no change to the explanation rule
at all** — the scheduler explains itself, which is precisely what the rule always demanded and
what an off machine could not do. This ships with ADR-0807's logon trigger, because the same logon
run is what discovers the owed slots in the first place.

**The guard that keeps this honest:** a class that can absorb a real failure is worse than no
class. The deferred mechanism may only mark a slot as downtime when the job can show it was not
running at that slot — never merely that it has no receipt for it. The revisit trigger at the top
of this ADR exists to catch it if that guard slips.

**Evidence:** `.claude/scripts/hq/lib/jobs/audit.mjs` lines 195–234, the actor check and its
comment, read in full · `arc-jobs audit --from 2026-08-17 --to 2026-08-22` output · absence of
`events/2026-08-20.jsonl` · the 2026-08-21T14:56 catch-up receipts.
**Confidence:** high that the criterion is unreachable as written — that follows from the actor
rule and needs no data. High that 2026-08-20 was downtime. Medium on the classification mechanism
being sufficient in general, which is why it is deferred rather than asserted, and why the
"cannot merely mean no receipt" guard is written into the decision rather than left to the build.
**Rejected because:** option 1 reopens a hole the code already records being exploited. Option 2
discards the criterion instead of correcting it. Option 4 lets the audit excuse itself on a quiet
day.

## Consequences

**Easier.** Phase 03 can close on the week it actually had, with the 2026-08-20 downtime named as
downtime rather than either ignored or counted as a scheduler failure. The DoD becomes a criterion
a correct system can meet.

**Harder.** "Classified" is a weaker word than "clean", and weaker words rot. The mitigation is
that the classification is not free text and not a human's call — it is a class emitted by the job
itself, checked by actor, and the one class that fails a week is named explicitly rather than left
as "anything bad". Until the mechanism ships, one gap in one window is classified by written
inference, and that is a debt with a name and an owner, not a precedent.

**What we would revisit if this goes wrong.** If downtime classification starts appearing on days
the machine was demonstrably on, the class is being abused and the audit reverts to the strict
CLEAN rule with the exit criterion rewritten instead as an explicit downtime *budget* — N off days
tolerated per window, stated in advance.

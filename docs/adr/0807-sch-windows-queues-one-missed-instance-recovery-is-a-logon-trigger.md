# ADR 0807 — Windows queues at most ONE missed instance; multi-slot recovery is a logon trigger

**Status:** accepted — decision recorded, implementation deferred to the next cycle (see Consequences)
**Date:** 2026-08-23
**Product:** `scheduler`
**Reversibility:** two-way
**Supersedes:** the open question carried by ADR-0804 (not the ADR — ADR-0804's `WakeToRun = false` decision stands and is reinforced by this finding)
**Revisit trigger:** a logon-triggered recovery run is built and the gap audit still shows a slot with no `run.completed` after a wake — then the queueing model is wrong in a second way and the answer moves to a resident check at session start.

## Context

ADR-0804 chose `StartWhenAvailable = true` over `WakeToRun`, and was explicit that one thing was
unverified: *"whether Windows abandons a queued missed run after some window; no such limit was
found documented, and absence of a documented limit is not proof there is none."* That gap was
carried as an assumptions-ledger row with a named trigger, and the Phase-3 proving week was built
to measure it.

**The trigger fired on 2026-08-23, and the answer is worse than the question.**

The machine was off through 2026-08-20 — there is no `events/2026-08-20.jsonl` on the spine at
all. On the next wake, both jobs caught up. The receipts:

| Receipt | Fired at | Slot it carried |
|---|---|---|
| `scheduler:day-close-roll` | 2026-08-21T14:56:25+05:30 | `2026-08-21T00:15:00+05:30` |
| `scheduler:brief-materialize` | 2026-08-21T14:56:25+05:30 | `2026-08-21T06:00:00+05:30` |

Both jobs had **two** slots outstanding — 08-20 and 08-21. Both caught up exactly **one**, and
the one they caught up was the newer. The 08-20 slots produced no receipt then and never will.

**So the failure is not the time window ADR-0804 feared.** Task Scheduler does not hold a queue of
missed instances that expires; it holds **at most one pending instance per task**, and a second
missed slot overwrites the first. This is consistent with every observation to date and explains
why the two single-slot catch-ups already on record (11:48 and 12:49, both recovering one slot)
looked like proof that queueing worked. They were proof that queueing works **for one**.

The practical consequence: `StartWhenAvailable` is *late, not dropped* for a machine asleep across
one slot, and *silently lossy* for a machine asleep across two. A laptop shut for a weekend loses
every slot but the last.

## Options considered

1. **Accept the loss and report it** — pros: nothing to build; the audit already catches it. Cons:
   the lane's whole premise is that a missed run is visible and recoverable, and "the weekend is
   lossy by design" is a heartbeat with a hole in it. `day-close-roll` is idempotent and multi-day
   *precisely so* a slept-through night is sealed, and this defeats that work for any gap over one
   night.
2. **`WakeToRun = true`** — rejected again, and harder than in ADR-0804: this machine is Modern
   Standby only (`powercfg -a`: S0 Low Power Idle, S1/S2/S3 firmware-unsupported, hibernation
   disabled), and `WakeToRun` has no documented behaviour on S0. It also does not address the
   finding — a machine that is *shut down*, not asleep, cannot be woken by any setting. 2026-08-20
   produced no spine file at all, which is a powered-off day, not a sleeping one.
3. **A logon-triggered recovery run** — a second trigger on the same task (`-AtLogOn`), so the job
   also fires when the owner signs in. Windows has no opinion about firmware here, and the case it
   covers — *the machine was off and is now on* — is exactly the case that loses slots.
4. **A catch-up sweep at session start** — the SessionStart hook already runs; it could invoke
   `arc-jobs catchup`. Cons: it makes the heartbeat depend on a Claude session being opened, which
   is the attended path the cron flip exists to replace.

## Decision

**Option 3, and ADR-0804 already named it.** Its own closing line reads: *"If proving-week data
shows queued runs are being dropped rather than delayed, the answer is not `WakeToRun` — it is a
login-triggered task, which depends on nothing the firmware has an opinion about."* The data now
says dropped. The remedy was pre-committed before the evidence existed, which is the only order in
which a remedy is not a rationalisation.

Concretely: each job's registration gains a second trigger at logon, and the wrapper's existing
slot-floor and `job@slot` idempotency do the rest — a logon run computes the slots it owes and the
idem key stops it double-serving a slot the OS already ran. **No new dedup mechanism is
introduced**, which matters: the lane bans a second hand-rolled anything.

`catchup: run` and the multi-day roll (ADR-0805) stay exactly as they are. They are what makes a
single logon run able to repay several days at once.

**Evidence:** `events/2026-08-21.jsonl`, both `run.completed` receipts read in full, slot fields
quoted above · absence of `events/2026-08-20.jsonl` · `arc-jobs audit --from 2026-08-17 --to
2026-08-22` reporting `MISSED 2026-08-20T00:15:00+05:30` and `MISSED 2026-08-20T06:00:00+05:30` ·
`initiatives/scheduler/evidence/phase-03/week-log.md` §2026-08-23.
**Confidence:** high on the observation — two independent jobs, two outstanding slots each, both
recovered exactly the newer one, from receipts rather than inference. Medium on the mechanism
being "one pending instance per task" as a general Windows rule: that is the reading most
consistent with this data and with the two earlier single-slot catch-ups, and it is **not** taken
from documentation, which says nothing on the point. The remedy does not depend on the mechanism
being named correctly — a logon trigger repays whatever was missed either way.
**Rejected because:** option 1 — a heartbeat that is lossy across any two-night gap does not
support the claim this lane exists to make. Option 2 — unspecified on this hardware's only sleep
state, and structurally unable to help a powered-off machine. Option 4 — reintroduces the attended
dependency the cron flip removed.

## Consequences

**Easier.** The recovery path stops depending on an undocumented Windows queueing depth. A weekend
of downtime repays itself on the next sign-in rather than vanishing.

**Harder.** A logon trigger fires on *every* logon, so the wrapper's idempotency moves from a
safety net to a load-bearing control — a fixture must prove that N logons in a day serve a slot
exactly once, and that a logon run with nothing owed exits without writing a receipt at all. The
brief panel's overdue arithmetic also needs re-reading against a job whose real cadence is now
"scheduled OR at logon", because a healthy job may legitimately run at odd times.

**Implementation is deferred, and deliberately.** This cycle's appetite is 3 days and 2.5 are
burnt; the remaining 0.5 is the audit and retro that close Phase 03. Building a second trigger,
its idempotency fixtures, and the panel re-read inside that 0.5 would be a silent extension, which
the kill criteria forbid. **The proving week's job was to find this, and it found it.** The finding
is the deliverable; the remedy is the next cycle's opening phase, entered with a measured defect
rather than a guess.

**What we would revisit if this goes wrong.** If a logon-triggered run still leaves gaps, the
queueing model is wrong in a second way and the honest answer is a check that runs on every arc
session start *in addition to* the OS triggers — accepting the attended dependency as a backstop
rather than as the primary path.

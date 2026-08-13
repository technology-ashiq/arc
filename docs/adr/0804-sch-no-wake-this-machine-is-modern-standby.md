# ADR 0804 — the laptop is never woken to run a job; missed slots are caught on next wake

**Status:** accepted
**Date:** 2026-08-12
**Product:** `scheduler`
**Reversibility:** two-way
**Revisit trigger:** a day-close seal is measurably missed (not merely late) during the Phase-3 proving week, or the spine shows a gap no catch-up filled — the wake question reopens with real data instead of a preference.

## Context

`PLAN-scheduler.md` §13.3 put this to the owner as a genuine fork: does the laptop **wake** at
00:15 so the day-close seal is guaranteed nightly (costing sleep and battery), or does it use
"run when available" plus `catchup: run`, letting the seal land at the next wake?

The design source framed it as a preference. It is not — the hardware has already decided it.

`powercfg -a` on this machine reports exactly one available sleep state:

```
Standby (S0 Low Power Idle) Network Connected
```

S1, S2 and S3 are all unavailable ("system firmware does not support this standby state"),
Hibernate is not enabled, and Hybrid Sleep is unavailable in consequence. This is a
Modern-Standby-only machine.

`WakeToRun` has **no documented behaviour on Modern Standby** — the official element and
property pages predate it and say nothing, and no default value is stated for the setting
anywhere. The only evidence that it fails on S0 is community reporting on Microsoft Q&A, which
is not a specification. So the honest position is not "wake is worse"; it is that **wake cannot
be relied on here, and no official source promises otherwise.**

## Options considered

1. **`WakeToRun = true`, guarantee the nightly seal** — pros: the seal lands on the day it
   belongs to. Cons: rests on unspecified behaviour on the only sleep state this machine has;
   an unreliable guarantee is worse than an honest best-effort because the brief panel would
   stop flagging a real gap.
2. **`StartWhenAvailable = true` + `catchup: run` on the seal** — pros: rests on documented
   behaviour; costs no sleep or battery; the day-close roll is already designed idempotent and
   multi-day for exactly this case (round-4 fix D1). Cons: the seal is late by however long the
   machine stays asleep, and a missed-run window past which Windows abandons a queued task
   could not be verified to exist or not exist.

## Decision

**Option 2.** `WakeToRun = false`. `StartWhenAvailable = true` (its documented default is
`false`, so it is written explicitly per ADR-0803). `day-close-roll` keeps `catchup: run`.

The reason that carried the most weight: the design source already engineered for this outcome.
Round-4 fix D1 moved the seal to 00:15 and made the roll idempotent and multi-day *precisely so
that a slept-through night is caught up rather than skipped*. Choosing wake would have made that
work redundant while depending on a setting this hardware does not document as honouring. The
plan's own fallback is the stronger design, and the hardware makes it the only one.

A late seal beats no seal; a seal that everyone believes is guaranteed and silently is not, is
the worst of the three.

**Evidence:** `powercfg -a` run on this machine 2026-08-12 — S0 Low Power Idle only; S1/S2/S3
firmware-unsupported; hibernation not enabled ·
[WakeToRun element](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-waketorun-settingstype-element)
(no default stated, no Modern Standby wording) ·
[StartWhenAvailable property](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-startwhenavailable)
(missed runs are queued and started after a delay; "The default delay is 10 minutes") ·
[StartWhenAvailable element](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-startwhenavailable-settingstype-element)
(`default="false"`).
**Confidence:** medium — the hardware fact is high-confidence and locally verified, and the
10-minute catch-up delay is documented. What is **unverified** is whether Windows abandons a
queued missed run after some window; no such limit was found documented, and absence of a
documented limit is not proof there is none. That gap is carried as an assumptions-ledger row
citing this ADR, and the Phase-3 proving week measures it.
**Rejected because:** option 1 — depends on behaviour unspecified for the only sleep state this
machine supports, and a guarantee that quietly is not one disables the very detector that would
report it.

## Consequences

**Easier.** No sleep or battery cost. Nothing depends on firmware behaviour that Microsoft does
not document. The seal is late-but-certain rather than on-time-but-hopeful.

**Harder.** `day.closed` for a given day may carry a wall-clock arrival well after that day —
the event's own `ts` is pinned to `<day>T23:59:59+05:30` by the CLI regardless, so the spine
stays coherent, but anyone reading file mtimes will see drift. And if the machine stays shut
for several days, the roll must seal several days in one run, which is why ADR-0805 puts the
multi-day loop in the job rather than assuming the CLI does it.

**What we would revisit if this goes wrong.** If proving-week data shows queued runs are being
dropped rather than delayed, the answer is not `WakeToRun` — it is a login-triggered task, which
depends on nothing the firmware has an opinion about.

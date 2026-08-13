# ADR 0806 — v1 ships two script-jobs; the lexos canary is deferred, not built

**Status:** accepted
**Date:** 2026-08-12
**Product:** `scheduler`
**Reversibility:** two-way
**Revisit trigger:** the owner wants uptime alerting on lexos-bay — the row flips `enabled: true` and one probe script is written; nothing else in the module changes.

## Context

`PLAN-scheduler.md` §13.2 left job #3 open: `lexos-canary`, a `daily@08:00` HTTP probe of
lexos-bay.vercel.app (status, latency, cert window) raising `incident.raised` on failure. REQ-06
requires only **≥2 jobs** for the proving week, and SCH-I already names two.

Kickoff also has to fit the REQ table to Tier S. The appetite is 3 days, which
`kickoff-lint` reads as Tier S and caps at **5 active REQs**; the design source carries 8.

## Options considered

1. **Build the canary this cycle, enabled at Phase 3** — pros: real uptime alerting on the
   owner's own product sooner. Cons: a third script, a third `processes/` stub and a third
   policy row in the owner's paste (ADR-0802); and it introduces the build's **first network
   dependency** into a module that is otherwise fully offline and hermetic — every other v1 job
   is ₹0 and reads only local state.
2. **Ship the row disabled, defer the script** — pros: the jobs file documents the intent and
   the schema is exercised by a third row; Phase 0 stays two scripts; no network in the build;
   no extra owner paste. Cons: no uptime alerting yet.

## Decision

**Option 2, chosen by the owner at kickoff on 2026-08-12.** v1 is `brief-materialize`
(`weekdays@06:00`) and `day-close-roll` (`daily@00:15`, `catchup: run`). The `lexos-canary` row
is **not written at all** this cycle — deferring the script but shipping the row would create a
job whose `entry` points at a file that does not exist, which `jobs-lint` must fail by design
(SCH-B: unknown script is exit 2). Deferral is recorded here rather than staged in the file.

The reason that carried the most weight: the module's job is to prove that scheduled work is
receipted, budgeted and policy-checked. Two jobs prove that as completely as three, and the
third is the only one that would put a live external URL inside a cycle whose entire worst-case
spend is ₹0 by construction.

**REQ consolidation, same decision.** The design source's eight REQs map onto five active rows
without losing a single acceptance criterion:

| v1 REQ | absorbs | why they are one outcome |
|---|---|---|
| REQ-01 | old REQ-01 | unchanged — the file and its lint |
| REQ-02 | old REQ-02 + REQ-03 | one execution path: lock → guards → execute → receipt. The receipt is not a separate outcome from the run that emits it |
| REQ-03 | old REQ-05 | unchanged — the brief jobs panel |
| REQ-04 | old REQ-04 | unchanged — unattended registration |
| REQ-05 | old REQ-06 + REQ-07 + REQ-08 | the proving week, its fire-drill and its evidence pack are one week and one verdict |

No acceptance criterion is dropped; each consolidated row carries every clause from the rows it
absorbs. This is a presentation change to fit the tier, not a scope cut — and it is recorded so
a later reader does not mistake five rows for a narrower plan than the eight they replace.

**Confidence:** high
**Rejected because:** option 1 — adds the build's only network dependency and a third owner
paste for a proving-week bar that two jobs already clear.

## Consequences

**Easier.** Phase 0 writes two job scripts, not three. The owner's single policy paste covers
two rows. The whole cycle stays offline and hermetic, so nothing in the proving week can fail
because a third-party host was down.

**Harder.** lexos-bay stays unmonitored for now, which is a real gap in a different product and
worth saying plainly rather than filing as done. And the REQ table no longer matches the design
source one-for-one, so anyone reading `PLAN-scheduler.md` alongside the lane's `PLAN.md` will
find eight rows in one and five in the other — the mapping table above is the reconciliation of
record.

**What we would revisit if this goes wrong.** If the proving week shows two jobs are too few to
exercise the overlap lock and the incident taxonomy meaningfully, the canary is the cheapest
third job to add — but the honest fix would be a second *local* job, not a network one.

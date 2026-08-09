# ADR 0074 — arc first: the venture clock is deferred by explicit owner ruling, and absorb's trigger gate is waived for one cycle

**Status:** accepted
**Date:** 2026-08-09
**Product:** `company` — arc-wide (ADR-0053)
**Reversibility:** two-way
**Revisit trigger:** the owner reprioritizes, **or** every arc lane reads IDLE on the board with
no lane carrying an open phase — the machine-visible moment at which "the factory has unfinished
work" stops being true and the deferral's stated reason expires. Whichever comes first.

## Context

`docs/strategy/plans/PLAN-absorb.md` gates its own kickoff on three conditions. On 2026-08-09 all
three were checked against the tree and **all three failed**:

1. **Live slot free (A9).** `wip-line.sh` reported `2 counted (LIVE+BLOCKED) — leads, policy`.
   Board 2026-08-08: leads LIVE (Cycle 8, 5.5d/7d, 93% allocated), policy LIVE (Cycle 9,
   6.8d/7d). Neither is CLOSED under ADR-0071.
2. **Venture clock resolved.** Cycle 2 closed 2026-07-28, so `PLAN-cycle3-venture-launch`'s
   ~2-week clock runs to **2026-08-11** (`docs/HISTORY.md:135`, ADR-0072:99). Two days out,
   unresolved.
3. **Receipted trigger evidence.** The kickoff prompt arrived with its evidence placeholder
   unfilled. Checked independently, none of the four arms has fired:
   - PLANOFF-01 (2026-07-12) has arc at the **top** composite — 94.5 vs gsd 94, gstack 90.8,
     superpowers 88.8, raw 59.5. arc did not lose.
   - PLANOFF-02 is `designed, not run` — empty score table, zero ledger rows.
   - No develop Capability Proposal returning "technique" exists in `docs/adr/` or
     `initiatives/develop/`.
   - `capability-lock.json` holds exactly one row (madge 8.0.0) with **zero use receipts**:
     develop C6 recorded it BLOCKed on `human-ok`, and `initiatives/develop/debt-ledger.md`
     records the circular-dependency check that would have consumed it as a declared PLAN
     no-go. The fourth arm's threshold is receipted use across ≥2 cycles.

The owner was shown this audit and ruled, in the same session: arc is the priority; ventures are
not being started now; arc must be finished as a complete product; a fired trigger is not
required to build out its remaining features.

ADR-0072 anticipated exactly this moment and left it to him: *"deferring past it is the owner's
call to make explicitly, not something this definition quietly absorbs."* Council session 002's
`NO` on the open-ended arc-first framing also stands, and its Resolution branch *"explicitly
allows a considered deferral"*. A considered deferral is one that is written down. This file is
that writing.

## Options considered

1. **Refuse the kickoff and hold until the gates clear.** Pros: the letter of the plan. Cons:
   the plan's gates are the owner's own instruments, aimed at stopping *ambition-pushed* work —
   using them to overrule the owner's stated priority inverts who they serve.
2. **Proceed silently, gates unmentioned.** Pros: fastest. Cons: a future retro reads "no arm
   fired" and cannot tell an owner decision from a skipped gate. This is precisely the
   five-day-stale-HISTORY failure of 2026-08-03 — *a trigger that reads a document is only as
   live as the document* — reproduced on purpose.
3. **Record the ruling as a receipt, waive the gate explicitly and once, flag the constitutional
   tension for the human.** Chosen.

## Decision

**Three things, each scoped deliberately narrowly.**

**(a) The venture clock is DEFERRED past 2026-08-11 by explicit owner ruling.** The clock is not
cancelled and ADR-0071 is not superseded — its definition of `closed` and its dual anchor stand
untouched. What is recorded here is that the anchor fired on 2026-07-28, the owner saw it, and
chose to defer. The deferral is dated, attributed and revisitable, which is the whole difference
between a considered deferral and a drift.

**(b) PLAN-absorb's four-arm trigger gate is WAIVED for the absorb cycle opened on 2026-08-09,
and for that cycle only.** The waiver does not delete the arms, does not lower the fourth arm's
≥2-cycle threshold, and does not extend to any later absorb cycle or any other lane. A future
absorb cycle needs a fired arm or its own waiver.

**(c) The A9 live-slot prerequisite is treated as satisfied in substance, and the reasoning is
recorded rather than assumed.** Neither live lane has agent work in flight: leads Phase 03 waits
on owner-published DNS records, policy Phase 04 on three owner edits to `.claude/settings.json`
that two independent layers refuse to make. Mode A's constraint is one *session* writing at a
time, and no other session is writing. This is a reading of the prerequisite, not a certification
of Mode B — ADR-0056 stands and concurrent emitters stay forbidden.

## Consequences

**Easier.** absorb can open, and the reason it opened is a document rather than a memory. The
next retro can tell a deliberate waiver from a missed gate.

**Harder — and this is the honest half.**

- **A8 tension, flagged not resolved.** A8 (*"Capability is built when a venture pulls it, never
  pushed by ambition"*) is in visible tension with building out arc while no venture is running.
  The Constitution's amendment process is explicit that **machines never amend** and may only
  *flag* tension, so this ADR does not touch A8. The reading under which no amendment is needed:
  **lexos is the venture, it runs a root-mode arc install (ADR-0059 / PORT-J), so arc's gaps are
  lexos's gaps and arc's completion is genuinely pulled.** That reading is recorded here as the
  basis on which this cycle proceeds, and it is the owner's to confirm or reject at the approval
  gate. If he rejects it, arc-first as standing law is a Tier-A amendment — ADR proposal, 7-day
  cooling period, explicit sign-off, re-adoption receipt — and that is a different and slower
  path than this file.
- **"A complete product" has no written definition yet**, so the revisit trigger above leans on
  the board state instead of on the goal. A condition that cannot be checked is the open-ended
  framing council 002 rejected; the board-IDLE anchor is a checkable stand-in, not a definition.
  Naming what "complete" means is the one thing that would upgrade this from stand-in to real,
  and it is named here as an open item rather than left implicit.
- **Two live lanes still hold owner actions.** Deferring the clock does not clear them; leads and
  policy each remain one owner action away from closing, and both stay LIVE on the board until
  they do.

# Toolbox — template block for a lane PLAN

<!-- Written by absorb Cycle 10 (REQ-05). Paste into a lane's PLAN.md when that lane will consult
     arc's technique registry or its capability lock. Delete the guidance comments, keep the shape.

     WHY THIS EXISTS AS A TEMPLATE. develop got this section written for it by absorb, following the
     EVO-H0 precedent that enablement lands in the client's cycle. Every lane after develop needs the
     same block, and writing it fresh each time is how the cap and the propose-only rule get quietly
     dropped. -->

## Toolbox

**Two drawers, and this lane looks in BOTH before deciding anything is missing.**

1. **`products/absorb/registry.json`** — techniques arc has already studied. `status: adopted` means
   it is already in arc and there is nothing to acquire. `status: retired` means it was tried and
   dropped, and the row says why. Reading this first is what stops the same technique being
   re-studied every cycle.
2. **`.claude/scripts/develop/capability-lock.json`** — executables arc has already vetted and
   pinned. Same-stack reuse is free; a fresh vet is not.

**Receipted use, per slice.** A slice that leans on a registry technique or a locked capability says
so in its ledger row. That is the detection machinery for absorb's load-bearing trigger arm — a
capability becoming load-bearing is discovered from receipted use across cycles, **never from
scanning**. No radar, no scheduled scan.

**Cap: 12 adopted techniques per lane.** At the cap, a new adoption **names what it displaces** and
the retire proposal rides with it. The cap is countable only because the registry is one file with a
lane on every row.

**Retro retire-review.** Anything adopted and unused for **2 cycles** gets a retire *proposal* at the
retro, read from the per-slice use receipts.

**Propose-only, both directions.** Adoption and retirement each end as an inbox item with a reason,
and no code path writes those statuses directly (absorb REQ-07). A tool arriving is a decision; a
tool leaving is also a decision.

**Roles are harness STEPS, never standing agents.** Nothing in this block describes a daemon, a
watcher, or a background process. If implementing it seems to need one, that is the signal to
re-read it.

<!-- What a lane should ADD to this block, rather than replace:
     - which of the two drawers it actually uses (a lane with no executables needs only the registry)
     - the specific slice-ledger field its use receipts land in
     - anything lane-specific about what "unused" means for it
     Do NOT change: the cap, the displacement rule, propose-only, or the no-scanning rule. Those come
     from ADR-0600 / ADR-0604 and REQ-04 / REQ-07, and a lane quietly relaxing one is the
     tool-hoarding failure this whole structure exists to prevent. -->

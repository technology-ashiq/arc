# ADR 0022 — Opportunity-Scout replaces InvoiceFly as the second dogfood target; REQ-09 amended

**Status:** accepted
**Date:** 2026-07-19
**Reversibility:** two-way
**Decided by:** Ashiq, at Phase 04 start (re-pick recorded in `docs/archive/evidence-orchestrator-2026-07-22/phase-04/verification.txt`)
**Amends:** REQ-09 · the Phase 04 spec's goal/verification/setup lines · ADR-0020's timing paragraph (name only)
**Closes:** the assumptions-ledger trigger *"venturemind + InvoiceFly are viable Phase-4 dogfood targets"*, FIRED 2026-07-19

## Context

The kickoff named two dogfood targets for REQ-09: **venturemind** and **InvoiceFly**. The
assumptions ledger carried the matching trigger — *"at Phase 4 start either repo is unavailable or
unsuitable → re-pick; Phase 4 blocked until targets named."*

Checked at Phase 4 start, as the trigger requires. **InvoiceFly does not exist** — never created,
absent from disk and from the GitHub account. The trigger fired and the block held: nothing
proceeded until Ashiq re-picked. Phase 4 then ran to close on the re-picked pair and REQ-09 was
marked `validated`.

The re-pick itself was never written back into the plan. Until this ADR, `PLAN.md` simultaneously
said Phase 4 was *"blocked until targets named"* and marked REQ-09 `validated` — and the name
**Opportunity-Scout** appeared in no plan artifact at all, only in the Phase-04 evidence bundle.
That gap is what this ADR closes. The ledger worked; the routing back did not.

## The fact that decides it

**Opportunity-Scout is the better second target than InvoiceFly would have been**, and this is
observable rather than argued: it was a **clean slate** (`--prune-report`: 0 unowned files),
which makes it the *fresh-install* path — while venturemind carried a pre-Phase-02 install
(21 unowned files) and is therefore the *upgrade* path.

Two different code paths on purpose. That split is what produced Phase 4's actual yield: all
three arc defects found in the phase lived on the upgrade path, and a fresh install would have
surfaced none of them. A second greenfield repo — which is what InvoiceFly would have been, had
it existed — would have tested the same path twice.

## Options considered

1. **Create InvoiceFly to satisfy the plan as written.** Pros: no plan edit. Cons: a repo
   invented to satisfy a requirement is not a real consumer; REQ-09's whole point is *real* work
   in a *real* repo. This would have manufactured the evidence rather than gathered it.
2. **Drop REQ-09 to a single consumer (venturemind).** Pros: cheapest. Cons: destroys the
   requirement — ADR-0013's "second concrete consumer" is the entire reason REQ-09 exists, and
   one consumer cannot show that a product installs *somewhere other than where it was built*.
3. **Re-pick an existing real repo.** Pros: keeps the requirement's substance intact; the
   trigger's own prescribed remedy. Cons: plan text must be amended after the fact.

## Decision

**Option 3 — Opportunity-Scout.** REQ-09's acceptance text is amended to name it, and the ledger
trigger is closed as RESOLVED.

REQ-09's **substance is unchanged**: two real external repos, each given a different product set,
each used for genuine work, both evidenced. Only the identity of the second repo changed, and it
changed because the originally named one did not exist. This is not a goalpost moving to meet the
result — the original acceptance bar (council-alone + a real session in one repo, core+plan + a
real kickoff in another, evidence bundles committed) was met in full and is unedited.

## Consequences

- `PLAN.md`: REQ-09 carries a dated amendment note; the ledger row is closed RESOLVED; the
  external-dependencies table swaps the InvoiceFly access row for Opportunity-Scout; the Phase 4
  row in the phase table is renamed.
- `phases/phase-04-spec.md`: goal, verification plan and setup lines renamed, with an amendment
  header — the phase is closed, so it is amended in place rather than rewritten.
- `docs/adr/0020-rehome-stale-consumer-copies.md`: its "decisive constraint on timing" paragraph
  is corrected for the name only. **Its reasoning is unaffected and was in fact confirmed** —
  ADR-0020 predicted the residue becomes real the first time anyone *upgrades* an existing
  install, and venturemind's pre-Phase-02 install is exactly that case, with 21 stale files found.
- `PROGRESS.md`'s kickoff done-log entry is **left as written**. At kickoff the targets genuinely
  were venturemind + InvoiceFly; that entry is history, and history is not drift.
- **Revisit trigger:** none. The requirement is validated and the phase is closed. If a future
  cycle needs a third consumer, it gets its own REQ and its own named target — picked by
  confirming the repo exists first, which is the one process lesson here.

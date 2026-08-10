# ADR 0604 — ABS-E: absorb's boundaries against develop, bench, discover and evolve, recorded so nobody re-litigates them

**Status:** accepted
**Date:** 2026-08-09
**Product:** `absorb`
**Reversibility:** two-way
**Revisit trigger:** two lanes both claim or both disclaim a piece of work in a real cycle — the
overlap is then real rather than theoretical, and the ruling is redrawn with that instance as
evidence.

## Context

absorb is the fifth lane to touch "arc gets better at something", and the four already-live
neighbours each own an adjacent verb. Left unwritten, every one of these becomes a retro question
asked twice: the first time as confusion, the second as rework. The cross-lane edit question is
sharper still — REQ-05 has absorb editing `PLAN-develop`, which looks exactly like the untracked
side-door edit the pre-mortem names as row 5.

## Options considered

1. **Leave boundaries to judgement per case.** Pros: no upfront work. Cons: the same question gets
   a different answer each cycle, and nobody can tell a ruling from a preference.
2. **Record the rulings now, in one place, before the first case.** Pros: the retro question is
   pre-answered; a reviewer can check a claim against a document. Cons: a ruling made before the
   first real case can be wrong.
3. **A single owner arbitration each time.** Rejected: it makes the owner the router for work he
   delegated, which is the inversion this whole factory exists to avoid.

## Decision

**Four rulings and one procedural one.**

- **vs develop (DEV-B/C).** An **installable artifact** is develop's: `capability-vet.sh` content
  scan plus a `capability-lock.json` row. A **technique expressed as an edit to arc's own files**
  is absorb's. A Capability Proposal that concludes "the gap is a technique, not an artifact"
  refers here. ADR-0110 is untouched: `/arc-capability` still installs nothing, and installing
  stays a manual owner action.
- **vs bench.** bench **scores**; absorb **produces**. absorb never scores itself — it generates
  the variants that a judge or a fixture arbitrates.
- **vs discover.** Different markets: discover mines ventures, absorb mines techniques. No overlap
  to arbitrate.
- **vs evolve.** evolve owns promotion machinery and the experiment kinds. absorb proposes through
  the inbox only, and touches neither EVO-F's verdict math nor its floors.
- **Cross-lane diffs are legitimate absorb-cycle work when the receiving plan gets a freeze-log
  line.** REQ-05's `PLAN-develop` addendum is reviewed like any other diff and lands with that
  line (the EVO-H0 precedent: enablement lands in the client's cycle). Nothing lands "while we are
  in there" — a cross-lane edit is a named REQ or it does not happen.

## Consequences

**Easier.** The routing question has a document instead of a debate, and the REQ-05 diff arrives
with its legitimacy already established rather than defended in review.

**Harder.** These rulings are drawn before a single real case, so at least one is probably wrong in
a way only a real case will show — the revisit trigger asks for that case rather than for an
argument. And absorb is now the lane that edits other lanes' plans, which is a standing privilege
that has to be re-earned every time by naming it as a REQ up front.

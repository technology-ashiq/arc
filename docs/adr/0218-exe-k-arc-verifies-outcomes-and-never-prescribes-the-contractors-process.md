# ADR 0218 — EXE-K: arc verifies outcomes and never prescribes the contractor's process

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** a measured A/B shows a process constraint beats the unconstrained arm on accepted-draft quality — that receipt, and nothing less, reopens this.

Decided under the owner's **Build-out Mandate (2026-08-09)**.

## Context

The design lane already paid for this lesson with a whole cycle. ADR-0049's process constraints on a
creative seat were **measured net-negative and were removed**. The same instinct arrives here wearing
safety clothing: the runtime is opaque and slightly frightening, so the reflex is to constrain how it
thinks — pin its reasoning style, prescribe its steps, line-edit its output until it sounds right.

Every one of those is a constraint on *method*, and none of them is a boundary. They cost quality and
buy nothing, because a contractor that is told how to think produces work at the level of the
instruction rather than the level of its capability. The quiet failure mode this cycle's pre-mortem
names is not a runaway agent — it is a perfectly safe, perfectly mediocre contractor.

## Options considered

1. **Constrain the process too** — steps, style, reasoning depth. Feels safer; measured worse
   elsewhere in this repository, and the measurement is on record.
2. **Constrain nothing, review the output** — no boundaries at all, which is not a hire, it is shadow
   IT with a receipt.
3. **Constrain boundaries hard, method not at all.**

## Decision

**Option 3, and it binds arc as much as the caps bind the runtime.**

arc constrains four **boundaries**, each enforced somewhere real:

- **data in** — owner-approved context packs (ADR-0214)
- **actions out** — L1-drafts, enforced by the policy engine (ADR-0212)
- **money** — the capped credential (ADR-0213)
- **time** — a calibrated wall-clock owned by the run (ADR-0210)

and **verifies outcomes** — review plus a per-draft verdict receipt.

arc **never** prescribes the runtime's internal method, model choice, reasoning style, or creative
approach. **Explicitly unconstrained internal thinking** is a design property, not an oversight.

**Routine review is accept/reject plus a one-line reason. Never line-edits.** A line-edit is process
prescription arriving one sentence at a time. Style-shaping happens only as a **reviewed diff to the
process file's brief** — a durable, versioned, reviewable change — never as ad-hoc steering inside a
dispatch.

Any future urge to constrain the contractor's process requires **a measured A/B first**. This is not a
high bar invented to protect a preference; it is the same bar MP-B sets for a creative seat's tier,
and the design lane has already run it once and got an answer nobody expected.

**Confidence:** high — this is an existing measured result applied to a new subject, not a fresh
hypothesis.

## Consequences

**Easier.** The contractor gets to be as good as it is. Review is fast, because accept/reject with a
reason is a smaller act than editing. And the freedom clause gives a clean answer to a question that
would otherwise be re-litigated every time a draft disappoints.

**Harder.** Rejection with one line of reason feels worse than fixing the draft, and the temptation to
"just tweak it" arrives on the very first mediocre output. The discipline costs something real: a
draft that is 80% right gets rejected with a reason rather than edited to 100%, and the improvement
has to arrive through the brief or the feedback pack instead. That is slower per draft and the whole
point — and it means the retro must read **accepted-draft quality**, not just safety counts, or the
cycle will report a contractor that never broke a rule and never produced anything good.

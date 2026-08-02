# ADR 0066 — MP-D: the session-001 retrofit executes council-v2 ADR-0010 as written; no new sanction is needed

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane
**Reversibility:** one-way
**Revisit trigger:** none available after the fact — an in-place edit to a saved session
cannot be un-made cleanly. The forward-looking check is: if a second historic session ever
needs the same treatment, it gets its own dated sanction rather than borrowing this one.

## Context

The calibration scoreboard is empty. Session 001
(`docs/council/sessions/001-ai-writing-assistant-trains-on-user-docs.md`, 2026-07-15) is
the only saved verdict, and it carries a `PREDICTION: … → RESULT: …` line but **no
`Review-by:` line** — verified 2026-08-02. `council-calibrate --overdue` keys on
`Review-by:`, so it can never surface session 001, and zero verdicts have ever been graded.

Council verdicts are append-only: review appends `## OUTCOME`, and nothing rewrites
DECISION, CONFIDENCE, or ratings. Editing session 001 in place therefore looks, at a
glance, like a violation of that law — which is why it has sat undone since it was
sanctioned.

**Citation hazard, pinned here deliberately:** the sanctioning ADR is **council-v2
ADR-0010**, which lives at
`docs/council/kickoff-v2/docs/adr/0010-fix-session-001-in-place.md`. The council build keeps
its own ADR numbering namespace. `docs/adr/0010-*.md` in the repo root namespace is
"Quality Passport" and is an entirely unrelated decision. An executor who resolves
"ADR-0010" against the root namespace will read the wrong document.

## Options considered

1. **Write a fresh sanction ADR for the retrofit** — pros: the permission is in the
   namespace an executor searches first. Cons: two ADRs sanctioning one edit, and the newer
   one would silently become the authority over a decision already reasoned through; that
   is a second source of truth (Constitution A5).
2. **Leave session 001 alone and start calibration from session 002** — pros: no
   append-only question at all. Cons: the scoreboard stays empty until some future council
   run happens; the mechanism goes unproven for an unbounded time, which is the actual
   thing REQ-04 needs to fix.
3. **Execute council-v2 ADR-0010 as written, and use this row to pin the reading** —
   pros: no new permission is invented; the existing decision is honoured. Cons: requires
   the executor to resolve a cross-namespace citation correctly.

## Decision

Option 3. The session-001 retrofit **executes council-v2 ADR-0010 as written** — in place,
append-only `OUTCOME` preserved, `Review-by:` and `Resolution:` appended. This ADR row pins
that reading and the full path to the sanctioning document; **no new sanction ADR is
created.** Council-v2's own PLAN already records this as the sole sanctioned exception to
the append-only rule, and that scope is not widened here.

> **Correction (2026-08-02, Phase 01) — this ADR named the wrong sanction, and the error
> made the work look more dangerous than it is.**
>
> Council-v2 ADR-0010 sanctions **capping session 001's `CONFIDENCE` from High to Medium
> plus a dated note**, because an offline `model-knowledge` run cannot carry High. It says
> nothing about `Review-by:` or `Resolution:`. **That correction was already executed on
> 2026-07-15** and is visible in the session file — so there was never an unexecuted
> ADR-0010 fix waiting to be run.
>
> Adding `Review-by:` and `Resolution:` is a different act with a different authority:
> **council-v2 ADR-0012** ("Calibration data lives inside session files"), which establishes
> that a session may carry more than one `## OUTCOME` / `Review-by:` and that the last of
> each is authoritative. That makes this an **append**, which is the documented normal
> operation of the calibration loop — not an edit of a saved verdict, and therefore **not**
> the one-way exception this ADR was built to justify.
>
> What stands: the cross-namespace warning (council ADR-0010 ≠ root ADR-0010, which is
> Quality Passport) — the trap is real and this ADR is still where it is pinned. What
> changes: the retrofit needs **no** special sanction, the `Reversibility: one-way` header
> above overstates it (an append is additive and the record is preserved), and REQ-04 is
> cheaper and safer than planned. Found in Phase 01 by reading the sanction before acting on
> it, which is the only reason it was found at all.

## Consequences

Easier: REQ-04 proceeds without inventing permission it does not need, and the
cross-namespace citation trap is written down where the executor will hit it rather than
discovered mid-phase. Harder: this is a one-way edit to the only historic council artifact,
so it must be done exactly once and exactly as ADR-0010 specifies — a botched retrofit
cannot be reverted into a clean "never touched" state. It also does not by itself produce a
grade: whether the retrofitted session yields a real HIT/MISS or an honest `UNRESOLVED` is
REQ-04's separate honesty fork, and a forced grade would violate Constitution E3.

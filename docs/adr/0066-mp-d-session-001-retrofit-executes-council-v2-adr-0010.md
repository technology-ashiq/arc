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

## Consequences

Easier: REQ-04 proceeds without inventing permission it does not need, and the
cross-namespace citation trap is written down where the executor will hit it rather than
discovered mid-phase. Harder: this is a one-way edit to the only historic council artifact,
so it must be done exactly once and exactly as ADR-0010 specifies — a botched retrofit
cannot be reverted into a clean "never touched" state. It also does not by itself produce a
grade: whether the retrofitted session yields a real HIT/MISS or an honest `UNRESOLVED` is
REQ-04's separate honesty fork, and a forced grade would violate Constitution E3.

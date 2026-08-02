# ADR 0068 — MP-F: model fingerprints are forward-only and never estimated; an unavailable field stays absent

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane
**Reversibility:** one-way
**Revisit trigger:** none for the historic gap — forward-only means the runs already done
can never be fingerprinted, and that is permanent by construction. The forward check is:
if ≥2 experiment arms in a row record so many absent fields that the block cannot support a
comparison, the field list is wrong and gets amended (never backfilled).

## Context

This cycle's whole claim is that model decisions should rest on receipts rather than taste.
That claim is only as good as the receipts, and arc has just been burned twice on exactly
this. The Cycle-2 spine treated 22 quarantine rejections as "dedup working as designed"
when they were 100 lost real receipts; Cycle-3 ran five critique rounds, three blind
rankings and a sealed prediction on pixels nobody in the session had opened. In both cases
a plausible story stood in for a measurement.

If REQ-03's paired A/B is going to decide a seat's tier, the record of *what actually ran*
has to be strong enough that a future reader can tell whether the comparison was fair —
which model, which prompt, which brief, how long, at what visible cost.

The temptation, once a field list exists, is to fill it. A missing cost becomes an
estimate; an estimate becomes a number in a table; the number gets compared. Constitution
E3 and ADR-0048's spirit both forbid this, but neither says it about model runs
specifically.

## Options considered

1. **No fingerprint discipline** — pros: nothing to maintain. Cons: the A/B produces a
   verdict nobody can audit later; "we tried opus once and it seemed better" is precisely
   the taste-encoded state this cycle exists to end.
2. **Build a fingerprint collector script** — pros: fields get captured automatically and
   completely. Cons: that is engine work (a collector is tooling, not discipline), it is a
   no-go this cycle, and it would blow a 3-day appetite on plumbing.
3. **A discipline: named fields, written into receipts humans and agents already write,
   forward-only, absent-when-unavailable** — pros: costs nothing to start, works today,
   and the honesty rule is the load-bearing part rather than the tooling. Cons: relies on
   whoever writes the receipt actually writing it; nothing enforces completeness.

## Decision

Option 3. Every experiment arm, calibration-relevant run, and policy exception records:

- provider
- exact model id
- agent role
- agent-file / prompt commit SHA
- input / brief SHA
- timestamp
- wall-clock duration
- effort setting **if visible**
- statusline cost **if visible**

Two rules carry the weight:

1. **Forward-only.** Fingerprints are never backfilled onto historic runs. The pre-policy
   past stays unfingerprinted and is described as such.
2. **An unavailable field stays absent.** Recorded, estimated, and fabricated are three
   different things and only the first is allowed. An absent field is a fact about the
   instrument; an estimated one is a lie with a decimal point.

The block rides existing spine kinds' payloads — the closed event vocabulary
([ADR-0026](0026-spine-c-closed-event-kind-vocabulary-v1.md)) is **not** extended this cycle.

> **Correction (2026-08-02, Phase 00).** As accepted, this line cited **ADR-0023** for the
> closed event vocabulary. ADR-0023 is the attic registry scope-cut; the closed event-kind
> vocabulary (18 kinds) is **ADR-0026**. Corrected here rather than superseded because the
> decision is unchanged — only the pointer was wrong, and a pointer that resolves to an
> unrelated document is the precise failure MP-D was written to warn about. Found by the
> Phase-00 verification pass, not by the author.

## Consequences

Easier: REQ-03's keep/revert decision becomes auditable by someone who was not in the room,
which is the difference between a receipt and an anecdote. Riding existing payloads means
zero new event kinds and no spine schema work. Harder: this is a discipline with no
enforcement — nothing fails if a fingerprint is skipped, so it will be skipped exactly when
someone is in a hurry, which is when it matters most. The forward-only rule is one-way: the
gap between arc's start and today is permanent, and any future analysis that wants
historic model data simply cannot have it. That cost is accepted deliberately over the
alternative of reconstructing plausible values.

# ADR 1007 — "Unedited approval" means sha equality, and 20 of them is the L2 evidence bar

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** the counter reaches 20 and the owner reads the sample — if the articles that
went through untouched are visibly worse than the edited ones, the metric is measuring compliance
rather than quality and the bar is redesigned before any promotion.

## Context

GRO-E asks for a measurable definition of "the machine's draft was good enough to ship as-is",
because that is the evidence any future autonomy promotion would rest on. "Ashiq didn't change
much" is not measurable.

Arc's promotion ladder is evidence-gated: A1 says gates promote WARN→FAIL only on trial-ledger
evidence, and `hq.policy.yaml` levels are `min(ceiling, event-earned cap)` where the cap rises
only by a human `policy.level.changed` citing that evidence.

## Options considered

1. **`unedited := approved draft_sha == published content_sha`; L2 evidence = 20 such approvals.**
2. Diff-size threshold ("under 5% changed"). Con: a one-word change to a claim-of-fact is a
   larger correction than reflowing three paragraphs; a percentage cannot tell them apart.
3. Ask the human to tick "I didn't change anything". Con: it is a third human gate, which
   ADR-1012 caps at two, and it is self-reported where a sha is observed.

## Decision

**Option 1.** The approval `decision.recorded` carries the draft's `content_sha`; the merged
tree's sha is read at publish time into `content.published.content_sha` (ADR-1001). Equal ⇒ the
article shipped exactly as drafted.

- The counter **increments on sha-equal** and **does not increment, and does not reset, on
  sha-different** — an edited approval is neither evidence for nor evidence against; it is simply
  not a sample of "shipped untouched".
- **20** such approvals is the evidence bundle for proposing an L2 promotion of any growth
  publishing capability. It is *evidence for a proposal*, never an automatic promotion: the
  promotion path is trial-ledger + owner sign-off, and E2 forbids the merge step being granted at
  all (ADR-1002).
- This cycle ships **ten** articles, so the counter reaches at most 10 of 20. The cycle **cannot**
  earn the promotion, by construction, and `PROGRESS.md` records the counter's honest state at
  close rather than a projection.

**Evidence:** `CONSTITUTION.md:33` (A1, evidence-gated gates) · `hq.policy.yaml:1–12`
(`effective = min(ceiling, cap)`; cap rises only on a human level-change citing evidence) ·
design source REQ-09, GRO-E.
**Confidence:** high on the definition; medium on 20 being the right number — it is an owner-set
bar carried from the design source, not a derived one, and its revisit trigger is the reading of
the sample rather than the arithmetic.
**Rejected because:** option 2 cannot distinguish a factual correction from a cosmetic one;
option 3 adds a gate the cap forbids and trades an observation for a self-report.

## Consequences

Easier: an autonomy argument later has a countable, tamper-evident basis. Harder: the counter is
a slow instrument — 20 approvals at 2–3 articles a week is roughly two months, so nothing in this
cycle or the next can be gated on reaching it.

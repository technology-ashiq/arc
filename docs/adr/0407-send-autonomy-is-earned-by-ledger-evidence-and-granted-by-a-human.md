# ADR 0407 — Send autonomy is earned by ledger evidence and granted by a human

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** two-way
<!-- a granted promotion can be revoked; the sends it authorized cannot -->
**Revisit trigger:** the bar is met twice and the human declines both times — the bar is
measuring the wrong thing.

## Context

L1 (every send human-approved) is the right starting posture and the wrong permanent one: it
makes Ashiq the bottleneck on every send. But "it seems fine now" is not a reason to hand a
machine the send button. The promotion needs a bar defined *before* anyone wants to cross it.

## Options considered

1. **Stay L1 forever** — pros: maximally safe. cons: outbound never scales past one human's
   daily attention.
2. **Auto-promote when metrics look good** — pros: no human in the loop. cons: the system
   grades its own homework; auto-switching is forbidden house-wide.
3. **Evidence creates a PROPOSAL; a human decides.**

## Decision

**Option 3.** A send-autonomy promotion **proposal** requires all of:

- ≥30 consecutive unedited approved drafts across ≥2 campaigns
- zero cap/suppression violations
- bounce <3% across the qualifying campaigns
- zero spam complaints
- stable-or-better reply rate

The ≥2-campaign / ≥30-draft shape means the sample is ≥50 sends by construction — the same
floor `ADR-0403`'s FREEZE breaker uses. Unlike a single campaign's n=25, the percentage is
meaningful at that size. That is deliberate: the bar and the breaker share a sample floor so
they cannot disagree about what 3% means.

Meeting the bar **creates a proposal in the inbox**. The human decides. Nothing auto-promotes.

Lint promotions (`ADR-0404` WARN → FAIL) travel the trial-ledger path separately — a
personalization gate earning a hard block says nothing about send autonomy.

**Confidence:** high on the structure; the specific thresholds are judgment, recorded now
precisely so they cannot be argued downward later by someone who wants the promotion.

**Rejected because:** Option 1 — unbounded human bottleneck. Option 2 — self-grading, and
auto-switching is forbidden everywhere in this repo.

## Consequences

**Easier:** the promotion conversation has evidence instead of vibes, and the bar was set
before anyone had an interest in the answer.

**Harder:** v1 costs ~15 min/day of inbox ritual during a campaign, and that is named in the
pre-mortem rather than discovered.

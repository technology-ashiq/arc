# ADR 1005 — The domain is chosen at Phase 1's entry gate, and the Search Console property is the earliest thing that can start evolve's clock

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Scope note:** two-way applies to *the deferral*. **The domain choice it defers is one-way** and
gets its own accepted ADR, numbered from this band, at the Phase 1 gate.
**Revisit trigger:** Phase 1 opens and the owner has not named a domain → the cycle continues on
the preview URL and Phase 5's feed reports zero COMPLETE windows with the reason recorded, rather
than the lane stalling.

## Context

The owner deferred the domain at kickoff: the plan is written domain-agnostic and the choice
becomes its own ADR at the site phase's entry gate. That is a sound deferral of a one-way door —
URLs, backlinks and Search Console history do not survive a move — but it has a cost this ADR
exists to make visible rather than let it be discovered in week four.

Research against Google's own documentation, 2026-08-12:

> *"Data is collected for a property as soon as anyone adds it in Search Console, even before
> verification occurs. However, it takes a few days for data to start to accrue for the property."*
> — [Verify your site ownership](https://support.google.com/webmasters/answer/9008080?hl=en)

**There is no retroactive backfill.** A third-party claim that aged domains show ~16 months of
prior performance was checked and rejected — it conflates inherited index/manual-action history
with Performance data, which are different systems.

The consequence is arithmetic. Evolve's trigger needs **4 complete consecutive weeks** of
`metric.observed`. The clock cannot start before the property exists. So **every day the property
does not exist is a day subtracted from evolve's wake-up, one for one** — and it is not recoverable
later by any amount of work. This is the single most schedule-critical fact in the cycle, and it is
owned by two owner keystrokes, not by any build task.

Verification method also matters: a **Domain** property covers all subdomains and both protocols
but is **DNS-TXT-verifiable only**; a **URL-prefix** property covers one exact protocol+path
prefix and accepts an HTML file, a meta tag, Analytics or Tag Manager as well as DNS.

## Options considered

1. **Defer the choice, but move the phase that consumes it to position 1** and state the
   one-for-one clock cost in the plan.
2. Defer the choice and leave the site phase late, as the design source's phase table had it
   (site work implicit in Phase 3 of 6). Con: costs roughly a week of clock for no benefit.
3. Force the choice now. Con: the owner explicitly deferred it; a one-way door taken under
   kickoff time pressure is exactly what the deferral avoids.

## Decision

**Option 1.**

- `PLAN.md` is written **domain-agnostic**: `content.published.site` carries whatever host is
  configured, and Phase 0's walking skeleton runs entirely on a **preview URL**, so no owner
  keystroke gates any build work.
- **Phase 1 is placed immediately after Phase 0**, and is 0.5d of build against two owner
  minutes — precisely because of the no-backfill rule above.
- Phase 1's entry gate is: domain named → its own one-way ADR written → DNS/TLS green → **GSC
  property added and verified**. A **Domain** property is recommended so a later `blog.` or `www.`
  decision does not require a second property and a second clock.
- If the gate is not met when Phase 1 opens, the lane does **not** stall: it proceeds on the
  preview URL, and Phase 5's feed honestly reports `MISSING` windows with the reason, never zero.

**Evidence:** [Verify your site ownership](https://support.google.com/webmasters/answer/9008080?hl=en)
(no backfill; data accrues from property-add) · [Domain vs URL-prefix properties](https://support.google.com/webmasters/answer/34592?hl=en)
(coverage and verification methods) · design source REQ-05(c) (4 complete weeks = the trigger) ·
`PORTFOLIO.md:23` (leads' DNS record as a phase entry gate).
**Confidence:** high on the no-backfill rule — it is a direct quote from Google's own page, and
the one contradicting source was traced to a category error.
**Rejected because:** option 2 spends a week of an unrecoverable clock for nothing; option 3
overrides an explicit owner deferral on a one-way door.

## Consequences

Easier: the build never waits on an account action, and the cost of waiting is written down in
days rather than felt in week four. Harder: until the gate is met, `content.published.site` holds
a preview host, so the receipts emitted before cutover carry a URL that will not be the permanent
one — the supersede path in ADR-1101 is the correction mechanism, and Phase 1's exit asserts it was
used rather than the old receipts being edited.

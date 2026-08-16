# ADR 1115 — Growth ships as a standing capability; the two domain-dependent phases are parked, not faked

**Status:** accepted
**Date:** 2026-08-13
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** *(sharpened 2026-08-14 — see below; the original wording is now satisfied and
was never the real condition)* **a verified Search Console Domain property exists** for
`automemory.ai`. Phase 01 then un-parks exactly as written, with no code change, and the first thing
to check is whether the ingest still matches Search Console's current export format (ADR-1108).
**Phase 06 additionally needs the indexability flip merged**, because a `noindex` site accrues no
week to read.

> **Why this was re-worded.** The trigger first read *"a domain and a live site exist"*. On
> 2026-08-13 both came true — `arc.automemory.ai` resolves and serves a real article — and the
> phase-02 close on 2026-08-14 caught the trigger reading TRUE while every reason for the park was
> still standing. Search Console does not backfill, and this ADR parks the phases on **the clock**,
> not on the address. A trigger that fires early is worse than one that never fires: the next
> session would have un-parked Phase 01 straight into its own entry gate and lost the time to
> discovering why. The condition now names the thing that actually starts the clock.

## Context

Assumption **A-07** fired on 2026-08-13: *"The owner can name a domain and verify a GSC property
inside Phase 1's window."* There is no domain and no live site, and the owner's decision is that
there will not be one on this cycle's timescale.

A-07's ledgered fallback said the cycle "continues on the preview URL" and Phase 5 reports zero
COMPLETE windows. That fallback is **partly unworkable and has to be corrected rather than
followed**: Phase 00 closed the accidental-publication incident by serving `noindex, nofollow` plus
`robots.txt: Disallow: /` on every non-domain host. The preview URL is therefore invisible to
Google *by our own deliberate design*, so "continue on the preview URL" cannot produce a single
Search Console row. Following the ledger literally would have produced a phase that ran, reported
zeroes, and looked like measurement.

The owner's framing is the useful one: growth is **a head of department** — a standing capability
the company keeps — not a campaign that either succeeds or is wasted this month.

## Options considered

1. **Buy a domain now to unblock the cycle.** Rejected by the owner: not where his attention
   belongs this month, and SEO is a 3–6 month channel regardless. Roughly ₹900/year is not the
   obstacle; the attention is.
2. **Point the cycle at the `.vercel.app` host and measure that.** Rejected on two counts. It
   cannot work (see above — we noindex it on purpose). And even if it did, ranking credit earned on
   a throwaway host cannot be moved to a real domain later; it would have to be redirected away,
   which is worse than not having earned it.
3. **Stop the cycle and bank what exists.** Rejected: Phases 03, 04 and 05 need no domain at all,
   and stopping would leave the machine half-built, which is the state PORTFOLIO records evolve
   shipping in and pre-mortem row 6 names by title.
4. **Build every domain-independent phase to completion, park the two that cannot run, and close
   the cycle honestly as "machine ready, clock not started".** Chosen.

## Decision

**Phases 03, 04 and 05 are built to completion this cycle.** None of them needs a domain: the
generator and its lints, the publish path with its module-graph guard and mutant, and the EVO-H0
ingest all run against fixtures and a local or preview host.

**Phases 01 and 06 are PARKED.** Not dropped, not marked done, not simulated:

- **Phase 01** (name and instrument the site) is entirely the domain. It has no other content.
- **Phase 06** (a real week) requires seven elapsed days of a live, *indexable* site. Both halves
  are absent.

A parked phase keeps its spec verbatim and is recorded in `PROGRESS.md` as PARKED with the reason
and the un-park condition. It is never counted toward the cycle's completion, and the close does
not round it up.

**The cycle closes as "machine ready, clock not started."** That is the honest description and it
is written that way in the tracker, in the close, and in any receipt. Specifically:

- `content.published` will have **zero production emissions** this cycle if nothing is published
  to a real domain, and the close reports that count read from the spine rather than inferring
  success from CI. Pre-mortem row 6 exists precisely to stop the opposite.
- The EVO-H0 feed is **fixture-proven, not live-validated**, and the tracker records which of the
  two each REQ closed as — the plan's non-negotiable already requires that distinction.

## Consequences

**Good.** The capability is finished and reviewed while the context is loaded, rather than
half-built and re-learned in three months. Switching it on later is a domain purchase and a
Search Console verification, not a build. The two parked phases are visible as parked, so nobody
later reads the cycle as having measured something.

**Bad, and stated.** Evolve's four-week clock does not start this cycle, and Search Console does
not backfill — so the earliest possible first complete window moves out by however long the domain
waits, one day for one day. That cost is real, unrecoverable, and accepted deliberately rather
than discovered later.

**Also bad.** Phases 03–05 will ship fixture-proven with no production exercise, which is exactly
the failure mode pre-mortem row 6 names and REQ-10 was written to prevent. REQ-10's real-article
run cannot happen without the site. This is the one place where parking genuinely weakens the
cycle's evidence, and it is not papered over: the close will say the path was proven end-to-end
against a preview host and never against a live domain.

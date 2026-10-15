# ADR 1762 — The day-12 tripwire cuts nothing; the overrun was the wait for owner keys

**Status:** accepted
**Date:** 2026-10-14
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** the burn reaches 18 days (100% of appetite) with Phase 04 or 05 still open. PLAN's kill criteria
then say cut or kill, never extend.

## Context

PLAN's kill criteria set two checkpoints. The day-7.5 checkpoint (2026-10-10) asked whether Phase 01 was closed. The
50% tripwire, read at the Phase 02 exit, fires when Phase 02 is not closed by day 12. Both fired: Phase 01 and Phase 02
close on 2026-10-14, day 12 of 18 (kickoff 2026-10-03). Each makes a scope-cut conversation mandatory, with the cut
order `refunds` → `errors` → `migration-rollback` → REQ-08's real second provider → `face-room` stays `planned`.

What the burn bought by day 12:
- Phases 00–04 built on fakes, attacked in two rounds each.
- 31 slots verified live on `arc-sandbox`.
- Three named ABSENTs: `domain` and `payment-live` behind their gates, and `legal-pages` waiting on the renderer.

The days between 2026-10-05 and 2026-10-13 went mostly on waiting for owner keys (Cloudflare, Vercel, Supabase,
Resend, Razorpay test keys, Sentry, Neon, PageSpeed) and the Vercel GitHub App. The build was not stuck.

## Decision

Nothing is cut. The first three items in the cut order are already verified live on `arc-sandbox`:
- `refunds`: rfnd_ArcProbe…, nets to 0 in `arc pnl --simulated`.
- `errors`: a Sentry issue raised from a thrown probe.
- `migration-rollback`: a down migration run on the venture CI.

Cutting any of them now would remove finished, proven work and save no days.

REQ-08's second provider is the one item in the cut order not yet run live. It stays in Phase 04: the Neon key is in
the private env file, so its real verify costs a free-tier project and no owner wait.

The remaining appetite (days 13–18) covers Phase 04's real half and Phase 05's close. Both mainly need the owner's
arc-inbox stamps for vetting (ADR-1705), plus the `launch-watch` job row he applies (deny-floor).

## Consequences

- Phases 01–03 close at day 12 with their REQs validated (REQ-03, REQ-04, REQ-06).
- The appetite-burn line reads 12 of 18 days. The next checkpoint is the 100% line, at which the lane cuts or stops.
- The overrun, and the fact that both checkpoints fired late, are flagged for `/arc-retro`. Owner-key waits ran on the
  calendar while the work was built on fakes; that is the pattern to look at, not the scope.

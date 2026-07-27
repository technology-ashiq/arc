# ADR 0032 — SPINE-I: Hook-mode rejections must surface where the owner looks

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Supersedes:** nothing. **Amends:** [ADR-0031](0031-spine-h-emitter-dual-mode.md) — its
"never block a session" rule is untouched and remains inviolate; only the *surfacing* half of
the hook-mode contract changes.
**Revisit trigger:** the brief's rejection line becomes routine noise the owner learns to skip
(≥1 non-zero count on most days for a month with no action taken) → the signal has stopped
working; move to an explicit `incident.raised` receipt on a rejection-rate threshold via a new
ADR, rather than making the line louder again.

## Context

ADR-0031 fixed the hook-mode contract as: invalid input is **quarantined + a loud SKIP + exit 0**,
so telemetry can never block a session. It carried a revisit trigger, written at kickoff before
anything ran:

> *Phase-4 gap audit shows quarantine swallowing events that strict mode would have surfaced in
> time (silent data loss exceeding what the weekly audit catches) → revisit the hook-mode
> contract via ADR (e.g. louder surfacing), keeping "never block a session" inviolate.*

**That trigger fired.** The Phase-04 gap audit (`docs/evidence/phase-04/gap-audit.md`) found the
spine silently discarded **100 real receipts** across a 3-working-day window — 1 valid receipt
against 9 rejections on 2026-07-25, and a full working day (2026-07-26) that produced no day file
at all. Nobody noticed for four days. The proximate defect is the idem preimage
(`arc-event.mjs:99` carries no time and no per-session identity, so repeat actions collide), and
that fix is filed separately — but the defect is not what this ADR is about.

**What this ADR is about is why it went unseen for four days.** ADR-0031's "loud SKIP" is loud on
**stderr, at the moment of rejection, inside a hook the owner never watches**. The quarantine file
is instance-local and gitignored. `arc brief` — the one surface the owner reads daily, and the
thing REQ-05 built specifically to be the day in one screen — never mentioned rejections at all.
Every day of the dogfood the brief rendered a confident, clean summary while receipts were being
destroyed behind it. A surfacing channel nobody reads is indistinguishable from no surfacing.

Worse, the Day-1 log looked at 22 rejections and concluded *"dedup working as designed, no data
loss, not a gap"* — the mechanism was visible and still misread, because a raw count with no
framing invites the benign explanation.

## Decision

**A hook-mode rejection is not fully handled until it appears in the brief.**

1. `arc brief` gains a rejection line whenever the day's quarantine is non-empty — count and
   distinct reason codes, rendered in the **needs-you** group, not background. Zero rejections
   render nothing (the one-screen budget, REQ-05, is not spent on silence).
2. The line states the consequence, not the mechanism: rejected events are **receipts that were
   not recorded**, never "duplicates handled". Wording must not invite the benign reading that
   cost four days here.
3. "Never block a session" is unchanged and remains inviolate (ADR-0031). This ADR adds a
   *report*, never a *refusal*. Hook mode still exits 0 on every path.
4. The brief stays reader-only (ADR-0030). Quarantine is not on the spine, so the reader gains a
   quarantine-count accessor; no consumer opens the quarantine file directly.

## Options considered

1. **Surface rejections in the brief** — chosen. It puts the signal on the one surface with a
   demonstrated daily read (3/3 dogfood days), costs at most one line, and needs no new kind
   (ADR-0026's vocabulary stays closed).
2. **Make the stderr SKIP louder** — rejected. It is already "loud" by ADR-0031's definition and
   was invisible in practice for four days. Volume on an unwatched channel is not surfacing.
3. **Emit an `incident.raised` receipt per rejection** — rejected *for now*. Each rejection is
   usually benign in isolation; per-event incidents would bury real incidents, and the rejection
   rate is the meaningful signal, not the individual event. Kept as this ADR's own revisit path.
4. **Promote hook mode to strict (block on invalid)** — rejected outright. It violates ADR-0031's
   inviolate rule and pre-mortem row 5 ("session blocked by its own telemetry"). The dogfood
   showed the emitter losing data; letting it also stop work would be strictly worse.
5. **Rely on the periodic gap audit** — rejected. That is exactly what was relied on, and the
   trigger fired because the audit is too slow: it caught this at window close, four days and
   100 receipts late.

## Consequences

**Good.** Silent loss becomes visibly loud on the surface the owner already reads daily. The
failure mode that cost this cycle four days is closed at the reporting layer regardless of
whether a future emitter bug takes the same shape — a different root cause producing rejections
would surface the same day.

**Cost.** The brief takes up to one more line on days with rejections, against a ≤40-line budget
(REQ-05). Acceptable: a day with rejections is precisely a day worth spending a line on.

**Not solved by this ADR.** The idem defect itself — repeat actions colliding — is a separate fix
filed in the gap audit (candidate: include `ms` or a real per-session `run_id` in the hook-mode
preimage, keeping content-derived idem on the `ingest` path where cross-day dedup is *required*
by REQ-03). This ADR would have made that defect visible on day one; it would not have prevented
it. Both are next-cycle work — Phase 04 changes no wiring (ADR-0026).

**Also unresolved.** 2026-07-26 produced neither receipts nor quarantine lines. Dropped receipts
still write a quarantine line, so a second, unidentified cause exists — and note that a
brief-based rejection line would NOT have surfaced that day either, since there was nothing in
quarantine to count. Recorded honestly: this decision closes the silent-rejection hole, not the
silent-nothing hole.

## Implementation status

**Decided, not built.** No code changes in Phase 04 — wiring and vocabulary are closed for the
dogfood phase (ADR-0026), and this ADR is the record of the decision, not its delivery. It enters
the next cycle's plan as scoped work alongside the idem fix.

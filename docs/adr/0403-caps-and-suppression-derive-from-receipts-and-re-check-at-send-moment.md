# ADR 0403 — Caps and suppression derive from receipts, and re-check at the send moment

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** one-way
<!-- the enforcement model is the safety property the whole lane rests on -->
**Revisit trigger:** receipt-derived counting proves too slow at a volume this lane has
explicitly no-go'd (>25/day), or a cap must legitimately vary per-lead.

## Context

The failure this prevents: a human approves a draft at 09:00, the lead unsubscribes at
09:30, and the send fires at 10:00. Approval is not authorization. Separately: any mutable
counter file is a thing that can be reset, hand-edited, or lost to a crash — and then the
21st send of the day goes out looking legal.

## Options considered

1. **Mutable counter file** (`sent_today.json`) — pros: trivial. cons: resettable, crash-lossy,
   and it lies after a restart. A cap you can edit is not a cap.
2. **Counter in the approval record** — pros: no extra state. cons: TOCTOU — approval time
   is not send time, which is exactly the failure above.
3. **Derive every count from spine receipts at the send moment** — pros: no mutable state
   exists to corrupt; restart rebuilds identical counts. cons: a read per send (irrelevant at
   ≤20/day).

## Decision

**Option 3**, with a guard chain that re-runs at the moment of send.

**Values in config, enforcement in code, hard ceilings above config** — config can lower a
limit, never raise it past the ceiling.

**Caps:**
- **≤20 successfully SUBMITTED sends per IST (Asia/Kolkata) calendar day.** Attempts the
  provider refused do not count. The day boundary is fixture-tested at midnight IST.
- **≤2 touches per lead in any ROLLING 7-day window** — rolling, not calendar week.
- Send window: IST business hours, weekdays.

**Guard chain, re-run at send moment, in this order:**

```
campaign-state (HOLD|FROZEN) → unresolved-intent → suppression → reply-stop
  → touch-cap (rolling 7d) → daily-cap (IST, submitted) → send-window → draft_sha match
```

The first two steps were added at kickoff by the attack panel: this ADR defines HOLD/FROZEN
and `ADR-0411` defines unresolved intents, but neither originally placed them *in the chain* —
so every breaker fixture asserted a receipt was emitted rather than that a send stopped. A
breaker that pauses nothing is pre-mortem row 1 with a receipt attached. **FROZEN and HOLD are
cleared only by an `arc-inbox` approval naming the incident** — no CLI flag, config value or
env var clears either.

**The daily cap buckets by the journal intent's `submitted_at`, never by spine emit time.**
`ADR-0411` can emit a recovery receipt arbitrarily later; without naming the field, a receipt
written at 00:10 IST would move a 23:55 IST send onto the next day and free a slot on both.

**Concurrency:** counts are derived per send, so two `arc-leads` processes would each read
20-headroom and both submit. `ADR-0056` forbids concurrent emitters by policy; the mechanism
is an exclusive `.send.lock` in the store held across the whole derive → guard → submit →
emit → resolve window. A lock held by a dead pid is **refused, never auto-broken** — that
process may be sitting in the ack-to-receipt window.

**Approval authorizes an ATTEMPT, never a send.** A reply, bounce, or unsubscribe recorded
after approval permanently blocks that send. The draft's current sha must equal the approved
sha (`ADR-0412`) or the send is refused.

**State derivation:** all cap and suppression state derives from spine receipts through the
reader. **No mutable counter file exists.** Effective counts = `receipts + unresolved
intents` (`ADR-0411`) — conservative until reconciled.

**Suppression ledger:** event-backed (`lead.suppressed` receipts → derived state,
reader-only), checked before every send, surviving across campaigns, unsubscribe honored in
the same run.

**Circuit breakers, sample-size-honest:**

| Trigger | Effect |
|---|---|
| FIRST bounce | **HOLD** — sends pause, review item in inbox, human resumes after cause check |
| 2 bounces in a campaign | **FROZEN** + `incident.raised` |
| rolling bounce ≥3% once ≥50 lifetime sends | **FROZEN** + `incident.raised` |
| any spam complaint | **FROZEN** + `incident.raised` |

Rationale for the split: at n=25 one bounce is 4%. A bare percentage floor freezes on noise —
that is the evolve lesson (thresholds without sample floors cannot be trusted). HOLD is the
honest small-n response; FREEZE is the evidenced one. Values config, ceilings hard.

**No background execution.** Sequence advancement is a human-started daily command. The
scheduler module (policy-engine-gated in the README order) owns background execution in a
later cycle, not here.

**Confidence:** high — every clause above is fixture-expressible, and the fixture list is
frozen in `phases/phase-01-spec.md`.

**Rejected because:** Option 1 — a resettable cap is not a cap. Option 2 — TOCTOU by
construction.

## Consequences

**Easier:** "prove the cap cannot be exceeded" becomes a fixture, not an argument. Wipe
derived state, replay, get identical counts.

**Harder:** every send does a spine read. Irrelevant at this lane's declared ceiling; would
matter at volume — which is a no-go anyway.

**The ask-to-exceed class is mandatory:** config raised past the hard ceiling, a CLI flag, an
env var, or a hand-edited counter must each be refused by fixture. This is the class an
adversarial pass attacks first.

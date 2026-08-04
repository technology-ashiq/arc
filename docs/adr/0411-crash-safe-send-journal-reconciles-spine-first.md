# ADR 0411 — The crash-safe send journal reconciles SPINE-FIRST

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** one-way
<!-- a duplicate email to a real human cannot be recalled -->
**Revisit trigger:** a provider is adopted whose API is exactly-once end-to-end, making the
journal redundant rather than merely belt-and-braces.

## Context

The gap: the provider accepts the mail → the process crashes **before** `outreach.sent`
lands on the spine. Receipts now undercount. A blind restart either resends (a duplicate to a
human) or oversends past the cap. `ADR-0403` derives every count from receipts, so a missing
receipt is a missing cap slot.

The subtler gap, found in a later review round: the *inverse* window. The receipt lands and
the process crashes **before** the journal intent is marked resolved. A provider-first
reconcile would then re-emit and collide with its own idem — turning a recoverable state into
an error.

## Options considered

1. **No journal; trust provider idempotency** — pros: nothing to build. cons: the crash
   window is between provider ack and receipt emission; provider idempotency cannot see it.
2. **Journal, reconcile provider-first** — pros: obvious ordering. cons: the receipt-first
   crash window re-emits into a dup-idem error.
3. **Journal, reconcile SPINE-FIRST.**

## Decision

**Option 3.** Two-phase journal, held in the `ADR-0410` private store — **the spine stays
confirmed-truth only; operational scratch state never rides it.**

**Write path:**

1. BEFORE submit, journal an `intent`: `{idempotency_key, lead_hmac, campaign, touch_n, draft_sha}`
2. submit
3. on provider ack, emit `outreach.sent` (payload carries provider message-id + provider timestamp)
4. mark the intent resolved

**Recovery path — startup and pre-send, in this exact order:**

1. compute the intent's deterministic send idem and **check the SPINE first**
2. receipt already exists → mark the intent resolved. **No provider call, no emit.**
3. no receipt → provider reconciliation by idempotency key / message-id
4. found-accepted → emit exactly one missing receipt (same idem preimage)
5. not-found → void the intent

**The recovery is itself idempotent.** A crash *during* recovery re-runs safely, because
step 1 always re-derives from the spine. That property is a consequence of the ordering, not
an extra mechanism — which is precisely why the ordering is spine-first.

**No new send is attempted anywhere while an unresolved intent exists.** Effective cap counts
= `receipts + unresolved intents` — conservative until resolved.

**Confidence:** high — the ordering was derived from the two crash windows and each window
has a named fixture.

**Rejected because:** Option 1 — cannot see the ack-to-receipt window. Option 2 — re-emits
into a dup-idem error in the receipt-first window.

## Consequences

**Easier:** every crash position converges to the same state, and each position has a fixture
rather than an argument.

**Harder:** a startup cost on every run, and an unresolved intent blocks *all* sends — a
deliberately blunt instrument. At ≤20 sends/day that is affordable.

**Fixture family (all mandatory, all adversarially attacked):** crash-after-provider-accept
→ exactly one late receipt, zero resends, cap counts it · crash-after-receipt-before-resolve
→ resolved from the spine, zero provider calls, zero duplicate emits · crash-before-accept →
intent voided, no receipt, cap slot released · crash mid-recovery → re-run converges ·
unresolved intent present → every send path refuses.

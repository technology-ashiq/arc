# ADR 1771 — A verify may answer PENDING: the slot stays pending, exits 4, and is neither failed nor verified

**Status:** accepted
**Date:** 2026-10-20
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** an adapter answers PENDING for something that never resolves on its own (a pending that needs an
owner act). That is an owner gate or a failure, and the answer moves to one of those.

## Context

REQ-18: `security-headers` verifies the live site, but the headers ship with a build. Read before the build is live, the
site still serves the old headers, and the slot was recorded `failed` on a correct config. Cycle 1 did this by hand on
`arc-sandbox` ("waits for the live build, as frontend does"). A verify had two answers, ok or not ok, and not ok is
`failed`.

## Decision

- A verify may answer `{ ok: false, pending: "<what>", answerer: "<host>" }`. The worker saves the slot as `pending`
  with reason `PENDING(<what>)`, cleaned and capped, and exits 4. In verify mode the slot is untouched and the probe's
  answer is named `PENDING(<what>)`.
- The runner receipts the attempt `run.completed` with payload `outcome: "pending"` and returns exit 4, which the walk
  (ADR-1767) already reads as "waiting": it stops with the slot and the reason.
- An answer without `pending` and `answerer` strings stays an ordinary failure. No new state, no new spine kind.
- `next-headers` answers PENDING while Vercel's production deployment of its commit is BUILDING, QUEUED or
  INITIALIZING, or not yet listed. It fails on ERROR, or on CANCELLED with nothing newer READY, and goes on to the live
  probe once that build or a newer one is READY.

## Consequences

- `next-headers` gains `VERCEL_TOKEN` and `api.vercel.com` and its bytes change, so the row is a candidate until the
  owner re-vets it on `myfitfolio` (ADR-1705).
- Fixtures: the runner case (exit 4, state pending, receipt outcome pending, then verified on the next apply), the walk
  stop line, and five build scenarios in the headers arm.

**Evidence:** `lib/worker.mjs` verdict block, `lib/runner.mjs` outcome allow-list, Cycle 1 Owed list.
**Confidence:** high.

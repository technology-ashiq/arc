# ADR 1622 — The social seat card is written against the expired `build-in-public-draft` hire as it stands; retiring the router row is its owning lane's call

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** two-way
**Revisit trigger:** The owner or the engine lane rejustifies the hire -> the social card flips to `origin: hired` with tenure and needs a fixture verdict (REQ-11).

## Context
The design source's kickoff gate asks for a rejustify-or-retire decision before Phase 00. The router row lives in `engine/router.yaml`, owned by the engine lane; editing it here is a cross-lane change to a shared organ (retro 2026-08-19: one field broke `arc-run` for every lane). Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **Write the truth, route the decision** — card records `seat: vacant`, `history:` names the expired hire; a paste-ready prompt goes to the engine lane.
2. **Retire the row from this lane** — cross-lane shared-organ edit.

## Decision
Write the truth. The build-in-public / social card has `byline: ashiq` and `e2: ["publishing under Ashiq's name"]`, so ADR-1609 seats it `human` (`human:ashiq`). The agent may prepare, but the owner publishes. It is `origin: own`, binds the `build-in-public-draft` process as its preparation tool, and has a `history:` line naming the hire and its 2026-08-31 expiry. *(Kickoff erratum, 2026-09-30, before first push: the first draft said `seat: vacant`, which ADR-1609 forbids for a role with a non-empty `e2`. The gate caught it when the card was written.)* The retire-or-rejustify question goes to the engine lane / owner; org does not touch `router.yaml`.

## Consequences
Easier: no shared-organ edit. Harder: the router keeps an expired row until its owner acts.

# ADR 1366 — FV3-J: "Prepare ship" — the face prepares a ship and never deploys

**Status:** accepted 2026-10-21 by the owner at the Cycle 17 kickoff (fork 2, "Prepare ship only")
**Lane:** face (Cycle 17) · **REQ:** REQ-06 · **Phase:** 02
**Reversibility:** one-way
**Revisit trigger:** arc-run enforces a confirm step itself (engine lane) — then a deploy-from-face is a new decision, never this one widened
**Bound by:** AGENTS.md (never deploy unless asked; publishing needs the owner) · ADR-1326 · the door's `CONFIRM_STEP_UNENFORCED` refusal

## Context

`review-ship.ship` has no process (`ship-run`) and its row is forced not-ready by `confirmStep`. A ship is outward and irreversible.

## Options considered

1. **`ship-run` prepares: lint, build, read CI per job, then `approval.requested{gate: deploy}`; the deploy stays the owner's `/arc-ship` (chosen).**
2. **`ship-run` deploys** — needs arc-run confirm-step enforcement first (engine lane, cross-lane ADR); does not fit 6 days.

## Decision

The session is labelled "Prepare ship"; its drawer says the deploy is the owner's. `qa-run` is an ordinary process (`qa.completed`).

## Consequences

- No button pretends to deploy. Deploy-from-face is deferred behind the engine's confirm gate.

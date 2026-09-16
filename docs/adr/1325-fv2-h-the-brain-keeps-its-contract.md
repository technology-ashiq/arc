# ADR 1325 — FV2-H: the brain keeps its contract

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the engine seam for `face-ask`'s `hq.policy.yaml` row lands → the model half of Ask is built on the server side under this same contract; nothing moves into the browser.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-H — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff. Restates Cycle 15 REQ-07, E2 and the SOURCE.md ruling of 2026-08-24.

## Context

v0.7's brain runs browser-side with a pasted provider key and an `approve`/`reject` action
protocol. arc's Ask contract is `POST /api/ask` → `face-ask`, zero write tools,
`ASK_ACTIONS` = `open_room` · `set_speed` · `enter_hq`.

## Options considered

1. **Keep the server-side contract; the Engine room renders driver, model and health and holds no key.**
2. **Keep v0.7's browser brain because it works** — rejected in PLAN-face-v2 §10: a prompt is not a tool contract.

## Decision

Option 1. No provider key in the browser; no `approve`/`reject` in the action vocabulary.

## Consequences

- The `ask-arc` module ports v0.7's view only; its fold reads `/api/ask` and `face/src/lib/ask.mjs` is unchanged.
- A flow that asserts `ask.answered` (a v0.7 kind arc does not have) is re-bound under ADR-1334.

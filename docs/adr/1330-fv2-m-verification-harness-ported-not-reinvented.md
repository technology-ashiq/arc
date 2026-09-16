# ADR 1330 — FV2-M: the verification harness is ported, not re-invented

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a frozen string (button text, placeholder, `data-*`, h1 sentence) has to be edited in more than 3 flows in one ring batch to go green → the port method is wrong for that ring; stop and compare against the reference before editing more assertions.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-M — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff. How its event assertions meet the zero-new-kinds rule is ADR-1334; where it runs is ADR-1335.

## Context

v0.7 ships `scripts/smoke.mjs` (121 lines: opens every room via `#hq/<room>`, collects
exceptions and console errors, screenshots) and `scripts/flows.mjs` (20 write flows that click
real buttons and type into real inputs). The design already proved 36/36 rooms and 20/20 flows
with 0 console errors. As written, smoke drives Chrome over raw CDP using Node's global
`WebSocket`, a hardcoded `C:/Program Files/Google/Chrome/Application/chrome.exe`, and
`vite preview` on :4173; flows read a browser `localStorage` log (`arcface.ws.v1`).

## Options considered

1. **Port both scripts with their UI assertions intact; change only what the environment forces (browser discovery, socket client, where events are read from).**
2. **Re-derive the bar in arc's own test idiom** — days of work, and the frozen strings are lost.

## Decision

Option 1. Button text, placeholders, `data-*` and the h1 sentence stay frozen strings — that is
what makes a redesign of this size safe to attack. The environment changes are declared, not
silent: the socket client (ADR-1335), Chrome discovery (ADR-1335), and event reads from the door
instead of `localStorage` (ADR-1334).

**Evidence:** the v0.7 scripts read from source at `E:/Work_Hub/01_Automemory/arc-face-hq2/assets/arcface/scripts/` on 2026-09-16; Node global `WebSocket` is flagged (`--experimental-websocket`) from 20.10 and unflagged from 22.0, absent in 18 (nodejs.org/en/blog/release/v20.10.0, nodejs.org/en/blog/announcements/v22-release-announce).
**Confidence:** medium
**Rejected because:** re-derivation — costs days and loses the frozen assertions.

## Consequences

- The transform destroys one signal and says so: flows no longer observe the design app's in-browser event log; they observe receipts the door serves. A flow can therefore no longer pass on an event the product never recorded.
- A planted string change in a ported assertion must FAIL the suite (REQ-09's mutant control).

# ADR 0031 — SPINE-H: Emitter dual-mode — hook mode never blocks, strict mode exits 2

**Status:** accepted
**Date:** 2026-07-22
**Reversibility:** two-way
**Revisit trigger:** Phase-4 gap audit shows quarantine swallowing events that strict mode
would have surfaced in time (silent data loss exceeding what the weekly audit catches) →
revisit the hook-mode contract via ADR (e.g. louder surfacing), keeping "never block a
session" inviolate.

## Context

The same validator must serve two masters: interactive sessions (a telemetry bug must never
block or fail Ashiq's work — the `arc_hook_field` guard chain and advisory-events-exit-0
rule already encode this) and CI/ingest/tests (where accepting a malformed event would
poison truth). Pre-mortem row 5: "session blocked by its own telemetry."

## Options considered

1. **One validator core, two modes: hook (quarantine + SKIP + exit 0) and `--strict`
   (exit 2)** — chosen.
2. **Strict everywhere** — rejected: a validation bug bricks every hook-emitting session;
   violates the advisory-hooks non-negotiable.
3. **Lenient everywhere** — rejected: CI and revenue ingest must be able to refuse bad
   input hard (REQ-02, REQ-03); lenient ingest silently poisons money truth.

## Decision

The emitter is dual-mode with ONE validator core. **Hook mode** never blocks: an invalid
event is quarantined to `events/_quarantine/`, a loud SKIP is printed, exit 0 — always.
**Strict mode** (`--strict`: CI, revenue ingest, tests) exits 2 on the same inputs. Every
pinned hostile fixture is asserted in BOTH modes (REQ-02) — the pair of behaviors is the
contract, not either alone.

**Evidence:** the jq→python→RAW fail-safe guard chain and advisory-hook history in this repo;
council v2+v3 adversarial passes (43 holes) justify pinning both modes per fixture
(`docs/retro-log.md`). **Confidence:** high.

## Consequences

- One validator core = no drift between what hooks tolerate and what CI rejects.
- Quarantine needs eyes: the weekly gap audit (Phase 4) reviews `_quarantine/` so "never
  block" doesn't decay into "never notice".
- Guard-chain regression bats are part of Phase 1's exit criteria — the emitter must leave
  `arc_hook_field` untouched.

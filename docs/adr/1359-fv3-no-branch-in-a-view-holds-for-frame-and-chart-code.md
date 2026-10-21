# ADR 1359 — FV3-C: no branch in a View — every v3 decision lives in node-importable `.mjs`

**Status:** accepted 2026-10-21 by the owner (PR #449 merged as `6012c36`, "merge panniten"); proposed in `docs/strategy/plans/PLAN-face-v3.md` (FV3-C), recorded at the Cycle 17 kickoff
**Lane:** face (Cycle 17) · **REQ:** REQ-01 · **Phase:** 00
**Reversibility:** two-way
**Revisit trigger:** a v3 component needs a decision the lint cannot see (then it moves into a `lib/*.mjs` with a node test)
**Bound by:** ADR-1320 (face-pure) · ADR-1321

## Context

v3 adds frame tabs, a strip, a drawer, an org chart and chip tables. ADR-1320 already forbids a branch in a module View; frame code under `shell/` and `ui/` is not scanned by `face-pure`.

## Options considered

1. **Restate the rule for v3's own code: tab lists, strip items, chart layout, chip status all come from `lib/frame.mjs`, `lib/rail.mjs` and the modules' `fold.mjs` (chosen).**
2. **Let shell components decide inline** — fast, and untestable by CI's install-free node legs.

## Decision

Every v3 decision is a pure function in `face/src/lib/*.mjs` or a module's `fold.mjs`; `View.tsx` files only map.

## Consequences

- `face-pure` 37/37 green after v3; `tests/face/l3-logic.mjs` and the ring suites import the new decisions with no install.

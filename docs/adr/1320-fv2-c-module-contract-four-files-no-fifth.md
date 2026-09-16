# ADR 1320 — FV2-C: the module contract is four files, and no fifth

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** `face-pure` has to exempt more than 2 modules by name to go green, or a module's decision provably cannot live in `fold.mjs` without importing React, Vite or three → reopen the contract by a new ADR before the next ring batch, never by a quiet fifth file.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-C and §5.1 — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff.

## Context

Cycle 15 rendered 34 rooms from 11 `.tsx` files plus generic derivation. The decisions that
were tested lived in `face/src/lib/*.mjs`, because CI never runs `npm install` at the repo
root and a decision inside a `.tsx` is a decision nobody tests (`face/README.md`). Porting 36
v0.7 rooms multiplies that risk by 36: under time pressure each room drifts back into one fat
component.

## Options considered

1. **Four files per module** — `module.mjs` (manifest) · `fold.mjs` (pure) · `ops.mjs` (verbs) · `View.tsx` (render); enforced by a lint.
2. **One `.tsx` per room with a lib helper where convenient** — Cycle 15's shape; untestable branches accumulate in views.
3. **Port v0.7's `.jsx` rooms as-is** — the design app has no fold/view split at all.

## Decision

Option 1. `fold.mjs` imports nothing from React, Vite or three and is imported by `node` with
no install; `View.tsx` carries no branch worth asserting. Enforced by `face-pure` (REQ-03),
which lands in Phase 02 **before** any of the 36 modules is written — a lint that lands after
the code it governs governs nothing.

## Consequences

- Easier: every module decision runs in `tests/face/l3-logic.mjs` on all CI legs with no install.
- Harder: one-way in practice — 36 modules written to this shape are expensive to re-shape, which is why the revisit trigger fires at batch granularity.
- A new lane's room is one folder plus its registry row; no shell file is edited (birth rule, §5.1).

# ADR 1323 — FV2-F: Tailwind v4 enters L3, and stops there

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** `npm ci` inside `face/` fails on a CI leg twice for a missing platform binary (`@tailwindcss/oxide-*` or Vite's native bindings) after the lockfile check in ADR-1335 is green, or any `face/src/lib/*.mjs` / `fold.mjs` gains an import that needs an install → stop the ring batch and reopen this ADR.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-F — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff. The kickoff re-verified the version facts below; it did not re-open the choice.

## Context

v0.7 is written in Tailwind v4 utilities, including the light-mode `white → ink` remap. The
product's `face/` has React 19.2, TypeScript 5.9 and Vite ^8.1.1 with its own `package.json`
and a tracked lockfile generated on Windows. No CI job has ever run `npm install` in `face/`.

## Options considered

1. **Add `tailwindcss` + `@tailwindcss/vite` + `@phosphor-icons/react` to `face/package.json` only; `lib/*.mjs` stays dependency-free.**
2. **Hand-translate v0.7's utilities into token CSS** — rejected in PLAN-face-v2 §10: 36 rooms of drift, and the light remap has no hand equivalent.

## Decision

Option 1. The boundary is enforced, not promised: `face-pure` (ADR-1320) FAILs a `fold.mjs`
that imports a package, and `tests/face/l3-logic.mjs` keeps importing every `.mjs` with no
install on all legs. The light-mood remap uses Tailwind v4's CSS-first `@custom-variant`
under `html.hq.hq-light`, fed by the generated token copy (ADR-1308).

**Evidence:** registry entries checked 2026-09-16 — `tailwindcss@4.3.3` (registry.npmjs.org/tailwindcss), `@tailwindcss/vite@4.3.3` peer `vite: ^5.2.0 || ^6 || ^7 || ^8` (registry.npmjs.org/@tailwindcss/vite), `@tailwindcss/oxide@4.3.3` `engines.node >=20` (registry.npmjs.org/@tailwindcss/oxide), `@phosphor-icons/react@2.1.10` peer `react >=16.8` (registry.npmjs.org/@phosphor-icons/react); Vite 8 `engines.node ^20.19.0 || >=22.12.0` (vite.dev/blog/announcing-vite8); `@custom-variant` (tailwindcss.com/docs/dark-mode); cross-platform optional-dependency lockfile defect still reported on npm 11.11 in Aug 2026 (github.com/npm/cli/issues/4828). All four packages VERIFIED to exist (registry + official docs).
**Confidence:** medium
**Rejected because:** hand translation — drift across 36 rooms and no equivalent for the light remap.

## Consequences

- Node 18 can never build L3 (Tailwind oxide and Vite 8 both refuse it); ADR-1335 turns that into a named, counted skip on the one Node 18 leg.
- A Windows-generated lockfile can omit Linux/macOS native binaries; ADR-1335 adds a lockfile check before any browser run trusts `npm ci`.
- A generated CSS copy feeding Tailwind has no documented incompatibility and none documented as safe either — Phase 01 proves it by building on CI, not by reading docs.

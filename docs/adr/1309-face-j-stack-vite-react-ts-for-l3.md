# ADR 1309 — FACE-J: L2 is zero-dep node ≥18; L3 is React + TypeScript + Vite

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** the SaaS face becomes near-term (FACE-O trigger fires) → Next.js
static export is re-evaluated before L3 grows server-side needs; a framework migration
after Phase 06 is a new cycle, never a drift.

## Context

L2 lives in the arc repo, which is zero-dep by law (A2). L3 lives in `arc-face`
(ADR-1300) and needs a component model for 32 rooms on one template, a registry of
bespoke panels, and strict typing for the kind/profile renderers. Framework class is a
one-way door (kickoff question budget).

## Options considered

1. **Vite + React + TS strict** — pros: local-first app, fastest inner loop, static
   output serves from anywhere, no server runtime to secure beside L2. Cons: if the SaaS
   skin nears, routing/SSR conventions arrive later.
2. **Next.js static export** — pros: SaaS-near conventions now. Cons: heavier for a
   localhost tool; server features are a standing temptation against FACE-M.

## Decision

Option 1 — the plan's stated default for a local-first app, adopted because the owner
pasted the kickoff prompt with defaults standing. L2: one zero-dep node ≥18 file (poll,
no websockets, no daemon). L3: React + TypeScript (**strict, no `any`**) + Tailwind +
design tokens (`tokens.css` from Phase 02); **lucide-react icons only**; no Three.js; no
charting lib beyond a thin SVG layer (dataviz discipline); Playwright for e2e, Vitest for
units. Loading + error states handled everywhere (CLAUDE.md code standard); the error
state renders the CLI refusal code verbatim.

## Consequences

Easier: L3 ships as static files a localhost server can host; the stack never enters the
arc repo. Harder: anything server-shaped must live in L2 by construction — which is the
architecture working as intended.

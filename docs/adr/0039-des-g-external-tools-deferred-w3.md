# ADR 0039 — DES-G: external design tools (MCPs/plugins) deferred to W3+; the loop proves itself on agent-browser first

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** scheduled — after the LexOS pilot proves the loop (Phase 3 closed + one clean external run), tools earn evaluation one at a time.

## Context

A stack was researched 2026-07-26 (Anthropic frontend-design plugin, shadcn MCP, Magic
MCP/21st.dev, Figma MCP, tweakcn, Mobbin-style galleries). Superseded row 5 killed
"MCP stack in v1".

## Options considered

1. **Defer to W3+** — v1 proves brief → explore → critique → decide → learn on agent-browser + existing rendering only. Con: slower component assembly in v1.
2. **Install accelerators now** — faster pretty output. Con: accelerators mask whether the *intelligence* (brief, theses, critique) works; debugging conflates tool noise with loop defects.

## Decision

Option 1. Accelerators are not intelligence. At W3+ install time the slopsquatting rule
applies to MCPs too: registry entry + official docs + receipt, re-verified at install.

## Consequences

Easier: v1 failures are attributable to the loop itself; zero new supply-chain surface
this cycle. Harder: composers hand-build more in v1 — acceptable, variants are
prototypes.

# ADR 1311 — FACE-L: the Coverage map is the v1 contract, asserted by `face-coverage`

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** the expected set and the tree disagree in a way that is the LINT's
fault twice in one cycle (false FAILs on legitimate tree changes) → the expected set's
derivation moves into the manifests entirely, by ADR.

## Context

Pre-mortem row 4: pretty rooms that miss half of arc. A pass condition that is only an
absence cannot detect mediocrity (CLAUDE.md) — but coverage is countable, so a validator
can hold it: every lane, kind, command, agent, gate and concept has a named home.

## Options considered

1. **`face-coverage` lint, FAIL from birth, mutant-tree negative control** — pros:
   coverage is CI, not review; the Coverage map appendices A–D are the machine's expected
   set. Cons: the lint must track the tree as lanes are born.
2. **Coverage by review checklist** — cons: the 33rd room is forgotten politely.

## Decision

Option 1 (REQ-01, Phase 05). The room list in the design source's Coverage map is the v1
contract: 15 born lanes + 4 planned (ops · trader · discover · chat-mcp) → rooms; 46
kinds → typed or generic homes (Appendix A); 26 commands, 30 agents, 6 processes, 7
gates, hooks, rules, lints → Toolbelt/Review homes (Appendices B–D); every glossary
concept → a room + station. `face-coverage` FAILs on any miss; on a mutant tree with a
new lane and a new kind it must FAIL naming both (the mutant IS the negative control).
The **"not instrumented"** state is the legal answer for missing data — never a hidden
panel. FAIL-from-birth is the named exception to the WARN-first trial rule, per the
`policy-lint`/`jobs-lint` validator precedent.

## Consequences

Easier: "does the face cover arc" is a CI verdict. Harder: the expected set is
maintenance — owned by this lane, refreshed at every lane birth via the ADR-1306
birth-rule.

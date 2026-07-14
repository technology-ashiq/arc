# ADR 0006 — Per-agent model tiers (verifier on opus, members on sonnet)

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** sonnet members produce weak reasoning that the verifier can't rescue, or an opus verifier proves unnecessary for grading quality.

## Context
Each `council-*` agent declares a `model:` in its frontmatter. The cross-examining verifier does the
hardest reasoning (grading evidence, finding contradictions), while stance/domain members produce
structured, bounded arguments. Tiering the models trades cost against quality where it matters.

## Options considered
1. **All members on opus** — pros: uniform peak quality; cons: highest cost across 7-12 agents/run.
2. **All members on sonnet** — pros: cheapest; cons: the verifier — the honesty backstop — is under-powered.
3. **Tiered: verifier opus, everyone else sonnet** — pros: spends the premium tier on the highest-leverage seat; cons: a two-tier config to maintain.

## Decision
Option 3. `council-verifier` runs on `opus`; all stance, researcher, and domain-expert members run on
`sonnet`. Chosen to put the strongest reasoning on the cross-examination seat that keeps the whole council
honest, while keeping fan-out affordable.

## Consequences
Easier: cost scales with sonnet members; quality concentrated where it's decisive. Harder: model tiers are
a knob to revisit if member reasoning proves too thin.

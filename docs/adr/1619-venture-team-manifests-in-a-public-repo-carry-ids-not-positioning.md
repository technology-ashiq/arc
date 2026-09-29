# ADR 1619 — A team manifest in this public repo carries role ids, stages, heads and budgets; venture positioning stays private

**Status:** accepted
**Date:** 2026-09-29
**Product:** `org`
**Reversibility:** one-way
**Revisit trigger:** The owner decides Nilluvai's positioning is public (launch) -> the mission line may move into the manifest by ADR.

## Context
arc's repository is PUBLIC. The design-source team manifest shape carries `mission:` text, and ventures carry kill lines. Pushing an unannounced venture's positioning is irreversible (indexed, cached). LexOS contact values already live in `~/.arc-private/` through `--venture-dir`. Fired by the owner ruling of 2026-09-29 (ADR-1600).

## Options considered
1. **(a) Everything in the repo** — simplest; publishes positioning.
2. **(b) Everything private** — coverage and the digest gate need a private resolver and a carve-out.
3. **(c) Split** — role ids, stages, `on_shift`, heads, budgets public; mission text private.

## Decision
(c). `mission:` in a team manifest is either a one-line **public-safe** label the owner approves as part of the `org.team` digest, or the literal `private` with the text held under `~/.arc-private/`. Coverage and the digest read only the public file. Kill lines stay in `ventures.yaml` (already public by ledger's design; the owner sets them).

## Consequences
Easier: gates stay simple, nothing sensitive leaks. Harder: the dispatcher's goal ancestry shows `mission: private` unless the owner approves a public line.

# ADR 0014 — Product monorepo: physical product boundaries in one repo

**Status:** accepted
**Date:** 2026-07-17
**Reversibility:** one-way
**Revisit trigger:** the restructure's Phase 3 (physical re-homing) blows 2× its appetite, OR the byte-diff gate cannot be made reliable on Windows — then fall back to registry-only (labels without moves, the runner-up architecture) and bank Phases 0–2.

## Context

Ashiq wants arc restructured from one monolithic build system into multiple products under
one orchestrator umbrella — each product independently developable, installable, and
eventually open-sourceable or SaaS-able — without breaking the daily driver. Three
architectures were designed and judged (2026-07-17, 12-agent analysis: 7 subsystem readers →
3 independent architects → 2 judges). Constraints: solo dev, Windows host, sync-to-project
twins are the only installer (standing rule: extend, never parallel), arc's own build
discipline applies to the migration itself.

## Options considered

1. **Plugin suite** (packages/ per product, generated .claude/, settings-merge engine) —
   pros: best marketplace/sellability story; cons: highest risk + maintenance tax, 12w,
   speculative with zero external users. Judge scores 22/40 and 23/40.
2. **Product monorepo** (one repo, products/<name>/ manifests+tests, scripts re-homed to
   .claude/scripts/<product>/, runtime stays under .claude/) — pros: real boundaries, cheap
   future extraction (packaging not archaeology), one CI; cons: big re-homing diff mid-cycle.
   Scores 27/40 and 30/40 (product judge's winner).
3. **Registry-in-place** (manifest layer only, zero file moves) — pros: lowest risk, 5w;
   cons: boundaries advisory-only, coupling free to regrow, extraction stays archaeology.
   Scores 31/40 (pragmatist judge's winner) and 29/40.

## Decision

Option 2 — product monorepo, with option 3's safety ideas grafted on (WARN-first TRIAL
lints, read-only /arc dashboard, prune-report before attic, demand-triggered extraction rule)
and option 1's protections (hostile-manifest fixtures, byte-diff CI invariant, banked-win
kill criterion, real-repo dogfood bar). The carrying reason: Ashiq's stated goals — per-product
development now, open-source/SaaS a product later — need physical boundaries; option 3 defers
exactly the work those goals require, and option 1 buys packaging polish no user has asked for.

**Evidence:** docs/orchestrator-monorepo-plan.md (full design + judge scores table);
subsystem map from 7 readers over the actual repo (2026-07-17 workflow run).
**Confidence:** high
**Rejected because:** Plugin suite — 12w speculative tax, fallback in its own risk list
collapses toward option 2. Registry-in-place — cannot deliver per-product tests, split
development, or cheap extraction; boundary is advisory.

## Consequences

Easier: developing one product without touching others; extracting a product when demand
appears (`product-lint --paths` emits the file list); selling the restructure's value story.
Harder: Phase 3's re-homing rewrites every hardcoded path (council-lint pinned agent paths,
bats greps, command frontmatter) — protected by the byte-diff gate; one repo means product
boundaries need lint enforcement (product-lint), not directory isolation. If this goes wrong,
the revisit trigger falls back to registry-only with Phases 0–2 banked.

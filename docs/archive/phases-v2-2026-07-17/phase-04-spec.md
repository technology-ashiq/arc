# Phase 04 — QA pipeline

**Goal (one line):** test quality becomes unfakeable — mutation score replaces coverage as the primary gate, perf budgets assert, and visual regressions diff automatically.
**Appetite:** 1.5 weeks.

## Exit criteria (Definition of Done)

- [ ] **Stryker adapter**: diff-scoped mutation testing (changed files only) as a CI-tier gate; `coverage-gate.sh` demoted to secondary check per ADR-0005; mutation score lands in evidence bundle
- [ ] **Lighthouse CI**: budget file (LCP/CLS/TBT/bundle) with `lhci assert` as a gate; budgets live in `arc.gates.yaml` per-phase section
- [ ] **Visual regression**: Playwright screenshot baseline diff wired into `/arc-qa` and `/arc-design` (design-reviewer's before/after becomes automated baseline compare)
- [ ] **schemathesis adapter**: if an OpenAPI spec exists, fuzz API contract in CI tier; no spec → SKIPPED
- [ ] `qa-tester` agent updated to consume these results as evidence instead of narrating
- [ ] Full-repo Stryker as nightly CI job (never gating) — trend data for evidence
- [ ] Live demo: delete an assertion from a green test → mutation gate blocks; regress LCP past budget → Lighthouse blocks
- [ ] bats + CI green; `/arc-toolcheck` covers new tools
- [ ] Tracker updated

## Rabbit holes in this phase

- Stryker runtime → diff-scoped only for gating (PLAN rabbit hole); tune later with real data
- Visual-diff flakiness (fonts/animations) → mask dynamic regions, 0.1% pixel threshold, mark known-flaky routes SKIPPED rather than fight them this cycle

## Out of scope for this phase

- k6 load testing (next cycle) · a11y beyond existing axe-core (already covered) · cross-browser matrix (chromium only this cycle)

## Your-setup / pending

- A target project with tests to demo mutation gating (arc itself has bats; Stryker demo needs a JS/TS target — use a seeded fixture repo)

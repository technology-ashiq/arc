# Phase 05 — Phase ratchet + docs gate v2

**Goal (one line):** quality thresholds become per-phase profiles that only ratchet up, and the docs gate upgrades from grep-heuristic to provable drift detection.
**Appetite:** 1 week.

## Exit criteria (Definition of Done)

- [ ] `arc.gates.yaml` gains per-phase benchmark profiles (mutation %, coverage %, criticals/highs, LCP, duplication %) — `/arc-phase-done` reads the active phase's profile
- [ ] **Ratchet rule enforced**: a threshold lower than the previous phase's = gate-runner blocks with "ratchet violation — needs ADR"
- [ ] Default ratchet table shipped (skeleton→ship progression from the plan discussion) as template for new projects
- [ ] **jscpd** + **dependency-cruiser** adapters (duplication % + architecture boundary rules) — the two AI-slop detectors — wired into the code gate
- [ ] Docs gate v2: **lychee** (dead links) + **markdownlint** + **oasdiff** (OpenAPI drift = provable, replaces route-grep heuristic where a spec exists); vale optional adapter
- [ ] `docs/templates/phase-spec-template.md` updated: exit criteria section now references the benchmark profile
- [ ] Live demo: attempt to close a phase with mutation score below profile → refused; lower a threshold in yaml → blocked without ADR
- [ ] bats + CI green; toolcheck covers new tools
- [ ] Tracker updated

## Rabbit holes in this phase

- Designing the perfect universal ratchet table → ship ONE sensible default, projects tune their own yaml
- vale style-guide bikeshedding → optional adapter, default off

## Out of scope for this phase

- Ratchet visualization/dashboard (Phase 8 material) · per-language profiles (TS/JS only this cycle)

## Your-setup / pending

- None

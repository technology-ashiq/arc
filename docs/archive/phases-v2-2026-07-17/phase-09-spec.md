# Phase 09 — Deployment confidence score

<!-- Next cycle. Depends on: Phase 02 gate engine + evidence bundles. ADR-0009. -->

**Goal (one line):** every gate run ends in one weighted 0–100 confidence score with per-dimension breakdown and top-3 actions — derived from existing evidence, never gating by itself.
**Appetite:** 3 days.

## Exit criteria (Definition of Done)

- [ ] `confidence-score.sh` reads all gate evidence artifacts → emits `confidence.json` (total, security/testing/architecture/docs subscores, top-3 actions)
- [ ] Weights defined in `arc.gates.yaml` per-phase profiles; default weight table shipped as template; ratchet rule applies
- [ ] Score is presentation-only — blocking behavior of every existing gate provably unchanged (bats test: flip score weights → gate outcomes identical)
- [ ] Wired into statusline + `/arc-phase-done` summary output
- [ ] Missing/SKIPPED gate → dimension marked `unknown`, total capped and annotated — never silently 100
- [ ] bats + 3-OS CI green; tracker updated

## Rabbit holes in this phase

- Perfect weighting debate → ship ONE sensible default, projects tune yaml (Phase 5 ratchet-table pattern)
- Score-as-gate creep → refused by ADR-0009; a hard cutoff request = profile change, not score logic

## Out of scope for this phase

- Passport embedding (Phase 10) · trend/history visualization (Phase 8 material)

## Your-setup / pending

- None

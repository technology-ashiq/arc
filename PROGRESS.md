# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**Kickoff complete (2026-07-17), awaiting Ashiq's approval gate (kickoff step 9).** PLAN.md +
6 phase specs + ADRs 0014–0019 written. Gates run: attack panel ×3 (20/20 findings accepted
as exact mutations) · kickoff-lint all checks passed · simulation gate round 1 = 6 blockers →
spec amended (manifest schema v1, line protocol v1, product-assignment table, golden-fixture +
hostile-corpus + named-fixture locations) → round 2 = 0 blockers · L-tier researcher
re-verified the top-3 load-bearing ADR claims against source (all VERIFIED, file:line quoted).
Second opinion: NO second model available on this machine (codex CLI absent, JUROR_* unset,
no second Claude profile) — recorded honestly per the command's own rule, not faked; wiring a
juror/codex remains available anytime via env. No product code yet — Phase 00 (steel thread:
manifests → resolver → twins → council-only install) starts on approval.

Appetite burn: **0 of 6 weeks (0%).**

Setup needed from user: none for Phase 00. Phase 04 will need venturemind + InvoiceFly access
and the council-vs-core+plan target assignment.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: manifests + resolver + product-lint + hostile fixtures + --products in both twins + twin-leak fixes + council-only install; minimal /arc = stretch (ADR-0019) | 1.5 weeks | ⬜ not started | |
| 01 | Composable hooks: event.d fragments, loud-SKIP guards, stable settings.json, <30s verified | 0.5 weeks | ⬜ not started | |
| 02 | Registry-aware core: arc-registry.json in targets, ledger kinds from registry, /arc registry-backed, CI tree-diff invariant | 1 week | ⬜ not started | |
| 03 | Physical re-homing, incremental council→core→plan→review→qa behind the byte-diff gate (ADR-0018) | 1.5 weeks | ⬜ not started | |
| 04 | Dogfood: council-alone + core+plan into two real external repos, evidence bundles | 0.5 weeks | ⬜ not started | |
| 05 | Prune-report + attic, README/usermanual rewrite, TRIAL promotions, retro | 0.5 weeks | ⬜ not started | |

Extraction to separate repos/plugins/SaaS is **not a phase** — demand-triggered next cycle (ADR-0016).

## Done log

- **2026-07-17 · Kickoff.** v2 initiative parked + archived (ADR-0017). Product-monorepo
  architecture decided over plugin-suite and registry-in-place (ADR-0014, judge-scored
  12-agent analysis). ADRs 0014–0019 accepted. Forks resolved: dogfood targets =
  venturemind + InvoiceFly (assigned at Phase 04 start) · Phase-03 re-homing incremental,
  council first (ADR-0018) · /arc ships minimal in Phase 00 (ADR-0019). Design source:
  docs/orchestrator-monorepo-plan.md.

## North-star metric

Time-to-install-one-product into a fresh repo (one command, <60s, zero manual file picking) —
measured at every phase close from Phase 00 onward.

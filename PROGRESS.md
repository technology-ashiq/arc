# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**Phase 00 IN PROGRESS — Ashiq approved 2026-07-17, build started (TDD).** Kickoff artifacts
committed (park v2 + full plan). Phase-00 slices done + committed so far:
- **Slice 1 — resolver + linter (done).** `arc-products.mjs` (TAB line-protocol emitter) +
  `product-lint.mjs` (schema + coverage/double-map + byte-hygiene + path-safety). 16 bats
  cases red-first→green; 7-case hostile corpus all exit 2 (REQ-03); crlf-bom fixture byte-pinned
  via .gitattributes -text.
- **Slice 2 — the 6 real manifests (done).** products/{core,plan,review,qa,council,git}. Added
  a `files` catch-all field (hooks/rules/output-styles/templates/skills/settings.json). Corrected
  REQ-03: TAB delimiter makes spaces-in-paths legal; real break = control-char (Ashiq-approved).
  `product-lint --root .` PASSES — all 90 .claude/ files map to exactly one product, no
  double-map. `--products council` resolver plan = 54 files (core+council only, clean).

Appetite burn: ~2 of ~7.5 days of the Phase-00 slice budget (rough).

**Next up (careful — touches the daily-driver sync scripts):** (1) capture the golden-output
fixture BEFORE editing twins (the byte-identical safety net); (2) wire `--list`/`--products`
into sync-to-project.sh + .ps1 via the resolver plan; (3) fix the twin bugs (.ps1 state/ leak,
both twins' scheduled_tasks.lock leak); (4) council-only install demo in a scratch repo (named
pass/fail fixtures); (5) stretch `/arc`. Then evidence bundle + `/arc-phase-done 00`.

Second opinion still unavailable on this machine (no codex/JUROR) — noted, not faked.

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

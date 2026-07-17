# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**Phase 00 BUILD COMPLETE (2026-07-17) — every exit criterion met; awaiting formal
`/arc-phase-done 00` (review + evidence bundle).** All slices done + committed (TDD throughout,
red-first). Full bats suite **197/197 green, 0 fail, 0 skip** across 20 files.

- **Resolver + linter.** `arc-products.mjs` (TAB line-protocol: PROTO/MKDIR/COPY/ENVBLOCK, +
  `--list`/`--status`) + `product-lint.mjs` (schema + coverage/double-map + byte-hygiene +
  path-safety). 7-case hostile corpus all exit 2 (REQ-03); crlf-bom fixture byte-pinned.
- **6 manifests** (products/{core,plan,review,qa,council,git}) + a `files` catch-all field.
  `product-lint --root .` passes — all 92 .claude/ files map to exactly one product, no double-map.
- **Twin bug fixes (REQ-04):** both twins now exclude `scheduled_tasks.lock`; .ps1 also excludes
  `state/`. Bugfix test-first; ps1 verified via Windows PowerShell.
- **Golden-output gate (REQ-02):** 109-file path+LF-SHA256 fingerprint; sync.bats diffs it on BOTH
  rsync + cp-r paths (proven identical). Regenerated once (reviewed) for the /arc additions.
- **Selective install (REQ-01):** `--products a,b` in both twins via the resolver plan. Live demo —
  council-alone install (55 files, core rides along, zero plan/review/qa/git leak); inside the
  target, council-lint on the pass-fixture → exit 0, fail-fixture → exit 1 (discrimination proven).
- **`/arc` dashboard (stretch, ADR-0019, not cut):** read-only per-product INSTALLED table; degrades
  gracefully in a consumer with no products/.
- Spec corrections surfaced by the build (both flagged to Ashiq): REQ-03 space→control-char
  (approved); product-lint is a hard-FAIL gate, not a WARN-first TRIAL gate (exit-criterion reworded).

Appetite burn: ~1 day of the ~7.5-day Phase-00 budget — well under (Claude speed).

**Next:** `/arc-review` on the branch → fix any findings → `/arc-phase-done 00` (evidence bundle +
tracker flip to ✅). Then Phase 01 (composable hooks). Second opinion still unavailable on this
machine (no codex/JUROR) — noted, not faked.

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

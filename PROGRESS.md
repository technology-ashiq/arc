# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**Phase 00 CLOSED ✅ (2026-07-17).** The selective-install spine ships: single resolver
(`arc-products.mjs`, TAB line-protocol) + registry linter (`product-lint.mjs`, hostile-corpus
gate) + 6 product manifests + `--products`/`--list` in both sync twins + twin leak fixes +
byte-identical golden gate (rsync+cp-r) + read-only `/arc` dashboard. **204/204 bats green.**
Reviewed (fix-first→ship: 2 real Criticals found + fixed + adversarially re-verified hole-free),
evidence bundle committed + verified. REQ-01–04 validated. Live proof of the whole idea:
`sync-to-project.sh <target> --products council` installs one product alone; `/arc` shows the
umbrella.

Next up: **Phase 01 — composable hooks** (`phases/phase-01-spec.md`, 0.5-week appetite): split the
6 monolithic hooks into `<event>.d/` fragments with loud-SKIP guards for absent products, a stable
core `settings.json` template, and a measured <30s hook-tier budget on the Windows box (REQ-06).

Appetite burn: **~1 of ~30 days (~3%)** — Phase 00 closed in ~1 session vs its 1.5-week appetite.
Kill tripwire (50%, Phase 1 must be done) is far off.

Setup needed from user: none for Phase 01. Phase 04 will need venturemind + InvoiceFly access
and the council-vs-core+plan target assignment.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: manifests + resolver + product-lint + hostile fixtures + --products in both twins + twin-leak fixes + council-only install + /arc dashboard | 1.5 weeks | ✅ done | 2026-07-17 |
| 01 | Composable hooks: event.d fragments, loud-SKIP guards, stable settings.json, <30s verified | 0.5 weeks | ⬜ not started | |
| 02 | Registry-aware core: arc-registry.json in targets, ledger kinds from registry, /arc registry-backed, CI tree-diff invariant | 1 week | ⬜ not started | |
| 03 | Physical re-homing, incremental council→core→plan→review→qa behind the byte-diff gate (ADR-0018) | 1.5 weeks | ⬜ not started | |
| 04 | Dogfood: council-alone + core+plan into two real external repos, evidence bundles | 0.5 weeks | ⬜ not started | |
| 05 | Prune-report + attic, README/usermanual rewrite, TRIAL promotions, retro | 0.5 weeks | ⬜ not started | |

Extraction to separate repos/plugins/SaaS is **not a phase** — demand-triggered next cycle (ADR-0016).

## Done log

- **2026-07-17 · Phase 00 · Steel thread (selective-install spine).** The orchestrator became
  real: `arc-products.mjs` (single resolver, TAB line-protocol PROTO/MKDIR/COPY/ENVBLOCK +
  `--list`/`--status`) + `product-lint.mjs` (registry police: schema, coverage/double-map,
  byte-hygiene, path-safety) + 6 product manifests (core/plan/review/qa/council/git; every one of
  the 92 `.claude/` files maps to exactly one product) + `--products`/`--list` selective install in
  BOTH sync twins + the twin leak fixes (`.claude/state/`, `scheduled_tasks.lock`) + a golden-output
  gate (byte-identical bare sync on rsync AND cp-r) + the read-only `/arc` dashboard (stretch, not
  cut). **Full suite 204/204 green** (products 25, sync 15) on the local 3-tool run. **Live demo:**
  council-alone install (57 files, core rides along, zero plan/review/qa/git leak) → council-lint
  discriminates pass-fixture (exit 0) vs fail-fixture (exit 1) inside the target; bare sync
  byte-identical to golden on both copy paths; `/arc` shows all 6 products; every hostile fixture
  exits 2. **Code review (fix-first → ship):** the code-reviewer found 2 real Criticals the corpus
  missed — backslash `..\` traversal (PowerShell escape) and `envSentinel` newline injection (both
  twins) — both fixed + pinned as red fixtures, then an adversarial re-review verified them hole-free
  across ~25 bypass attempts and returned **ship**; 2 follow-up warnings (W3/W4, same Windows-norm
  class) + N4 also closed. Evidence bundle committed + verified (`docs/evidence/phase-00/`). Spec
  corrections surfaced by the build (all flagged): REQ-03 space→control-char, product-lint hard-FAIL
  not WARN-TRIAL, REQ-04 ps1-test skips-on-pwsh-less (not fails). **Actual: ~1 session (part of a
  day) vs 1.5-week appetite — well under.** · amendments: 0 · reopened: n · t-to-phase0: 0 days.
- **2026-07-17 · Kickoff.** v2 initiative parked + archived (ADR-0017). Product-monorepo
  architecture decided over plugin-suite and registry-in-place (ADR-0014, judge-scored
  12-agent analysis). ADRs 0014–0019 accepted. Forks resolved: dogfood targets =
  venturemind + InvoiceFly (assigned at Phase 04 start) · Phase-03 re-homing incremental,
  council first (ADR-0018) · /arc ships minimal in Phase 00 (ADR-0019). Design source:
  docs/orchestrator-monorepo-plan.md.

## North-star metric

Time-to-install-one-product into a fresh repo (one command, <60s, zero manual file picking) —
measured at every phase close from Phase 00 onward.

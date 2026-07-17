# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**Phase 01 CLOSED ✅ (2026-07-17).** The 6 lifecycle hooks are now composable: thin core
dispatchers (`_dispatch.sh`) running `.claude/hooks/<Event>.d/NN-*.sh` fragments, advisory events
isolate failures, blocking events propagate exit 2, the deploy-guard degrades loudly when
`arc.gates.yaml` is absent (REQ-06), a missing dispatcher fails open loudly. Fixed a live
pre-existing security hole (the destructive-guard was silently disarmed on Windows by the MS-Store
python stub — now jq-first + raw fail-safe). **215/215 bats green**, reviewed (ship), evidence
bundle verified. REQ-06 validated. Scope trimmed via /arc-change (dropped the hollow per-product
SKIP; kept the dispatcher pattern + degradation + <30s). SessionStart 11.4s < 30s.

Next up: **Phase 02 — registry-aware core** (`phases/phase-02-spec.md`, 1-week appetite): targets
carry an `arc-registry.json` ground truth; `/arc` + review-ledger read it instead of guessing from
file presence; CI tree-diff invariant (`--products all` vs the mold) so manifests can never silently
diverge from reality.

Appetite burn: **~2 of ~30 days (~7%)** — Phases 00+01 both closed in ~1 session each, far under
their 1.5w/0.5w appetites. Kill tripwire (50%) is far off.

Setup needed from user: none for Phase 02. Phase 04 will need venturemind + InvoiceFly access
and the council-vs-core+plan target assignment.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: manifests + resolver + product-lint + hostile fixtures + --products in both twins + twin-leak fixes + council-only install + /arc dashboard | 1.5 weeks | ✅ done | 2026-07-17 |
| 01 | Composable hooks: event.d dispatcher + fragments, graceful partial-install degradation, <30s | 0.5 weeks | ✅ done | 2026-07-17 |
| 02 | Registry-aware core: arc-registry.json in targets, ledger kinds from registry, /arc registry-backed, CI tree-diff invariant | 1 week | ⬜ not started | |
| 03 | Physical re-homing, incremental council→core→plan→review→qa behind the byte-diff gate (ADR-0018) | 1.5 weeks | ⬜ not started | |
| 04 | Dogfood: council-alone + core+plan into two real external repos, evidence bundles | 0.5 weeks | ⬜ not started | |
| 05 | Prune-report + attic, README/usermanual rewrite, TRIAL promotions, retro | 0.5 weeks | ⬜ not started | |

Extraction to separate repos/plugins/SaaS is **not a phase** — demand-triggered next cycle (ADR-0016).

## Done log

- **2026-07-17 · Phase 01 · Composable hooks.** The 6 monolithic Claude Code lifecycle hooks
  became thin core **dispatchers** (`_dispatch.sh`) that run `.claude/hooks/<Event>.d/NN-*.sh`
  fragments in order — a product can drop in a fragment without editing the hook. Advisory events
  (SessionStart/PostToolUse/PreCompact/SessionEnd) always exit 0 and isolate a fragment's failure;
  blocking events (PreToolUse/edit) propagate a fragment's exit 2 (first block wins); the payload is
  captured once and fed only to the three tool hooks (session events never wait on stdin); a
  missing dispatcher fails open **loudly**. The current logic was split into fragments (all core);
  the deploy-guard **degrades loudly** (`SKIP arc-gates … Allowed.` + exit 0) when `arc.gates.yaml`
  isn't installed (REQ-06). **Scope trimmed via /arc-change** (Ashiq): the 6 hooks are ~90% core, so
  the hollow "loud SKIP for every absent product on every event" was dropped; kept the dispatcher
  pattern + graceful degradation + the <30s measure. **SECURITY FIX (pre-existing, live):** the
  destructive-guard was silently disarmed on Windows — `python3` is the Microsoft-Store stub, so
  command extraction failed and a recursive-force-remove of `/` was NOT blocked (the old hook let
  it through, proven); `arc_hook_field` now parses jq-first + real-python + a RAW payload fail-safe
  so a broken parser can never disarm the guard (proven live). **Full suite 215/215 green** (11 new
  hooks-dispatch/guard bats incl. the stub + fail-open regressions). Live demo: council-only install
  → all 6 events exit 0; deploy-guard loud-SKIP degradation; destructive blocks / normal allows;
  SessionStart 11.4s < 30s (assumption "hook dispatch stays under budget on Windows" HELD).
  **Code review fix-first→ship** (no Criticals; the reviewer verified the fix cannot introduce a
  false-allow across ~every degraded path; W1 loud-fail-open + N1/N3 nits folded in). Evidence bundle
  committed + verified (`docs/evidence/phase-01/`). settings.json unchanged. **Actual: ~1 session vs
  0.5-week appetite — under.** · amendments: 1 (the scope trim) · reopened: n.
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

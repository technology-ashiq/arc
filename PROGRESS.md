# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**Phase 02 CLOSED ✅ (2026-07-17).** Registry-aware core: targets now carry `.claude/arc-registry.json`
ground truth (v1 schema locked: `schema` · `source.commit` · per-product `version`+`files`) and consumers
read it instead of guessing from file presence. (1) resolver `--registry` mode + registry-backed
`/arc --status` (REQ-05); (2) **both** twins write the registry in bare **and** `--products` paths (ps1
UTF8-no-BOM, sh capture-then-write, REQ-08); (3) `review-ledger.sh` derives `VALID_KINDS` from the registry
(review→scan/code/security/docs, qa→qa/design), hardcoded fallback kept; (4) a tree-diff invariant proves
installing all products reproduces the mold's `.claude/` exactly. Golden gate **excludes** `arc-registry.json`
(volatile commit) so REQ-02 stays byte-identical. **236/236 bats green**, reviewed (ship — 2 Low + 2 Nits
fixed fix-first, glob hole pinned), evidence bundle verified. **Bonus:** the new tree-diff invariant caught
a pre-existing REQ-04-class leak on first use — sync copied `.claude/worktrees/` (transient git worktrees)
into targets; fixed in both twins + pinned. REQ-05 + REQ-08 validated. **Actual: ~1 session vs 1-week
appetite — under.** · amendments: 1 (phase-start /arc-change refinement) · reopened: n.

Next up: **Phase 03 — physical re-homing** (`phases/phase-03-spec.md`, 1.5-week appetite): scripts move
under `.claude/scripts/PRODUCT/`, tests under `products/NAME/tests/`, incrementally (council → core → plan →
review → qa) each behind the byte-diff gate (ADR-0018) — installed tree provably unchanged per move.

Appetite burn: **~3 of ~30 days (~10%)** — Phases 00+01+02 each closed in ~1 session, far under their
1.5w/0.5w/1w appetites. Kill tripwire (50%) is far off.

Setup needed from user: none for Phase 03 (all local). Phase 04 will need venturemind + InvoiceFly access
and the council-vs-core+plan target assignment.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: manifests + resolver + product-lint + hostile fixtures + --products in both twins + twin-leak fixes + council-only install + /arc dashboard | 1.5 weeks | ✅ done | 2026-07-17 |
| 01 | Composable hooks: event.d dispatcher + fragments, graceful partial-install degradation, <30s | 0.5 weeks | ✅ done | 2026-07-17 |
| 02 | Registry-aware core: arc-registry.json in targets, ledger kinds from registry, /arc registry-backed, CI tree-diff invariant | 1 week | ✅ done | 2026-07-17 |
| 03 | Physical re-homing, incremental council→core→plan→review→qa behind the byte-diff gate (ADR-0018) | 1.5 weeks | ⬜ not started | |
| 04 | Dogfood: council-alone + core+plan into two real external repos, evidence bundles | 0.5 weeks | ⬜ not started | |
| 05 | Prune-report + attic, README/usermanual rewrite, TRIAL promotions, retro | 0.5 weeks | ⬜ not started | |

Extraction to separate repos/plugins/SaaS is **not a phase** — demand-triggered next cycle (ADR-0016).

## Done log

- **2026-07-17 · Phase 02 · Registry-aware core.** Targets now carry `.claude/arc-registry.json`
  ground truth and consumers read it instead of guessing from file presence. The single Node resolver
  gained a `--registry` mode (v1 schema **locked**: `schema` · `source.commit` · per-product
  `version`+`files`, nothing else) with version-format + hex-commit adversarial guards; **both** twins
  write the registry in bare **and** `--products` paths (ps1 UTF8-**no-BOM** via `WriteAllText`, verified
  live on Windows; sh capture-then-write, no truncate-on-failure). `/arc --status` reads the registry
  for INSTALLED (zero file-presence guessing, REQ-05) with a live HEALTH check + absent-product install
  hints; a malformed registry degrades, never crashes. `review-ledger.sh` derives `VALID_KINDS` from the
  registry (review→scan/code/security/docs · qa→qa/design), hardcoded fallback preserved for old installs;
  registry-aware install hint on an unavailable kind. A **tree-diff invariant** (bats, 3-OS matrix) proves
  installing all products reproduces the mold's `.claude/` payload exactly — manifests can't silently drift.
  Golden gate **excludes** `arc-registry.json` (volatile `source.commit`) so REQ-02 stays byte-identical;
  golden fixture regenerated twice, each a proven diff of only the intentionally-changed synced scripts.
  **236/236 bats green** (0 skip). **Code review fix-first → ship** (no Criticals; independent adversarial
  pass confirmed every reader degrades safely on malformed/empty/array/`__proto__`/null/non-hex input, no
  prototype pollution; 2 Low + 2 Nits all fixed, glob-key hole pinned as a red fixture). **Bonus find:** the
  new tree-diff invariant caught a pre-existing **REQ-04-class leak on its first use** — bare sync copied
  `.claude/worktrees/` (transient agent git-worktrees) into consumer targets; fixed in both twins (excluded
  like `state/`) + pinned by a leak regression test. Evidence bundle committed + verified
  (`docs/evidence/phase-02/`). Review archived (`docs/reviews/2026-07-17-2044-arc-phase-02-registry.md`).
  **Actual: ~1 session vs 1-week appetite — under.** · amendments: 1 (phase-start /arc-change refinement)
  · reopened: n.
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

# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**Phase 04 CLOSED ✅ (2026-07-19).** arc left its own repo for the first time. Opportunity-Scout
took council-alone on a clean slate; venturemind took core+plan over a pre-Phase-02 install — the
upgrade path is where all three defects lived, and a fresh install would have shown none of them.
REQ-09 and REQ-10 validated. 268/268 on 3 OS + ci-tier. Evidence at `docs/evidence/phase-04/`.

**What dogfooding actually bought:** three arc defects that no fixture could have produced — sync
deleting a consumer's gate settings, re-homed products leaving stale *executable* copies while the
registry reported clean, and arc changing the plan contract without telling anyone. All three fixed
with a regression test each. Plus the trial ledger's first real fire data in its existence: five
gates fired on a real external plan, where two prior logged runs had fired nothing at all.

**Next up: Phase 05 — prune/attic + docs + retro** (`phases/phase-05-spec.md`, 0.5-week appetite).
Three strands: **REQ-11** (attic — move unowned files to `.claude/attic/DATE/`, never delete; the
report half already shipped in Phase 4), the README/usermanual rewrite, and TRIAL-gate promotions
via `/arc-retro`.

**Plan reconciled 2026-07-19 (ADR-0022), before Phase 05 opened.** `/arc-resume` caught PLAN.md
saying Phase 4 was *"blocked until targets named"* while REQ-09 read `validated` — the ledger
trigger fired correctly at Phase 4 start, but the re-pick was never routed back into the plan, so
**Opportunity-Scout appeared in no plan artifact at all**, only in the evidence bundle. Now named
across REQ-09, the ledger row (RESOLVED), the external-deps table, the phase table, the Phase 04
spec and ADR-0020. ADR-0020's timing argument was confirmed by events, not weakened — only its
repo name was wrong. The kickoff done-log below is deliberately unedited: it is history.

**Phase 05 inherits a live decision.** Council session 001 (run in Opportunity-Scout, committed
there) ruled CONDITIONAL on promoting the 8 WARN-only gates: promote `appetite-sum`'s over-commit
branch only, and only after a governed escape hatch exists — today `fail()` is an unconditional
`process.exit(1)` with no recorded-reason bypass anywhere in `.claude/scripts/plan/`. Phase 5 owns
that call, and now has real fire data to make it on.

Appetite burn: **~6 of ~30 days (~20%)** — five phases closed, every one under appetite. Kill
tripwire (50%) not approached; no scope-cut conversation triggered.

Setup needed from user: none for Phase 05 — all local.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: manifests + resolver + product-lint + hostile fixtures + --products in both twins + twin-leak fixes + council-only install + /arc dashboard | 1.5 weeks | ✅ done | 2026-07-17 |
| 01 | Composable hooks: event.d dispatcher + fragments, graceful partial-install degradation, <30s | 0.5 weeks | ✅ done | 2026-07-17 |
| 02 | Registry-aware core: arc-registry.json in targets, ledger kinds from registry, /arc registry-backed, CI tree-diff invariant | 1 week | ✅ done | 2026-07-17 |
| 03 | Physical re-homing, incremental council→core→plan→review→qa behind the byte-diff gate (ADR-0018) | 1.5 weeks | ✅ done | 2026-07-19 |
| 04 | Dogfood: council-alone + core+plan into two real external repos, evidence bundles | 0.5 weeks | ✅ done | 2026-07-19 |
| 05 | Prune-report + attic, README/usermanual rewrite, TRIAL promotions, retro | 0.5 weeks | ⬜ not started | |

Extraction to separate repos/plugins/SaaS is **not a phase** — demand-triggered next cycle (ADR-0016).

## Done log

- **2026-07-19 · Phase 04 · Dogfood into two real external consumers.** arc left its own repo.
  Opportunity-Scout took council-alone on a clean slate; venturemind took core+plan on top of a
  **pre-Phase-02 install** — two paths on purpose, because a fresh install exercises none of the
  upgrade code. **268/268 bats on 3 OS + ci-tier.**
  **Actual: ~1 day vs a 0.5-week appetite — under.** · amendments: 2 · reopened: n.

  The phase opened by firing its own assumption: **InvoiceFly does not exist** — never created,
  absent from disk and from the account. The trigger said "Phase 4 blocked until targets named",
  so nothing proceeded until Ashiq re-picked. That is the ledger working rather than decorating.

  **Three arc defects, all found on a real consumer, none findable by a fixture:**
  (1) sync silently deleted a consumer's `settings.json` customisations — venturemind's
  `coverageMode`/`docsGate` were wiped and their gates flipped warn → block, for keys arc's own
  shipped doc string invites them to add. (2) Re-homed products leave stale **executable** copies
  while the registry reports the tree clean — measured, not theorised: 6 orphans, and the stale
  `review-ledger.sh` still runs. (3) arc changed the plan contract on 2026-07-11 and told nobody;
  a plan written 2026-07-07 failed 7 checks with no indication of the remedy. Fixed as
  `arc-settings-merge.mjs`, `--prune-report` (REQ-10, pulled forward by ADR-0020), and actionable
  lint messages — 19 tests between them.

  **The trial ledger got its first real fire data in its life.** It held two runs, both zero-fire,
  both this author's own kickoffs — so "3 clean runs" had been measuring silence. Against a real
  external plan, five trial gates fired, and `appetite-sum`'s over-commit branch is a verified
  TRUE positive (phase appetites sum past the stated total, checked by hand). One run is not three
  and one repo is not several; it promotes nothing. It is the first evidence in that file that
  measures a gate rather than its absence.

  Amendments: the `/arc-kickoff` criterion became "one real plan-product command", with the reason
  recorded — venturemind carries a live 5-phase product plan, and archiving it to satisfy a word
  would have been the criterion driving the work. `/arc-change` ran instead and took their lint
  from 7 FAILs to 0. Second amendment: ADR-0020's REQ-10 split, landed here rather than Phase 5.


- **2026-07-19 · Phase 03 · Physical re-homing.** Every script left the flat `.claude/scripts/`
  for a product directory — `core/` · `council/` · `plan/` · `review/` — 36 scripts across four
  checkpoints, each one `git mv` + same-commit path updates + a byte-diff gate transcript + a
  checkpoint-private evidence bundle. 42 moves gated, all content+mode preserved; ckpt 2 and 4
  finally exercised the mode half (12 of the moved files are `100755`). `common.sh` left `arc-scan/`
  because the review product may not own a library the whole repo sources, and every sourcer
  repo-wide was patched at four different relative depths. `statusline.sh` moved too, with
  `settings.json` repointed and its render verified byte-identical.
  **248/248 bats on 3 OS + ci-tier green.**
  **Actual: ~2 days vs a 1.5-week appetite — well under.** · amendments: 4 · reopened: **y** (ckpt 0).

  The honest part: the byte-diff gate was **not** what protected this phase. Every real break it
  shipped past was byte-perfect — three scripts that resolved the repo root by counting `..` and
  died one level deeper, `sync-to-project.sh`'s resolver pointing at a moved file so a bare sync
  failed outright, a path sweep that rewrote two self-contained fixtures **and the golden manifest
  itself**, and a `sed` that mangled `\c`/`\a` in the ps1 twin. Smoke-running each moved script is
  what caught them, which is why that is now in the per-checkpoint contract and why the PLAN
  assumption "the byte-diff gate is sufficient protection" is marked FALSIFIED rather than left to
  rot. The gate itself was reopened twice: four adversarial holes before ckpt 1 (non-negotiable
  #49's mandated pass, which had never actually been run), and a fifth found by code review at
  phase close — a file moved *and* rewritten past git's similarity threshold stages as D+A, never
  R, so it slipped the completeness sweep entirely. All five pinned as red fixtures.
  Amendments: ADR-0020 (consumer stale copies → REQ-10 split, report half pulled to Phase 4),
  ADR-0018 batching (plan+qa+git merged into one checkpoint after the trigger was evaluated, not
  assumed), ADR-0021 (REQ-07 amended — tests stay centralised, because a full sync ships zero
  `.bats` files so the clause drew a boundary around something that never leaves the repo), and
  the test-policy change making CI the authority for the full suite after measuring the local
  Windows suite at 8.9× the ubuntu leg for the same tests.

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

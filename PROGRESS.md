# PROGRESS.md — arc Orchestrator (Product Monorepo)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (v2 world-best) parked at ~13% burnt: `docs/archive/PROGRESS-2026-07-17.md` (ADR-0017).

## Now

**INITIATIVE CLOSED ✅ (2026-07-22).** All six phases done, every one under appetite. arc is now
six products — `core` `plan` `review` `qa` `git` `council` — with selective install
(`--products`), a per-target `arc-registry.json`, physical per-product script boundaries, and
two real external consumers. 271/271 bats local at close; evidence per phase in
`docs/evidence/phase-NN/`.

**Nothing is in progress. The next move is a decision, not a task.**

**ADR-0017's revisit trigger FIRED at this close** — *"the orchestrator initiative closes … the
v2 tracker un-parks and Phase 04 (QA pipeline) resumes as next up."* Routed and recorded, not
acted on: the owner chose to hold the resume decision rather than un-park in the closing
minutes. The reason is in ADR-0017 itself — on resume, v2's Phase 8 must be **re-scoped against
what the orchestrator shipped**, because selective install already delivers part of what v2's
REQ-08 was going to build. That is real work, not a close-time formality. v2 stays archived at
`docs/archive/PROGRESS-2026-07-17.md`, its appetite clock still **stopped at ~13%**.

**So the open question, whenever you want it:** resume v2 (re-scope Phase 8 first, then Phase 04
QA pipeline), or start something else. Neither is scheduled here.

**Two things this initiative decided that outlive it.** REQ-11 (attic) was built and cut on the
same day — the adversarial pass proved *"not in the registry"* also describes every file the
consumer wrote, so the mode quarantined their own work (ADR-0023; implementation preserved at
`e2b3646`, revisit triggers recorded and all currently false). And the eight substance gates in
`kickoff-lint.mjs` stay **WARN**, each with a reason in `docs/trial-ledger.md`: none clears the
three-exercised-run bar, and council session 001 made any promotion conditional on a governed
escape hatch that does not exist — `report()` is still an unconditional `process.exit(1)`.
Building that hatch needs `/arc-change` and its own ADR.

Appetite burn: **~6.5 of ~30 days (~22%)** — six phases closed, every one under appetite. Kill
tripwire (50%) never approached; no scope-cut conversation was ever forced by burn. (The one
scope cut, REQ-11, was a safety call, not a time call.)

**Setup needed from user: none.** The close's one outstanding condition — CI — is met. PR #43
merged as `0aaa3f2`; CI green on **ubuntu + windows + macos + ci-tier** against head `ced2693`,
the same tree the local 271/271 ran on. The macOS leg mattered: it exercises BSD userland, and
the local run was Windows-only.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: manifests + resolver + product-lint + hostile fixtures + --products in both twins + twin-leak fixes + council-only install + /arc dashboard | 1.5 weeks | ✅ done | 2026-07-17 |
| 01 | Composable hooks: event.d dispatcher + fragments, graceful partial-install degradation, <30s | 0.5 weeks | ✅ done | 2026-07-17 |
| 02 | Registry-aware core: arc-registry.json in targets, ledger kinds from registry, /arc registry-backed, CI tree-diff invariant | 1 week | ✅ done | 2026-07-17 |
| 03 | Physical re-homing, incremental council→core→plan→review→qa behind the byte-diff gate (ADR-0018) | 1.5 weeks | ✅ done | 2026-07-19 |
| 04 | Dogfood: council-alone + core+plan into two real external repos, evidence bundles | 0.5 weeks | ✅ done | 2026-07-19 |
| 05 | README/usermanual/blueprint/how-it-works rewrite for the product model, TRIAL-gate decision (all 8 kept WARN with recorded reasons), retro (attic scope-cut — ADR-0023; prune-report shipped in Phase 04) | 0.5 weeks | ✅ done | 2026-07-22 |

Extraction to separate repos/plugins/SaaS is **not a phase** — demand-triggered next cycle (ADR-0016).

## Done log

- **2026-07-22 · Phase 05 · Docs, the gate decision, and the retro — initiative close.** The
  phase that shipped no code. Its three deliverables were a documentation set that matches the
  machine, a recorded decision on eight lint gates, and a retro.
  **271/271 bats — local (Windows/Git Bash) and CI green on ubuntu + windows + macos + ci-tier**
  (PR #43, head `ced2693`, merged `0aaa3f2`). Evidence at `docs/evidence/phase-05/`.
  **Actual: ~1 session vs a 0.5-week appetite — under.** · amendments: 2 · reopened: n.

  **The docs had been describing a product that no longer existed.** arc became six products on
  2026-07-17 and re-homed its scripts on 07-18; README, usermanual, blueprint and how-it-works
  went on describing a single copy-the-folder template for five more days. Corrected against
  the machine, not from memory: commands 20 → 22, agents 7 → 23, hooks 6 → 7, scripts flat →
  per-product, blueprint's command table 10 → 22 rows. Each of the four now names the six
  products and the selective-install command, and every `/arc-*` command they mention was
  checked to exist. Proved by installing rather than asserting — `--products plan,review` into
  a scratch target pulled core in as a dependency and landed exactly 14 commands, and
  `--prune-report` listed a consumer-authored file as unowned with the "not a delete list"
  wording the phase added.

  **No gate was promoted, and that is the deliverable, not a shortfall.** REQ-12 allows either
  promotion with evidence or an explicit WARN with the ledger saying why. All eight took the
  second branch: `appetite-sum`, `nonneg-drift` and `verify-red` have one exercised run against
  a three-run bar; `pre-mortem-cite` and `adr-wired` fired but remain unadjudicated;
  `adr-confidence`, `architecture` and `current-state-structure` have never fired at all, and
  promoting those would promote silence. Independent of evidence, council session 001 made
  promotion conditional on a governed escape hatch, and `report()` in `kickoff-lint.mjs` is
  still an unconditional `process.exit(1)`. Building that hatch sits in no REQ and no exit
  criterion, so it needs `/arc-change` and its own ADR rather than this phase's last half-week.

  **The retro found the phase's own cause.** Two recurring patterns logged: meta-docs hardcode
  counts a script already reports and rot the moment code moves (this phase's entire docs
  strand); and the golden fixture has broken across 10 commits because any content edit to a
  product-shipped file moves its hash, twice arriving as a surprise rather than a planned step.
  Both regenerations this phase followed the corrected procedure — delta checked first, exactly
  the intended paths confirmed, then re-recorded and named in the commit. A third finding, a
  piped test runner masking a red suite's exit code, went to `.claude/rules/testing.md`; it
  happened once, so it is a rule, not a retro-log line.

  `appetite-sum` also earned a ledger row against itself: its zero-slack branch fired on arc's
  own PLAN (27.5d = 92% of 30d), and the initiative closed at ~22% burn. The arithmetic was
  right and the risk inverted. Recorded against that branch only — the over-commit branch
  council named is untouched.

  Amendments: REQ-11 dropped (ADR-0023) and REQ-12 added in its place, both on 2026-07-19,
  before the phase's working session.

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

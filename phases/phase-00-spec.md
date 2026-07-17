# Phase 00 — Steel thread: manifests → resolver → twins → council-only install

**Goal (one line):** the full selective-install spine works end-to-end with zero file moves — 6 manifests, one hardened resolver, both twins consuming its plan, hostile fixtures pinned, and a council-only install proven in a scratch repo.
**Appetite:** 1.5 weeks — blown appetite = cut scope or kill, never extend silently. Designated cut inside this phase: the minimal `/arc` (ADR-0019).
**Depends on:** none

## Exit criteria (Definition of Done)

- [ ] `products/{core,plan,review,qa,council,git}/manifest.json` exist per the "Manifest schema (v1)" section below, following the "Product assignment" table below; every file the twins sync maps to exactly one product (REQ-03)
- [ ] `arc-products.mjs` emits the COPY/MKDIR/ENVBLOCK plan; `product-lint.mjs` passes on the real manifests (WARN-tier TRIAL set registered in docs/trial-ledger.md)
- [ ] Hostile red fixtures pinned and ALL exit 2: path traversal (`../../settings.json`), duplicate product names, file double-mapped across products, CRLF/BOM manifest bytes, case-colliding paths declared as sibling string entries inside manifest JSON test data (never as two real git-tracked files — colliding-case filenames fail `git checkout` on Windows/default-macOS before the test can run), a control char (TAB/newline) in a path — the real protocol break; spaces are deliberately legal under the TAB delimiter (ADR-0015), proven by a separate good-path fixture — empty required fields
- [ ] `--list` and `--products <x,y>` work in BOTH twins via the resolver plan; unknown product name → exit 2 with the valid list printed
- [ ] Twin bugs fixed: .ps1 no longer copies `.claude/state/`; neither twin copies `scheduled_tasks.lock` (REQ-04)
- [ ] Golden-output case green: bare `sync-to-project.sh <target>` tree byte-identical to pre-initiative (REQ-02)
- [ ] Council-only install works: scratch repo gets ONLY core+council files; inside the target, council-lint exits 0 on a named pass-fixture AND non-zero on a named fail-fixture — discrimination, not just non-crash (REQ-01)
- [ ] STRETCH (first cut under appetite pressure, ADR-0019 — the checkbox is droppable without failing the phase): minimal `/arc` (`.claude/commands/arc.md` + `.claude/scripts/arc-status.sh`, file-presence detection) renders the 6-product table
- [ ] tests added & green; live demo run + output checked; tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/products.bats --print-output-on-failure` then `bats tests/sync.bats --print-output-on-failure` (one file at a time, foreground — Windows rule)
- **Expected failure first:** `tests/products.bats` is written before `arc-products.mjs` exists — first run fails with `arc-products.mjs: No such file or directory` on every resolver case; the new `--products council` case in `tests/sync.bats` fails with `unknown option: --products` from the untouched twin. Red → green, no after-the-fact tests.
- **New file locations:** resolver `.claude/scripts/arc-products.mjs` · lint `.claude/scripts/product-lint.mjs` · dashboard `.claude/scripts/arc-status.sh` (alongside kickoff-lint.mjs, house convention) · manifests `products/NAME/manifest.json`.
- **Golden fixture:** `tests/fixtures/sync-golden/tree-manifest.txt` — sorted `path + SHA-256` listing (LF-normalized content hashes) of a bare `sync-to-project.sh` run into a temp dir, captured ONCE at the pre-initiative commit (cd91baf) and committed. The golden bats case re-runs bare sync into a fresh temp dir, recomputes the listing, diffs against the fixture — run on BOTH the rsync path and the cp-r fallback. Regeneration only via a reviewed diff naming the intentional change (non-negotiable).
- **Hostile corpus:** `tests/fixtures/products/hostile/CASE-NAME/` — one dir per case (traversal, dup-name, double-map, crlf-bom, case-collide-json, control-char-path, empty-field), each holding the malicious manifest set; `tests/products.bats` iterates the corpus and asserts `product-lint.mjs` exit 2 + a case-specific message token per dir. Good-path fixtures live in `tests/fixtures/products/good/` and `good-space/` (space-in-path is legal).
- **Named council fixtures (REQ-01):** pass = `docs/council/kickoff-v2/fixtures/phase-00/good-full.md`, fail = `docs/council/kickoff-v2/fixtures/phase-00/bad-nodecision.md` — both ALREADY EXIST in the repo (council v2 corpus, no new authoring); the demo copies them into the scratch target before running `council-lint.mjs --verdict` on each (they are test data, not product payload).
- **Live demo scenario:** (1) `bash sync-to-project.sh /tmp/arc-scratch --products council` → tree shows ONLY core+council files (no arc-scan/, no kickoff-lint, no qa agents); (2) inside `/tmp/arc-scratch` run council-lint on the named pass-fixture → exit 0, then on the named fail-fixture → exit non-zero; (3) bare `bash sync-to-project.sh /tmp/arc-full` → diff against pre-initiative golden tree = empty, on BOTH the rsync path and the cp-r fallback path; (4) `bash .claude/scripts/arc-status.sh` → 6-product table; (5) each hostile fixture through `product-lint.mjs` → exit 2 each.
- **Real-system check:** n/a — scratch repos only this phase (real external repos are Phase 4).
- **Expected evidence:** bats `1..N` green output for both files, empty golden diff output, scratch-repo tree listing, six exit-2 lint transcripts, ps1 smoke-test transcript showing no `state/` in the target.

## Manifest schema (v1)

`products/NAME/manifest.json` — zero-dep JSON, parsed ONLY by `arc-products.mjs` (ADR-0015). Fields:

- `name` (required, string): must match `^[a-z][a-z-]*$` AND equal the containing `products/NAME/` dir name.
- `version` (required, string): semver `MAJOR.MINOR.PATCH`.
- `requires` (optional, array of product names): dependency products; `core` is implicit for every product.
- `commands`, `agents`, `scripts` (arrays of repo-root-relative explicit paths — no globs, no `..`, no absolute paths, no drive letters): the synced payload.
- `files` (same path rules): the catch-all for non-command/non-agent `.claude` payload — rules, output-styles, templates, skills, settings.json, and (in Phase 0, before the `hooks` field is used) the hook scripts. At least one of commands/agents/scripts/files must be non-empty.
- `docs` (optional, array of `{src, dest}` objects, both repo-root-relative): doc payload copied src→dest in target.
- `skeletonDirs` (optional, array): dirs created empty in the target (e.g. council sessions dir).
- `envBlock` (optional, string path + `envSentinel` regex string): file appended to the target's `.env.example` iff the sentinel regex matches nothing there.
- `hooks` (optional, array): hook fragment files — EMPTY in Phase 0 (fragments are Phase 1).

Validation (product-lint): unknown fields = error; every listed path must exist in the repo; every file the twins sync must appear in exactly ONE product's payload (coverage + double-map checks); path entries differing only by case = error (case-collide); any control char, TAB, or leading/trailing space in a path = error.

## Resolver line protocol (v1)

`arc-products.mjs --products LIST` emits the install plan on stdout, one record per line, UTF-8, LF endings. Field separator: **TAB** (this is why a TAB inside a manifest path is a lint error, and why paths with spaces transport safely — no quoting layer). Records:

- Line 1 always: `PROTO` TAB `1` — twins reject any other version, loudly.
- `MKDIR` TAB dest-relative-dir
- `COPY` TAB src-relative-path TAB dest-relative-path
- `ENVBLOCK` TAB source-file-path TAB sentinel-regex

Both twins consume this as a dumb loop (bash `while IFS=$'\t' read -r`, PowerShell `foreach` over tab-split) — no twin ever parses JSON or makes a decision beyond executing the verb. Resolver re-validates no-traversal/no-absolute on every path before emit (defense in depth with product-lint).

## Product assignment (decision record)

The manifests are the authoritative machine-readable assignment (exit criterion 1); this table records the decisions, including tiebreaks. New files this phase marked ★.

| Product | Commands | Agents | Scripts |
|---|---|---|---|
| core | arc ★, arc-toolcheck, arc-resume, arc-freeze, arc-unfreeze | log-analyzer, researcher (shared utility — used by plan AND change flows, tiebreak: core) | arc-gates.sh, arc-profile.sh, review-ledger.sh, toolchain-health.sh, freeze-check.sh, statusline.sh, arc-scan/lib/common.sh (owned by core from Phase 0, physically moves Phase 3), arc-products.mjs ★, product-lint.mjs ★, arc-status.sh ★; all 6 hooks; settings.json template; arc.gates.yaml; .claude/rules/*; .claude/output-styles/*; .claude/templates/*; .claude/skills/* |
| plan | arc-kickoff, arc-change, arc-phase-done, arc-retro, arc-diagram | question-planner, plan-attacker, plan-simulator, codebase-surveyor, product-challenger | kickoff-lint.mjs, arc-evidence.sh; docs/templates/ (PLAN/phase-spec/ADR templates), docs/build-playbook.md |
| review | arc-review, arc-audit, arc-second-opinion, arc-docs | code-reviewer, security-auditor | arc-scan/ tree (adapters, lib minus common.sh ownership, rules), arc-scan-summary.sh, version-gate.sh, docs-drift.sh, coverage-gate.sh, rls-gate.sh, arc-tools-image.sh |
| qa | arc-qa, arc-design, arc-canary | qa-tester, design-reviewer | (none) |
| council | arc-council | the 12 council-* agents | council-lint.mjs, council-juror.mjs, council-calibrate.mjs; docs/council/README.md + references/fairness.md; skeleton: docs/council/sessions/.juror |
| git | arc-commit, arc-pr, arc-fix-issue, arc-ship | (none) | (none — arc-ship calls core's gates via dependency on core) |

Every remaining synced file not named above (e.g. .mcp.json template pieces) is assigned during manifest authoring under the coverage rule: exactly one product, tiebreak = core; any file that cannot be assigned honestly = product-lint error to resolve in this phase, never silently skipped.

## Rabbit holes in this phase

- Manifest globs — v1 is explicit paths only (No-go); a missing-file entry is a lint error, not a glob invitation.
- settings.json handling — Phase 0 does NOT touch settings composition (Phase 1); the golden test simply proves today's behavior unchanged.
- rsync exclude cleverness — the selective path uses plain copy loops; a bats case forces the no-rsync Git Bash fallback AND a second bats case runs the rsync-available path (ubuntu/macOS CI default) asserting its output tree byte-identical to the same golden tree — REQ-02 must hold on both code paths, not only the fallback.

## Out of scope for this phase

Hook fragments + partial-install guards (Phase 1) · registry file in targets + registry-backed /arc (Phase 2) · any file moves (Phase 3) · external repos (Phase 4) · prune/attic (Phase 5).

## Your-setup / pending

Nothing — all local. Node ≥18 already required.

## Non-negotiables (verbatim from PLAN)

- Bare `sync-to-project TARGET` output stays byte-identical to pre-initiative — golden-output bats case green on every PR of this initiative (products are additive under the umbrella, ADR-0014); the golden fixture may only be regenerated via a reviewed diff naming the intentional change — silently re-recording it to match new output is a gate failure, not a fix.
- Every new parser (manifest reader, resolver, product-lint) AND the byte-diff/golden-output comparison gates get an adversarial construct-a-breaking-input pass; found holes fixed + pinned as red fixtures BEFORE any FAIL-mode promotion (council v2+v3: 43 holes in gates that passed their own tests).
- Physical re-homing lands only behind the byte-diff gate — defined as: per-file SHA-256 over content with line endings normalized to LF before hashing, executable bit compared separately, symlinks resolved before hashing; installed tree provably unchanged, per product move (ADR-0018).
- Consumer repos: never delete — attic move to `.claude/attic/DATE/` only, report before mutate.
- Every hook/script change ships with a bats test. CI red = no merge on the arc repo.
- Cross-platform: Git Bash (Windows) + ubuntu + macos CI; bash-3.2/POSIX; no new PowerShell logic beyond the dumb copy loop (ADR-0015).
- New lint checks start WARN in the TRIAL set; FAIL promotion only via docs/trial-ledger.md evidence.
- Engine scripts assume no Claude (ADR-0013 writing rule, inherited).
- Every `/arc-phase-done` on this initiative commits an evidence bundle.

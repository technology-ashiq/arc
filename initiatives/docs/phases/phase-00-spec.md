# Phase 00 — Steel thread: the extractor

**Goal (one line):** `node .claude/scripts/docs/wiki-build.mjs --json` turns the live tree into one deterministic `wiki.json`, reading the tree only through `face-coverage.mjs`, proven on CI.
**Appetite:** 1.5 days (kill-criteria scope-cut conversation at 2.25 d)
**Depends on:** none

## Build order (inside the phase)

**Scratch convention:** every `$SCRATCH` below is `SCRATCH="$(mktemp -d)"`, created fresh per use,
outside the repo, and removed afterwards. Nothing is ever written into the worktree as scratch.

1. **The ruling on the spine (A-08, ADR-1500).** From the canonical clone
   (`E:/Work_Hub/01_Automemory/arc`, `git pull` first — a stale checkout rejects a newly merged kind):
   `bash .claude/scripts/hq/arc-event.sh emit approval.requested --payload '{"what":"record the owner ruling of 2026-09-18: a generated wiki over every product, lane and feature, complete by construction (docs lane, ADR-1500)","gate":"decision"}'`
   → the owner stamps it with `node .claude/scripts/hq/arc-inbox.mjs approve <ULID> --reason "..."`.
   The resulting `decision.recorded` event id is written into ADR-1500's Context and this lane's
   `PROGRESS.md`. Verify by event id in `events/` AND `events/_quarantine/`.
2. **The export commit (ADR-1501) — small and on its own, made immediately AFTER the red tests-only
   commit of step 4 has been pushed and its CI run recorded** (that run is where the missing-export
   `SyntaxError` is captured). It is the first CODE change on the branch, and it is pushed as its own
   PR if the face session asks for one. In `face-coverage.mjs`: add
   `export` to `dirNames`, `mdStems`, `yamlStems`, `treeKinds`, `treeProducts`; add
   `export async function treeWorld(repo)` returning everything `gather` returns **except**
   `contract`; rewrite `gather` as `{ ...(await treeWorld(repo)), contract: loadContract(repo) }`.
   Before pushing: `git log origin/main --oneline -5 -- .claude/scripts/core/face-coverage.mjs`, and
   list its callers mechanically (`git grep -ln face-coverage -- tests .claude`) — today
   `tests/face/coverage-readers.mjs`, `tests/face/module-frame.mjs`, `.claude/scripts/hq/face-module.mjs`,
   `tests/face-coverage.bats`, `tests/face-browser.bats`, `tests/face-l3.bats`,
   `tests/fixtures/sync-golden/tree-manifest.txt`. Send the face session a paste-ready note first.
3. **The `docs` product born (ADR-1512).** `products/docs/manifest.json` (`requires: ["core"]`,
   scripts list); its `products.docs` row in `expected-set.json` + `face-sections.mjs` regen;
   `product-lint` clean.
4. **`tests/docs-extract.bats` written RED first** — executed BEFORE step 2 and step 5: committed and
   pushed while neither `treeWorld` nor `wiki-build.mjs` exists, so one CI run records both reds.
5. **`wiki-build.mjs --json [--root DIR] [--out FILE]`**: imports `treeWorld`, `treeAdrBands`,
   `treePlans`; reads only named files (a manifest, a PROGRESS header, an ADR header, a process file,
   an agent/command frontmatter); per type:
   - **products** — `treeWorld().products` names → `products/<id>/manifest.json` (`name`, `version`, `requires`, `commands`, `agents`, `scripts`)
   - **lanes** — `treeWorld().lanes` → `initiatives/<id>/PROGRESS.md` machine header (`status`, `cycle`, `phase`, `appetite`, `burn`, `blocked-on`, `depends-on`)
   - **processes** — `treeWorld().processes` → `processes/<id>.process.yaml` top-level scalar keys (`name`, `version`, `description` when present)
   - **ADR bands** — `treeAdrBands()` band names and `fileCount`; per-ADR `Status` / `Date` / `Product` / `Reversibility` read by named path for each stem the exported `mdStems(docs/adr)` returns, grouped under its band
   - **commands** — `treeWorld().commands` → `.claude/commands/<id>.md` frontmatter `description`, plus `generated: true` when the file carries the GENERATED banner
   - **agents** — `treeWorld().agents` → `.claude/agents/<id>.md` frontmatter `description`, `model`, `tools`
   - **rules** — `treeWorld().rules` (stems of `.claude/rules/*.md`) → `.claude/rules/<id>.md` first `# ` heading line as `title`
   - **gates** — `treeWorld().gates` (from `treeGates`, which reads `arc.gates.yaml`) → the matching row of `arc.gates.yaml` read once by named path, every scalar field of that row
   Emits `wiki.json` with `{ schema: 1, entities: { products, lanes,
   processes, adrBands, commands, agents, rules, gates } }`, each entity `{ id, type, source, facts }`,
   every list byte-order sorted, no timestamps, no absolute paths, LF. Unparsed fields are recorded as
   `unparsed: [<field>]` on the entity, and a per-type unparsed count is in the top-level `stats`
   (A-02, A-03). Unknown flag → exit 2 naming it; `--flag` given with no value or a value starting
   `--` → exit 2; realpath main guard.
6. **Unmapped-key guard:** `wiki-build` holds two literal lists — `RENDERED` (the eight types above) and
   `NOT_RENDERED` (every other key `treeWorld` returns today: `kinds`, `jobs`, `ventures`, `plans`,
   `capabilities`, `plannedRooms`, `ci`, `hooks`, `lints`, `modules`, `ops`), each `NOT_RENDERED` entry
   with a one-line reason in a comment. It exits 1 naming any `treeWorld` key in NEITHER list, and exits 2 naming any reader that returns `unreadable` — both with mutants in `tests/docs-extract.bats` (pre-mortem 5, REQ-09).
7. **`/arc-attack`** — two fresh attackers (logic · filesystem/OS boundary) carrying
   `initiatives/docs/fixed-defects.md`, on the local commit before push; fixes pinned as fixtures; holes appended to that file.
8. **Regenerate `tests/fixtures/sync-golden/tree-manifest.txt` LAST**, unconditionally — the default full sync copies `.claude/` wholesale, so every new file under `.claude/scripts/docs/` is in the synced set:
   `bash sync-to-project.sh "$SCRATCH" >/dev/null && source tests/test_helper.bash && _arc_tree_manifest "$SCRATCH" > tests/fixtures/sync-golden/tree-manifest.txt`,
   then `git diff -U0 tests/fixtures/sync-golden/tree-manifest.txt | grep "^+[^+]" | cut -f1` must list only the new docs files.
9. **Shard weight:** after CI is green, dispatch `gh workflow run weigh-tests.yml --ref BRANCH`, read the `docs-extract` line from its "what changed against tests/shard-timings.json" step, and write that measured seconds value into `tests/shard-timings.json` → `timings`. Never the default.

## Exit criteria (Definition of Done)
- [ ] `decision.recorded` for the 2026-09-18 ruling exists on the canonical spine, event id recorded in ADR-1500 and PROGRESS (A-08)
- [ ] `face-coverage.mjs` exports `treeWorld` + the five helpers; `tests/face-coverage.bats` and `face-coverage --selftest` green on CI **unmodified** (A-07)
- [ ] `products/docs/manifest.json` exists, `product-lint` clean, face contract rows present, `face-coverage` passes
- [ ] `wiki-build --json` emits `wiki.json` over all eight entity types from the live tree
- [ ] REQ-09 green on CI: import scan clean, `readdirSync` mutant RED, per-type count parity with `treeWorld`
- [ ] determinism: two runs byte-identical, asserted in the suite
- [ ] two-surface attack run, holes fixed and pinned, `fixed-defects.md` appended
- [ ] `tests/fixtures/sync-golden/tree-manifest.txt` regenerated after the last file change; its diff shows only the new docs files
- [ ] `tests/docs-extract.bats` has a measured shard weight
- [ ] CI green per-JOB at the head SHA (`ci-digest.mjs`)
- [ ] closed via `/arc-phase-done 00 --lane docs` from the canonical clone after the merge, board row in the same commit
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/docs-extract.bats` — on CI only (three OS legs), read per-JOB with `node .claude/scripts/review/ci-digest.mjs`
- **Expected failure first:** committed before `wiki-build.mjs` exists, the suite's first test fails with `wiki-build.mjs: No such file or directory` (node exit 1, `MODULE_NOT_FOUND`), and the count-parity test fails because `treeWorld` is not exported (`SyntaxError: The requested module ... does not provide an export named 'treeWorld'`). Both reds are recorded from the CI run on the tests-only commit.
- **Live demo scenario:** from the worktree, `node .claude/scripts/docs/wiki-build.mjs --json --out "$SCRATCH/wiki.json"` → exit 0; `node -e` prints the eight per-type counts, and they equal the counts line printed by `node .claude/scripts/core/face-coverage.mjs` (no flags; its
   last stdout line, `face-coverage: N kinds, N lanes, N commands, … -- all covered`) for the same tree (17 lanes, 28 commands, 30 agents, 17 products, 7 rules, 8 processes, 7 gates, 15 ADR bands — the figures `face-coverage` printed on the kickoff tree, re-read on the day, never copied). Run twice; `cmp` the two outputs → identical.
- **Real-system check:** the canonical clone's spine — `decision.recorded` found by event id, not quarantined.
- **Expected evidence:** `initiatives/docs/evidence/phase-00/` — CI run ids (red tests-only commit, green close), the demo transcript with both counts lines, the spine event id, the attack report path.

## Rabbit holes in this phase
- **Modelling every ADR field.** Only Status · Date · Product · Reversibility; the rest is `unparsed`.
- **Rewriting `gather` beyond the split.** The face lane owns its behaviour; the change is a spread, nothing else.
- **Designing page layout now.** `wiki.json` carries facts, not presentation (P02).

## Out of scope for this phase
Any page rendering (P02) · the coverage gate (P01) · narrative (P03).

## Your-setup / pending
- The owner's `arc-inbox approve` keystroke on the canonical clone for the ruling (A-08).
- A heads-up to the face session before the export PR merges (paste-ready note, written by this session).

## Non-negotiables (verbatim from PLAN)

- DOC-A / DOC-B: nothing under `.claude/scripts/docs/` enumerates a directory; every entity set comes from `face-coverage.mjs`'s `treeWorld` (ADR-1501), no hand-maintained list of what exists is kept anywhere (ADR-1502), and `tests/docs-extract.bats` proves it with a scan and a mutant.
- DOC-C: `wiki-coverage.mjs` is FAIL-FROM-BIRTH, checks BOTH directions (entity with no page, page with no entity), and ships `--mutant-selftest` whose run count is asserted before its verdicts (ADR-1503).
- Phase order is fixed: extractor → coverage gate → renderer → drift/stale + narratives. The gate is built and proven before any renderer exists.
- DOC-D: every generated file carries the do-not-edit banner, and CI regenerates and fails on a dirty diff (ADR-1504).
- DOC-E / DOC-H: narrative lives only in `docs/wiki/_narrative/`, is hand-written or absent, and no model-authored prose ships (ADR-1505, ADR-1508).
- DOC-I: pages show build-time tree facts only — no spine, no `.claude/state/`, no network, nothing from outside git-tracked files; the repo is public, so the PII grep runs on `docs/wiki/**` before every push (ADR-1509).
- DOC-J: Phase 02 does not close until the four overlapping documents are archived or stubbed and the strategy file map says so in the same commit (ADR-1510).
- DOC-K: every gate and the extractor get two fresh attackers on different surfaces carrying `initiatives/docs/fixed-defects.md`, run on the local commit of the PR that ships that gate, before its push — not deferred to a phase-close checkbox; at most two rounds per PR (ADR-1511).
- Tests run on CI only, never on this box; "green" means CI per-JOB with the head SHA confirmed (`ci-digest.mjs`). Every test asserts it RAN before asserting what it printed.
- Cross-lane blast radius: once `wiki-coverage` and the dirty-diff check run on CI, any lane's PR that adds a product, lane, command, agent, rule, gate or ADR band turns red until the wiki is regenerated. Every such failure prints the one fix command (`node .claude/scripts/docs/wiki-build.mjs`) on its first line, the command is listed in `CLAUDE.md` § Commands, and each live lane's session gets a paste-ready note in the PR that turns the check on. No WARN grace period (ADR-1503).
- Each new suite (`tests/docs-extract.bats`, `docs-coverage`, `docs-render`, `docs-drift`) gets a measured CI weight in the shard table, taken on a tree where it passes, before the phase that adds it closes — never the default.
- Zero-dep Node and POSIX (A2); central `tests/` (ADR-0021); never delete — superseded docs move to `docs/archive/` (A10).
- Constitution articles this plan upholds, for kickoff-lint: E3, A2, A8, A10.

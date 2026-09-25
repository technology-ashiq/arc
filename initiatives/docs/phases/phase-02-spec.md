# Phase 02 — The renderer, and the four documents resolved

**Goal (one line):** `wiki-build` renders `docs/wiki/**` — one page per entity plus a generated index — that `wiki-coverage` passes on the real tree, that CI proves unedited, and that replaces the four overlapping documents.
**Appetite:** 1 day
**Depends on:** phase-01

## Scope
- Page per entity from `wiki.json`, generated banner (ADR-1504), `narrative pending` banner when no narrative file exists (ADR-1506), narrative included verbatim when one does (ADR-1505); index page with per-type counts and the narrative-debt figure, all derived.
- `tests/docs-render.bats`: regenerate into scratch and diff (REQ-06), one-byte-edit mutant RED; REQ-04 fixture product; REQ-01 `wiki-coverage` exit 0 on the real tree.
- `.gitattributes`: `docs/wiki/** text eol=lf`.
- **REQ-08 / DOC-J (ADR-1510):** `docs/how-it-works.md`, `docs/how-arc-works-simple.md`, `docs/usermanual.md`, `docs/blueprint.md` each copied whole to `docs/archive/` and reduced at its original path to a ≤ 10-line stub naming its `docs/wiki/` replacement and its archive copy; zero inbound links edited (68 referring files, `git grep -n` list in evidence); `docs/strategy/README.md` file map updated **in the same commit**.
- Two-surface attack on the renderer and the dirty-diff check.

## Exit criteria (Definition of Done)
- [ ] REQ-01, REQ-04, REQ-06, REQ-08 green / done with evidence
- [ ] PII grep over `docs/wiki/**` clean before the first push of generated pages (the repo is public)
- [ ] the phase does NOT close while any of the four documents is un-archived and un-stubbed
- [ ] two-surface attack run; CI green per-JOB at head SHA; tracker updated

## Verification plan

Refined at phase start (2026-09-25), as this spec's coarse line required.

- **Test command:** `bats tests/docs-render.bats` — CI only, read per-JOB with `ci-digest.mjs`.
- **Expected failure first:** committed before the renderer exists: `wiki-build.mjs --check` is an unknown flag (exit 2), `docs/wiki/` does not exist, and `wiki-coverage` on the real tree exits 1 naming all 129 entities — every test red on the tests-only commit, run id recorded.
- **What the suite proves:** REQ-06 twice over — `--check` on the committed tree, AND an independent render into scratch diffed with `diff -r` — plus one-byte-edit, deleted-page and stale-page mutants each turning `--check` red by name; REQ-01 as `wiki-coverage` exit 0 on the real tree with counts equal to `wiki.json`'s; REQ-04 as a manifest-only fixture product rendered with its facts and the `narrative pending` banner; the do-not-edit banner on line 1 of every generated file; a narrative included verbatim (and never rewritten); every relative link in every generated page resolving to a real file; determinism (two renders byte-identical, no CR, no checkout path); REQ-08 as four ≤ 10-line stubs, four archive copies, and the file map naming the move.
- **Live demo scenario:** `node .claude/scripts/docs/wiki-build.mjs` → pages written; `node .claude/scripts/docs/wiki-coverage.mjs` → `129 entities, 129 pages … -- all covered`; open `docs/wiki/index.md` and follow one product, one lane and one ADR band by link.
- **Real-system check:** the rendered `docs/wiki/` on the merged `main`, verified by a `workflow_dispatch` run.
- **Expected evidence:** `initiatives/docs/evidence/phase-02/` — the red run, the green run, the demo transcript, the link-check count, the inbound-reference list for the four documents.

## Rabbit holes in this phase
Styling · rewriting the four documents' prose into narrative (archive, don't port).

## Out of scope for this phase
Drift, stale, audit-counts, narratives (P03).

## Your-setup / pending
None.

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

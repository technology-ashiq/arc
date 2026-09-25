# Phase 01 — The coverage gate, before any renderer

**Goal (one line):** `wiki-coverage.mjs` fails, naming it, on any entity with no page and any page or narrative with no entity — and `--mutant-selftest` proves it fails closed.
**Appetite:** 1.5 days — ends on the **day-3 kill checkpoint**
**Depends on:** phase-00

## Design

- Input: `wiki.json` (from `wiki-build --json`, or `--wiki FILE`) and a page root (`--pages DIR`,
  default `docs/wiki/`). Forward direction: each entity's page is read by **named path**
  (`<pages>/<type>/<id>.md`). Reverse direction needs TWO sets — the page files under each
  `<pages>/<type>/` and the narrative files under each `docs/wiki/_narrative/<type>/` (M3) — both
  read with the `mdStems` export Phase 00 already lands. **No new `face-coverage.mjs` export in this
  phase** (No-gos; A-06).
- Exit `0` covered · `1` finding(s), each printed `FAIL [entity-no-page|page-no-entity|narrative-no-entity] <id or path>` · `2` usage / unreadable input. Unreadable is never 0.
- `--mutant-selftest`: builds scratch copies (fixture tree + fixture pages), runs the real gate as a
  child process against each, and requires: **M1** unknown product + unknown lane → exit 1 naming
  BOTH · **M2** product removed, page kept → exit 1 naming the orphan page · **M3** orphan narrative
  → exit 1 naming it · **M4** `treeWorld` wiring cut (entities empty) → exit 1, never "covered" ·
  **M0** the clean fixture → exit 0. Prints `mutant-selftest: ran 5 of 5` and labels expected
  failures as `EXPECTED-FAIL`. Cleans up on every path, including a thrown error.
- Page fixtures under `tests/fixtures/docs/pages/` are hand-made minimal files — the renderer does
  not exist yet, which is the point.

## Exit criteria (Definition of Done)
- [ ] REQ-02 and REQ-03 green on CI via `tests/docs-coverage.bats`
- [ ] the suite asserts `ran 5 of 5` BEFORE asserting any verdict (vacuous-pass rule)
- [ ] each mutant's failure names exactly what was planted (asserted by id, not by exit code alone)
- [ ] a mutant of the gate itself (reverse direction deleted from a scratch copy) turns the suite RED — the test is attacked, not only the rule
- [ ] two-surface attack run, holes fixed and pinned, `fixed-defects.md` appended
- [ ] **day-3 kill checkpoint answered in PROGRESS.md**: does `--mutant-selftest` fail closed? yes → proceed; no → STOP, record the finding, build no renderer
- [ ] `tests/docs-coverage.bats` has a measured shard weight; sync-golden regenerated last
- [ ] CI green per-JOB at the head SHA; closed via `/arc-phase-done 01 --lane docs` from the canonical clone

## Verification plan

- **Test command:** `bats tests/docs-coverage.bats` — CI only, read per-JOB with `ci-digest.mjs`
- **Expected failure first:** committed before `wiki-coverage.mjs` exists, every test fails with `Cannot find module '.../wiki-coverage.mjs'`; after a stub that always exits 0 is committed, M1–M4 fail with `expected exit 1, got 0` — the stub is the negative control that proves the suite can go red on a vacuous gate. Both runs' ids recorded.
- **Live demo scenario:** `node .claude/scripts/docs/wiki-coverage.mjs --mutant-selftest` → prints five labelled cases and `ran 5 of 5`, exit 0; then delete one page from a scratch copy of the fixture pages and run the gate against it → exit 1 naming that entity.
- **Real-system check:** n/a — fixtures only this phase (real pages exist from Phase 02).
- **Expected evidence:** `initiatives/docs/evidence/phase-01/` — both red CI runs, the green run, the demo transcript, the kill-checkpoint answer.

## Rabbit holes in this phase
- **Checking page CONTENT.** Coverage is existence in both directions; content is P02/P03.
- **A WARN mode.** No trial period (ADR-1503).

## Out of scope for this phase
The renderer (P02) · drift/stale/audit-counts (P03).

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

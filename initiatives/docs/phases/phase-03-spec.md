# Phase 03 — Drift, staleness, counts, and three real narratives

**Goal (one line):** a narrative that names something gone fails CI, a narrative older than its facts warns, every printed number re-derives, and three hand-written narratives prove the template at both extremes.
**Appetite:** 1.5 days
**Depends on:** phase-02

## Scope
- `wiki-drift.mjs` BLOCK (REQ-05): references to repo paths, `ADR-NNNN`, scripts / drivers / commands / agents in `docs/wiki/_narrative/**` must resolve; mutant citing `ADR-9999` and `drivers/ghost.mjs` exits 1 naming both (ADR-1507).
- `wiki-stale.mjs` WARN: per-narrative fingerprint of the facts it describes; divergence warns, exit 0.
- `wiki-build --audit-counts` (REQ-07): every number on every page re-derived; mutant page RED.
- Narratives for `engine`, one thin product, one sleeper lane — hand-written or owner line-accepted; otherwise absent (ADR-1508).
- Two-surface attack on drift and stale; retro; cycle seal.

## Exit criteria (Definition of Done)
- [ ] REQ-05 and REQ-07 green on CI
- [ ] three narratives present and owner-accepted, or absent with the reason in the done-log — narratives never block the cycle close (ADR-1505, ADR-1508)
- [ ] two-surface attack run; CI green per-JOB at head SHA; retro written; tracker updated

## Verification plan

Refined at phase start (2026-09-25).

- **Test command:** `bats tests/docs-drift.bats` — CI only, per-JOB.
- **Expected failure first:** committed before `wiki-drift.mjs`, `wiki-stale.mjs` and `--audit-counts` exist; every test red (module not found / unknown flag). Per the owner's lean rule (one push per PR) the red state is that commit, not a separate CI run.
- **What the suite proves:** REQ-05 — a narrative citing `ADR-9999`, `drivers/ghost.mjs` and `/arc-ghost` fails `wiki-drift` naming all three, while one citing real ones passes; the gate's own `--mutant-selftest` ran every arm; `wiki-stale` WARNs (exit 0) on a narrative with no fingerprint and on one whose entity's facts moved, and is silent when they match; REQ-07 — `wiki-build --audit-counts` passes on the real tree and names the page and the number when one count on a page is changed; both gates run on the real tree every PR.
- **Live demo scenario:** `wiki-drift --mutant-selftest`; `wiki-drift` and `wiki-stale` on the real tree; `wiki-build --audit-counts`.
- **Real-system check:** the three narratives, if the owner supplies them, pass `wiki-drift` on the real tree and render on their pages.
- **Expected evidence:** `initiatives/docs/evidence/phase-03/` — the green run, the demo, the retro.

## Rabbit holes in this phase
Narrative template perfection · NLP-grade reference extraction (a fixed grammar, attacked).

## Out of scope for this phase
The other ~30 narratives · any face ring · publishing.

## Your-setup / pending
Owner time to write or line-accept three narratives.

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

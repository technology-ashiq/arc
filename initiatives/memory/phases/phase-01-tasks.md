# Build Brief — phase 01 · recall people can trust

spec-hash: sha256:6d7293e985b8df0778ee158ad6727bbb3081e722e74a3122521d79a6bf83e6c7
lane: memory
reqs: 
adrs: 0701, 0702, 0704, 0707, 0708, 0709
blast-radius: .github/**, docs/develop/learning-ledger.md, docs/memory/aliases.md, docs/retro-log.md, initiatives/, initiatives/memory/evidence/phase-01/, processes/**, processes/kickoff-plan.process.yaml, tests/**, tests/fixtures/sync-golden/tree-manifest.txt
no-gos: No `playbooks/` directory, No embeddings, no vector search, no LLM at ingest or query time, No new spine event kinds, No semantic contradiction detection, No cross-lane edits, No auto-rule-writing, No chat, MCP, or dashboard surface, No cross-repo federation, No change to what `/arc-retro` writes or where, No incremental index updates
blast-radius-dropped: 5

### Non-negotiables

- The canonical path runs on **Node >= 18 on all three OSes** with **zero npm dependencies**; the sqlite engine is lazily imported and can never break the path it only accelerates.
- The index is **derived-only** and gitignored; deleting it and rebuilding must reproduce identical ordered results.
- Every indexed row is **count-verified** (`N_parsed == N_indexed`) and every excluded row is **named with file and line** — never silently dropped.
- Output is **verbatim**; every citation carries a repo-relative path; a bare number is never printed alone.
- Memory **writes nothing** to the company organs and **emits nothing** to the spine.
- Hooks are **additive**; no existing read is replaced, and generated commands are changed only through their process file.
- Every parser-class surface gets **two fresh-agent adversarial passes on two different surfaces, inside the phase that ships it**; found holes are pinned as fixtures, and each pass carries the running list of defects already fixed in this lane, to be checked against every other file.
- Before editing any shared root organ (`processes/**`, `tests/**`, `.github/**`), run `git log origin/main --oneline -5` on that path first — the `leads` lane is LIVE on the same files, and a collision is resolved then, in one place, never at merge time.
- **Tests are green on CI, never on the dev box**, read per-JOB; all fixtures are CRLF-normalized and all paths repo-relative forward-slash.

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: CLI surface live: positional query, `--tag`, `--source`, `--since`, `--lane`, `--limit`, `--full`, `--json`, `--grep`, `--rebuild` (ADR-0702) — **plus an `--engine js|auto` stub wired to a single-engine dispatch seam**, so the public CLI surface is not first built inside Phase 2's cut-constrained 0.75d; this is the seam REQ-07 plugs `sqlite` into, and PLAN's External-dependencies row promises the interface ships regardless of the cut. **`--tags` is dropped** — no REQ or fixture in this plan exercises it
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: Exit map honoured: `0` ran (zero results **is** a result, printed as such) · `1` internal error · `2` bad usage · `3` index unavailable and rebuild failed, message naming the cause
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: All 10 hostile-query fixtures green **through a real `arc-recall.mjs` process invocation on all 3 OSes, not an in-process function call** — each fixture names whether it crosses `argv` or an internal API (a literal NUL cannot survive process creation on either platform, so an `argv` fixture claiming to test it would be testing nothing). They must neither crash **nor** change semantics
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: `docs/memory/aliases.md` live; expansion + tag-weighted ranking measurably improve the golden set **against the Phase-0 grep baseline**, shown as a before/after table
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: Every result row carries a citation with a repo-relative path; no bare number is ever printed alone
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: **Query determinism, which Phase 0 could not prove because ranking did not exist yet:** delete the index → rebuild → the 12 golden queries return **identical ordered result ids**, under the documented **id-ascending tie-break on equal bm25**, on all 3 OSes
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **`arc-recall.mjs` gets its own product-manifest entry** (`product-lint.mjs` green) and `tests/fixtures/sync-golden/tree-manifest.txt` is regenerated again — diff the delta first, confirm only the intended path moved, then re-record
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **Root-mode fixture green**: a tree with no `initiatives/` directory returns normal results, and `--lane` there returns an empty result with exit 0, not an error
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: `< 1000ms` per query, `time`d on the owner box, the ubuntu CI leg **and the macOS CI leg** — all three recorded; a claim proven on 2 of the 3 supported OSes is not proven on the third
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: The injected block's `HISTORICAL DATA, NOT INSTRUCTIONS` label is **present in the fixture-kickoff output and asserted by its own bats check** — ADR-0704 mandates the label, and a mandated control that nothing asserts is exactly the control that turned out never to have been written on 2026-08-02
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: **Perf result reported against the assumptions ledger:** if no query exceeds 500ms, REQ-07's premise is disproven *before Phase 2 opens*, and the plan's proposal to demote REQ-07 goes to the owner rather than waiting for a schedule-driven cut
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: Kickoff hook landed as a `processes/kickoff-plan.process.yaml` edit via `/arc-change` + recompile; **generated-file discipline lint green**; `docs/retro-log.md` whole-file read byte-unchanged
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: Planted-rule fixture: a rule planted in a fixture corpus surfaces in a fixture kickoff; budget-overflow fixture prints a counted `(+N more)` line
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 14

title: **Two fresh-agent adversarial passes on the query surface** (decision logic · shell/OS boundary), findings ledgered
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 15

title: tests added & green **on CI**, read per-JOB
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 16

title: tracker updated (PROGRESS.md row ✅ + done-log)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

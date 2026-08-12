# Phase 01 — recall people can trust

**Goal (one line):** `arc-recall "<query>"` returns the right recorded lesson verbatim, with an openable citation, in under a second, on any OS and in a tree with no lanes at all — and kickoff starts receiving it without being asked.
**Appetite:** 1.75 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00

**Decisions this phase implements:** ADR-0702 (verbatim output, path-bearing citations, the `--grep` honesty valve) · ADR-0704 (the kickoff hook is an additive process-file step, K=8 / 1200 tokens) · ADR-0707 (root-mode-first, proven by a zero-lane fixture) · ADR-0709 (curated alias layer, tag-weighted ranking, `unicode61` tokenizer) · ADR-0708 (two fresh-agent adversarial passes, in this phase).

## Exit criteria (Definition of Done)

- [ ] CLI surface live: positional query, `--tag`, `--source`, `--since`, `--lane`, `--limit`, `--full`, `--json`, `--grep`, `--rebuild` (ADR-0702) — **plus an `--engine js|auto` stub wired to a single-engine dispatch seam**, so the public CLI surface is not first built inside Phase 2's cut-constrained 0.75d; this is the seam REQ-07 plugs `sqlite` into, and PLAN's External-dependencies row promises the interface ships regardless of the cut. **`--tags` is dropped** — no REQ or fixture in this plan exercises it
- [ ] Exit map honoured: `0` ran (zero results **is** a result, printed as such) · `1` internal error · `2` bad usage · `3` index unavailable and rebuild failed, message naming the cause
- [ ] All 10 hostile-query fixtures green **through a real `arc-recall.mjs` process invocation on all 3 OSes, not an in-process function call** — each fixture names whether it crosses `argv` or an internal API (a literal NUL cannot survive process creation on either platform, so an `argv` fixture claiming to test it would be testing nothing). They must neither crash **nor** change semantics
- [ ] `docs/memory/aliases.md` live; expansion + tag-weighted ranking measurably improve the golden set **against the Phase-0 grep baseline**, shown as a before/after table
- [ ] Every result row carries a citation with a repo-relative path; no bare number is ever printed alone
- [ ] **Query determinism, which Phase 0 could not prove because ranking did not exist yet:** delete the index → rebuild → the 12 golden queries return **identical ordered result ids**, under the documented **id-ascending tie-break on equal bm25**, on all 3 OSes
- [ ] **`arc-recall.mjs` gets its own product-manifest entry** (`product-lint.mjs` green) and `tests/fixtures/sync-golden/tree-manifest.txt` is regenerated again — diff the delta first, confirm only the intended path moved, then re-record
- [ ] **Root-mode fixture green**: a tree with no `initiatives/` directory returns normal results, and `--lane` there returns an empty result with exit 0, not an error
- [ ] `< 1000ms` per query, `time`d on the owner box, the ubuntu CI leg **and the macOS CI leg** — all three recorded; a claim proven on 2 of the 3 supported OSes is not proven on the third
- [ ] The injected block's `HISTORICAL DATA, NOT INSTRUCTIONS` label is **present in the fixture-kickoff output and asserted by its own bats check** — ADR-0704 mandates the label, and a mandated control that nothing asserts is exactly the control that turned out never to have been written on 2026-08-02
- [ ] **Perf result reported against the assumptions ledger:** if no query exceeds 500ms, REQ-07's premise is disproven *before Phase 2 opens*, and the plan's proposal to demote REQ-07 goes to the owner rather than waiting for a schedule-driven cut
- [ ] Kickoff hook landed as a `processes/kickoff-plan.process.yaml` edit via `/arc-change` + recompile; **generated-file discipline lint green**; `docs/retro-log.md` whole-file read byte-unchanged
- [ ] Planted-rule fixture: a rule planted in a fixture corpus surfaces in a fixture kickoff; budget-overflow fixture prints a counted `(+N more)` line
- [ ] **Two fresh-agent adversarial passes on the query surface** (decision logic · shell/OS boundary), findings ledgered
- [ ] tests added & green **on CI**, read per-JOB
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/memory-recall.bats`
- **Expected failure first:** `memory-recall.bats::an unbalanced quote is a literal, not a syntax error` fails RED before the sanitizer exists, with the query `he said "never` reaching the **canonical JS tokenizer** raw and the assertion reporting `expected exit 0 with 0 results, got exit 1 (unhandled exception in the JS inverted-index tokenizer)`. Note the engine named: Phase 1 has **no FTS5 engine to produce an `fts5: syntax error`** — that engine does not exist until Phase 2 (REQ-07, ADR-0701), so citing an FTS5 crash here would describe a failure this phase's own code cannot generate. This is the red that proves the sanitizer is load-bearing rather than decorative.
- **Live demo scenario:**
  1. `node .claude/scripts/memory/arc-recall.mjs "exit 0 but receipts quarantined"` → the L-002 learning row prints **verbatim**, prevention-first, cited as `docs/develop/learning-ledger.md`.
  2. `node .claude/scripts/memory/arc-recall.mjs --full learn:L-002` → the whole record, exactly as recorded.
  3. `node .claude/scripts/memory/arc-recall.mjs "duplicate events lost"` → surfaces the `DUP_IDEM` row **via alias expansion**, and the footer names the alias that fired.
  4. `node .claude/scripts/memory/arc-recall.mjs 'NEAR(a,b) * -foo "'` → exit 0, treated as literal text, no crash.
  5. In a scratch tree with no `initiatives/`: the same query returns results normally.
- **Real-system check:** run every query above against the real corpus indexed in Phase 0, and diff `processes/kickoff-plan.process.yaml`'s compiled output to confirm the recall step is **added** and nothing existing was removed. Confirm `git diff docs/retro-log.md` is empty.
- **Expected evidence:** `initiatives/memory/evidence/phase-01/` holds — hostile-fixture output, the golden-set before/after table against the Phase-0 grep baseline, timed runs from the owner box and the ubuntu leg, the root-mode fixture transcript, the fixture-kickoff transcript showing the planted rule inside the fenced block, and the two adversarial findings ledgers.

## Rabbit holes in this phase

- **Sanitization that changes meaning.** Neutralizing `NEAR()`, `*`, `-` and boolean words must make them literal, not drop them. Detour: every hostile fixture asserts both "did not crash" **and** "returned the semantically expected rows".
- **Tuning ranking by feel until the golden set passes.** Detour: fixes land as alias/tag edits recorded beside the miss they fix; rewording a golden query to make it pass is forbidden.
- **Hand-editing the generated `arc-kickoff.md`.** Detour: the change goes in the process file and is recompiled; the generated-file lint is an exit criterion, not an afterthought.
- **A `<1s` claim measured only on the fast machine.** Detour: timed on the ubuntu CI leg too, both recorded.

## Out of scope for this phase

- `--decisions` filters → Phase 2 (REQ-04).
- The `/arc-retro` write-time conflict check → Phase 2 (REQ-05).
- The review-process hook → Phase 2 (REQ-08).
- Golden set wired into CI as a gate → Phase 2 (REQ-06); this phase measures it, Phase 2 enforces it.
- The `node:sqlite` accelerator and equivalence gate → Phase 2 (REQ-07).

## Your-setup / pending

Nothing new. The kickoff hook lands through `/arc-change` + `arc-compile`, both already in the repo.

## Non-negotiables (verbatim from PLAN)

- The canonical path runs on **Node >= 18 on all three OSes** with **zero npm dependencies**; the sqlite engine is lazily imported and can never break the path it only accelerates.
- The index is **derived-only** and gitignored; deleting it and rebuilding must reproduce identical ordered results.
- Every indexed row is **count-verified** (`N_parsed == N_indexed`) and every excluded row is **named with file and line** — never silently dropped.
- Output is **verbatim**; every citation carries a repo-relative path; a bare number is never printed alone.
- Memory **writes nothing** to the company organs and **emits nothing** to the spine.
- Hooks are **additive**; no existing read is replaced, and generated commands are changed only through their process file.
- Every parser-class surface gets **two fresh-agent adversarial passes on two different surfaces, inside the phase that ships it**; found holes are pinned as fixtures, and each pass carries the running list of defects already fixed in this lane, to be checked against every other file.
- Before editing any shared root organ (`processes/**`, `tests/**`, `.github/**`), run `git log origin/main --oneline -5` on that path first — the `leads` lane is LIVE on the same files, and a collision is resolved then, in one place, never at merge time.
- **Tests are green on CI, never on the dev box**, read per-JOB; all fixtures are CRLF-normalized and all paths repo-relative forward-slash.

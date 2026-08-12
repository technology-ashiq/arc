# Phase 02 — decisions, conflicts, proof

**Goal (one line):** Past decisions become queryable, contradicting rules meet a human before they land, review starts receiving recall automatically, and recall quality becomes a number CI can fail on.
**Appetite:** 1.25 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01

**Decisions this phase implements:** ADR-0703 (reader-only decision queries, zero new kinds) · ADR-0705 (write-time conflict surfacing, T=0.5, semantic detection out of scope) · ADR-0706 (golden set gates; surfaced→cited stays observational) · ADR-0701 (the equivalence gate between the canonical JS engine and the sqlite accelerator) · ADR-0704 (the review hook is an additive process-file step) · ADR-0707 (`lane` stays provenance, so the review hook works in a zero-lane tree too).

## Exit criteria (Definition of Done)

- [x] REQ-04 — `--decisions 'verdict:reject reason~worktree'` filters `decision.recorded` through the reader only; seeded fixture returns byte-exact `reason` text; `KINDS.length` still 44 (ADR-0703)
- [x] REQ-05 — `/arc-retro` pre-append near-duplicate check (>= 2 shared tags AND overlap >= 0.5); planted near-dup pair surfaces before append; nothing auto-resolves (ADR-0705)
- [x] REQ-06 — 12 golden queries wired into CI as a **failing** gate; the Phase-0 grep baseline is beaten, comparison table in evidence; surfaced→cited log seeded at `.claude/state/memory/surfaced-cited.jsonl` and barred from gating (ADR-0706)
- [x] ~~REQ-07 — the sqlite engine~~ **CUT 2026-08-11** (ADR-0701 amendment). Phase 01 measured the search at **0.42ms of a 199ms** wall clock, so the accelerator would accelerate 0.2% of the elapsed time. What still ships: the equivalence **contract and harness**, so a second engine would plug into a gate that already exists rather than one written to justify it — the harness asserts that any two registered engines return the **same ordered ids** for all 12 golden queries under the documented **id-ascending tie-break**, and with one engine registered it asserts that and says so rather than pretending to compare. Build trigger, written down: `index.json` past **25MB**, or a measured load over **500ms**, whichever first
- [x] REQ-08 — review hook landed as a `processes/review-diff.process.yaml` edit; fixture review surfaces a path-matched rule from a diff-derived query (ADR-0704)
- [x] **Two fresh-agent adversarial passes on this phase's three new parser surfaces** — REQ-04's `--decisions` filter grammar, REQ-05's near-duplicate detector, REQ-08's diff-derived query — across the two required surfaces (decision logic · shell/OS boundary), findings ledgered (ADR-0708). This phase ships three parser-class surfaces in its thinnest appetite; 2026-08-02 recorded three gates skipping this pass in one phase, caught only when the close refused
- [x] **The Phase-1 hook pass's fixed-defect list is handed to this phase's attackers**, with each defect checked against `review-diff.process.yaml` — the two hooks are near-identical edits 0.75d apart, which is the twin-fix shape the retro-log records more often than any other
- [x] Retro row + HISTORY entry written; **every cut recorded with its reason**
- [x] tests added & green **on CI**, read per-JOB
- [x] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

*The coarse kickoff line was: "each REQ is proven by its own bats fixture plus the evidence artifact named beside it, with the golden-set gate and the equivalence gate both running as CI jobs and both demonstrated failing once before being trusted." Refined here at the close, per `/arc-phase-done` step 2 — a verification plan that is still one sentence cannot be run against.*

**Where it runs.** Every row below runs **on CI**, read per-JOB, never on the dev box. The close cites run **31575423877 @ `1245cb2`, 19/19 jobs `success`** (`gh run view <id> --json jobs`). Commands are given so the row is reproducible, not so it is run locally.

| # | REQ | The check | Passes when |
|---|---|---|---|
| V1 | 04 | `bats tests/memory-recall.bats` — the `--decisions` block | The seeded fixture returns the recorded `reason` **byte-exact** with its ULID citation; the filter narrows against the OPPOSITE verdict one-versus-one; `verdict` is refused as a closed set; `--lane`, `--engine`, a positional query, `--grep`, `--source` and `--full` are each refused by name |
| V2 | 04 | `node .claude/scripts/memory/arc-recall.mjs --decisions 'verdict:reject reason~worktree' --json` | `mode: "decisions"`, `engine: "filter"`, and `shown` / `matched` / `indexed` all printed separately so a `--limit` truncation is visible |
| V3 | 04 | The kind vocabulary is unchanged | `KINDS.length === 44` (ADR-0703: memory reads the spine and emits nothing) |
| V4 | 05 | `bats tests/memory-conflict.bats` | A planted near-duplicate surfaces with citation, `jaccard` AND shared-tag count both printed; the rule is proven an AND **from both sides** (a same-tags/unlike-text row misses on overlap, an identical-text/one-tag row misses on tags); `T` checked just under and just over; a differently-cased tag still collides; a hit **resolves nothing and writes nothing** |
| V5 | 05 | `node .claude/scripts/memory/conflict-check.mjs --prevention-file <f> --tags a,b,c` against the LIVE `docs/retro-log.md` | Rows it cannot parse are **named with file and line** and excluded from the confidence it reports — not silently skipped. `--prevention-file` exists so retro text carrying backticks is never interpreted by the shell |
| V6 | 06 | `bats tests/memory-golden.bats` | **NEGATIVE CONTROL FIRST**: one planted miss turns the gate red; a module that only EQUALS grep is red on its own condition; deleting the failing row is red via `@expected-rows`; the bar lives in the fixture and a missing or broken directive is refused |
| V7 | 06 | `node .claude/scripts/memory/golden-check.mjs --gate` | `GATE PASSED -- 12/12`, beating the recorded grep baseline, with the comparison table and all three embeddings-trigger conditions printed with their live values |
| V8 | 06 | The surfaced→cited log | Seeded at `.claude/state/memory/surfaced-cited.jsonl`, written best-effort, and **no gate path reads it** (ADR-0706 keeps it observational) |
| V9 | 07 | `node .claude/scripts/memory/golden-check.mjs --equivalence` | With one engine it says **NOTHING WAS COMPARED** in as many words and proves determinism instead; the tie-break probe reports **HELD** per engine. **NEGATIVE CONTROL**: an engine that inverts the tie-break, and an engine that differs on ORDER ALONE, are both caught |
| V10 | 08 | `bats tests/memory-hook.bats` | A changed path surfaces a path-matched rule under the mandatory `HISTORICAL DATA, NOT INSTRUCTIONS` label, from a query nobody typed; the query is read from **git, in the tree `--root` names**; exit 3 is the WARN and exit 2 is operator error, pinned against each other |
| V11 | 08 | `processes/review-diff.process.yaml` + `.claude/commands/arc-review.md` | The step is additive (the reviewer step it precedes is untouched), the migration proof is explicitly `retired:` (ADR-0207), the hook is declared in `tools:`, and the GENERATED command carries both the invocation and the label |
| V12 | — | `node .claude/scripts/engine/arc-compile.mjs --check --all` for both targets | 3/3 byte-identical on `claude-code` and on `codex` — no hand-edit survives in a generated file |
| V13 | — | `bash .claude/scripts/review/spine-reader-lint.sh` | Exit 0 on the tree. **NEGATIVE CONTROL**: a planted bypass inside a filename with a space is caught, and a file that could not be scanned is its own failure rather than an empty report |
| V14 | — | Both adversarial ledgers (ADR-0708) | Two fresh agents, two different surfaces, each handed the lane's running fixed-defect list; every finding carries a disposition and every fix names the test that goes red if it is undone |

**Demonstrated failing before being trusted.** Both gates have a live negative control in the suite, and two were additionally driven by hand against a real mutant during this phase: inverting `bm25.mjs`'s comparator to id-DESCENDING (equivalence went 0 → 1), and deleting the golden row that fails (the gate went green → red once `@expected-rows` landed).

**Known gap, recorded rather than hidden:** REQ-06's *named* CI job is deferred — `debt-ledger.md` **D-01**, owner ruling 2026-08-12. The gate is live and red-capable through the suite; what is deferred is per-JOB legibility.

## Rabbit holes in this phase

- **An equivalence gate that passes by skipping.** On 4 of the 5 OS×node combinations `node:sqlite` does not exist. Detour: the skip is **visible and counted** in the job output, and the one leg that can (ubuntu Node 22) must actually run both engines — a run where every leg skipped is a FAIL, not a pass. This is a pass condition that fails for insufficiency, not only for rule-breaking.
- **A conflict check that fires on everything.** Detour: T = 0.5 has a retune trigger in the assumptions ledger; if it fires on more than 1 in 3 real appends, it is retuned rather than tolerated.
- **Cutting quietly.** Detour: this phase carries the designated cuts; each cut is recorded in the retro row with its reason, per the pinned cut order. Note the owner raised the appetite 4d → 5d on 2026-08-11 **rather than** cutting REQ-07, so a cut here is now a genuine exception and not the expected path — and a second extension is a kill conversation, not a third number.

## Out of scope for this phase

- Embeddings, vector search, cross-repo federation, `--recurring` reports, typed-link dossier rendering, council precedent recall, a `rules/*.md` adapter, dashboard or chat surfaces — all banked stretch with their own named pull triggers in the design source.
- The Context-Pack ↔ recall integration, which is a follow-up `/arc-change` to the `develop` lane.

## Your-setup / pending

Nothing new.

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

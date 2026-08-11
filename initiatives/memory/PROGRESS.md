# PROGRESS.md — arc-memory "playbooks + recall"

status: LIVE
cycle: arc-memory (Cycle 11, opened 2026-08-11)
phase: 02
appetite: 5d
burn: 2.75d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane memory` on 2026-08-11 and claims **ADR band
> 0700–0799** (ADR-0700..0709). Company organs (`docs/adr/`, `docs/retro-log.md`,
> `docs/trial-ledger.md`, `docs/develop/learning-ledger.md`, `tests/`) stay at root and are never
> copied here (ADR-0053); evidence is lane-scoped at `initiatives/memory/evidence/phase-NN/`
> (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-memory.md` v1.1 (frozen — the decision record, not the
> cycle). MEM-A, MEM-C..MEM-K are locked there.
>
> **MEM-B was re-decided at this kickoff, on measurement.** The design source made the FTS5
> preflight the cycle's first act and instructed a STOP on any failure. The probe passed on the
> owner's machine (Node v24.18.0, SQLite 3.53.1 — FTS5, unicode61, external-content, weighted
> bm25, parameterized MATCH, atomic rename, no experimental warning) and then failed the platform
> half: `node:sqlite` needs Node 22+, and arc's CI runs Node 20 on macOS and Windows, so **only 1 of
> the 5 distinct OS×node combinations can import it** (one job out of 18). A sqlite-only index
> would have been untestable on 2 of 3 OSes, dead on
> every Node 18/20 root-mode consumer install, and would have made memory the first arc component
> to hard-require Node 22 — overturning ADR-0024 by omission. The owner was shown the three
> options on 2026-08-11 and chose **C**: a pure-JS index is canonical, `node:sqlite` FTS5 is an
> optional accelerator behind an equivalence gate. Recorded as **ADR-0701**.

## Phases

| # | Capability | Appetite | REQs | Status |
|---|---|---|---|---|
| 00 | The index exists and is honest — 5 adapters, count-verified, named exclusions, atomic rebuild, golden set committed, grep baseline recorded | 1.5d | REQ-01 | ✅ closed 2026-08-11 |
| 01 | Recall people can trust — CLI, sanitization, aliases, citations, `<1s` on 3 OSes, root-mode fixture, kickoff hook | 1.75d | REQ-02, REQ-03 | ✅ closed 2026-08-11 |
| 02 | Decisions, conflicts, proof — `--decisions`, write-time conflict check, review hook, golden set in CI, sqlite engine + equivalence gate | 1.25d | REQ-04..REQ-08 | ⬜ not started |

## Appetite burn

**2.75d of 5d used (55%).** Phase 01 came in at **0.75d against its 1.75d appetite**. Phase 00 came in at **1d against its 1.5d appetite**. Tripwires: 2.5d (50%) — if Phase 00 is not closed, mandatory scope-cut
conversation. 5.0d (100%) — cut or kill, never silently extend.

**The appetite was raised 4d → 5d by the owner on 2026-08-11**, recorded here rather than absorbed
silently. Option C (ADR-0701) added REQ-07 to an already-committed cycle; the kickoff recommended
holding 4d and cutting REQ-07's engine first, and **the owner chose to fund it instead**. A second
extension is a kill conversation, not a third number.

Cut order, still pinned but now a contingency rather than the expected path: **REQ-07's sqlite
engine → REQ-05 → REQ-04.** REQ-01/02/03 are the module and are never the cut.

## Done-log

- **2026-08-11** — lane born. MEM-B preflight run as the design source's first act; result forced
  a storage re-decision (ADR-0701). ADR-0700..0709 written. PLAN.md, three phase specs and this
  tracker created. `kickoff-lint` and `board-lint` both green.
- **2026-08-11 — attack panel: 20 findings, 19 applied, 1 rejected.** Three fresh agents
  (edge-cases/feasibility · scope/hidden-dependencies · pre-mortem-from-history) found two errors
  of fact in the kickoff's own work. **(a)** The kickoff reported "1 of 6 CI legs" for
  `node:sqlite`; there are **5 distinct OS×node combinations** (18 jobs), so the number under the
  cycle's central decision was wrong and is now corrected everywhere. **(b)** The kickoff had
  written off `retro-log.md`'s "1 anomalous 6-field row" as malformed. It is a **real lesson**
  whose prevention text contains a pipe inside a code span — and the count-verify could never have
  caught the misclassification, because excluded rows sit outside `N_parsed`. Masking code spans
  gives **54 rows, 0 malformed**. The row that would have been silently discarded is the
  2026-08-02 lesson *about regex parsing bugs*. A third correction followed: `trial-ledger` holds
  **37 records inside 85 pipe rows** across seven tables, so the kickoff's "85" would have indexed
  headers and separators as evidence. *(That 37 was itself wrong; the adapter measured **49** on
  the same day — see the Phase 00 log below.)*
- **2026-08-11 — simulation gate: RED after two rounds (5 → 5). STOPPED for the owner.** Round 1's
  five blockers were fixed by adding an "Execution contracts" section to `phase-00-spec.md`
  (id grammar · per-adapter field schemas · spine reader API · the 12 golden queries · adversarial
  ledger format · product-manifest and sync-golden procedure). Round 2 returned five **new** ones,
  all real, all confined to Phase-0 spec detail rather than to the plan's structure, decisions or
  appetite — two are contradictions this kickoff introduced (Phase 0's rebuild proof needs ranking
  that Phase 0 itself defers to Phase 1; the product-manifest item says "both scripts" when one of
  them is a Phase-1 deliverable) and three are missing detail (the fixture spine's **emit** path is
  unnamed — only the reader is; the golden-queries file has no column format and one query has
  plural expected answers; the grep-baseline method is undefined while an assumptions-ledger
  trigger depends on its number). Per the kickoff process, a third repair round is the owner's
  call, not this session's.
- Separately, this session caught itself inventing an environment variable (`ARC_HQ_ROOT`, which
  does not exist) in that same section; the real test door is `ARC_SPINE_ROOT`. Every other path,
  command and API name in the spec was then verified against the tree.
- **2026-08-11 — owner ruled on both open questions.** (1) **Take a third repair round** on the
  simulation gate. All five round-2 blockers were fixed: Phase 0 now proves *index* determinism via
  `--dump-records` while query determinism moves to Phase 1; Phase 0 registers only the builder in
  the product manifest; the fixture spine's **emitter** is named along with the approval-then-decision
  ULID ordering and the cross-checkout refusal this session hit for real; `golden-queries.tsv` gets a
  4-column format where `expect` may hold several ids; and the grep baseline gets a fixed method,
  deliberately generous to grep so the comparison cannot flatter the module. (2) **Appetite raised
  4d → 5d rather than cutting REQ-07** — the whole of option C ships, and the cut order survives only
  as a contingency.
- **2026-08-11 — simulation gate PASSES at 0 blockers, after six rounds: 5 → 5 → 4 → 2 → 3 → 0.**
  Rounds 3–6 closed fourteen more findings, every one of them a gap in `phase-00-spec.md` rather
  than in the plan: the golden set's file format and its plural-answer case · a pinned stopword
  list, because the grep baseline gates a STOP trigger and two different lists give two different
  answers · the fixture-injection door (`--root`, plus adapters as pure functions of a value) ·
  per-adapter signatures, since one `parse(text)` shape cannot serve `adr` (needs its own path) or
  `decisions` (has no text) · the `approval.requested` payload and the approval-then-decision ULID
  ordering · a single invocation contract, replacing a RED assertion this session had **invented**
  (`bats: command not found`, which `node` never prints — the real `MODULE_NOT_FOUND` text was
  observed in this very session when a `cd` drifted) · the record-hash input, defined as canonical
  serialization so it is uniform across an adapter whose records have no source text · and a
  sorted ADR glob, because directory order is not stable across three OSes. Round 4 also caught
  this session committing its own pre-mortem's twin-fix pattern: PLAN.md was left asserting the
  opposite of the spec after the spec alone was repaired.
- **2026-08-11 — kickoff receipts on the spine.** `kickoff.done` `01KZQR3W3ZSZ9CRSJMQ79XGF28` and
  `approval.requested` `01KZQR43KNH8TKJAQG6QHDJBS4`, both emitted from the main clone (the worktree
  guard refused and named the right directory) and both confirmed present in `events/` with today's
  `_quarantine/` empty — looked at, not inferred from exit 0.

- **2026-08-11 — owner approved and Phase 00 opened.** `/arc-develop start 00`, 14 slices.
  Commits in ADR-mandated order: the 12 golden queries first (`e8a186c`), before any adapter
  existed; then the grep baseline (`98a9741`), measured at a commit where
  `.claude/scripts/memory/` was not on disk; then the module (`d594bfd`).
- **2026-08-11 — the code corrected the plan four times.** `trial-ledger` holds **49** ledger
  records, not 37, and 19 non-ledger rows, not 31 — 49+7+10+19 = 85 exactly, which the kickoff's
  split did not. `docs/adr/` is **150** files, not 140, because this lane wrote ten during its own
  kickoff; that is why absolute counts are pinned only in frozen fixture trees and the live tree
  is held to the invariant alone (spec §B3). And `decisions` reported **0/0 on a spine the builder
  had never opened** — the reader's root is the spine root, not the repo root, and handing it the
  wrong one returns zero events with no error at all. Against the real spine it reads **20
  decisions out of 1004 events**.
- **2026-08-11 — CI found two defects this box could not.** `portability.bats` refused a negated
  letter-range bracket expression, a locale-collation trap this repo already gates against; and
  six legs identically refused `decision.recorded`, whose idem is **welded** to the approval it
  decides. **This phase's own spec §C carried that emit snippet**, written at kickoff from reading
  the payload shape and never run. Both fixed; the spec is corrected in place with the refusal
  quoted, so the next reader inherits the answer rather than the mistake. CI green 19/19 on
  `eb62094`, read per-JOB.
- **2026-08-11 — two fresh-agent adversarial passes (ADR-0708), inside the phase. 37 findings, 35
  fixed, 2 rejected with a reason. Exactly ONE overlapped** between the decision-logic agent and
  the shell/OS agent — the measured argument for two surfaces rather than one attacker given more
  time, and the second time this repo has measured it.
  - Nine fixes are the same sentence: **a line the parser did not understand left no trace.** The
    leading-date regex was a filter, so markdown's own pipe escape, one leading space, a one-digit
    day and a table-shaped row each vanished with no record and no exclusion, at exit 0, with
    `N_parsed == N_indexed` perfectly true. The count-verify cannot see that class by construction.
  - **The twin-fix this lane's own pre-mortem predicted happened inside this cycle** — not across
    the two process hooks it named, but **four lines apart in one function**: the pipe split was
    masked and the comma split below it was not.
  - Also closed: an empty `--root` built an index for a directory nobody named; the staleness check
    consulted the hash only when the mtime already differed, while the comment beside it claimed
    the opposite; an ADDED file could never mark the index stale; an emptied or UTF-16-re-saved
    organ reported 0/0 and exited 0 with no channel able to catch it on the live tree; `--root`
    moved the organs but not the spine; a malformed expectation file silently disarmed the only
    pinning channel; and one of the phase's own regression tests could not fail.
  - The index now reports **2 malformed rows on the live tree, and both are real**: ADR-0006 and
    ADR-0007 each carry two `**Status:**` lines under `## Amendment`.
  - `golden-queries.tsv` gained an **anchor** column: a retro id is content-positional, so one
    back-filled row renumbers every later id on that date and the gate keeps passing while grading
    a different lesson. Demonstrated, then closed.

- **2026-08-11 — PHASE 00 CLOSED.** `amendments: 2` · `reopened: n` · `t-to-phase0: 0d` ·
  **1d against a 1.5d appetite.** Shipped: five adapters over the five company organs, one
  derived index (`.claude/state/memory/index.json`, gitignored, full-rebuild only), count-verified
  per organ with every excluded row named by file and line, an mtime+sha256 staleness manifest
  with an atomic temp-then-rename swap, the 12 golden queries with content anchors, and
  `golden-check.mjs`.

  **Green on CI: 31/31 memory tests on all five OS×node combinations** (ubuntu 18/20/22, macOS 20,
  windows 20), read per-JOB, run `31484874136` at head `1ff8ecb` — and the tests were confirmed
  to have *executed* on each leg, not merely to have not failed.

  Live counts **54 / 49 / 4 / 150 / 21 = 278 records**, 48 named exclusions of which **2 are
  malformed and both are real**: ADR-0006 and ADR-0007 each carry two `**Status:**` lines under
  `## Amendment`, so an amendment recording a new status would never be read. Two consecutive
  rebuilds with the index deleted between them produced byte-identical record dumps. `git status`
  clean afterwards; `KINDS.length` still 44; `spine-reader-lint` green **and now actually
  scanning memory**, which it was not before.

  The two amendments were both corrections of measured fact, neither a change of intent: the spec
  said `trial-ledger 37/37` (it is 49) and `adr 140/140` (it is 150, because this lane wrote ten
  during its own kickoff), and its section-C emit snippet was refused by six CI legs because
  `decision.recorded` carries an idem welded to the approval it decides — written at kickoff from
  reading the payload shape, never run.

  **Assumption triggers checked, none fired.** Grep scores 1/12 by the pinned method against a
  `>= 10/12` trigger. The "second organ carries separators inside its own data" clause was
  measured rather than assumed: two organs do carry pipes inside code spans, but both are in
  *prose describing the format*, not in data — the only pipe inside real data is still
  `retro-log.md:28`. No ADR revisit condition is true, and **ADR-0708's is the inverse of what
  happened**: it fires on heavy overlap between the two passes, and 37 findings produced exactly
  one.

- **2026-08-11 — Phase 01: REQ-02 shipped, REQ-03 BLOCKED on another lane's proof.**
  `arc-recall.mjs` ships: bm25 over a tag-weighted inverted index built at index time, an
  id-ascending tie-break, verbatim prevention-first output with a path-bearing citation on every
  row, the `--engine js|auto` seam, ten hostile-query fixtures, a zero-lane root-mode fixture, and
  `golden-check --rank`. **26 recall tests and 31 index tests EXECUTED and green on all five
  OS×node combinations** (run `31489671716`, head `da0d1a0`), counted from the TAP lines per leg.
  Measured shard weights entered for both files.

  **Golden set 12/12 in the top 3 against a recorded bar of 5/12** — grep's ORACLE best case,
  pinned in Phase 00 so it could not be renegotiated here.

  **Two findings reported rather than acted on, both the owner's call.** (1) The alias layer is
  **unearned and ships empty**: a 10-row table was written, then removed, and nothing changed —
  not one row was load-bearing. G10's `officially` appears zero times in the corpus, the cleanest
  vocabulary mismatch in the set, and it hits at rank 2 anyway. ADR-0709's premise is weaker than
  the design assumed. (2) **REQ-07's speed premise is disproven**, exactly as the assumptions
  ledger predicted: worst end-to-end 199ms against a 500ms trigger, and the search itself is
  **0.42ms** of it — the rest is node startup, so a sqlite accelerator would be accelerating 0.2%
  of the wall clock.

  **Two fresh-agent adversarial passes: 27 findings, 23 fixed, and ZERO overlap between the two
  surfaces.** The severest was my own Phase-00 fix over-corrected — exact URL identity for the
  direct-invocation guard, which is false under any symlinked path because Node ESM realpaths the
  entry module, so all three CLIs exited 0 with empty output and the entire exit map collapsed to
  success-having-done-nothing. macOS `/tmp` is a symlink, so it was live on a CI leg.

  **But the finding worth keeping is that the suite protecting this module proved nothing.** A
  60-line stub that read no organ and imported nothing passed fifteen of its assertions, one of
  which was the determinism proof. `.claude/rules/testing.md` states the rule that violated, and
  the file that violated it was written the same day by the session that had just quoted that rule
  in another suite's header. Two assertions now compare against the fixture organ's own bytes and
  against a ranking computed independently by the library.

- **2026-08-11 — BLOCKED: memory's two process-file hooks collide with the engine lane's migration
  proof.** `arc-compile --against-baseline` renders each process file and compares it to the
  pilot as it was at the commit that file pins, read out of git — so the first legitimate step
  added to a migrated process file makes the proof false, correctly. All three migrated process
  files pin the same commit and none has been edited since; this cycle is the first to try.
  Re-pinning the sha would turn a real gate into a tautology, and hand-editing the generated
  command is forbidden. Retiring the per-file proof is an **engine-lane** decision and this plan's
  own no-go list forbids cross-lane edits. The hook is reverted, both engine targets are back to
  3/3 byte-identical, and its exact text is parked in
  `evidence/phase-01/BLOCKED-process-hooks.md`. Blocks **REQ-03** and, identically, **REQ-08**.

- **2026-08-11 — PHASE 01 CLOSED.** `amendments: 1` · `reopened: n` · **0.75d against a 1.75d
  appetite.** The owner chose to retire the engine lane's migration proof, so REQ-03 landed after
  all: **ADR-0207** in the engine band, written by this lane with the owner's explicit approval.
  A `baseline.retired:` field carries a date and a reason; both gates skip that file and count it
  **apart** (`2/2 byte-identical (1 retired)`), never folded into the total, because a retirement
  that read as a pass would be the tautology the gate exists to refuse. A negative control proves
  the retirement must be **declared**: delete the field and the same file fails 0/1 again.

  The kickoff hook then landed from the parked text unchanged — **48 insertions, 0 deletions**,
  with the whole-file `docs/retro-log.md` read byte-untouched, because recall ranks and a
  pre-mortem needs the unranked whole. Both compile targets recompiled; the codex golden
  re-recorded, since a recorded output is supposed to move.

  **Green on CI, run `31500294944` at head `f12ca3c`, 19/19 jobs**, and both suites confirmed to
  have EXECUTED per leg by counting TAP lines: **26 recall + 31 index tests on all five OS×node
  combinations**, zero failures. Measured shard weights entered for both files (44s, 60s).

  The one amendment was mine and it was a windows-only defect in my own new test: I asserted a
  forward-slash path against output that carries the platform separator, so 18 of 19 jobs were
  green and one shard was red on the assertion added that hour.

## Now

**Phases 00 and 01 are closed. Phase 02 is next, and it is the largest of the three.**

What exists and is green on all three OSes: the index (278 records, count-verified, named
exclusions, atomic rebuild), `arc-recall` (bm25, id-ascending tie-break, verbatim path-bearing
citations, ten hostile fixtures, root-mode), `golden-check --rank`, and the additive kickoff hook.
**Golden set 12/12 against a recorded bar of 5/12.**

**Phase 02 (REQ-04..REQ-08, 1.25d appetite) still owes:**

| REQ | What | Note |
|---|---|---|
| 04 | `--decisions 'verdict:reject reason~worktree'` through the reader only | `KINDS.length` must stay 44 |
| 05 | `/arc-retro` pre-append near-duplicate check, T=0.5 + 2 shared tags | surfaces, never auto-resolves |
| 06 | the 12 golden queries as a **failing** CI gate | `golden-check --rank` already measures; Phase 02 wires it |
| 07 | the sqlite engine behind the equivalence gate | **its speed premise is disproven** — search is 0.42ms of a 199ms wall clock. The owner funded it anyway on 2026-08-11; the gate still earns its place as the thing that catches a second engine disagreeing |
| 08 | the review hook | lands exactly like REQ-03 did, via `baseline.retired:` on `review-diff.process.yaml` — the path is now proven |

**Plus, non-negotiable:** two fresh-agent adversarial passes on Phase 02's three new parser
surfaces, and the Phase-01 defect list handed to them. That list is not short, and pre-mortem row 2
named this phase specifically: the review hook is a near-identical edit to the kickoff hook, which
is the twin-fix shape the retro-log records more often than any other.

**Two findings still standing for the owner**, both reported and neither acted on: the alias layer
is unearned and ships empty, and REQ-07's speed premise is disproven.

PR **#162** stays a draft until the cycle closes.

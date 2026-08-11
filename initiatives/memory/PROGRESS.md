# PROGRESS.md — arc-memory "playbooks + recall"

status: LIVE
cycle: arc-memory (Cycle 11, opened 2026-08-11)
phase: 00
appetite: 5d
burn: 0.6d
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
| 00 | The index exists and is honest — 5 adapters, count-verified, named exclusions, atomic rebuild, golden set committed, grep baseline recorded | 1.5d | REQ-01 | 🔨 in progress |
| 01 | Recall people can trust — CLI, sanitization, aliases, citations, `<1s` on 3 OSes, root-mode fixture, kickoff hook | 1.75d | REQ-02, REQ-03 | ⬜ not started |
| 02 | Decisions, conflicts, proof — `--decisions`, write-time conflict check, review hook, golden set in CI, sqlite engine + equivalence gate | 1.25d | REQ-04..REQ-08 | ⬜ not started |

## Appetite burn

**0.6d of 5d used (12%).** Tripwires: 2.5d (50%) — if Phase 00 is not closed, mandatory scope-cut
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

**Phase 00 open. Slices 01–07, 09–12 proven; 08 (measured shard weight), 13 (CI green on the
current head) and 14 (tracker) still owed.**

## Now

**Current position, 2026-08-11: kickoff COMPLETE, every gate GREEN, STOPPED at the approval
gate.** PLAN.md, `phases/phase-00-spec.md`, `phase-01-spec.md`, `phase-02-spec.md` and
ADR-0700..0709 are written. `kickoff-lint` green · `board-lint` green · **simulation gate 0
blockers** after six rounds. No product code exists and none may be written until the owner
approves.

Both of the owner's 2026-08-11 rulings are applied: the third repair round was taken (and ran to
six, reaching zero), and the appetite is **5 days with nothing cut**, so the whole of option C
ships — canonical JS engine, sqlite accelerator, and the equivalence gate between them.

**What the owner is approving:** an 8-REQ, 3-phase, 5-day cycle that indexes five existing company
organs in place and gives `arc-recall` back their contents verbatim with openable citations, plus
additive recall steps in kickoff and review. It creates no new store, emits no events, adds no
spine kinds, and touches no organ's contents. If it were deleted tomorrow the company would lose a
search box and nothing else — that property is what makes it safe to build in five days.

**Next step on approval:** `/arc-develop start` on Phase 00 — first slice the five adapters and the
count-verify negative control, first proof the grep baseline measured **before** anything claims to
beat it. If grep already answers 10 of the 12 golden queries, the module's own premise is thin and
that is a STOP-and-report, not a number to improve.

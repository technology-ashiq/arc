# Phase 04 — Kernel freeze in kickoff-lint + the new-cycle detector

**Goal (one line):** `kickoff-lint` refuses a new cycle on a kernel lane while the owner's freeze ruling stands, printing its ULID, with exemptions read from the ruling (REQ-06, ADR-0076, ADR-0077).
**Appetite:** 0.6 days
**Depends on:** phase-00

## Non-negotiables (verbatim from PLAN)
- ADR-0051: no value on the board is typed by hand; `stale` is derived by the job and never written into PORTFOLIO.md (ADR-0079).
- Lock 4: PORTFOLIO.md's columns and row grammar do not change; no health score, no owner column, no ETA.
- The freeze's exempt lanes are read from the ruling's payload, never hardcoded; an unreadable ruling refuses, never exempts (ADR-0077).
- `hq.jobs.yaml` and `hq.policy.yaml` are written only by the owner-apply script the owner runs (ADR-1750); the job never runs ungoverned.
- The spine is read only through `.claude/scripts/hq/spine.mjs`; zero new event kinds.
- Lock 5: two-surface `/arc-attack` (logic + boundary, ADR-0226) per gate PR, carrying `initiatives/portfolio/fixed-defects.md`; the author is never the attacker; one round per PR.
- Tests run on CI only; every fixture asserts it RAN before asserting what it printed.
- feat/* branch; push freely; merge once, after every phase is complete (owner, 2026-10-14).

## Exit criteria (Definition of Done)
- [ ] `kickoff-lint.mjs` gains the new-cycle detector (ADR-0076) and the `[kernel-freeze]` FAIL (ADR-0077), reading the spine only through `.claude/scripts/hq/spine.mjs`
- [ ] the canonical spine root resolves to the main clone from a linked worktree; an absent spine is `WARN [kernel-freeze-unread]`
- [ ] `tests/portfolio-kernel-freeze.bats` added, every case asserting RAN first, green on CI 3 OS per-JOB
- [ ] live demo: run against the real spine in this worktree, with a fixture new-cycle for a frozen lane and for `portfolio`
- [ ] two-surface `/arc-attack` on the PR diff before push; findings fixed or recorded
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `bats tests/portfolio-kernel-freeze.bats` (on CI only; run by the existing bats shard jobs)
- **Expected failure first:** before the gate exists, the case "non-exempt lane new cycle → exit 1 with `FAIL [kernel-freeze]` and `01M4…` ULID" fails with `expected status 1, got 0` — kickoff-lint passes the frozen lane because it reads no spine
- **Live demo scenario:** in a scratch copy of a fixture repo whose `initiatives/` holds `portfolio` and `memory` with changed `cycle:` headers, with `ARC_SPINE_ROOT` unset and the real main-clone spine in reach, run `node .claude/scripts/plan/kickoff-lint.mjs --lane memory` → `FAIL [kernel-freeze] … 01M4VP8AMYJPMT1MZNQRB0FYY6`; `--lane portfolio` → no freeze line
- **Real-system check:** the real ruling text `01M4VP8AMYJPMT1MZNQRB0FYY6` parses under the grammar (assumption A3); the real `decision.recorded` `01M4VPVKGNX9DMNWFEEZ57ZGJX` is approve, so the freeze stands; the demo prints the `revenue.received` count and each receipt id on the real canonical spine and a hand-check states each is a real, non-rehearsal payment (expected 0 today)
- **Expected evidence:** `initiatives/portfolio/evidence/phase-04/` — live demo transcript, CI run id with per-JOB conclusions, attack report

## Fixture matrix (REQ-06)
Fixture spines are JSONL day files written by the test into a temp `ARC_SPINE_ROOT`; fixture lanes are temp git repos with a base commit.
1. new cycle, non-exempt lane → FAIL with ULID
2. exempt list without `portfolio` → `portfolio` refused (nothing hardcoded)
3. `distribute Cycle 3` → Cycle 3 exempt, Cycle 4 refused
4. `engine (metered runs only)` → exempt, note printed
5. `decision.recorded` verdict reject → lifted
6. later owner-ruling `supersedes: <ULID>` → lifted
7. one `revenue.received` → lifted
8. unparseable exempt clause → FAIL closed naming ULID
9. unchanged `cycle:` vs base (mid-cycle lane) → never refused
10. base ref missing → `WARN [new-cycle-unknown]`
11. no spine → `WARN [kernel-freeze-unread]`
12. linked worktree → reads the main clone's spine
13. pending (no decision) ruling → stands
7b. a `revenue.received` whose payload marks it rehearsal, test or fixture does NOT lift the freeze — the marker field is read from ADR-1016 / arc-ledger's receipt schema before coding; an unknown shape counts as not-lifting
15. `cycle:` text amended with the same `Cycle N` on a frozen lane → never refused; `status: IDLE` → never judged
14. case/format variants of the ruling grammar (`Are exempt`, extra spaces, trailing period, Oxford comma) → pinned outcome each

## Rabbit holes in this phase
- A policy language for rulings — three item shapes only, fail closed otherwise.
- Wiring the freeze into `/arc-kickoff`'s preflight — kickoff.md is generated; step 8 already runs kickoff-lint, which is the gate.

## Out of scope for this phase
The debt budget (Phase 05); the stale job (Phase 06); enforcement rows and wiki (Phase 07).

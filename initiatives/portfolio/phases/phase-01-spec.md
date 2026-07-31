# Phase 01 — Self-host + link history + board v1

**Goal (one line):** Move this cycle's own tracker into `initiatives/portfolio/` (dry-run → rehearsed rollback in a disposable scratch worktree → single-commit real move), give design its HISTORY-INDEX lane (links only), birth `PORTFOLIO.md` v1 with both tables, wire the SessionStart degraded rule — and close this very phase in lane-mode.

**Appetite:** 0.75 days
**Depends on:** phase-00

Migration runs only AFTER Phase-0 routing is proven. The rollback rehearsal (REQ-02,
round 5) happens in a DISPOSABLE scratch worktree branched from the SAME commit the real
move will start from — if any commit lands on the branch after the rehearsal, re-run it;
a rehearsal against a stale HEAD is not evidence for the real move — isolated from the
working tree and any dirty state, `git revert` executed there, root-mode + lint + resume
proven green post-revert, NO emitters run there, worktree removed after. Design lane per ADR-0058:
folder + `HISTORY-INDEX.md` pointing at frozen `docs/archive/` + `docs/evidence/`
locations — never copies. Lane `PROGRESS.md` opens with the machine header block
(ADR-0051: status / cycle / phase / appetite / burn / blocked-on / depends-on) from
birth; evidence for this phase lands lane-scoped per ADR-0055.

## Exit criteria (Definition of Done)

- [ ] Capability works end-to-end: tracker lives at `initiatives/portfolio/`, `/arc-resume` no-arg auto-resolves the single LIVE lane and prints canonical order (lane echo → board → 5-block report)
- [ ] Tests added & green: migration guard fixtures, SessionStart degraded-rule fixtures (one eligible → canonical order; zero/multiple → board + hint, selects nothing), board-v1 presence fixtures — bats green on 3 OS
- [ ] **A5's unvalidated half is closed by test, not inherited.** A5 fired in Phase 0 (2026-07-31) on locale collation — a different mechanism than the `git mv` casing it also claimed, so that half is untested and this phase is the one that depends on it. A fixture must prove that a case-only rename of a lane directory behaves identically on all three legs — succeeding everywhere or refusing loudly, never a silent no-op that leaves the resolver seeing a directory the mover believes it renamed — and that the migration script decides what it moved from git's own record (status/oid), never by comparing two path strings, which case-insensitive filesystems fold
- [ ] Live demo run + output checked (scenario below)
- [ ] Verified against the real system: THIS repo post-move; `/arc-phase-done 1` itself executes in lane-mode and confirms the selected lane
- [ ] Contract tests green: not applicable — zero external dependencies (PLAN External dependencies)
- [ ] Tracker updated (lane PROGRESS.md row ✅ + done-log + machine header refreshed + board updated in the SAME commit)

## Verification plan

- **Test command:** `bats tests/lane-resolver.bats tests/portfolio-board.bats` locally (touched files only — CI runs the full 3-OS suite)
- **Expected failure first:** in a scratch worktree with the tracker already moved, run `/arc-resume` no-arg BEFORE the auto-resolution path lands — it fails to locate the tracker (red); green only when the resolver reads `initiatives/portfolio/`. Likewise the SessionStart fixture with two eligible lanes must show board + hint and select nothing — red until the degraded rule exists.
- **Live demo scenario:** dry-run output of the move script shown and checked; rollback rehearsal transcript from the disposable worktree (revert executed; kickoff-lint + resume + bare-root fixture green post-revert); real move as ONE commit; `/arc-resume` no-arg prints `Selected lane: portfolio (via auto)` → board → report; `PORTFOLIO.md` shows initiatives table (portfolio LIVE · design IDLE · develop QUEUED) + passports table (lexos) + `Updated:` line.
- **A5 casing fixture (new, from the 2026-07-31 firing):** in a sandbox repo create `initiatives/Design`, attempt `git mv initiatives/Design initiatives/design`, and assert the SAME outcome on ubuntu / macos / windows-git-bash. The failure this guards is not an error — it is the silent one: on a case-folding filesystem the rename can no-op while reporting success, leaving the mover convinced it renamed a lane the resolver still sees under the old name. Assert against git's record, never against a path string. Phase 0 already pins the resolver half (`initiatives/Design` is skipped, membership decided by exact comparison against readdir); this pins the MOVER half.
- **Real-system check:** SessionStart hook in this repo post-move follows the degraded rule with exactly one eligible lane; pointer stubs exist at old root paths; `docs/archive/` and `docs/evidence/` untouched (git status clean on frozen paths).
- **Expected evidence:** dry-run transcript, rehearsal transcript, single move commit hash, board v1, HISTORY-INDEX with resolving links (0 copied files), A5 casing-fixture transcript from all three legs, lane-scoped phase-01 evidence bundle.

## Rabbit holes in this phase

- Backfilling design's history INTO the lane (ADR-0058 forbids copies — links only).
- Polishing board grammar beyond what v1 needs — the lint that enforces it is Phase 2.
- Building a reusable migration tool; this move is a one-off script with a dry-run flag.

## Out of scope for this phase

- Board lint, WIP info line, ownership lint, spool (Phase 2). Docs One-Rule rewrite
  (Phase 3). The develop lane (born at its own kickoff, next cycle).

## Your-setup / pending

- None.

## Non-negotiables (verbatim from PLAN)

- Philosophy untouched: Golden Loop, gates, receipts, change discipline — a lane is a namespace for tracker state, nothing more (ADR-0050, ADR-0053).
- No history rewrite and no history duplication: frozen paths stay frozen as sole canonical copies; lanes link, never copy (ADR-0055, ADR-0058).
- Root-mode green at every commit — byte-identical when no `initiatives/` dir exists; the bare-root fixture is a permanent consumer contract (ADR-0054).
- feat/* branch + PR, never main.
- All new lints WARN-first, and every WARN prints Expected / Found / Example (ADR-0057).
- Spine receipts for kickoff / phase-done / retro as usual; no silently lost receipts — degrade visibly, never lose, never block (ADR-0056, REQ-04).
- Never guess a lane: explicit `--lane` beats auto-resolve beats ask; destructive commands confirm the selected lane (ADR-0054).

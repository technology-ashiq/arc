# PROGRESS.md — Cycle 4 · arc-portfolio "The Conductor"

status: LIVE
cycle: arc-portfolio
phase: 01 — Self-host + link history + board v1
appetite: 3d
burn: 1.4d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 3 · arc-design) CLOSED 2026-07-30: `docs/archive/PROGRESS-2026-07-30.md`.
> Note: this tracker migrates itself to `initiatives/portfolio/` in Phase 1 (REQ-02) —
> pointer stubs will remain at the root paths.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Dual-mode machinery (steel thread): root goldens, resolver on 7 surfaces, creation/STOP/echo/adversarial fixtures | 1.25 days | ✅ done 2026-07-31 |
| 01 | Self-host + link history + board v1 (rehearsed rollback; close in lane-mode) | 0.75 days | ⬜ pending |
| 02 | Parallel-safety floor: WIP info line, board lint, ownership lint, spine spool | 0.75 days | ⬜ pending |
| 03 | Docs truth + retro | 0.25 days | ⬜ pending |

**Appetite burn:** ~1.4 of 3 days used. Kill tripwire (1.5 days with Phase 0 not closed)
**retired** — Phase 0 closed 2026-07-31 at ~1.4d, inside it. **But the remaining arithmetic
does not work and is not being hidden:** 1.6 days remain against 1.75 days of planned phases
(01: 0.75 · 02: 0.75 · 03: 0.25). The plan has been 100%-allocated with zero slack since
kickoff — that is the standing `[appetite-sum]` WARN, now load-bearing rather than
theoretical. Phase 01 opens ~0.15d in deficit; the pre-decided scope-cut ladder (defer
REQ-04 + Mode-B certification, ship the Mode-A core) is the lever, and the decision belongs
to the owner at Phase 01's close, not to a silent overrun.

## Done log

- 2026-07-30 — Kickoff: Cycle 3 archived (`docs/archive/PLAN-2026-07-30.md` +
  `PROGRESS-2026-07-30.md` + `phases-design-2026-07-30/`); PLAN.md written from the
  frozen pack `docs/strategy/plans/PLAN-portfolio.md`; ADR-0050..0059 recorded
  (PORT-A…J); 4 phase specs; kickoff-lint green; spine receipts emitted
  (kickoff.done + approval.requested). Question-planner returned zero open forks —
  all §15 items owner-closed 2026-07-29. Attack panel: merged A+C run reconciled
  into PLAN mutations.

- 2026-07-31 — **Phase 00 CLOSED.** Dual-mode machinery shipped: `lane-resolve.sh` +
  `lane-resolve.mjs` twins held byte-identical by an equivalence gate, seven surfaces routed,
  kickoff-only creation, unknown-lane hard STOP, canonical output order, root-mode goldens
  pinned before any edit and byte-identical after. **569 tests green on 3 OS** (arc-ci
  30627445144, 19/19 jobs), declared == executed on all 18 legs. Three adversarial rounds:
  18 findings on the resolver (4 HIGH, all one root — an unquoted `$lane_args` that let a
  crafted `--lane` smuggle `--for kickoff` or redirect a bundle into the frozen path), 2
  cross-OS defects found by CI itself, 1 hole in the ADR-0060 refusal written during this
  close. Every one reproduced against its own breaking input before and after.
  actual ~1.4d vs 1.25d appetite (+0.15d) · amendments: 2 · reopened: n · t-to-phase0: 1 day
  · evidence: `docs/evidence/cycle-04-portfolio/phase-00/` (verified, 7 artifacts)

  Three things this phase taught, all the same shape — **a gate that reports on itself
  rather than on the thing**: the equivalence helper that ran one twin while claiming both;
  `verify` hashing what it wrote instead of what was in the bundle; and bats reporting a
  dropped test as a comment among 91 `ok` lines. None was found by review. Each was found by
  making the gate fail on purpose, which is now the standing rule for every gate added here.

## Now

**Position:** Phase 01 IN PROGRESS on `feat/phase-01-self-host`. **The move has landed** —
you are reading this file at `initiatives/portfolio/PROGRESS.md`; the repo is in lane-mode
and auto-resolves to `portfolio`. Built so far: the mover (`tracker-migrate.sh`, in no
product manifest — a venture repo has nothing to migrate), A5's casing half closed by
fixture, the rehearsed rollback, the real move as one commit, the design lane (links only),
`PORTFOLIO.md` v1, and the SessionStart degraded rule. **Not yet done:** CI green on 3 OS,
the evidence bundle, and `/arc-phase-done 1` in lane-mode.

**The rollback rehearsal, performed 2026-07-31 before the real move** (from `1e33ae8`, the
exact parent of the move commit — nothing landed in between): move applied and committed in
a disposable worktree → lane-mode proven → `git revert` executed → root-mode restored and
compared to the pre-move baseline **byte-for-byte** (resolver output and kickoff-lint output
both identical), root-golden 7/7, `git diff 1e33ae8..HEAD` empty, zero emitters, worktree
removed. Reverting the single move commit puts the repo back in root-mode; that is a
recorded result, not a promise.

**A5's untested half is closed.** The casing fixture pins the MOVER half (Phase 00 pinned
the resolver half): a target lane that folds onto an existing directory of different case is
refused on every leg — refusing is the only outcome that is identical on three legs, since
succeeding depends on the filesystem underneath. Three further holes were found by building
breaking inputs, none by reading the code: `--lane a --lane b` collapsing to last-wins, a
`--root` outside a work tree passing every precondition because `git status` writes an empty
stdout on failure, and `[ -e phases ]` answering TRUE on a folding checkout whose index says
`Phases/`. All three fixed and pinned by the input that found them.

**Two decisions waiting on the owner:**

- **The `develop` board row.** The source pack illustrates board v1 with `develop QUEUED`,
  and the same section rules that every initiatives row resolves to an `initiatives/<lane>/`
  directory while lanes are born only at `/arc-kickoff`. Both cannot hold for a lane that
  does not exist. v1 ships without the row (the only reading that breaks no rule); settle it
  via `/arc-change` before Phase 02 writes the lint that would flag it.
- **The appetite deficit.** 1.6 days remained against 1.75 days of planned phases at Phase
  01's open. The scope-cut ladder (defer REQ-04 + Mode-B certification, ship the Mode-A core)
  is pre-decided; the call belongs at this phase's close, not to a silent overrun.

**Deviation taken, flag for ratification:** `initiatives/design/PROGRESS.md` was created
alongside the HISTORY-INDEX. ADR-0058 specifies "folder + HISTORY-INDEX.md" only, but
ADR-0051 rules that every board value derives from a lane's machine header — a `design` row
with no header to derive from would be the hand-written second truth that ADR forbids. The
file holds a header and a pointer, no copied history.

**Carried forward, deliberately not fixed (same bug class as Phase 00's, out of scope):**
the `_slug` pair (`design-critique.sh:42`, `design-render.sh:71`) slugs the same route
differently per box under UTF-8, and the slug is an artifact filename — renaming existing
artifacts needs a decision, not a quiet fix. `shard-tests.mjs:77`'s `localeCompare` tiebreak
claims a byte determinism it does not provide (no divergence today, checked across 13
collations). Both are held by `tests/portability.bats`'s allowlist, with a companion test
that fails if an entry stops matching — neither can rot into a gate that lies.

**Next step:** push `feat/phase-01-self-host` and read CI. From 2026-07-31 there are **no
local test runs at all** (owner's standing rule, all phases) — CI is the only gate, so the
3-OS claims this phase makes are unproven until that run is green. Then: evidence bundle
(dry-run + rehearsal transcripts, move commit hash, board v1, casing fixture on all three
legs) at `initiatives/portfolio/evidence/phase-01/`, then `/arc-phase-done 1` executed in
lane-mode.

blocked-on: —
depends-on: —

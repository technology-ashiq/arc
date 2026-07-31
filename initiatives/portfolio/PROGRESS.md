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

**Position:** Phase 00 CLOSED 2026-07-31 (see done log). Phase 01 is next and has not
started. Root layout still in place — this cycle's tracker migrates itself into
`initiatives/portfolio/` as Phase 01's first act, so every command below still runs
root-mode until that lands.

**What Phase 01 must not inherit:**

- **A5's untested half.** A5 fired on locale, not on `git mv` casing — the half Phase 01's
  physical move actually rests on. Its exit criteria now carry a casing fixture: a case-only
  rename of a lane directory must behave identically on all three legs, asserted against
  git's own record rather than a path string, because the failure being guarded is the
  silent one — a case-folding filesystem can no-op a rename while reporting success.
- **The appetite deficit.** 1.6 days remain against 1.75 days of planned phases. Phase 01
  opens ~0.15d short; the scope-cut ladder is pre-decided and the call is the owner's.

**Carried forward, deliberately not fixed (same bug class as Phase 00's, out of scope):**
the `_slug` pair (`design-critique.sh:42`, `design-render.sh:71`) slugs the same route
differently per box under UTF-8, and the slug is an artifact filename — renaming existing
artifacts needs a decision, not a quiet fix. `shard-tests.mjs:77`'s `localeCompare` tiebreak
claims a byte determinism it does not provide (no divergence today, checked across 13
collations). Both are held by `tests/portability.bats`'s allowlist, with a companion test
that fails if an entry stops matching — neither can rot into a gate that lies.

**Next step:** `/arc-kickoff` is not needed; Phase 01 starts from its spec. First move is
the rollback rehearsal in a disposable scratch worktree, BEFORE the real move — and it must
be re-run if any commit lands on the branch after it, because a rehearsal against a stale
HEAD is not evidence.

blocked-on: —
depends-on: —

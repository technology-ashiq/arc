# PROGRESS.md — Cycle 4 · arc-portfolio "The Conductor"

status: LIVE
cycle: arc-portfolio
phase: 02 — Parallel-safety floor
appetite: 3d
burn: 1.9d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 3 · arc-design) CLOSED 2026-07-30: `docs/archive/PROGRESS-2026-07-30.md`.
> This tracker migrated itself here in Phase 01 (REQ-02, commit `dcc7f7d`); pointer stubs
> remain at the old root paths, and evidence is lane-scoped from Phase 01 forward.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Dual-mode machinery (steel thread): root goldens, resolver on 7 surfaces, creation/STOP/echo/adversarial fixtures | 1.25 days | ✅ done 2026-07-31 |
| 01 | Self-host + link history + board v1 (rehearsed rollback; close in lane-mode) | 0.75 days | ✅ done 2026-07-31 |
| 02 | Parallel-safety floor: WIP info line, board lint, ownership lint, spine spool | 0.75 days | ⬜ pending |
| 03 | Docs truth + retro | 0.25 days | ⬜ pending |

**Appetite burn:** ~1.9 of 3 days used (63%). Phase 01 came in **under** appetite — ~0.5d
against 0.75d — and that closed the deficit rather than deepening it: 1.1 days now remain
against 1.0 day of planned phases (02: 0.75 · 03: 0.25), a ~0.1d surplus where Phase 01
opened ~0.15d short. The scope-cut ladder (defer REQ-04 + Mode-B certification, ship the
Mode-A core) is therefore **not** triggered and stays banked for Phase 02's own tripwire
(burn reaching 1.0d inside Phase 02).

Both kill checks, stated rather than assumed: the 50%-of-appetite rule forces the scope-cut
conversation only when the **tripwire phase** is not done — Phase 0 closed 2026-07-31, so
63% burnt does not trip it. The standing `[appetite-sum]` WARN (100% allocated, zero slack)
is unchanged and still load-bearing; a surplus of 0.1d is not slack, it is one bad afternoon.

Basis for the 0.5d, so it can be audited rather than believed: Phase 00 closed at 19:05 and
Phase 01's last build commit landed at 21:25 the same day, with the close itself running
after — roughly four hours of continuous work, against a "day" that Phase 00's 1.4d over two
calendar days puts at about a working day.

## Done log

- 2026-07-31 — **Phase 01 CLOSED.** arc self-hosts: the tracker moved into
  `initiatives/portfolio/` as ONE commit (`dcc7f7d`), pointer stubs at the old root paths,
  the ADR-0051 machine header written at birth by the same flow that moved the file.
  `PORTFOLIO.md` v1 born with both tables; `initiatives/design/` given its lane by
  HISTORY-INDEX links only (ADR-0058, zero files copied); SessionStart taught the degraded
  rule. **621 tests green on 3 OS** (arc-ci 30648403346, 19/19 jobs), `declared == executed`
  on every leg. This close ran in lane-mode, which was itself an exit criterion.
  actual ~0.5d vs 0.75d appetite (−0.25d) · amendments: 1 · reopened: n
  · evidence: `initiatives/portfolio/evidence/phase-01/` (verified, 4 artifacts)

  **A5's untested half is closed.** It fired on locale collation and left `git mv` casing —
  its original subject, and the thing this phase's move actually rested on — unproven. The
  casing fixture now executed on ubuntu, macOS and windows-git-bash: two case-folding
  filesystems and one case-sensitive, same outcome, refusal. Refusing is the only result
  that is identical on three legs; succeeding would depend on the filesystem underneath.

  The rollback was **rehearsed before it was performed**, from `1e33ae8` — the exact parent
  of the move commit, so not against a stale HEAD. Revert executed for real; root-mode came
  back byte-for-byte against a pre-move baseline, `git diff` empty, zero emitters.

  Four holes found by building breaking inputs, none by reading code: a case-fold collision
  that would have put the tracker where the resolver cannot see it; `--lane a --lane b`
  collapsing to last-wins so the resolver never saw a duplicate; a `--root` outside a work
  tree passing every precondition because `git status` fails with an empty stdout that reads
  as "clean"; and `[ -e phases ]` answering TRUE on a folding checkout whose index says
  `Phases/`. Each pinned by the input that found it.

  Two mistakes worth keeping, both mine and both caught by gates this repo already had.
  `product-lint` refused the mover because everything under `.claude/` is the shipped
  surface — I had grepped that lint for "orphan/unmanifest" and concluded no such rule
  existed; its word is "unmapped". And six `@test` names carried a U+2014, so windows shard
  10/12 reported `declared 93, executed 87`: six tests that existed, were counted, and never
  ran — the 2026-07-30 em-dash incident, reproduced in the cycle whose previous phase fixed
  it. The ASCII guard and the executed-vs-declared reconciliation both did exactly their job.

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

**Position:** Phase 01 CLOSED 2026-07-31 (see done log). **Phase 02 — Parallel-safety
floor** is next and has not started. The repo is in lane-mode: this file is the operational
truth, `PORTFOLIO.md` indexes it, and every command auto-resolves to `portfolio` because it
is the only eligible lane.

**Phase 02 opens with its Verification plan still COARSE.** The spec says so itself, and
`/arc-phase-done` refuses to close a phase whose plan was never refined — so refining it via
`/arc-change` is the phase's first act, before any code. It needs to name, concretely: how a
concurrent-emit fixture proves zero interleaving on 3 OS, what the spool-drain and
spool-visibility fixtures assert, and what Expected/Found/Example looks like for each new
WARN class.

**What Phase 02 must not inherit:**

- **Two unratified deviations from Phase 01.** (1) `PORTFOLIO.md` v1 ships with no `develop`
  row: the source pack illustrates one, while the same section rules that every initiatives
  row resolves to an `initiatives/<lane>/` directory and that lanes are born only at
  `/arc-kickoff` — both cannot hold for a lane that does not exist. (2)
  `initiatives/design/PROGRESS.md` exists, which ADR-0058 does not ask for, because ADR-0051
  requires every board value to derive from a lane's machine header. **Phase 02 writes the
  board lint that will judge exactly these two things**, so route both through `/arc-change`
  BEFORE that lint is designed, not after it flags the repo's own board.
- **A surplus that is not slack.** 1.1d remain against 1.0d planned. Phase 02's own tripwire
  (burn reaching 1.0d inside it → ship the Mode-A core, defer REQ-04 + Mode-B certification)
  is unchanged and pre-decided.
- **A5 is fully closed** — locale half in Phase 00 (#71), casing half here, executed on all
  three legs. Nothing carries forward. A3 and A4 are Phase 02's to test.

**Carried forward, deliberately not fixed (same bug class as Phase 00's, out of scope):**
the `_slug` pair (`design-critique.sh:42`, `design-render.sh:71`) slugs the same route
differently per box under UTF-8, and the slug is an artifact filename — renaming existing
artifacts needs a decision, not a quiet fix. `shard-tests.mjs:77`'s `localeCompare` tiebreak
claims a byte determinism it does not provide (no divergence today, checked across 13
collations). Both are held by `tests/portability.bats`'s allowlist, with a companion test
that fails if an entry stops matching — neither can rot into a gate that lies.

**New this phase, and worth remembering:** `tests/portability.bats` now scans
`.github/scripts` too. Moving a file out of `.claude/` to keep it off the shipped surface
must not also move it out of the bash-3.2/BSD ratchet — it still runs on all three legs.

**Next step:** merge PR #79 (CI green at `399f25e`, 19/19), then `/arc-change` to refine
Phase 02's verification plan. No local test runs at any point — CI is the only gate
(owner's standing rule, 2026-07-31).

blocked-on: —
depends-on: —

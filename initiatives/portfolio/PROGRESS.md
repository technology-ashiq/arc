# PROGRESS.md — Cycle 4 · arc-portfolio "The Conductor"

status: LIVE
cycle: arc-portfolio
phase: 03 — Docs truth + retro
appetite: 3d
burn: 3.0d
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
| 02 | Parallel-safety floor: WIP info line, board lint, ownership lint, ~~spine spool~~ (reverted) | 0.75 days | ✅ done 2026-08-01 |
| 03 | Docs truth + retro | 0.25 days | ⬜ pending |

**Appetite burn:** ~3.0 of 3 days used (100%). Phase 02 ran ~1.1d against a 0.75d appetite
— **over by ~0.35d, and its own tripwire fired.**

Basis, so it can be audited rather than believed: section A's commit landed 02:26 and the
close landed 21:27 on 2026-08-01, but that window is not continuous — there is a 12-hour gap
between A and the 14:27 B+D merge. The work is section A (~1–1.5h, its own sitting) plus one
unbroken 14:27→21:27 run of seven hours covering B/D, C, E, F, G, the RI-1 routing, the
adversarial pass, the lock fix, the F revert and this close. Against Phase 01's established
unit (~4h ≈ 0.5d, so a "day" ≈ 8h of work), that is ~1.0–1.1d.

**Phase 02's tripwire was "burn reaching 1.0d inside Phase 02 → ship the Mode-A core, defer
REQ-04 + Mode-B certification". It fired, and the outcome matches it** — arrived at from the
other direction. REQ-04 is deferred (section F reverted) and Mode-B certification is
withdrawn. The pre-decided cut and the cut the evidence forced turned out to be the same
one; it was not applied because the tripwire was read, which is worth being honest about.

**The cycle is now at 100% of appetite with Phase 03 (0.25d) still to run.** There is no
slack left to spend — the standing `[appetite-sum]` WARN said this was one bad afternoon
away, and this was that afternoon. Phase 03 will run over unless it is cut, and it now
carries two retro inputs it cannot absorb at 0.25d. **That is the owner's call at Phase 03
kickoff, not a decision this close gets to make.**

Basis for **Phase 01's** 0.5d, which is the unit the paragraph above measures against: Phase
00 closed at 19:05 and Phase 01's last build commit landed at 21:25 the same day, with the
close itself running after — roughly four hours of continuous work, against a "day" that
Phase 00's 1.4d over two calendar days puts at about a working day.

## Done log

- 2026-08-01 — **Phase 02 CLOSED.** Six of seven sections shipped: the WARN-shape assertion
  helper (#82), the two-table board lint and the manifest-derived ownership lint (#83), the
  WIP info line that cannot refuse (#84), zero interleaving proven on 3 OS against a control
  that must tear (#85), and Mode B's certification (#87) — **since withdrawn, see below**.
  Section **F**, the `_pending/` spool, shipped (#86) and was **reverted** (#89).
  **762 tests green on 3 OS** (arc-ci 30705654140, 19/19 jobs), `declared == executed` on
  every leg.
  actual ~1.1d vs 0.75d appetite (**+0.35d, tripwire fired**) · amendments: 4 · reopened: y
  · evidence: `initiatives/portfolio/evidence/phase-02/` (verified, 2 artifacts)

  **The close refused the first time, and that is the phase's real story.** The Definition
  of Done names "the adversarial pass in B run and its findings pinned". It had never run —
  not for B, not for D, not for F; only section A carried one. `docs/retro-log.md:10` has
  required it since 2026-07-16 for any hand-authored gate, lint or parser. Six passes were
  run: **61 findings, 9 verified by hand**, nothing rejected on verification. Full record in
  the evidence bundle.

  **One fix shipped, because it put wrong data on an immutable artifact.** `LOCK_STALE_MS`
  (5000) is smaller than `STRICT_LOCK_TIMEOUT_MS` (15000), and `withLock` re-reads its token
  once at acquire and never again during `fn()` — so a strict waiter outlived the stale
  threshold and deleted the lock of a holder that was alive and mid-write. Two writers in one
  critical section is how duplicate receipts reach an append-only spine with both processes
  exiting 0. Reproduced at production defaults, fixed to `max(stale, own timeout)`, pinned by
  a fixture verified in **both** directions.

  **Section F was reverted rather than repaired.** Three of the nine verified findings are
  defects in it: `ts` never re-validated, so a receipt lands in a day file `listDays()`
  filters out — on disk, invisible, lost, while the drain reports success; `ts` used as a
  path component, so `"../../../pwn"` wrote three directories above the spine root; and the
  drain skipping the secret scan, an ADR-0028 bypass. The drain is also what made the lock
  bug reachable in ordinary operation — it put an unbounded `O(pending × idem-index)` body
  inside a critical section that had held a single append.

  **Mode B's certification is withdrawn**, three hours after it was granted. ADR-0056 makes
  certification a fixture result and REQ-04's fixtures include F's, which no longer exist.
  The certifying run was also green on a spine that still had the duplicate-writer bug.
  Section G's own sentence — "a fixture result, not a judgement call" — is what withdrawing
  it honours.

  **Two mistakes of mine worth keeping.** I shipped section F the same day I wrote it, with
  9 fixtures green on three OS, and it had three data-loss defects; the fixtures tested the
  inputs I had thought of. And I let five sections merge without the pass the DoD names,
  which nothing caught until the close — a rule only a phase close can enforce gets skipped
  for a whole phase. Both are RI-2's questions now.

  **What did NOT ship:** the spool gap is open again (hook timeouts land in `_quarantine/`
  beside malformed payloads), B's 24 board-lint findings are unfixed, and five findings are
  live in shipped `ownership-lint.sh`. All routed to RI-1/RI-2, none silently.

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

**Position:** Phase 02 CLOSED 2026-08-01 (see done log). **Phase 03 — Docs truth + retro is
OPEN as of 2026-08-01**: the shape question the close refused to answer has been answered by
the owner — **run it as specified**, 0.25d, docs + retro, no code, RI-1/RI-2 triaged **by**
the retro into the next cycle — and its coarse Verification plan has been refined into
checkable items (`/arc-change`, branch `feat/phase-03-refine-verification`). The appetite
position is unchanged and stated rather than softened: the cycle is at **100% of its 3d
appetite**, so Phase 03's 0.25d runs **over** it by construction, landing the cycle at
~3.25d (~8% over). No kill criterion fires on that — the 50% tripwire was Phase-0-scoped and
Phase 02's ladder already executed at its close — but nothing about this is free, and the
overrun is a number to carry into the retro, not a rounding error.

**The three things Phase 02 did NOT close, stated here so `/arc-resume` cannot lose them:**

1. **The spool gap is open again.** A hook-mode lock timeout lands in `events/_quarantine/`
   beside malformed payloads — "your event was invalid" and "the machine was busy" share a
   destination, which is the gap section F was written to close and its revert reopened.
2. **`board-lint.sh` has 24 reported defects**, four of them silently-wrong verdicts, and it
   passes its own 41 fixtures. It is a hand-written strict-grammar markdown parser, which is
   the exact bug class PLAN risk 3 names.
3. **Five findings are live in shipped `ownership-lint.sh`**: a `--base` typo silently
   disables it; `--lane a --lane b` is last-wins and the verdict inverts with flag order; a
   trailing `--lane` with an empty value makes it auto-resolve and judge a lane nobody named;
   `git mv` out of another lane is invisible; any non-ASCII filename is invisible. The middle
   two are failures `.claude/rules/lanes.md` describes **by name** as past incidents.

All three are routed — RI-1 and RI-2 in `phases/phase-03-spec.md`, with the full evidence at
`evidence/phase-02/adversarial-report.md` (61 findings: 9 verified by hand, 52 still
carrying an agent's verdict rather than a confirmed one).

**Mode B is NOT certified.** It was, for three hours, and the certification was withdrawn at
this close: ADR-0056 makes it a fixture result, REQ-04's fixtures include section F's, and F
was reverted. The certifying run was also green on a spine that still carried the
duplicate-writer bug. The board says so, with the reason next to it.

**Phase 03's shape: decided 2026-08-01, owner.** ~~Three options.~~ **Run it as specified** —
0.25d, docs + retro, no code — and let the retro triage RI-1/RI-2 into the next cycle. The
two rejected options are kept as the record of what was traded away: widening Phase 03 to fix
the five live `ownership-lint` findings (overruns 3d outright), and cutting the docs scope to
spend the 0.25d on those findings instead (takes the docs debt into the next cycle). What
this choice costs, stated plainly: **the three open items stay live in the tree for however
long the next cycle takes to start**, and five of them are wrong answers a shipped gate will
keep giving in the meantime.

**Two things the refine found, which are the reason the coarse plan could not just be
executed:**

1. **The coarse criterion had gone stale against a decision taken mid-cycle.** It asked the
   board to show "develop kickoff as the queued next"; [ADR-0061](../../docs/adr/0061-board-indexes-born-lanes-only.md)
   (accepted 2026-08-01, after the spec was written) holds a board row iff the lane
   directory exists, and **rejected the `Queued next:` fact line for v1** in the same
   breath. Executed as written it would have made Phase 03 violate a mid-cycle ADR, and
   Phase 02's own board lint would have flagged arc's board. Corrected in the spec's section
   E; the fact moves to the HISTORY entry, where no grammar has to parse it.
2. **A docs-only phase can turn CI red six ways.** `tests/fixtures/sync-golden/tree-manifest.txt`
   stores a sha256 per synced file, and **two of the seven doc targets are in it** —
   `docs/usermanual.md` and `docs/templates/adr-template.md`. Editing either fails both
   golden tests (rsync + cp-r) on all three legs. With no local runs, CI is the first sight
   of it. The golden must be regenerated **in the same commit** as the edit — spec section
   B2 carries the recipe and the check that the manifest moved exactly two rows.

**Next step:** land this refine, then build the phase in spec order — **A** the seven doc
surfaces (regenerating the sync golden with A4 and A6) → **B** drift gate 0 findings +
ledger stamp → **C/D** `/arc-retro`, which appends the HISTORY entry and records verdicts for
RI-1, RI-2 and A4 → **E** flip `status: IDLE` and show the real zero-eligible resolver
output → `/arc-phase-done 3`. **After E the repo has no eligible lane** (portfolio IDLE,
design IDLE), so every no-arg lane surface exits 3 and asks: `--lane portfolio` becomes
required for ordinary work. That path is pinned by `tests/lane-resolver.bats:97`, but this
phase is the first time the real repo enters it. No local test runs — CI is the only gate.

**Assumptions status:** A3 (advisory lock + spool covers concurrency) is **not** marked
FIRED but is now materially weaker: its trigger was widened to cover refused receipts, the
lock half was found broken at production defaults and fixed, and the spool half no longer
exists to cover anything. A4 (advisory-only WIP is enough) still cannot fire — it needs
counted lanes above 2 and this repo counts 1. A5 is closed and carries nothing.

**The one methodological finding, which outlives every item above.** All nine verified
findings came from RUNNING the artifact; none came from reading it. The code had been read
carefully — sections B, D and F each ship with long comments explaining why they are
correct, and several of those comments are the exact claims the pass falsified. `retro-log`
already said this on 2026-07-16: *"code that looked correct and passed its own fixtures"*.
This phase shipped three gates without the mandated pass and rediscovered it.

blocked-on: —
depends-on: —

# PROGRESS.md — Cycle 4 · arc-portfolio "The Conductor"

status: IDLE
cycle: arc-portfolio (Cycle 4, closed 2026-08-02)
phase: — (no live cycle)
appetite: 3d
burn: 3.35d
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
| 03 | Docs truth + retro | 0.25 days | ✅ done 2026-08-02 |

**Appetite burn: ~3.35 of 3 days used (~112%) — CYCLE CLOSED OVER APPETITE.** Phase 02 ran
~1.1d against 0.75d (**over by ~0.35d, its own tripwire fired**) and Phase 03 ran ~0.35d
against 0.25d. Phase 02 is where the cycle went over; Phase 03 only failed to claw it back.

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

**The cycle finished over, and the warning that predicted it had been firing all along.**
The standing `[appetite-sum]` WARN said 100% allocation was one bad afternoon away from an
overrun; Phase 02 was that afternoon, and with no slack to absorb 0.35d the whole cycle went
past its appetite. The owner chose at Phase 03 to run it as specified rather than cut it or
widen it, accepting the ~0.1d overrun on top rather than taking docs debt into Cycle 5.

Basis for **Phase 03's** ~0.35d: Phase 02's close landed 22:37 on 2026-08-01 and this close
ran to ~01:15 on 2026-08-02 — one unbroken ~2.6h sitting covering the `/arc-change` refine,
the seven doc surfaces, the golden regeneration, the retro and the close. Against the same
unit the paragraph above uses (~4h ≈ 0.5d), that is ~0.3–0.35d against a 0.25d appetite.

Basis for **Phase 01's** 0.5d, which is the unit the paragraph above measures against: Phase
00 closed at 19:05 and Phase 01's last build commit landed at 21:25 the same day, with the
close itself running after — roughly four hours of continuous work, against a "day" that
Phase 00's 1.4d over two calendar days puts at about a working day.

## Done log

- 2026-08-02 — **Phase 03 CLOSED. Cycle 4 is closed with it.** The per-lane One Rule now
  reads the same in the five documents that teach arc: `how-arc-works-simple` §1/§3/§8, the
  usermanual's new §9a (its own Tanglish register, inserted not renumbered so no
  cross-reference breaks), the plans ritual, the ADR template's `Product:` field, and
  `CLAUDE.md`'s command lines. Docs-drift 0 findings, ledger stamped.
  actual ~0.35d vs 0.25d appetite (+0.1d) · amendments: 1 · reopened: n
  · evidence: `initiatives/portfolio/evidence/phase-03/`

  **The close turned CI red, and the two tests it broke were measuring the calendar.**
  `tests/portfolio-board.bats` pinned "this tree auto-resolves to portfolio, counted == 1"
  and "the portfolio machine header says `status: LIVE`". Both were true only while exactly
  one lane was live; flipping `portfolio` to IDLE falsified them on 5 of 19 legs. Neither the
  resolver nor the board was wrong — the tests asserted a snapshot of the cycle rather than
  the rule, so they had to be re-edited every time a cycle opens or closes, and nobody would
  have noticed until it cost a CI run. They now assert the rule: mode is always `lane` here,
  and resolution branches on the live count (1 → auto-resolve; 0 or 2+ → exit 3 and ask), with
  a second test pinning that explicit `--lane portfolio` resolves whatever the cycle state.
  The header test now accepts the whole `LIVE|BLOCKED|QUEUED|IDLE` vocabulary instead of one
  value. This is a code change inside a phase that declared none, taken for the same reason as
  the doc repairs: this phase's own close broke them, and a phase cannot close on red CI.

  **B2's trap fired exactly as the spec predicted it would, which is the point.**
  `usermanual.md` and `adr-template.md` are content-hashed in the sync golden, so editing
  them without regenerating it fails both golden tests on all three legs — six red legs from
  a phase containing no code, and with no local runs CI would have been the first sight of
  it. The regeneration method was proved on a control first: rebuilding the manifest from the
  UNEDITED repo reproduces the committed golden byte for byte, so a wrong method could not
  have passed unnoticed. Exactly two rows moved. A trap named in advance cost minutes; the
  same trap unnamed cost this repo ten commits in Cycle 1 (`retro-log` 2026-07-22).

  **Rewriting three sections left the file contradicting itself, and no writer could see
  it.** §5 still routed phase-done evidence to `docs/evidence/` — the path §3 now marks
  frozen — and still said phases "always live at root `phases/`", a flat negation of the new
  §8 rule 2; §2 and §7 still taught the root-only law; `usermanual.md:111` still put the
  tracker at the root behind a cross-reference pointing at the wrong section. All of it was
  caught by three independent read-back agents and confirmed by hand before any fix. Six
  line-level repairs beyond the sections REQ-05 names, taken deliberately: the Rabbit hole
  forbids *rewriting* docs beyond those sections, and these are corrections to contradictions
  this phase's own edits created. A docs-truth phase that ships a self-contradicting
  orientation page has failed its own goal. Recorded, not done quietly.

  **`docs/HISTORY.md` was missing Cycle 3 entirely** — closed 2026-07-30 with a retro stat
  line and an archive bundle but no entry, the exact wiring gap the page's own ⚠ TODO names.
  Back-filled here from its verbatim stat line rather than left as a hole, because the same
  commit that declares HISTORY the truth hierarchy's immutable company log cannot also leave
  a cycle missing from it. Same class as RI-1: a stated artifact that nothing asserts exists.

  **The three verdicts section D required, decided under the owner's 2026-08-02 delegation
  ("complete the phase, don't wait for me") and reversible at Cycle 5's kickoff:**

  - **RI-1 — ACCEPTED, deferred to Cycle 5 as its first build item.** A tenth board-lint
    class asserting the execution-mode section exists and its Mode B line matches one of two
    known grammars. Accepted because the failure it addresses already happened and lasted two
    phases; deferred because it is a code change and Phase 03 forbids those, and because the
    WARN registry is pinned at nine with `tests/warn-shape.bats` asserting them by name, so a
    tenth needs the registry, the class-obligation guard and its own fixtures. The
    generalisable question it raised — *which other ADR-mandated artifacts have no gate
    asserting they exist?* — is the more valuable half and goes to Cycle 5's kickoff as a
    pre-mortem input, not as a lint.
  - **RI-2 — SPLIT, and only one half is urgent.** The 5 findings live in shipped
    `ownership-lint.sh` are Cycle 5's first fix, ahead of RI-1: a `--base` typo silently
    disables the lint, `--lane a --lane b` inverts its verdict with flag order, and a
    trailing empty `--lane` makes it judge a lane nobody named — a gate giving confidently
    wrong answers is worse than no gate, and two of these are failures `lanes.md` describes
    by name as past incidents. The 52 unconfirmed findings are NOT accepted as work: each
    needs its reproduction re-run before it is believed, and re-verifying 52 agent verdicts
    is its own sized piece of work, not a tail on a fix. `board-lint.sh`'s shape question —
    24 reported defects in a hand-written strict-grammar markdown parser, the exact class
    PLAN risk 3 names and the council found 43 holes in twice — is a **design question for
    Cycle 5's kickoff**, not a bug list to grind through. The spool gap stays open and stays
    known: a hook-mode timeout still lands in `_quarantine/` beside malformed payloads.
  - **A4 — NOT FIRED, and it still cannot fire.** Its trigger needs counted lanes above 2 or
    two consecutive weeks with both counted lanes owner-blocked; this repo counted 1 for the
    whole cycle. Recorded explicitly because the ledger names *the retro* as A4's test venue
    and this was the cycle's last retro — an assumption whose only test venue passes without
    examining it is an assumption that expires unnoticed. It carries into Cycle 5 untested,
    which is a fact about the evidence, not a verdict about the assumption.
  - **A3 — not FIRED, and materially weaker than when written.** Its trigger was widened to
    cover refused receipts, its lock half was found broken at production defaults and fixed,
    and its spool half no longer exists to cover anything. What it still claims has shrunk.

  **The one finding that outlives the rest, and it is a repeat.** Every real defect this
  cycle surfaced came from RUNNING an artifact, never from reading one: `EPERM` on the
  Windows lock, a negative control that had passed six legs by luck, a mandated board note
  that was never written, and this phase's own self-contradicting doc. `retro-log` has said
  this since 2026-07-16 — *"code that looked correct and passed its own fixtures"* — and
  Phase 02 shipped three gates without the mandated adversarial pass anyway. The new
  prevention logged today is narrower and therefore more likely to hold: bind the adversarial
  pass to the section that ships a gate, not to the phase close that comes after all of them.

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

**Position: Cycle 4 · arc-portfolio is CLOSED (2026-08-02).** All four phases done, the lane
is `IDLE`, and there is no live plan in this repo. `PORTFOLIO.md` derives that from the
machine header above. Nothing is in flight; nothing is blocked.

**Read this before running anything: the repo now has ZERO eligible lanes.** `portfolio` is
IDLE and `design` is IDLE, and only LIVE or BLOCKED counts as eligible. Every no-arg
lane-aware surface — `/arc-resume`, `/arc-change`, `/arc-phase-done`, `/arc-retro` — will
therefore **exit 3 and ask**, printing "Lane not specified and no lane is eligible (LIVE or
BLOCKED)" with the known lanes. This is designed behaviour, not breakage: the resolver has a
dedicated message for it and `tests/lane-resolver.bats:97` pins it. **Until a new cycle
starts, pass `--lane portfolio` explicitly.** The real output is captured in this phase's
evidence bundle — Phase 03 is the first time the repo actually entered this state, so it was
demonstrated rather than cited.

**What Cycle 5 inherits, in the order the retro put it:**

1. **The 5 findings live in shipped `ownership-lint.sh`** — first fix, ahead of everything
   else. A gate that gives confidently wrong answers is worse than no gate.
2. **RI-1's tenth board-lint class** — accepted, needs the registry, the class-obligation
   guard and its own fixtures.
3. **The spool gap, still open** — a hook-mode lock timeout still lands in `_quarantine/`
   beside malformed payloads. Whatever replaces section F must run the same
   validate → scan → seal path the front door runs.
4. **Two questions for kickoff, not bug rows:** is a hand-written strict-grammar markdown
   parser the wrong shape for `board-lint.sh` (24 reported defects, the class PLAN risk 3
   names)? And which other ADR-mandated artifacts have no gate asserting they exist?
5. **52 adversarial findings still carrying an agent's verdict** rather than a confirmed
   one. Re-verification is its own sized piece of work, not a tail on a fix.

**Mode B is NOT certified.** It was for three hours on 2026-08-01; the certification was
withdrawn when section F was reverted, because ADR-0056 makes it a fixture result. Concurrent
emitters stay forbidden. The board says so with the reason next to it.

**Assumptions at close:** A1, A2 validated in Phase 00. A3 not FIRED but materially weaker —
lock half fixed, spool half gone. A4 not FIRED and **still untested**: its trigger needs
counted lanes above 2 and this repo counted 1 all cycle, so the retro that was supposed to
test it could only record that it could not. A5 closed, carries nothing.

**Next:** `/arc-kickoff --lane <name>` when the owner starts Cycle 5. The plan pack's queue is
`docs/strategy/plans/README.md`. `develop` — the first native lane, and the dogfood tripwire
for real parallel validation — is the standing candidate, deliberately not written onto the
board: ADR-0061 holds a row only for a lane that exists, and this fact lives in the HISTORY
entry instead, where no grammar has to parse it.

blocked-on: —
depends-on: —

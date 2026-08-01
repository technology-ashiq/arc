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
floor is IN PROGRESS**, and **section F is REVERTED**: **A** the shared WARN-shape
assertion helper (#82) · **B** the board lint and **D** the ownership lint (#83) · **C** the
WIP info line (#84) · **E** zero interleaving on 3 OS (#85) · ~~**F** the `_pending/`
spool~~ (#86, **reverted on this branch — see below**) · **G** Mode B certification (#87).
This branch also carries the **adversarial pass that should have run before any of them**,
and the one fix it produced. After it merges the only thing left is `/arc-phase-done 2`.
The phase row stays ⬜ until then — sections merging is not a phase closing. The repo is
in lane-mode: this file is the operational truth, `PORTFOLIO.md` indexes it, and every
command auto-resolves to `portfolio` because it is the only eligible lane.

`burn:` is deliberately still 1.9d. It is written at phase close, not per section, so it
does NOT yet carry Phase 02's own spend — the 1.0d tripwire inside this phase cannot be read
off the header today, and that is a thing to measure at close rather than to guess at now.

**Phase 02's Verification plan is REFINED as of 2026-08-01** (`/arc-change`, branch
`feat/phase-02-ratify-and-refine`) — sections A–G in the spec, each an existing-and-passing
fixture or the phase does not close. The two things worth knowing without opening it: the
zero-interleaving test ships with a **negative control** (a >8 KB `>>` append that MUST tear
on the same harness, or the subject's pass proves nothing), and the spool work is defined
against the real gap — today a hook-mode lock timeout lands in `_quarantine/`, the same
bucket as a malformed payload, so "invalid" and "busy" currently share a destination.

**What Phase 02 must not inherit:**

- ~~Two unratified deviations from Phase 01.~~ **RATIFIED 2026-08-01, owner-decided, both
  the option that breaks no existing rule.** (1) No `develop` row —
  [ADR-0061](../../docs/adr/0061-board-indexes-born-lanes-only.md):
  the board indexes **born lanes only**; a row exists iff the lane directory does, and
  `QUEUED` is a state a born lane holds, never a way to announce one that does not exist.
  The lint therefore gets one unconditional invariant instead of one plus an exception.
  (2) `initiatives/design/PROGRESS.md` stays —
  [ADR-0062](../../docs/adr/0062-port-i-amendment-a-board-row-needs-a-machine-header.md)
  amends ADR-0058: a lane on the
  board carries a machine header even with no live cycle, because the board's `design IDLE`
  must derive from something (ADR-0051). REQ-02's "links only" acceptance is amended in
  PLAN, not waived. A wrong claim in that file was corrected in the same pass: it credited
  itself with keeping design out of the eligible set, but `lane-resolve.sh` counts any
  validly-named directory as a lane with or without a `PROGRESS.md` — the file is
  load-bearing for the board, not the resolver.
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

**Next step:** ~~merge PR #79~~ (merged as `ef82e16`) · ~~refine Phase 02's verification
plan~~ (done 2026-08-01) · ~~section A~~ (#82) · ~~sections B + D~~ (#83) · ~~section C~~
(#84) · ~~section E~~ (#85) · ~~section F~~ (#86, **since reverted**) · ~~section G~~ (#87)
· **the adversarial pass + the lock fix + the F revert are on `feat/phase-02-close`**.
**Next after it: `/arc-phase-done 2`.** CI is the only gate (owner's standing rule,
2026-07-31, restated 2026-08-01) — with one deliberate exception this time: the new `lock:`
fixture was run locally, in both directions, because it is the fix for a data-corruption
bug and a fixture that cannot be shown to fail is not a gate.

## The adversarial pass, and what it cost

**`/arc-phase-done 2` refused, and it was right to.** This phase's Definition of Done names
"the adversarial pass in B run and its findings pinned". It had never run — for B, D or F.
Only section A carried one. `docs/retro-log.md:10` has required it since 2026-07-16 for any
hand-authored gate, lint or parser: *"mandatory verification, not optional review"*.

**61 findings. 9 verified by hand** (re-running the reproduction, not carrying a report's
verdict). Nothing was rejected. The full record, including the 52 that are reported but
still unconfirmed, is at `evidence/phase-02/adversarial-report.md`.

**The one that had to be fixed before anything shipped:** `LOCK_STALE_MS` (5000) is smaller
than `STRICT_LOCK_TIMEOUT_MS` (15000), and `withLock` re-reads its token once at acquire and
never again during `fn()`. A strict waiter therefore outlives the stale threshold and
deletes the lock of a holder that is **alive and mid-write** — two writers in one critical
section, which is how duplicate receipts reach an append-only spine with both processes
exiting 0. Reproduced at production defaults. The threshold is now
`max(stale, this caller's own timeout)`: you may only call a lock abandoned once it has
outlasted your own patience. Pinned by a red-first fixture — it reports `HOLDER_LOST_LOCK`
and fails when the fix is reverted.

**Section F is reverted, and the reason is not squeamishness.** Three of the nine verified
findings are defects in the spool written the same day: `ts` is never re-validated, so a
receipt lands in a day file no reader can see (**lost**); `ts` is used as a path component,
so a spool file's content decided a write three directories above the spine root; and the
drain skips the secret scan, so a credential the front door refuses reaches the immutable
spine in cleartext (ADR-0028 bypass). The drain is also **what made the lock bug reachable
in ordinary operation** — it moved an unbounded `O(pending × idem-index)` body inside a
critical section that had previously held a single append. Reverting removes all four at
once. Hook-mode timeouts go back to `_quarantine/`, which is the state this phase started
in: the gap section F was written to close is still open, and is now RI-1's to carry.

**The DoD is amended, not met** (owner-decided, 2026-08-01). "The adversarial pass in B run
and its findings pinned" becomes **run, recorded, and its findings routed** — the pass ran
and its output is committed, but B's 24 board-lint findings are not fixed. Fixing them is
real work against a cycle appetite that is already 100% allocated with zero slack. This is
written as an amendment rather than a tick because the difference matters: `board-lint.sh`
today has 24 reported defects, of which 4 are silently-wrong verdicts.

**What the pass says about method, which is the part worth keeping.** All nine verified
findings came from *running* the artifact. None came from reading it — and the code had been
read carefully; B, D and F each ship with long comments explaining why they are correct, and
several of those comments are the exact claims the pass falsified. `board-lint.sh` passes
its own 41 fixtures. `spine-spool.bats` passed 9 fixtures on three operating systems. Two of
the ownership findings are failures `.claude/rules/lanes.md` describes **by name** as past
incidents, reintroduced in a new lint written after that file.

**Section E's control was flaky, and the run taken as certification evidence is what caught
it.** Before certifying, a `workflow_dispatch` run was fired on merged `main` so the claim
would rest on one run containing E and F together (CI only triggers on `pull_request`, so
merging produces no run of its own). That run came back **red on ubuntu-18**: the control
reported CLEAN. It had passed six legs across two PRs and was never reliable, only lucky —
writers leave the barrier up to one poll interval (0.02s) apart, and a record that takes
microseconds to write closes before the next writer wakes, so the barrier was serialising
the writers it existed to release. Fixed here by holding each record open across a
deliberate 0.4s gap, a 20x margin over the release spread. The detector itself was then
checked in **both** directions — a genuinely serial run still reports CLEAN — because an
instrument that always says TORN would make the whole fixture pass vacuously. Green
afterwards on the certification run (arc-ci 30699327058), ubuntu-18 included. **A control
that fails one run in several is not a gate, it is a coin**, and the only reason this was
found before it wasted a morning is that certification was made to rest on a fresh run
rather than on two green PRs remembered separately.

**Section G certified Mode B, and found that the safeguard it was meant to remove had never
existed.** G's stated job was to take `Mode B: not certified` off `PORTFOLIO.md`. It was not
there: a search of every branch's history for that string in that file returns nothing. The
board was born in Phase 01 without the note and ran through Phase 02 without it, so for the
whole window in which Mode B was UNSUPPORTED, the artifact ADR-0056 appointed to say so was
silent. Nobody was misled in practice — one person, one working tree — but that is luck
about the circumstances, not the control working. Certification is now ON the board, with
the absence recorded next to it rather than quietly fixed.

**What the certification rests on, and its weakest link, are in the spec's section G rather
than summarised here.** The one thing worth repeating: REQ-04's "every event lands in main
file OR spool, none lost" is proven by **two fixtures together**, not by either alone — E
covers the all-in-main half and F the spooled half, and no single fixture produces a run
where some events go each way. The union covers the claim. A mixed run does not exist yet,
and "certified" should not be read as more than that.

**~~Left as an open decision rather than smuggled into G~~ — ROUTED 2026-08-01
(`/arc-change`, owner-decided): it becomes Phase 03 retro input RI-1**
(`phases/phase-03-spec.md`). Nothing stops the board losing that line again; the candidate
fix is a tenth board-lint class asserting the execution-mode section EXISTS and matches one
of two known grammars — not "matches the certification state", because no machine-readable
source of truth for certification exists and the failure that actually happened was silent
absence, which a presence check catches.

It is **not** built in Phase 03: that phase is docs + retro at 0.25d with any code change
out of scope by its own spec, and the change is not one line — the WARN registry is pinned
at exactly nine classes and `tests/warn-shape.bats` asserts them by name, so a tenth needs
the registry, the obligation guard and its own fixtures. None of the nine can carry it
either: all nine are about board rows, lanes and ownership, none about a required section
being absent. The retro decides what it becomes, with the finding in front of it — which is
the mechanism for turning a missed control into a permanent upgrade rather than a note.

**The question RI-1 really asks**, and the reason it is worth a retro slot rather than a
ticket: this is the **second** time this cycle a stated control turned out not to exist or
not to work — the other being section E's own control, which passed six legs by luck before
the certification run caught it. Both were found by exercising the artifact; neither by
reading it. So: which other ADR-mandated artifacts have no gate asserting they exist?

**~~Section F, and where the spool's edges were decided.~~ REVERTED 2026-08-01 — kept below
because the design reasoning survives the revert and RI-1 will need it.** The four decisions
were sound; what was missing was any re-validation of the file the drain picked up. A hook
`LOCK_TIMEOUT` wrote its already-sealed line to `events/_pending/<ulid>.json` and exited 0;
the next emitter to take the lock appended it, before its own event, so append order still
matched arrival order. Four decisions worth having written down:

- **Strict mode does not spool.** Strict tells CI and ingest the truth, and a caller told
  exit 2 must never find its event on the spine afterwards — that would make the exit code
  a lie. Only the hook path, whose whole promise is "never blocks", gets the spool.
- **The drain rides on `appendEvent`, not on a daemon or a timer.** ADR-0027's no-bus stance
  holds: the spool is a timeout fallback, and the only moment anything reliably holds the
  lock is somebody else's append.
- **Append-then-unlink, deliberately.** A crash in between leaves the event on the spine AND
  in the spool; the next drain gets `DUP_IDEM` from the idem index, which is proof it
  already landed, so the copy is dropped. Unlink-then-append would lose it outright in the
  same window. Never both, never neither — and the fixture reproduces that exact window by
  restoring the spool file after a successful drain.
- **Two things that can never be drained get a visible destination rather than a retry
  loop:** an unparseable spool file, and an event whose day was closed while it waited
  (ADR-0029 makes a closed day immutable forever). Both go to `_quarantine/` with their own
  code. Left in `_pending/` they would be re-read on every future emit for the life of the
  repo.

**`status` was ambiguous in the spec and the owner picked.** "surfaced in status/brief" —
`brief` is `arc-brief.mjs`, but `status` could have meant the `/arc` dashboard or the
SessionStart heads-up. Owner-decided 2026-08-01: the **`/arc` dashboard**
(`arc-status.sh`). It is composed in the shell there rather than read by
`arc-products.mjs`, so a core script never opens `events/` itself and the spine stays the
only way to ask the spine (ADR-0030) — `spine-reader-lint` caught the first attempt at this
and was right to.

**Section E found a real bug on its first CI run, and it was not the bug it was looking
for.** arc-ci 30696565045, windows shard 11/12: `1 of 200 strict emits were refused --
arc-event: REJECT LOCK_FAILED -- cannot take the spine lock: EPERM`. Windows keeps a
released file in a **delete-pending** state until the last handle closes, and an `O_EXCL`
create landing in that window fails `EPERM`, not `EEXIST`. `withLock` treated every
non-`EEXIST` code as fatal, so under contention one emitter in ~200 exited 2 and **lost its
receipt** — risk 5 and the C2 lesson, arriving in the shape nobody was watching for. Fixed
in the same branch: `EPERM` and `EACCES` are contention like `EEXIST` and retry; a genuine
permission fault now surfaces as a `LOCK_TIMEOUT` naming the code it kept seeing. This is
the whole argument for building the fixture before certifying Mode B — no amount of reading
that function would have produced `EPERM`, only running it on the OS that emits it.

**A3's trigger was widened in the same pass** (PLAN, marked and dated). It read "any
interleaved/corrupt line in main JSONL", which watches only for CORRUPTION — and this
failure corrupted nothing. It refused. A trigger that cannot see a refused receipt cannot
see half of what the assumption is about.

**The control took three designs, and the two failures are worth keeping.** The spec's
original ">8 KB, over `PIPE_BUF`" is the wrong mechanism: one `write()` to a regular file
opened `O_APPEND` is serialised by the inode lock on Linux, so 9 KB lands whole. The second
try — 512 KB per writer so stdio splits it into ~100 writes — is right on Linux and macOS
and came out **CLEAN on windows-git-bash**, because a Windows append write is serialised by
the OS and MSYS fork is slow enough that 12 writers spawned in a loop can take turns. Both
designs were measuring the OS rather than the harness. What ships depends on nothing
platform-specific: each writer appends one record as **two separate appends**, released
from a barrier once all 12 have signalled ready. Any other writer's bytes can land between
those two appends on any OS, so CLEAN now means exactly one thing — no overlap happened.

**A cost this phase creates and does not pay:** `tests/spine-concurrency.bats` spawns 200
emitter processes, and on the windows leg process creation is the entire cost of the suite.
It enters `shard-timings.json` at the `_default_weight` of 16, which will badly under-weight
it and make whichever shard it lands in the binding leg. The weights file states its own
rule — re-run `weigh-tests.yml` and paste the block, never hand-edit a number — so this is
left for a measured pass rather than guessed at here. **Section F adds a second unweighed
file** (`tests/spine-spool.bats`, 9 tests) and one of them is slow by construction: proving
strict mode does NOT spool means waiting out the strict lock timeout, a hardcoded 15s in
`arc-event.mjs`. Both files should be weighed in the same pass.

**Assumptions status:** A3 is **not** marked FIRED, and the reason is stated rather than
assumed: the lock held, nothing interleaved, and the row's prescribed remedy (strict
lockfile for hook mode, spool as the only timeout path) addresses a different fault than the
one found — a fatal error code, not a timeout. Its trigger is widened, its remedy is
untouched. **A3 now has its full instrument and still does not fire:** section F's fixtures
show a hook-mode timeout routing to the spool, draining exactly once across the crash
window, and never reaching the main JSONL out of order — the lock-plus-spool pair covers
single-machine concurrency, which is the half of A3 this repo can actually exercise. Its
Mode-B half (two worktrees, one shared spine) stays untested by construction and is
precisely what ADR-0056 keeps uncertified. A4 (advisory-only WIP is enough)
**has its instrument** — section C prints the counted number — but still cannot FIRE: its
trigger needs counted lanes above 2 and retro evidence of rising rework, and this repo
counts 1. A5 is closed and carries nothing.

blocked-on: —
depends-on: —

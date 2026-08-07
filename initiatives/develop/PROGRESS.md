# PROGRESS.md — Cycle 6 · arc-develop "The Developer" — the intelligence layers

status: IDLE
cycle: arc-develop (Cycle 6, closed 2026-08-03)
phase: — (cycle closed, merged as 17473e7 / PR #100)
appetite: 7d
burn: 2.1d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 5 closed 2026-08-02 at ~1.9 of 5 days, all four phases under appetite — its plan is
> archived at `archive/PLAN-cycle5-2026-08-02.md` and its done-log is kept below unchanged.
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at
> root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/develop/evidence/phase-NN/`.
> Design source: `docs/strategy/plans/PLAN-develop.md` (frozen). Cycle 6 finishes its layers 3-5.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — parked, shipped in Cycle 5 | — | ✅ done 2026-08-02 |
| 04 | The Learning System — ledger with typed links, eval fixtures, withheld holdout, promotion loop | 1.5 days | ✅ done 2026-08-03 (12 of 13 slices; slice 08 carried) |
| 05 | Context Pack — code-graph neighbourhood with stated grep fallback, churn, tagged hits, one-hop links | 1.0 days | ✅ done 2026-08-03 (9 of 9 slices) |
| 06 | Capability — scout, vet gate that BLOCKs on provenance, pinned lockfile | 0.75 days | ✅ done 2026-08-03 (15 of 15 slices) |
| 07 | Quality intelligence — decision-triggered pattern mining, risk-triggered approach sketches | 0.75 days | ✅ done 2026-08-03 (9 of 9 slices) |
| 08 | The feedback half of layer 5 — outcome metrics, calibration record, tags, suggestion engine | 1.5 days | ✅ done 2026-08-03 (9 of 9 slices) |

**Appetite burn: 2.1 of 7 days used (30%).** The five phases allocate **5.5 days**
(1.5 + 1.0 + 0.75 + 0.75 + 1.5); the remaining **1.5 days are unallocated buffer**, belonging to no
phase and counted by no kill criterion — the same numbers PLAN's Appetite section states, and the
figure to keep the two files agreeing on. The buffer's size has never been stress-tested: no cycle
has yet run hot enough to reach a checkpoint under pressure, so the guard is the pre-decided cut,
not the slack. Phase 07 is independently cuttable, and the kill criterion — **at 4.0 days burned,
is Phase 06 done?** — sits above 04+05+06's 3.25 days so it can tell on-track from in-trouble
rather than firing on every on-schedule run.

## Done log

### Cycle 5 — closed 2026-08-02, ~1.9 of 5 days, all four phases under appetite

**Phase 00 — steel thread — closed 2026-08-02, ~0.5d against a 1.5d appetite.**
CI run `30751546128` green: 20 of 20 jobs, ubuntu + macos + windows, head `8c46844`
(`initiatives/develop/evidence/phase-00/ci-green.txt`). `/arc-develop` runs
start → next → status → checkpoint → handoff offline against committed fixtures; the lane
contract holds (unknown lane exits 4, duplicate `--lane` exits 5, reserved names exit 5, root-mode
byte-identical to its golden); receipts land; `status` reconstructs cold at `slice 2/5`.

Under appetite because the phase found its two hard problems early rather than late:

1. **The spine silently swallowed every receipt.** Its kind vocabulary is closed (ADR-0026) and
   `develop.started` was quarantined with `UNKNOWN_KIND` **while the command still exited 0** —
   a receipt that never landed, reported as success. ADR-0106 extends it 18 → 21.
2. **`sectionOf` shipped the `$`-under-`/m` bug** the retro-log records from 2026-07-16, so every
   derived brief field came back empty. Caught on its first run against a real fixture.

Two more caught by process rather than luck: a test that passed before any code existed (node's own
`Cannot find module` is also non-zero and also writes no file — it now asserts the reason), and the
ADR-number collision with the model-policy session, which forced the century-band rule.

**Phase 00 did not use `/arc-develop` on itself** — the tool did not exist yet. Phase 01 is the
first phase run through it, which is the real dogfood.

---

**Phase 01 — the proof floor — closed 2026-08-02, ~0.6d against a 1.25d appetite.**
CI run `30752975413` green: 20 of 20 jobs, head `33a8d45`
(`initiatives/develop/evidence/phase-01/ci-green.txt`). Nine slices, all proven through the
harness itself — `status` reported `slice 5/9` and then `9/9` from committed files alone.

`develop-lint` ships ADR-0101's split: `ledger-unparseable`, `brief-stale` and `slice-unproven`
BLOCK from v1; `self-declared-number` and `tier-floor` are WARN-first and registered in
`docs/trial-ledger.md` with what would promote them. Every BLOCK has a negative control proving
it can fail, and every failure names the offending slice and line.

**The phase's real lesson is about who may attack a gate.** My own 26 breaking inputs were all
caught on the first run — and that was a true result about a blind spot, not about the gate.
All 26 attacked one direction: a slice the parser SEES holding bad data. An unanchored agent,
blind to how the parser was written, attacked the other direction and found **9 holes**. The
flagship: a four-slice ledger claiming `proof: it works` / `tier: eyeballed` / `commit: yes`
that parsed to ZERO slices and ZERO errors, and the gate answered "all checks passed ✔".

Two of the nine deserve naming. A `#` line inside a fenced proof block closed the slice — so
the *sanctioned* way to record evidence (ADR-0100 prescribes that fence) was also the way to
stop being checked. And `isFilled` was a denylist of 8 strings holding the em dash but not the
en dash, while the writer itself emits an em dash — so `proof: –` read as a real value.

45 fixtures pinned now, all caught. Five round-2 fixtures initially "passed" because they were
cosmetic-only, with no violation riding along — a fixture that passes by parsing correctly pins
nothing, so they were rebuilt.

---

**Phase 02 — earned judgment — closed 2026-08-02, ~0.4d against a 0.75d appetite.**
`handoff` now refuses a ledger whose predictions are unscored, and emits no receipt when it
refuses. Verdicts are `hit | miss | unforeseen`, each requiring the reference that settles it.
`spec-fidelity` ships as an agent whose whole information set is the spec and the diff.

**It was proven by running the fidelity pass on this phase's own diff, and the pass found real
drift** — which is a stronger result than the synthetic drifted fixture the spec asked for.
Three findings, all fixed: a bare `hit` with no settling reference passed the gate; the
self-declared-number detector was only ever applied to slice fields, so a score reading
`hit — 95% confidence` would have printed straight out of `handoff`; and "its report lands in the
evidence pack" was simply absent — handoff printed a pack and assembled nothing.

**One finding no fix closes, kept as the lesson.** This phase shipped an agent structurally
incapable of verifying its own phase's first exit criterion: the criterion says "recorded in the
ledger", and the agent is forbidden to read ledgers. Any criterion phrased that way is
unverifiable by the fidelity pass by construction. Future exit criteria must be diff-verifiable
or be marked as something else's job.

---

**Phase 03 — controlled escalation — closed 2026-08-02, ~0.4d against a 0.5d appetite.**
Deterministic counters under a judgement call: same fingerprint 3× forces root-cause mode, five
attempts on one slice escalates with a one-screen diagnosis. Hypothesis novelty is *claimable* —
a model under pressure always feels like it has a new idea — so the counters are the floor
beneath the judgement, and a claimed new hypothesis does not reset them. Every firing emits
`slice.stuck`, because `.claude/state/` is disposable and a retro asking where the time went
must have something to read.

`checkpoint` became real and runs inline at the slice boundary (ADR-0103). Risk is path-matched
by a glob table, never self-assessed. The debt ledger opens with four honest rows — including
the two things this phase deliberately did not build.

`slice.stuck` needed ADR-0107 (21 → 22). ADR-0106's own revisit trigger — *"a fourth develop
lifecycle event needs a kind"* — is what authorised it, one cycle after it was written.

---

**Phase 04 — the Learning System — closed 2026-08-03, ~0.8d against a 1.5d appetite.
12 of 13 slices proven; slice 08 carried forward, deliberately.**
CI run `30763365970` green, 36 tests across 3 legs
(`initiatives/develop/evidence/phase-04/ci-green.txt`).

Shipped: `docs/develop/learning-ledger.md` (a company organ, 4 rows drawn from arc real
failures, each with typed links) · `learning.mjs` (parse / replay / list --visible) ·
`develop-lint [learning-row]` as a structural BLOCK · 18 fixtures across SIX categories
including 6 clean controls · a withheld holdout chosen and committed BEFORE any candidate
was authored.

**The loop ran end to end twice and returned "no" twice, and that is the phase result.**
L-002 was authored from a real Cycle-5 finding and sent to a fresh agent carrying only the
candidate and the computed counts. It rejected it on the CODE, not the counts — two bags of
words tested against a whole document with nothing requiring the success claim and the lost
write to concern the same operation; an optional possessive that showed the regex was
covering two remembered sentences; one alternative that could never fire. It then
constructed two inputs that break it, both now pinned as clean controls. L-004, the
rewrite, stopped false-blocking and stopped firing at all.

**Slice 08 — "one REAL promotion ships an enforced check" — is UNPROVEN and the criterion
was not reworded to match what happened.** Moving a goalpost to where the ball landed would
be a strange thing to do inside the phase that builds the machinery for refusing it. A
first-try promotion is what a rubber stamp also produces.

**The adversarial pass found 8 holes across 29 candidates, 3 critical, in a gate whose own
tests already passed.** The worst: `replay` handed the candidate the answer key — it
received the whole fixture including `expect`, and the parent re-read that field AFTER the
untrusted call. A candidate returning `flagged: fixture.expect === "flagged"` scored 11 of
11; one that MUTATED `expect` erased the clean denominator and reported
`false-blocked 0 of 0`; one exfiltrated every withheld id and body through the runner
itself; one printed a fabricated report at import time and exited 0. Candidates now run in
their own process with a frozen `{ body }` and return booleans; counting happens against
labels they never see.

Two further lessons worth keeping. A false block is as damaging as a miss and easier to
ship: the self-declared-number check FAILED on a legitimate path
(`.../false-confidence/F-003.md`) whose directory contains "confidence" and filename
contains a number. And a fixture must BE the artifact — mixing the artifact with commentary
about it made a corrected matcher over-fire on the very controls written to prove the
original over-fired.

---

**Phase 05 — the Context Pack — closed 2026-08-03, ~0.2d against a 1.0d appetite.**
CI run `30768154452` green: 19 of 19 jobs, ubuntu + macos + windows, head `777b49e`
(`initiatives/develop/evidence/phase-05/ci-green.txt`). Nine slices, all proven.

`next` hands over five sources before a slice is built — code neighbourhood, governing ADRs,
learning rows, retro patterns, churn — and writes every one into the slice's `sources:`,
including the ones that returned nothing and including which retrieval path ran and why.

**The one-hop boundary is structural rather than checked.** Links are read from the matched row
and the target is never opened, so there is no code path that could cross it. A fresh agent tried
to make it leak and reported back that it could not: the boundary "is structural, not enforced by
a check that could be bypassed."

**Two fresh agents found 23 holes, 8 of them wrong answers reported as right ones**, in code whose
own 14-test suite passed. The four worst are all one shape — a reader answering confidently about
something it had misread:

1. `adrs()` took the first Product-looking line anywhere in an ADR's head and allowed a `>` in its
   lead, so a "supersedes the develop-lane rule" QUOTATION claimed a design ADR for develop while
   the same trick in reverse hid a develop ADR. The shipped fixture passed only because its real
   header happened to come first — ordering was doing the work, not the rule.
2. git C-quotes non-ASCII paths, and the Windows separator normalisation then read the octal
   escapes as directories: the top-ranked churn entry was a path that exists nowhere,
   `"src/auth/caf/303/251.js"`, printed with a computed count beside it.
3. `setSliceField` bound to the first block with a matching id while the reader hands out the first
   UNPROVEN one, so with a duplicate id one slice's pack overwrote another slice's audit trail and
   the slice being built recorded nothing, on that run or any later one.
4. `learning()` discarded the parser's own errors, so a ledger with one unterminated fence reported
   `learning [0] (none)` — strictly less informative than a MISSING ledger, which at least said it
   was missing.

**And the pinning commit shipped three vacuous passes.** Nine probes imported a Git Bash path node
cannot resolve. Six went red, which is how it was found; three PASSED, because "output does not
contain X" is satisfied by a stack trace. That is the exact failure this phase is about, shipped
inside the commit that fixed thirteen instances of it. Probes now assert they ran. Two further
tests were true of runs that did nothing: one checked a drop that had already happened for an
unrelated reason, one checked a file the blast radius never contained.

**`tests/shard-timings.json` was re-measured — all 54 files in one pass** (run 30765982979). The
old table covered 42 and left 12 riding `_default_weight` 16; the new file measured 49s against
that 16. Predicted total 1785s, real 2366s. So the balance test's `<= 200` was 1785/9 rounded, a
snapshot of an under-measurement, and it now asserts the rule — max(heaviest file, total/shards) —
derived from the plan on every run.

---

**Phase 06 — capability acquisition — closed 2026-08-03, ~0.3d against a 0.75d appetite.**
CI run `30771652000` green: 19 of 19 jobs, head `6489684`
(`initiatives/develop/evidence/phase-06/ci-green.txt`). Fifteen slices, all proven.

`capability-vet.sh` refuses by default on seven conditions, reporting every failure rather
than the first. `capability-scout` finds candidates and has no write tools. `/arc-capability`
is the entry point, and it installs nothing.

**The real candidate was refused, and that is the phase's result.** madge@8.0.0 was fetched
with `npm pack`, its tarball hashed, and its `dist.integrity` verified byte-for-byte against
the registry. It BLOCKed on `human-ok`, because `src/lib/graph.js:8` does
`promisify(require('child_process').execFile)` — write-capable, computed from the source
rather than read from anything the package claims. That is assumption-ledger row 5 going the
way ADR-0110 said it must: **the capability is refused rather than the gate weakened.**
Writing `human-ok: ashiq` would have satisfied the exit criterion in the same motion that made
the promotion machinery worthless. It is one line and it is his line.

**Two fresh agents defeated ALL SEVEN checks.** They got a candidate carrying `child_process`,
`curl | sh`, `process.env` exfiltration and an `/etc/cron.d` write to `PASS — read-only`,
exit 0. They independently found the same root cause and were right about it: untrusted,
attacker-controlled, possibly multi-line strings fed into line-oriented `grep` and `sed`.

The five worth remembering:

1. **A newline in `name` walked past the allowlist.** `grep -qxF` treats each line of its
   pattern as a separate fixed string, so `evil-package\nsafe-tool` matched — defeating the
   one control ADR-0110 names as the anti-slopsquatting defence. The same shape defeated the
   version pin and `human-ok`.
2. **One NUL byte turned three BLOCKs into a PASS.** The flag string read `-raInE`; `-a` and
   `-I` are opposites and `-I` won, so any file holding a NUL was skipped — and a NUL in a
   comment changes nothing about how the file executes.
3. **The hash was shape-checked and never compared.** Sixteen `A`s passed.
4. **A `\` in the candidate path voided the entire scan.** Hits were relativised with
   `sed "s|^$CANDIDATE/||"`, which interpolates an unsanitised path into a sed expression;
   the ordinary native path form on Windows broke it, sed wrote nothing, every finding
   vanished, and the operator saw only `PASS read-only`.
5. **"Unreadable means write-capable" asked the wrong question** — whether ANY file was
   readable — so one README beside a compiled blob cleared the whole tree.

The metadata half is one node program over parsed JSON now, because substring matching cannot
express "this field EQUALS that field". 25 fixtures, one per hole, and three legitimate
candidates — a clean npm package, a write-capable one with a recorded OK, and a skill pinned
by commit SHA — still PASS in the same run.

**Two process deviations, recorded rather than tidied.** The Predictions block was filled in
after the build rather than before it, which is the harness's own rule broken by the session
that owns the harness; the values are what the red-test commit recorded before any
implementation existed, but the field was not populated at the time. And `capability-scout`
could only be exercised through a general-purpose agent carrying its definition inline, because
agent types register at session start — the identical debt Cycle 5 recorded for
`spec-fidelity` and paid down one session later. Both are in the debt ledger.


## Now

**Every phase of Cycle 6 is closed on green CI (run `30782174344`, 19 of 19 jobs at head
`27cb7ce`). The cycle is ready to merge — PR #100, still open by instruction.**

### Inbox from the `policy` lane, 2026-08-07 — four develop kinds have no `arc brief` group

`arc-brief.mjs` sorts every event kind into one of four sections — `needs-you`, `money`,
`progress`, `background` — and that table is **22 kinds behind the closed vocabulary of 44**.
Four of the 22 are this lane's: `develop.started`, `slice.done`, `handoff.ready`, `slice.stuck`.

**The urgent half is already fixed and needs nothing from you.** Until 2026-08-07 the renderer
used `if (group) push`, so a kind missing from the table rendered as *nothing at all* — every
`develop.*` and `slice.*` receipt has been silently absent from the brief since this lane
shipped, and a day full of them read exactly like a quiet day. Unmapped kinds now fall through
to a catch-all that names them, and the catch-all collapses to a count so it cannot bury the
sections above it (`6d3e3fb`, PR #125). Nothing is dropped any more.

**What is left is a decision only this lane can make.** The four sit in a catch-all rather than
a section, so the brief can show them but cannot rank them — a `slice.stuck` and a routine
`develop.started` arrive at identical weight. `slice.stuck` is the one genuinely worth thinking
about: `validate.mjs` describes it as *where a build bleeds time, for `/arc-retro` to read*,
which makes it a `needs-you` line if this lane wants it in front of a human the same day, and
`background` if it is only ever retro material. The policy lane deliberately did not guess.
A wrong guess does not break anything — it makes the daily brief quietly misrepresent this
lane's work, which is worse than the catch-all it would replace.

Cost when someone picks it up: four entries in the `GROUPS` table at the top of
`.claude/scripts/hq/arc-brief.mjs`. The tests guarding that table are in `tests/policy-brief.bats`,
including a control that fails if a change ever collapses `needs-you`.

### Cycle 6 position

| phase | state |
|---|---|
| 04 Learning System | closed 2026-08-03, 12 of 13 slices, ~0.8d of 1.5d |
| 05 Context Pack | closed 2026-08-03, 9 of 9 slices, ~0.2d of 1.0d |
| 06 Capability | closed 2026-08-03, 15 of 15 slices, ~0.3d of 0.75d |
| 07 Quality intelligence | closed 2026-08-03, 9 of 9 slices, ~0.3d of 0.75d (NOT cut — burn never reached the checkpoint) |
| 08 Feedback metrics | closed 2026-08-03, 9 of 9 slices, ~0.5d of 1.5d |

Burn ~2.1 of 7 days. The 4.0-day checkpoint was never reached. The 4.0-day checkpoint — is Phase 06 done? — is a long way off.

### To start Phase 06, in this order

1. `node .claude/scripts/develop/develop.mjs start 6 --lane develop`.
2. Read `initiatives/develop/phases/phase-06-spec.md`. It builds `capability-vet.sh` (the BLOCK
   gate, ADR-0110), `capability-lock.json`, the `capability-scout` agent and `/arc-capability`.
3. Failing bats FIRST, commit, push, read the red off CI. Never run the suite locally.
4. The adversarial pass runs by a FRESH agent, in the commit that ships the gate. On Phase 05
   two of them found 23 holes in code whose own suite passed — and the commit that pinned the
   first thirteen shipped three tests that passed while executing nothing.

### One thing Phase 06 needs from Ashiq

**The initial allowlist.** An empty allowlist means the gate refuses everything, which is the
correct default, and it also means the exit criterion "a REAL candidate is vetted" cannot be
met without naming something admissible. The plan is to vet **madge** — the dependency-analysis
tool Cycle 5 recorded as debt — because vetting is not installing (ADR-0110 separates them):
arc gains a `capability-lock.json` row and **no dependency**. Flagged rather than blocking,
since nothing is admitted by it.

### Three things carried forward

| what | why |
|---|---|
| **Slice 08 of Phase 04** — one REAL promotion shipping an enforced check | Both candidates were rejected: L-002 by the unanchored evaluator on its code, L-004 on its own computed counts. L-004's ledger row records what a third attempt must do differently — reconcile a claimed count against a persisted count, rather than start from a regex over prose |
| **Renames are not followed by churn** | `--follow` takes a single path and the blast radius is a set. Dead paths are dropped and the count is stated, which is honest but is not the same as knowing a file's real history. Revisit if a slice repeatedly wants it |
| **PR #100 is open and unmerged** | By instruction: nothing merges until every Cycle-6 phase is complete. Phases 06 through 08 land on `feat/develop-cycle6` |

### Still owed from Cycle 5, unchanged

`initiatives/develop/debt-ledger.md` — the inline risk globs, the absent public-API surface
diff, and `spec-fidelity` never yet loaded by the runtime that will load it. That last row
is now closable: the agent type IS registered, so the next `handoff` can invoke it for real
and retire the row.

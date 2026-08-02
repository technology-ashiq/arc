# PROGRESS.md — Cycle 6 · arc-develop "The Developer" — the intelligence layers

status: LIVE
cycle: arc-develop Cycle 6 (opened 2026-08-02)
phase: 05 — not started
appetite: 7d
burn: 0.8d
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
| 05 | Context Pack — code-graph neighbourhood with stated grep fallback, churn, tagged hits, one-hop links | 1.0 days | pending |
| 06 | Capability — scout, vet gate that BLOCKs on provenance, pinned lockfile | 0.75 days | pending |
| 07 | Quality intelligence — decision-triggered pattern mining, risk-triggered approach sketches | 0.75 days | pending |
| 08 | The feedback half of layer 5 — outcome metrics, calibration record, tags, suggestion engine | 1.5 days | pending |

**Appetite burn: 0.8 of 7 days used (11%).** The five phases allocate **5.5 days**
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

## Now

**Phase 04 closed on green CI (run `30763365970`). Phase 05 has NOT been started** — the
session that built 04 stopped here deliberately, so 05 begins with a fresh context.

### Cycle 6 position

| phase | state |
|---|---|
| 04 Learning System | closed 2026-08-03, 12 of 13 slices, ~0.8d of 1.5d |
| 05 Context Pack | **next** — 1.0d |
| 06 Capability | pending — 0.75d |
| 07 Quality intelligence | pending — 0.75d (the pre-decided cut) |
| 08 Feedback metrics | pending — 1.5d |

Burn ~0.8 of 7 days. The 4.0-day checkpoint — is Phase 06 done? — is a long way off.

### To start Phase 05, in this order

1. `node .claude/scripts/develop/develop.mjs start 5 --lane develop` — writes the brief and
   decomposes the phase-05 spec's exit criteria into slices.
2. Read `initiatives/develop/phases/phase-05-spec.md`. It builds
   `.claude/scripts/develop/context-pack.mjs`: five retrieval sources — code-graph
   neighbourhood with a STATED grep fallback, governing ADRs, learning rows, retro patterns,
   and churn from `git log` — plus one-hop typed-link following per ADR-0111, with every
   source recorded in the slice's `sources:` field.
3. Write the failing bats FIRST, commit, push, and **read the red off CI. Never run tests
   locally** — that rule has now been given three times, and the third violation was a
   one-off script in /tmp rather than bats.
4. The adversarial pass on anything gate-shaped must be run by a **fresh agent that has not
   seen the code**, in the commit that ships it. On this cycle that pass found 8 holes in a
   gate whose own tests already passed, 3 of them critical.

### Two things carried into Phase 05

| what | why |
|---|---|
| **Slice 08 of Phase 04** — one REAL promotion shipping an enforced check | Both candidates were rejected: L-002 by the unanchored evaluator on its code, L-004 on its own computed counts. L-004's ledger row already records what a third attempt must do differently — reconcile a claimed count against a persisted count, rather than start from a regex over prose |
| **PR #100 is open and unmerged** | By instruction: nothing merges until every Cycle-6 phase is complete. Phases 05 through 08 land on `feat/develop-cycle6` |

### Still owed from Cycle 5, unchanged

`initiatives/develop/debt-ledger.md` — the inline risk globs, the absent public-API surface
diff, and `spec-fidelity` never yet loaded by the runtime that will load it. That last row
is now closable: the agent type IS registered, so the next `handoff` can invoke it for real
and retire the row.

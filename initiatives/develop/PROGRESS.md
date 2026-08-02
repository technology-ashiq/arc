# PROGRESS.md — Cycle 5 · arc-develop "The Developer"

status: LIVE
cycle: arc-develop (Cycle 5, opened 2026-08-02)
phase: — all 4 closed, cycle ready to land
appetite: 5d
burn: 1.9d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane develop` on 2026-08-02 — arc's first natively-born
> lane. Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay at
> root and are never copied here (ADR-0053); evidence is lane-scoped from Phase 00 forward
> (ADR-0055), at `initiatives/develop/evidence/phase-NN/`.
> Design source: `docs/strategy/plans/PLAN-develop.md` (frozen — the decision record, not the cycle).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — `/arc-develop` runs start → next → status → handoff end-to-end offline on the committed fake phase, lane-native, writing a durable brief + slice ledger and emitting receipts | 1.5 days | ✅ done 2026-08-02 |
| 01 | The proof floor — `develop-lint` with structural BLOCKs, evidence tiers, and a parser that survives ≥20 adversarial breaking inputs | 1.25 days | ✅ done 2026-08-02 |
| 02 | Earned judgment — predictions scored at handoff, and a fresh unanchored `spec-fidelity` pass over spec + diff | 0.75 days | ✅ done 2026-08-02 |
| 03 | Controlled escalation — stuck backstops, inline risk-triggered checkpoints, debt-ledger marker lint | 0.5 days | ✅ done 2026-08-02 |

**Appetite burn: ~1.9 of 5 days used (~38%). All 4 phases closed, every one under its own
appetite.** Phases allocated 4.0 days and spent ~1.9. The 3.0-day checkpoint never fired.

| phase | appetite | spent | closed on |
|---|---|---|---|
| 00 steel thread | 1.5d | ~0.5d | CI `30751546128` |
| 01 proof floor | 1.25d | ~0.6d | CI `30752975413` |
| 02 earned judgment | 0.75d | ~0.4d | CI `30754616004` |
| 03 controlled escalation | 0.5d | ~0.4d | CI `30754616004` |

Basis, so it can be audited rather than believed: one unbroken sitting on 2026-08-02, from the
kickoff through to all four phases green on the 3-OS matrix. The honest caveat on that number is
that this was a single continuous session with no context switches, which is the most favourable
possible condition and not what a normal week looks like — the figure is real but it is not a
throughput claim.

**Prediction calibration across the three scored phases: 9 hit · 5 miss · 1 unforeseen.**
That is the record this product exists to accumulate — earned from scored outcomes, not asserted.
The misses are the useful half: the riskiest-file call was wrong twice in a row, both times
naming the gate rather than the parser underneath it.

## Done log

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

## Now

**Current position: all four phases closed on green CI, ~1.9 of 5 days.** `/arc-develop` ships
with five modes, a lint with three BLOCKs and two WARN-first groups, 45 pinned adversarial
fixtures, a stuck protocol, inline risk checkpoints, a debt ledger and a fidelity agent.
PR **#95** carries the cycle.

**Next step:** `/arc-retro` — this cycle has unusually good material for it (see below) — then
merge #95.

**What the retro should not lose:**

1. **A gate's author cannot be its attacker.** 26 self-written breaking inputs, 26 caught, zero
   holes — then an unanchored agent found 9. Every one of mine attacked the same direction.
2. **A stated control is not a control.** The ADR band went into `PORTFOLIO.md` as a convention;
   the lint that would enforce it is still not built, so the protection is a promise.
3. **The spine failed silently.** `develop.started` quarantined while the command exited 0. Any
   emitter should verify its first receipt actually landed rather than trust exit 0.
4. **Two extensions of a closed vocabulary in one cycle.** ADR-0107 sets the next trigger at the
   fifth kind, where the answer becomes one `develop.*` kind with a typed payload.

**Tracked, not built** (also in `debt-ledger.md`): the duplicate-ADR-number lint; the public-API
surface diff; the shared risk-glob rules file; and `spec-fidelity` has never been loaded by the
runtime that will load it — it was exercised through a general-purpose agent carrying its
contract inline, because agent types register at session start.

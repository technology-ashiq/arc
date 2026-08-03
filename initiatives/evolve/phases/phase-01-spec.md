# Phase 01 — Board

**Goal (one line):** `arc evolve board` renders every module's honest state from the reader
alone, and a wiped-and-replayed spine produces a byte-identical board.

**Appetite:** 1.0 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] Board renders from the reader only — no direct spine file reads anywhere in the path
- [ ] **Replay determinism:** wipe derived state → replay spine → board is byte-identical; and a
      fixture with two receipts sharing the same `ts` from different `actor`s (concurrent
      emitters) replays to the same board regardless of on-disk append order — the reducer sorts
      on a total order key (`ts` + `id`), never on file-arrival order
- [ ] State `PENDING` renders below-floor surfaces with n-per-arm progress
- [ ] Staleness renders loudly with an age (e.g. `last metric 12d ago`)
- [ ] **`MISSING`** renders for any incomplete window — never rendered or counted as zero
- [ ] `insufficient evidence` renders for council metrics below floor
- [ ] **Stream separation (ADR-0302):** experiment panels read `experiment.measured`; the
      baseline-panel path is proven ONLY against `MISSING`, since `metric.observed` is not a
      member of `KINDS` this cycle (ADR-0308) and no closed-payload validator for it exists —
      the "never summed" two-kind fixture is **deferred to the client's cycle**, when a
      legitimately validated `metric.observed` receipt first exists. Building one here would be
      doing EVO-H0's work inside this lane, which is a no-go
- [ ] Baseline panels render `MISSING` today, since `metric.observed` is not in `KINDS` and no
      client feed exists — the absent feed is displayed honestly, not faked or zeroed
- [ ] No invented numbers anywhere in the output
- [ ] tests added & green in CI
- [ ] live demo run + output checked
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/evolve-board.bats`
- **Expected failure first:** before any code, `bats tests/evolve-board.bats` fails on
  `replayed spine renders byte-identical board` with `command not found: arc evolve board` —
  no board command exists yet. The second test to go red is
  `incomplete window renders MISSING, not 0`, which must fail with the golden fixture diff
  showing `0` where `MISSING` is expected once a naive reducer exists; that ordering is
  deliberate, because a reducer that sums absent windows to zero is the exact defect the test
  is written to catch.
- **Live demo scenario:** run `arc evolve board` against the committed fixture spine → observe
  a baseline panel reading `MISSING` and an experiment panel reading `PENDING` with n-per-arm
  progress. Then delete the derived-state directory, re-run, and `diff` the two outputs —
  expected: no differences.
- **Real-system check:** run the board against the live local spine (1 `note.logged` event as of
  kickoff) and confirm it renders empty-but-honest — no zeros, no invented rows, no crash on a
  spine with no evolve receipts at all.
- **Expected evidence:** bats output red → green; the two board renders and their empty `diff`;
  the fixture proving `metric.observed` and `experiment.measured` panels are not summed.

## Rabbit holes in this phase

Dashboard UI — this is a CLI board and the dashboard module owns pixels later. Metric-taxonomy
perfection: render the 2–3 metrics a fixture actually carries. Building a synthetic client feed
so the baseline panel looks alive — the honest answer today is `MISSING` and that is the feature.

## Out of scope for this phase

Assignment, floors and verdict math (Phase 02) · promotion lineage and watch (Phase 03) · council
columns (Phase 04, the designated cut).

## Your-setup / pending

None.

## Non-negotiables (verbatim from PLAN)

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to promote,
  not to revert (Constitution A6, no exceptions, no carve-outs).
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits live in config; **enforcement lives in code**. A
  FRESH agent that has not seen the implementation runs the adversarial breaking-input pass on
  the manifest validator, every receipt validator, and floor + cohort + seal + lineage + watch
  enforcement — bound to the section that ships each gate, never deferred to the phase close.
- No experiments on money-touching surfaces (pricing, payments, revenue) — permanently refused
  at the contract layer, with a fixture.
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
  replay-identical board, config-hash-carrying verdicts, SHA-bound lineage at every hop. If
  replay cannot re-derive it, it does not count.
- Absent data is `MISSING`, never zero. Corrections supersede, never overwrite. No raw URLs or
  PII on the spine.
- Reader-only spine consumption; standard emitter for every receipt; real and simulated never
  mixed. Zero-dep Node + POSIX.

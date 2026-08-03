# PROGRESS.md — Cycle 7 · arc-evolve "The Self-Improvement Engine"

status: LIVE
cycle: arc-evolve (Cycle 7, opened 2026-08-03)
phase: 02 — runner + verdict math (Phases 00-01 CLOSED)
appetite: 7d
burn: 2.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane evolve` on 2026-08-03 and claims **ADR band
> 0300–0399**. Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`,
> `tests/`) stay at root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/evolve/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-evolve.md` (v1.0, frozen — the decision record, not
> this cycle). Model policy is inherited from `docs/adr/0069-balanced-model-policy.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contract + steel thread — manifest schema, `product-lint` extension, 8 kinds + validators, grammar, one receipt end-to-end | 1.5 days | ✅ closed 2026-08-04 |
| 01 | Board — reader-only reducer; `PENDING` / staleness / `MISSING` / `insufficient evidence`; stream separation | 1.0 days | ✅ closed 2026-08-04 |
| 02 | Runner + verdict math — assignment, seal, floors, TTL, the pinned test + reference vectors | 1.5 days | ⬜ pending |
| 03 | Promotion safety — four-hop SHA lineage, evidence table, inbox, watch, freeze, revert path | 1.5 days | ⬜ pending |
| 04 | Council bridge — **THE DESIGNATED CUT** | 1.5 days | ⬜ pending |

**Appetite burn: 2.5 of 7 days used (36%).** Phases 00–03 (the core engine) allocate **5.5 days**.
Phase 04 allocates the remaining 1.5d and is the designated cut — it is simultaneously the only
slack in the cycle. That is deliberate and it is the lesson `arc-portfolio` paid for: Cycle 4
allocated 100% with zero slack, `appetite-sum` warned on every run, Phase 02 overran 0.35d with
nothing to absorb it, and the cycle closed at ~112%. Here the overrun absorber is a phase that
was pre-decided as cuttable, rather than slack nobody named.

**Kill checkpoint: at 3.5 days burned (50%), is REQ-02 met?** — i.e. does a wiped-and-replayed
spine produce a byte-identical board? If not, the reader-only derivation is fighting the spine:
bank the contract, lint and vocabulary ADRs as documentation, stop, retro.

## Done log

- **2026-08-03 — kickoff.** `PLAN.md`, 11 ADRs (0300–0310), 5 phase specs. STOPPED for owner
  approval per the kickoff contract; approved as `01KZ3NAV2BVM7REMZFDAZGW9W1`
  (`decision.recorded`, verdict approve).
- **2026-08-04 — Phase 00 CLOSED.** 13/13 slices proven, CI green (run 30843916974, 19 jobs,
  0 failures), evidence bundled and verified at `initiatives/evolve/evidence/phase-00/`.
  Delivered: the `evolve` manifest section (ADR-0301), the eight experiment receipts
  (ADR-0304/0309, `KINDS` 22 -> 30), the variant grammar (ADR-0303), and the steel thread — one
  `experiment.opened` emitted, landed and read back through the reader on the REAL spine, sealed
  with a real file's sha256. Prediction calibration: 1 hit, 1 miss, 3 unforeseen.

- **2026-08-04 - Phase 01 CLOSED.** 12/12 slices, CI run 30851431809 green. `arc-evolve board`
  folds the spine into an honest status board; `products/evolve/manifest.json` is born.
  A fresh agent found **15 breaks** in the first version and all are pinned as fixtures; CI then
  found a 16th the agent missed - an order dependency in the fold itself.
  Prediction calibration: 2 hit, 2 miss, 1 unforeseen.

## Now

**Current position: Phases 00 and 01 closed. Phase 02 (runner + verdict math) is next.**

**The pattern across both phases is the same, and it is worth stating plainly.** Each phase's
code passed every test I wrote, then a fresh unanchored agent broke it 15 times. Phase 00: the
idem was a subset so corrections could never land, and one unit could be assigned to both arms.
Phase 01: an uncollected window counted toward the floor, guardrail units were summed into the
primary metric, and any receipt could supersede any other. In BOTH phases one of MY OWN tests was
wrong in a way that hid a severe bug. The adversarial pass is not a formality in this lane; it is
where the defects are found.

**A rule that came out of Phase 01 and now applies everywhere:** THE READ PATH IS NOT THE WRITE
PATH. The reader replays what was written and does not re-validate, so any consumer must
re-assert the grammars on read. Phase 02's runner and Phase 03's lineage checks read the same
spine and inherit the same exposure.

**This cycle is built ahead of its trigger, and that is on the record (ADR-0300).** The
pre-kickoff gate was verified in-tree at kickoff and **all five rows are unevidenced**: no client
module is named, `metric.observed` is not in `KINDS` (so 4 weeks of receipts are technically
impossible, not merely absent), and rows 3–5 have nothing to derive from. The owner was shown
this evidence and directed the build forward twice. The build proceeds fixture-proven; the
operational runway does not start.

**What that costs, stated up front so the close cannot be surprised by it:** Phase 03's "first
real experiment OPENED on the chosen surface" is **cut and banked**, not delivered. This cycle
must close saying its north-star claim is *fixture-proven, unexercised* — the `engine` lane's
REQ-08 partial is the precedent for reporting a partial claim as partial rather than waiving it,
and this lane inherits that standard.

**To start Phase 02:** `/arc-develop start 2 --lane evolve`. Its reference vectors for
`newcombe-wilson-difference-v1` must be sourced INDEPENDENTLY of this lane's own implementation
and committed BEFORE any Phase 02 code exists (REQ-04) — a test whose expected values came from
the code under test proves only that the code agrees with itself.

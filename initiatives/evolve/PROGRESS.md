# PROGRESS.md — Cycle 7 · arc-evolve "The Self-Improvement Engine"

status: LIVE
cycle: arc-evolve (Cycle 7, opened 2026-08-03)
phase: 03 — promotion safety (Phases 00-02 CLOSED)
appetite: 7d
burn: 4.0d
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
| 02 | Runner + verdict math — assignment, seal, floors, TTL, the pinned test + reference vectors | 1.5 days | ✅ closed 2026-08-04 |
| 03 | Promotion safety — four-hop SHA lineage, evidence table, inbox, watch, freeze, revert path | 1.5 days | ⬜ pending |
| 04 | Council bridge — **THE DESIGNATED CUT** | 1.5 days | ⬜ pending |

**Appetite burn: 4.0 of 7 days used (57%).** Phases 00–03 (the core engine) allocate **5.5 days**.
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

- **2026-08-04 - Phase 02 CLOSED.** 9/9 slices, CI run 30856255831 green. Deterministic
  assignment, the canonical seal, TTL, the concurrency cap, and `newcombe-wilson-difference-v1`
  with reference vectors derived by TWO independent agents and committed BEFORE any
  implementation existed. Those derivations disagreed on 6 of 8 cases, which is what ADR-0311
  records: bit-for-bit as REQ-04 words it is unachievable across independent implementations,
  so acceptance is bit-for-bit against ONE pinned expression tree PLUS absolute agreement with
  the independent derivation. A third fresh agent found **15 more breaks**, all fixed and pinned.
  Prediction calibration: 4 hit, 0 miss, 1 unforeseen.

## Now

**Current position: Phases 00, 01 and 02 closed. Phase 03 (promotion safety) is next.**

**Three phases, three fresh-agent passes, 45 real breaks.** 15 in the contract and receipts, 15
in the board, 15 in the assignment layer and the verdict gate. Every one of them was in code that
had already passed every test its author wrote, and in two phases one of those tests was itself
wrong in a way that hid a severe defect. This is not a formality in this lane.

**Four failure classes now recur often enough to check for by name, before the agent has to
find them again:**

1. **In-band separators in a hash preimage.** `configHash` gave the SAME hash to `floor: 1000`
   and `floor: "1000"` - opposite verdicts. Everything hashed now goes through `canon.mjs`.
2. **A refusal sharing a channel with an answer.** `ttlExpired` returned `null` for "cannot
   evaluate", and `null` is falsy, so the experiment never expired.
3. **A gate that throws instead of refusing.** An exception has no outcome and no reasons, so a
   caller looping inside try/catch skips the item rather than recording a refusal.
4. **The read path is not the write path.** The reader replays what was written and does not
   re-validate, so every consumer must re-assert the grammars on read.

Phase 03's lineage checks read the same spine and hash the same kinds of thing, so all four
apply directly.

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

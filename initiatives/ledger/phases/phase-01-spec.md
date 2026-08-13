# Phase 01 — Kill-distance

**Goal (one line):** Every venture's distance to each of its kill lines is visible in `arc pnl` and
in the daily brief, and the lines themselves cannot move without a receipt.
**Appetite:** 2 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] Root `ventures.yaml` exists, schema-versioned, shipping exactly the two v1 criteria
      `days_without_revenue` and `traffic_floor_monthly` (ADR-1008, PLAN Appendix B)
- [ ] Parser reads it and refuses malformed input loudly — a criteria parser that accepts a
      malformed line silently disables a kill switch
- [ ] `arc pnl` prints distance-to-line per criterion per venture
- [ ] A criterion at 80% or closer renders a warning line; a crossing raises a needs-you item in the
      brief (REQ-03)
- [ ] Both are computed **at render** by the ledger lib: the phase diff emits 0 events, verified by
      asserting the spine's event count is unchanged across a render (ADR-1000)
- [ ] A `ventures.yaml` edit with no accompanying `decision.recorded` receipt produces an
      `UNRECEIPTED CRITERIA CHANGE` refusal, pinned as a fixture (ADR-1008)
- [ ] **Adversarial pass complete** on the `ventures.yaml` parser: two fresh agents on different
      surfaces, holes fixed and pinned as red fixtures, before its lint is promoted from WARN to
      FAIL. The attacker prompt carries the lane's running fixed-defect list with the instruction to
      check each one in every other file
- [ ] REQ-03 green on 3-OS CI, read per job with the head SHA confirmed
- [ ] Tracker updated: the Phase 01 row in `initiatives/ledger/PROGRESS.md` flipped, plus a dated
      entry under that file's `## Done log` section

## Verification plan

- **Test command:** `bats tests/ledger-ventures-parser.bats tests/ledger-kill-distance.bats`
- **Expected failure first:** `tests/ledger-ventures-parser.bats` case "an unreceipted criteria edit
  is refused" fails before the receipt check exists, asserting output contains
  `UNRECEIPTED CRITERIA CHANGE` and getting a clean render instead — the failure message is the
  absent refusal, not a crash, so the fixture and a stub parser land first and the test is watched
  going red on the missing string. `tests/ledger-kill-distance.bats` case "a render emits no events"
  fails first by asserting the spine event count is equal before and after, which a naive
  implementation that emits a crossing event breaks immediately.
- **Live demo scenario:** with a scratch spine holding 91 days of no revenue for venture `lexos` and
  a `ventures.yaml` setting `days_without_revenue: 90`, run `arc pnl --venture lexos`. Expected: a
  crossing line for that criterion and a needs-you item in `arc brief`. Lower the threshold to 120
  without a receipt and re-run: expected `UNRECEIPTED CRITERIA CHANGE` and no render.
- **Real-system check:** `ventures.yaml` is created at the repo root for real this phase, and the
  receipt path is exercised with a real `decision.recorded` emission on a scratch spine — the
  emission is confirmed present in `events/` and absent from `events/_quarantine/`.
- **Expected evidence:** bats output on 3 OSes, the refusal fixture, the before-and-after spine event
  counts proving 0 emissions from a render, and the rendered brief needs-you item.

## Rabbit holes in this phase

Adding more kill criteria because ledger now computes MRR — the detour is that v1 ships exactly two,
and a third is a later receipted decision (ADR-1008). Building a criteria expression language —
the detour is two scalar thresholds and nothing evaluable.

## Out of scope for this phase

Reconciliation, `month.closed` and costs (Phase 2). `--simulated` (Phase 3). Auto-kill is a
permanent no-go in every phase: meters inform, and killing a venture stays a human
`decision.recorded`.

## Your-setup / pending

The real kill thresholds for `lexos`. Placeholder values are used until the owner supplies them, and
because the file now requires a receipt to change, the first real edit is itself a
`decision.recorded` — which is the mechanism working, not an obstacle.

## Non-negotiables (verbatim from PLAN)

- Derived-only: delete derived state, replay, and the P&L is identical — twin-determinism runs in CI from Phase 0 and never leaves (ADR-1000, ADR-1014).
- Real money only in real views; simulated revenue is structurally excluded, never filtered out at the end (REQ-01).
- PII never lands on the spine, and the validator that enforces it ships before any ingest path exists (ADR-1002).
- Money is integer minor units end to end; a non-integer monetary value is rejected, never rounded (ADR-1012).
- Ledger records money and never moves it: no ledger code initiates a payment, refund, transfer or price change (Constitution E2, ADR-1011).
- Parser-class surfaces — payload normalizer, `ventures.yaml` parser, FX handling, export parsers — get a mandatory adversarial construct-a-breaking-input pass by two fresh agents on different surfaces, holes fixed and pinned as red fixtures, before any FAIL promotion.
- A test asserts it RAN before asserting what it printed; a gate that can only report absence is not a gate (ADR-1014).
- Absent stays absent: nullable-cost honesty end to end, with `source` surfaced on every cost line (MP-F inherited, ADR-1006).
- Month-close is human-run, always; a future scheduler may invoke the same CLI but the gate logic never moves into a daemon.
- Any new or edited file that enters the sync set regenerates `tests/fixtures/sync-golden/tree-manifest.txt` in the same commit — the gate is byte-identity and invisible locally, and membership is decided by the product catalog, never assumed.
- Any edit to this list is swept into all four phase specs' verbatim copies in the same commit — the writer of a change is structurally blind to the sections citing it, and this list is cited four times by construction.
- Inherited whole: zero-dependency Node >=18, bash-3.2/POSIX with no GNU-only constructs, bats in central `tests/` (ADR-0021), 3-OS CI red means no merge, new lints WARN-first in TRIAL, an evidence bundle per phase-done, emit via the emitter and read via the reader only.

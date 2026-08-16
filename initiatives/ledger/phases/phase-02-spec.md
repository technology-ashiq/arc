# Phase 02 — Close and costs

**Goal (one line):** A month can be frozen behind a green per-rail reconciliation, and the cost side
of the P&L renders three honestly-labelled sources that are never added together.
**Appetite:** 2 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] `arc pnl --close YYYY-MM` on IST month boundaries, taking per-rail reconciliation input via
      `--reconcile-file` (summing Phase 0's typed parser result) or `--reconcile-total` (ADR-1015)
- [ ] The gate blocks in **both** directions: a shortfall lists missing-payment candidates, an excess
      lists duplicate suspects by `provider_payment_id`, and a rail with no input blocks exactly as a
      mismatched one does — "no input" and "matches" must never render the same. A rail given
      **both** `--reconcile-file` and `--reconcile-total` whose totals disagree is itself a refusal,
      never a silent pick-one (ADR-1005, ADR-1015)
- [ ] `month.closed` added to `KINDS` in `.claude/scripts/hq/lib/validate.mjs`, taking the vocabulary
      from **44 to 45**, with the count read from the live array and never hardcoded (ADR-1004)
- [ ] **In the same commit**, `arc-brief.mjs`'s `GROUPS` table gives `month.closed` a section:
      `tests/policy-brief.bats` derives its coverage list from `KINDS` and asserts
      `all-<count>-grouped`, so a kind added to `KINDS` with no group fails that suite shut. Verified
      2026-08-12: `month.closed` has no entry today. Run `git log origin/main --oneline -5` on both
      files first — bench, engine and leads are live and these are shared organs owned by no lane
- [ ] A green gate emits exactly 1 `month.closed` carrying the summary and the input shas. The
      emission is verified by listing **both** `events/` and `events/_quarantine/` and finding it in
      the first — retro 2026-08-02 records an emitter exiting 0 while every receipt was quarantined
- [ ] Post-close correction fixtures: a refund recorded after the close leaves the closed month's
      bytes unchanged and appears in the current month (ADR-1004)
- [ ] Cost trichotomy renders measured, declared and allocated as separately labelled lines, never
      summed into one number; a mixed-source month renders 2 labelled lines rather than 1 total
      (ADR-1006, REQ-06)
- [ ] Declared fixed and subscription costs are monthly `cost.incurred` events — no cost config file
      appears anywhere in the diff (ADR-1001)
- [ ] `venture: arc` costs render as Overhead, unattributed to any venture
- [ ] Daily spend line appears in `arc brief` when spend data is present
- [ ] `--explain` shipped if the appetite is intact; it is the **first pre-authorized cut** if not
- [ ] **Adversarial pass complete** on the reconciliation gate and the export-sum path: two fresh
      agents on different surfaces, holes fixed and pinned, before FAIL promotion. The attacker
      prompt carries the lane's running fixed-defect list from Phases 0 and 1, with the instruction
      to check each one in every other file
- [ ] REQ-05 and REQ-06 green on 3-OS CI (plus REQ-07 if not cut), read per job with the head SHA
      confirmed
- [ ] Tracker updated: the Phase 02 row in `initiatives/ledger/PROGRESS.md` flipped, plus a dated
      entry under that file's `## Done log` section

## Verification plan

Coarse at kickoff, refined via `/arc-change` when the phase starts: bats over a reconciliation
fixture set covering shortfall, excess, exact-match, missing-rail and post-close-correction, plus a
production-count assertion that reads the emitted `month.closed` back off the spine rather than out
of a fixture.

## Rabbit holes in this phase

Accrual accounting — the detour is that post-close corrections book into the recording month and the
no-gos keep tax books with the CA. Cost-allocation fairness modelling — the detour is that
`allocated` is labelled and crude is fine (ADR-1006). Reconciling anything other than a per-rail
total — the detour is that a rail is one provider account settling into one currency, and nothing
finer is attempted in v1.

## Out of scope for this phase

`--simulated` and the real-spine replay proof (Phase 3). Any provider API or webhook, permanently.
Auto-close on a schedule: the close is human-run, always.

## Your-setup / pending

A real provider total for at least one rail for one month, to exercise the gate against a number the
owner did not compute. With the live spine's money side at 0 events, that exercise is expected to be
a fixture rather than a real month — which is the honest position and is why closure language is
"mechanism proven, live value pending".

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

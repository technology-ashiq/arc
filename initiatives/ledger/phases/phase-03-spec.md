# Phase 03 — Proof

**Goal (one line):** Run the whole module against the real live spine and report what it honestly
says — which today is that there is no revenue yet — and demonstrate the same views over simulated
data without a single simulated rupee touching a real view.
**Appetite:** 1 day — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-00, phase-01, phase-02

**The acceptance of this phase is an empty answer.** The live spine's money side was 0
`revenue.received`, 0 `revenue.simulated`, 0 `cost.incurred` and 0 `run.completed` when this plan
was written. `arc pnl` rendering "no real revenue yet", honestly and without inventing a number, IS
the proof — not a disappointing result to be worked around.

## Exit criteria (Definition of Done)

- [ ] `arc pnl` run against the **real** live spine in the main clone, rendering honest-empty output
      with no fabricated or placeholder figures anywhere in it
- [ ] **The zero is corroborated against the mechanism, never accepted at face value:** a raw count
      of `revenue.received`, `revenue.simulated` and `cost.incurred` lines across the live spine's
      day files, taken independently of `spine.mjs`, is compared against what the reader reports, and
      the two must agree. Retro 2026-07-28 (arc-cycle2) recorded a day of zero receipts read as "no
      work happened" when work had happened and the instrument was wrong for 4 days — inside the very
      phase built to catch it. This phase's entire acceptance IS a zero, so the zero gets tested
- [ ] `arc pnl --simulated` ships **if the appetite is intact; it is the second pre-authorized cut**
      (after REQ-07) if not — the cut order is only real where the owning phase spec encodes it.
      When shipped: renders the same views over `revenue.simulated` events only, watermarked
      SIMULATED on every line; a spine holding both yields 0 simulated rows in the real view and 0
      real rows in the simulated view (REQ-08)
- [ ] **Production counts asserted from the spine, not from fixtures**: the number of `month.closed`
      events actually on the live spine is read and reported, whatever it is. Retro 2026-08-10
      (arc-policy) recorded an entire engine shipping with 4 new kinds and 0 real emissions, and this
      line exists so that number is stated rather than discovered later
- [ ] Evidence bundle: fixture index, both adversarial reports from Phases 0-2, golden `arc pnl`
      renders, golden brief output, and the engine-equivalence log naming which engine each leg ran
      (ADR-1014)
- [ ] The whole build re-verified reader-only: `spine-reader-lint.sh` reports 0 violations, and the
      only kind ledger emits is `month.closed` (ADR-1000)
- [ ] `/arc-retro` run, with every assumption-ledger trigger that names a spine count **actually
      queried** before a status is written — a dogfood-gated row is recorded NOT EVALUABLE rather
      than VALIDATED
- [ ] Closure language recorded verbatim in PROGRESS and HISTORY: **mechanism proven, live value
      pending.** The live-value milestone is the first real month closed with a green reconciliation,
      expected around September or October 2026 when LexOS earns
- [ ] Tracker updated in ONE commit with the close: the Phase 03 row in
      `initiatives/ledger/PROGRESS.md` flipped, a dated entry under that file's `## Done log`
      section, the lane's `status:` machine header moved off LIVE, the `ledger` row in
      `PORTFOLIO.md`, and `docs/HISTORY.md` — retro 2026-08-03 records a lane left LIVE all day
      after its merge, with the board still advertising a PR already in

## Verification plan

Coarse at kickoff, refined via `/arc-change` when the phase starts: run against the real spine in
the main clone (not a worktree — the canonical spine is gitignored and per-clone), capture the
rendered output as evidence, and diff the simulated view against the real view to prove structural
exclusion rather than filtering.

## Rabbit holes in this phase

Manufacturing revenue to make the demo look better — the detour is that `--simulated` exists
precisely so nothing has to be faked in a real view, and a simulated rupee in a real view is a
non-negotiable violation. Extending the cycle to wait for real revenue — the detour is the
live-value milestone, which is explicitly not a gate on this closure.

## Out of scope for this phase

Any new capability. This phase proves and closes. A third export parser, a dashboard, a slash
command and multi-currency beyond INR plus USD (ADR-1013) are all later slots.

## Your-setup / pending

Nothing. If a first real payment happens to arrive before this phase runs, the assumptions ledger's
last row fires and the proof upgrades from simulated to live — which is a better outcome, not a
re-plan.

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

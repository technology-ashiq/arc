# Phase 05 — Debt budget in kickoff-lint

**Goal (one line):** a new cycle for a lane with more than 20 open debt rows must carry a `Debt:` phase ≥ 20% of appetite that names the open rows it closes (REQ-07, ADR-0078).
**Appetite:** 0.4 days
**Depends on:** phase-04

## Non-negotiables (verbatim from PLAN)
- ADR-0051: no value on the board is typed by hand; `stale` is derived by the job and never written into PORTFOLIO.md (ADR-0079).
- Lock 4: PORTFOLIO.md's columns and row grammar do not change; no health score, no owner column, no ETA.
- The freeze's exempt lanes are read from the ruling's payload, never hardcoded; an unreadable ruling refuses, never exempts (ADR-0077).
- `hq.jobs.yaml` and `hq.policy.yaml` are written only by the owner-apply script the owner runs (ADR-1750); the job never runs ungoverned.
- The spine is read only through `.claude/scripts/hq/spine.mjs`; zero new event kinds.
- Lock 5: two-surface `/arc-attack` (logic + boundary, ADR-0226) per gate PR, carrying `initiatives/portfolio/fixed-defects.md`; the author is never the attacker; one round per PR.
- Tests run on CI only; every fixture asserts it RAN before asserting what it printed.
- feat/* branch; push freely; merge once, after every phase is complete (owner, 2026-10-14).

## Exit criteria (Definition of Done)
- [ ] `kickoff-lint.mjs` gains `[debt-budget]`, reusing Phase 04's new-cycle detector
- [ ] open-row reader handles all six real ledger header grammars
- [ ] `tests/portfolio-debt-budget.bats` added, RAN-first, green on CI 3 OS per-JOB
- [ ] live demo: open counts printed for the real face / design / launch / distribute ledgers and 10 sampled rows hand-checked (A4)
- [ ] one bats case runs `kickoff-lint.mjs --lane portfolio` on the CI checkout itself and asserts `[new-cycle-unknown]` is absent (base resolved, via `--base` from the PR base SHA if the checkout is shallow); on any leg where it is present the case FAILs, not WARNs
- [ ] two-surface `/arc-attack` before push; findings fixed or recorded
- [ ] tracker updated

## Verification plan
- **Test command:** `bats tests/portfolio-debt-budget.bats` (CI only)
- **Expected failure first:** "21 open rows, new cycle, no Debt: phase → exit 1 `FAIL [debt-budget]`" fails with `expected status 1, got 0` before the gate exists
- **Live demo scenario:** a debug flag `--debt-count <lane>` prints `open=<n> total=<m> ids=<first five>` for each real ledger; a fixture new cycle for a 21-row lane is refused, then passes once a `Debt: … debt #3` phase at 20% is added
- **Real-system check:** hand count of 10 sampled rows across the four heavy ledgers matches the reader
- **Expected evidence:** `initiatives/portfolio/evidence/phase-05/` — counts, hand-check table, CI run id, attack report

## Rabbit holes in this phase
- Normalising other lanes' ledgers — read them as they are; never edit them.

## Out of scope for this phase
Paying any lane's debt; a status column in ledgers.

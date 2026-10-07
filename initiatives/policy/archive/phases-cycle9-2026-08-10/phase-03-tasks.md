# Build Brief — phase 03 · Birth-rule and cap inventory, honestly scoped

spec-hash: sha256:3d806968233f5b059c71620ea5dc42825766a3603567809df38cb32e99caa502
lane: policy
reqs: 
adrs: 0023, 0028, 0068, 0069, 0106, 0107, 0501, 0502
blast-radius: .claude/scripts/plan/kickoff-lint.mjs, PROGRESS.md, docs/trial-ledger.md, engine/router.yaml, processes/*.process.yaml
no-gos: 
blast-radius-dropped: 6

### Non-negotiables

- **Fail-closed everywhere, honestly scoped (ADR-0501)**: a policy check that throws blocks the run (ADR-0028 fail-safe precedent); a hook fragment exits 2 on its own internal error; and because a hook that never runs cannot deny, every high-blast-radius capability also carries a static `permissions.deny` backstop. An event that lands in quarantine is never reported as enforcement success (ADR-0106/0032).
- **Enforcement lives in code paths agents cannot bypass** — the `arc-run` wrapper and registered hooks; never prompts, never convention.
- **Deny-by-default**: no wildcard grants, a kind absent from the file is read-only, unknown fields are hard errors (POL-B).
- **E2's five items are never above L1**, quoted verbatim from the adopted Constitution (receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`); the un-grantable resource list (ADR-0502) is excluded from **every write grant and every shell grant capable of mutating a file** (`git checkout --`, `cp`, `sed -i`, `mv`, output redirection) regardless of ceiling or cap — `shell` and `write` are separate vectors, so an exclusion written against writes alone is not an exclusion.
- **No auto-promotion, no auto-recovery, no time-decay** — every raise is a human decision citing trial-ledger evidence (A4, A1).
- **Money**: Mode A only; no provider call before a successful reservation; no real-money movement above L1; spend-capable kinds excluded from any future scheduling in v1.
- **One implementation, two consumers** (POL-D) — the wrapper and the hooks call the same library; two interpretations of policy is guaranteed drift.
- **Counts derived, never hardcoded** (ADR-0107); profiles and hashes forward-only, never backfilled or estimated (ADR-0068 spirit).
- **`policy-lint` FAILs from birth** — it is a validator (spine strict-mode exit-2 precedent), not an advisory lint; every other new advisory lint starts WARN-first in TRIAL.
- **A gate is not done until a fresh agent that has not seen the implementation has attacked it**, on two different surfaces, and every hole found is pinned as a permanent regression fixture.
- **Every phase close leaves its receipt on the spine**, and "tests green" means green on CI, read per job.
- Constitution articles this plan upholds, for kickoff-lint: E1, E2, E3, A1, A2, A4, A5, A8, A9, A10.

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: **Cap inventory recorded** from the tree as it is when this phase starts, one row per real enforcement point with a `file:line`: engine budgets (`arc-run --budget`, parsed today but never enforced as authority), `engine/router.yaml` (a tier-to-model map, **not** a spend cap), `processes/*.process.yaml` `permissions:` blocks (declared, validated against nothing today), council mode envelopes (confidence buckets, not spend). A row that turns out not to be a cap is recorded as not-a-cap rather than quietly dropped.
kind: logic
risk: high
proof: reopen every cited file:line and check it against the claim; re-derive each load-bearing NEGATIVE by grep rather than accept it
tier: static
sources: phase-03-spec.md
decision: scoped to REQ-07's four named areas plus what contradicts the plan, NOT every timeout and maxBuffer in the tree — inventory completionism is this phase's named rabbit hole. A survey agent swept; the table was verified by hand.
result: 53/53 cited lines reopened and matched, 0 missing, 0 surprises. Three negatives re-derived independently — zero budget references in any driver, concurrencyRefusal referenced only from two bats files, no seat counter in council code. ONE FINDING: leads is a live cap-bearing module (ADR-0403, guardSend reached from sequencer.mjs:83), which falsifies the PLAN's stated ground for deferring migration. Recorded, not acted on. Artifact: initiatives/policy/evidence/phase-03/cap-inventory.md
commit: (empty until proven)

#### slice: 02

title: **Birth-rule wired** as a check in `.claude/scripts/plan/kickoff-lint.mjs`, **WARN-first in TRIAL** (it is advisory lint, unlike `policy-lint`): a module that lands after policy went live without a policy row is flagged, with the trial-ledger entry that would let a future `/arc-retro` promote it to FAIL.
kind: logic
risk: medium
proof: 9 new bats tests in tests/kickoff-lint.bats ([birth-rule] family), plus a mandatory mutation control — two FRESH adversarial agents on different surfaces, each building a mutant kickoff-lint with the check deleted and reporting which tests stay green
tier: contract
sources: phase-03-spec.md
decision: NO date and NO git-history boundary for "born after policy went live". All 3 processes already have rows, so the set is complete TODAY and any new process without one flags immediately — the birth boundary is implicit in the current state, needs no clock, and survives a shallow CI checkout where `git log --diff-filter=A` returns nothing. The ORPHAN direction is deliberately NOT implemented: policy-lint already hard-FAILs it (lint.mjs:126), and a second gate on one relation is the drift POL-D forbids. Name resolution is IMPORTED from a new lib/policy/subjects.mjs rather than re-implemented, and policy-lint now imports the same function it used to keep private.
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: **Migration is deferred, not attempted.** The Current-state survey already established that no live cap-bearing module exists; `PLAN-leads.md` is the named future candidate, waiting on its own unfired trigger. Phase 3 does not go hunting for an implicit cap to migrate so that the REQ looks fuller. The deferral is written into `PROGRESS.md` with the condition that reopens it.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: Retired cap paths, if any are found, are **attic'd rather than deleted** (A10, ADR-0023).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: `kickoff-lint` still passes for **every existing lane**, not only `policy` — this file is run by all of them, and a check that breaks a sibling lane's kickoff is a cross-lane regression.
kind: logic
risk: medium
proof: run kickoff-lint for all 8 lanes on this branch AND on the stashed origin/main tree, and compare — a lane that was already failing is not a regression, and a lane that was passing must still pass
tier: integration
sources: phase-03-spec.md
decision: the comparison is against the PRE-CHANGE tree, not against an expectation. Asserting "7 of 8 pass" alone would have hidden whether the 8th was mine.
result: 7/8 exit 0, zero [birth-rule] lines anywhere (correct — all 3 processes carry rows). design exits 1 on `[plan-exists] PLAN.md not found`, BYTE-IDENTICAL before and after the change (verified by git stash), so it is pre-existing and not a regression. The check is silent on every lane, which is the intended state for a tree with no ungoverned process.
commit: (empty until proven)

#### slice: 06

title: Tests green on CI; tracker updated; phase-close receipt on the spine.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

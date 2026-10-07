# Phase 03 — Birth-rule and cap inventory, honestly scoped

**Goal (one line):** from this phase on, a module is born with its policy row in the same change,
and the caps that already exist in the tree are written down as they are — not as they should be.
**Appetite:** 0.25 days — blown appetite means cut scope or kill, never extend silently. It
shrank from 0.5 because the kickoff attack panel established that this phase's migration is
**deferred by evidence rather than conditional**: the Current-state survey already proved no live
cap-bearing module exists, so there is nothing to go hunting for. The reclaimed 0.25 days went to
Phase 0, which the simulation gate showed was under-scoped.
**Depends on:** phase-02

## Exit criteria (Definition of Done)

- [ ] **Cap inventory recorded** from the tree as it is when this phase starts, one row per real
      enforcement point with a `file:line`: engine budgets (`arc-run --budget`, parsed today but
      never enforced as authority), `engine/router.yaml` (a tier-to-model map, **not** a spend
      cap), `processes/*.process.yaml` `permissions:` blocks (declared, validated against
      nothing today), council mode envelopes (confidence buckets, not spend). A row that turns
      out not to be a cap is recorded as not-a-cap rather than quietly dropped.
- [ ] **Birth-rule wired** as a check in `.claude/scripts/plan/kickoff-lint.mjs`, **WARN-first in
      TRIAL** (it is advisory lint, unlike `policy-lint`): a module that lands after policy went
      live without a policy row is flagged, with the trial-ledger entry that would let a future
      `/arc-retro` promote it to FAIL.
- [ ] **Migration is deferred, not attempted.** The Current-state survey already established
      that no live cap-bearing module exists; `PLAN-leads.md` is the named future candidate,
      waiting on its own unfired trigger. Phase 3 does not go hunting for an implicit cap to
      migrate so that the REQ looks fuller. The deferral is written into `PROGRESS.md` with the
      condition that reopens it.
- [ ] Retired cap paths, if any are found, are **attic'd rather than deleted** (A10, ADR-0023).
- [ ] `kickoff-lint` still passes for **every existing lane**, not only `policy` — this file is
      run by all of them, and a check that breaks a sibling lane's kickoff is a cross-lane
      regression.
- [ ] Tests green on CI; tracker updated; phase-close receipt on the spine.

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: a bats suite that
runs `kickoff-lint` against a fixture module with a policy row (passes), one without (warns with
the birth-rule code), and against each existing lane's real tracker (must stay green) — plus the
committed inventory table, checked by opening each cited `file:line` rather than by trusting the
table.

## Rabbit holes in this phase

- **Migration completionism.** Hunting every implicit cap in every script is not this cycle.
  Inventory plus birth-rule, then stop.
- **Promoting the birth-rule lint to FAIL early.** It is advisory and starts WARN-first in
  TRIAL, per the standing rule. Promotion is `/arc-retro`'s call against `docs/trial-ledger.md`,
  not this phase's.
- **Rewriting `router.yaml` into a cap.** It is a tier-to-model map. Turning it into a spend cap
  is a different build.

## Out of scope for this phase

Any actual migration of an existing cap-bearing module (reopens as new work the day one exists) ·
the adversarial security pass (Phase 4) · re-tiering any model seat, which is C5's territory
(ADR-0069) · touching `/arc-capability`, which vets what may **enter** the toolchain while this
engine governs what a run may **do** (POL-J).

## Your-setup / pending

Nothing.

## Non-negotiables (verbatim from PLAN)

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

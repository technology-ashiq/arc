# Phase 02 — Receipts and the interactive surface

**Goal (one line):** every authority change becomes a receipt on the spine with a deterministic
state machine behind it, and an interactive session obeys the same law as a headless run — hooks
where Phase 0's matrix proved interception, a static deny floor where it did not.
**Appetite:** 1.25 days — blown appetite means cut scope or kill, never extend silently. The
pre-planned first cut is the `arc brief` / inbox rendering, which is display and carries no
enforcement property.
**Depends on:** phase-00, phase-01

## Exit criteria (Definition of Done)

- [ ] Vocabulary ADR merged adding exactly **four** kinds on the live `KINDS.length` (derived,
      never a hardcoded total): `policy.level.changed`, `policy.demoted`, `spend.reserved`,
      `spend.released`. Two kinds for promotion and demotion because there are two truth
      sources — human-decided and machine-derived — following the `revenue.received` /
      `revenue.simulated` precedent. Validators land in
      `.claude/scripts/hq/lib/validate-policy.mjs`, imported into `validate.mjs` beside the
      evolve- and leads-owned modules.
- [ ] Every new kind has a **closed typed payload**, is idem-bound (ADR-0304 pattern), carries
      the policy file hash (forward-only, never estimated) and a run correlation id. Payload
      keys are authored **sorted**, because `tests/spine-emit.bats` round-trips every ACCEPT
      fixture byte-for-byte through `canonicalize()`.
- [ ] The **unknown-kind hostile fixture is re-run** after the extension (ADR-0106 rule), and
      the derived-count assertion updated to the new live length.
- [ ] **Promotion chain live end-to-end:** `approval.requested` under the strict
      `subject: "policy.promotion"` profile — `action_kind`, **`capability`** (ADR-0505),
      `from_level`, `to_level`, `trial_ledger_ref`, `policy_hash`, `correlation`, unknown keys
      rejected in the `assertDecision` style — then a human `decision.recorded` through
      `.claude/scripts/hq/arc-inbox.mjs` (whose payload is closed to `decides|verdict|reason`,
      so the trial-ledger citation rides on the request, not the decision), then
      `policy.level.changed` referencing that decision. The validator **rejects an approved
      level above the ceiling at decision time**, not at emit time.
- [ ] **Automatic demotion:** `incident.raised` → `policy.demoted` with
      cap = `max(L0, effective-at-incident − 1)` **for the capability involved in the denied
      action only** (ADR-0505), in the same run, incident reference mandatory. Fixtures include
      the cap-above-ceiling bite, a same-run double incident, a demotion-versus-promotion race
      whose tie-break is spine append order, and a **cross-capability isolation** case proving a
      `network` incident leaves the same kind's `write` cap where it was.
- [ ] **Reducer replay fixture:** the same event stream yields the same effective level, always.
- [ ] **Hook fragments** in `.claude/hooks/PreToolUse.d/` for every class Phase 0's matrix
      proved, each calling the shared library with zero duplicated policy logic and **each
      exiting 2 on its own internal error**. MCP classes are matched as `mcp__SERVER__TOOL`
      across the four servers in `.mcp.json`.
- [ ] **Static deny floor** written into `.claude/settings.json` for `spend`, `deploy`,
      `publish` and every E2-adjacent action (ADR-0501), plus the un-grantable resources of
      ADR-0502. A **cross-check test fails if layer 2 ever contradicts layer 1** — that test is
      what keeps POL-D's single-interpretation rule true across two representations.
- [ ] Every class the matrix could not prove is fail-closed by a static deny entry or capped at
      L0/L1. **No class is left unassigned.**
- [ ] Interactive bypass fixture: a session cannot write, shell, network, message, publish,
      deploy or spend outside policy.
- [ ] `arc brief` and the inbox render pending promotions and open incidents. **Cut this first
      if the appetite is going.**
- [ ] Tests green on CI; two fresh adversarial agents on different surfaces (event/state machine
      vs hook and settings boundary), each carrying the lane's running defect list; holes fixed
      and pinned.
- [ ] `.claude/settings.json` merge checked against `origin/main` before and after — `leads` is
      LIVE and edits the same file; take the stronger version at any conflict. `tree-manifest.txt`
      regenerated; tracker updated; phase-close receipt on the spine.

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats suites for the
four new kinds (accept + hostile fixtures, derived count), an end-to-end promotion chain driven
through `arc-inbox` and read back from the spine directory rather than from emitter return
values, a demotion fixture set including the three race cases, and an interactive bypass suite
driven through real PreToolUse dispatch — with the layer-1-versus-layer-2 cross-check as the
gate that the two representations have not drifted.

## Rabbit holes in this phase

- **Hook framework generalization.** Fragments call the shared library. Refactoring the hook
  dispatch system itself is a no-go inherited from C5.
- **Trust scoring.** The state machine is `min()`, one-level bites and human raises. Anything
  smoother is a v2 debate.
- **A policy dashboard.** Brief and inbox rendering only, and even that is the first cut.
- **Re-deriving the deny floor.** Phase 0 decided which classes get one. This phase writes them
  down; it does not reopen the question.

## Out of scope for this phase

The birth-rule lint and cap inventory (Phase 3) · the two-day adversarial security pass over the
whole engine (Phase 4) · any migration of an existing cap · user-level MCP connectors (No-go,
ADR-0503) · anything scheduler-shaped, which becomes a note in `BRIEF-scheduler.md` and nothing
else.

## Your-setup / pending

Nothing new. The human decision in the promotion chain is exercised through `arc-inbox` by the
owner during the live demo — that is the phase's one human-in-the-loop step, and it is a
demo step rather than a setup prerequisite.

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

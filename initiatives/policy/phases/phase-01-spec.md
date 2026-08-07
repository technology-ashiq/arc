# Phase 01 — Headless enforcement: the wrapper cannot be talked past

**Goal (one line):** the Phase-0 decision function is wired into `arc-run` **before any driver is
invoked** — this phase is the wiring and its proof, not the building of the check — a denied
action produces no side effect at all, and the day's spend cap survives a second run, a crash and
a race.
**Appetite:** 1.25 days — blown appetite means cut scope or kill, never extend silently. The
50% tripwire (day 3.5) checks this phase specifically.
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] Phase 0's `authorizeAction` called from `.claude/scripts/engine/arc-run.mjs` **before** the
      `spawnSync("bash", [sh, "run", …])` driver invocation. There is one call site and it is
      the only one; a second path into a driver is a Phase-4 kill-criterion finding, so it is
      searched for now. **No policy logic is written here** — a second interpretation of policy
      at the call site is the POL-D violation this phase exists to avoid.
- [ ] Effective authority = process-declared ∩ policy grant ∩ driver-safe set. A process may
      request **less** than its grant, never more; the cross-check lint (POL-D) fails a process
      whose `permissions:` block exceeds its policy row.
- [ ] A denied action produces **no side effect**, emits `incident.raised`, and the same run's
      next authorization sees the demoted effective level **for that capability** (ADR-0505) —
      the cap is recomputed mid-run, not at the next start, and a network incident leaves the
      kind's `write` grant untouched.
- [ ] **Capability fixture matrix, one row per class, each asserting an absence:** denied write
      → the target file is byte-identical; denied shell → the process never starts; denied
      network → the fake server logs 0 requests; denied message → the fake provider has 0 send
      records; denied publish and denied deploy → the fake publisher has 0 releases; denied
      spend → 0 provider calls. Each fixture asserts the guarded code path **ran** before
      asserting what it produced — an absence that would also hold if nothing executed is a
      vacuous pass.
- [ ] **Bypass fixtures, all blocked:** direct driver invocation, a denied command nested inside
      an allowed shell, environment-variable injection, an alternate driver path.
- [ ] Deny-by-default proven at runtime (REQ-03): a kind absent from the file can read and do
      nothing else, one fixture per capability class; an empty policy file yields a fully
      read-only system; a **missing** policy file blocks every non-read action rather than
      granting them.
- [ ] Money guard core (REQ-06): read settled + active reservations from the spine → atomic
      `spend.reserved` under `withLock` → provider call with an idempotency key → `cost.incurred`
      (settlement profile) or `spend.released`. Reservation state is **derived from the event
      chain, never stored** — no status field on an append-only receipt.
- [ ] Money fixtures: under-cap allowed · exact-boundary behaviour pinned · over-cap blocked ·
      sequential second run blocked · lock-level concurrent attempt blocked · restart/replay
      identical · **crash before the provider call** (reservation open, no call attempted;
      restart retries under the same idempotency key) · **crash after the provider call, before
      settlement** (the reservation stays permanently open, is never auto-released or
      auto-retried, and surfaces as stuck for a human — the no-auto-recovery rule applies to
      money too) · **no provider call before reservation success**.
- [ ] Tests green **on CI**, per-job conclusions read.
- [ ] Adversarial pass: two fresh agents, different surfaces — one on the authorization decision
      logic, one on the wrapper/shell/OS boundary. Each carries the lane's running defect list
      with orders to check every Phase-0 fix in every **other** file. Holes fixed and pinned.
- [ ] `tree-manifest.txt` regenerated if a synced file changed; tracker updated; phase-close
      receipt on the spine.

## Verification plan

- **Test command:** `bats tests/policy-runwrapper.bats tests/policy-capabilities.bats tests/policy-bypass.bats tests/policy-spend.bats`
  — one file at a time, foreground; **CI is the gate**. (`tests/policy-authorize.bats` belongs to
  Phase 0 and stays green here.)
- **Expected failure first:** `bats tests/policy-capabilities.bats` fails on
  `@test "denied write leaves the target byte-identical"` — before this phase, `arc-run` has no
  policy check at all, so the driver runs, the write lands, and the assertion reports a sha256
  mismatch against the pre-run digest. That failure is the proof the fixture measures
  enforcement rather than absence of activity. Each file asserts its own registered test count
  from `BATS_TEST_NAMES`, and all `@test` names are ASCII-only.
- **Live demo scenario:** (1) Grant a test process `write` at `L2` with a write root of
  `tmp/allowed/`; run it through `arc-run` writing to `tmp/allowed/x` → succeeds. (2) Same
  process, same run, write to `tmp/denied/x` → blocked, `tmp/denied/x` does not exist, an
  `incident.raised` ULID is printed. (3) Immediately re-authorize in that same run → the
  effective level is one lower than it was in step 1, printed. (4) Set a daily spend cap of
  `100` minor units, run a job that reserves `80` → allowed; run a second → blocked with the
  reservation ledger derived from the spine and printed. (5) Kill the process between reserve
  and call, restart → the same idempotency key is reused, no double charge on the fake.
- **Real-system check:** `arc-run` is driven for real against a committed fake driver, and every
  spine event produced is read back from `.claude/state/hq/events/` — never asserted from the
  emitter's return value, because a quarantined event with exit 0 is exactly how this repo has
  reported success for something that never landed.
- **Expected evidence:** CI output for the four bats files; the printed capability matrix with
  its per-class absence assertions; the spine ULIDs of the `incident.raised`, `spend.reserved`
  and `spend.released` events produced during the demo, committed under
  `initiatives/policy/evidence/phase-01/`.

## Rabbit holes in this phase

- **Egress proxy engineering.** Network enforcement is an allowlist decision inside
  `authorizeAction` plus red-team fixtures. A forward proxy is its own cycle.
- **Refactoring `arc-run`.** Add the check at the one call site. Restructuring the runner
  because the insertion point is awkward is how a 1.25-day phase becomes three.
- **Auto-reconciling stuck reservations.** Tempting and forbidden — a reservation whose provider
  outcome is unknowable is a human decision, by the same rule that forbids auto-recovery of a
  demoted level.

## Out of scope for this phase

The four new spine event kinds and their vocabulary ADR (Phase 2 — this phase uses the existing
`incident.raised` and `cost.incurred`) · the promotion chain and automatic demotion as *events*
(Phase 2; the mid-run cap recomputation here reads the reducer, it does not yet emit
`policy.demoted`) · every interactive surface and hook fragment (Phase 2) · the birth-rule and
cap inventory (Phase 3) · the full adversarial security pass (Phase 4).

## Your-setup / pending

Nothing. The spend provider, the network endpoint, the message provider and the publisher are
all committed recording fakes (ADR-0104 pattern); POL-F bans real money above L1 in v1, so no
provider account or budget is needed.

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

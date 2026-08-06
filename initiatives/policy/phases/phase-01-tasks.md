# Build Brief — phase 01 · Headless enforcement: the wrapper cannot be talked past

spec-hash: sha256:400ef61f29c18e6d0b6ac253ed2ba79e77a7967147c2bc291a6289138f76dcdb
lane: policy
reqs: 
adrs: 0028, 0068, 0104, 0106, 0107, 0501, 0502, 0505
blast-radius: .claude/scripts/engine/arc-run.mjs, .claude/state/hq/events/, initiatives/policy/evidence/phase-01/, tests/policy-authorize.bats
no-gos: 
blast-radius-dropped: 10

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

title: Phase 0's `authorizeAction` called from `.claude/scripts/engine/arc-run.mjs` **before** the `spawnSync("bash", [sh, "run", …])` driver invocation. There is one call site and it is the only one; a second path into a driver is a Phase-4 kill-criterion finding, so it is searched for now. **No policy logic is written here** — a second interpretation of policy at the call site is the POL-D violation this phase exists to avoid.
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: Effective authority = process-declared ∩ policy grant ∩ driver-safe set. A process may request **less** than its grant, never more; the cross-check lint (POL-D) fails a process whose `permissions:` block exceeds its policy row.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: A denied action produces **no side effect**, emits `incident.raised`, and the same run's next authorization sees the demoted effective level **for that capability** (ADR-0505) — the cap is recomputed mid-run, not at the next start, and a network incident leaves the kind's `write` grant untouched.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **Capability fixture matrix, one row per class, each asserting an absence:** denied write → the target file is byte-identical; denied shell → the process never starts; denied network → the fake server logs 0 requests; denied message → the fake provider has 0 send records; denied publish and denied deploy → the fake publisher has 0 releases; denied spend → 0 provider calls. Each fixture asserts the guarded code path **ran** before asserting what it produced — an absence that would also hold if nothing executed is a vacuous pass.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **Bypass fixtures, all blocked:** direct driver invocation, a denied command nested inside an allowed shell, environment-variable injection, an alternate driver path.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: Deny-by-default proven at runtime (REQ-03): a kind absent from the file can read and do nothing else, one fixture per capability class; an empty policy file yields a fully read-only system; a **missing** policy file blocks every non-read action rather than granting them.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: Money guard core (REQ-06): read settled + active reservations from the spine → atomic `spend.reserved` under `withLock` → provider call with an idempotency key → `cost.incurred` (settlement profile) or `spend.released`. Reservation state is **derived from the event chain, never stored** — no status field on an append-only receipt.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: Money fixtures: under-cap allowed · exact-boundary behaviour pinned · over-cap blocked · sequential second run blocked · lock-level concurrent attempt blocked · restart/replay identical · **crash before the provider call** (reservation open, no call attempted; restart retries under the same idempotency key) · **crash after the provider call, before settlement** (the reservation stays permanently open, is never auto-released or auto-retried, and surfaces as stuck for a human — the no-auto-recovery rule applies to money too) · **no provider call before reservation success**.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: Tests green **on CI**, per-job conclusions read.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: Adversarial pass: two fresh agents, different surfaces — one on the authorization decision logic, one on the wrapper/shell/OS boundary. Each carries the lane's running defect list with orders to check every Phase-0 fix in every **other** file. Holes fixed and pinned.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: `tree-manifest.txt` regenerated if a synced file changed; tracker updated; phase-close receipt on the spine.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-01-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

# Phase 01 — handoff

What is now true, what the next phase inherits, and the two places a reader will otherwise
assume something the tree does not support.

## What Phase 01 delivered

| Surface | Where | What it does |
|---|---|---|
| Headless gate | `arc-run.mjs` `invoke()` | Consults `authorizeRun` before `spawnSync`. A denial produces **no side effect**: the driver process never starts |
| Second gate | `drivers/common.mjs` `runDriver` | The same question at the one function every driver core funnels through — because `arc-run` was never the only door, and the repo's own engine suite invokes a driver directly |
| Governing root | `run-gate.mjs` `policyRoot()` | Derived from the module's own location, never `--root` or `$ARC_ROOT`. `ARC_ROOT=/tmp/anywhere` used to disarm the whole gate in one variable |
| Money guard | `lib/policy/spend.mjs` | Reserve inside `withLock` with a **re-read**, ledger derived from the event chain, nothing stored |
| Demotion emitter | `lib/policy/incident.mjs` | An overreach at execute authority raises an incident and seals a demotion citing it |

## The three things a reader will get wrong

**1. The gate is coarse, and that is deliberate.** It blocks a run that declares a capability
policy denies **outright (L0)** and permits at L1 or above. Requiring `execute` here would deny
every run in the repo, since every pair is born at L1. L1 means *prepare and record, never
perform*, and a headless run producing a proposal is exactly that. The per-action question lives
at the tool boundary.

**2. A root with no `hq.policy.yaml` is NOT IN FORCE, and the run proceeds — loudly.** This looks
like a fail-open and is not. Deny-by-default is a rule *inside* a policy file; it is not a rule
about the file's own absence. A root that never adopted policy has declared nothing. Denying
there would brick every consumer repo and every fixture that copies the scripts into a temp
directory. What keeps it honest: where policy **is** in force, `hq.policy.yaml` is un-grantable
(ADR-0502), so no policed write can delete it to reach that branch. Recorded as an accepted
deviation in `phase-01-spec.md` — the spec said the opposite and the tree was right.

**3. The demotion fires at the ACTION boundary, not at the run gate.** `authorizeRun` pushes a
denial exactly when the effective level is already `L0`, so a demotion there could never fire
once. It fires only when the level would otherwise have **executed** — never on a `propose`
(every pair is born at L1, so that would walk the policy to L0 in a handful of ordinary calls),
and never at L1 even though hard denies do land there.

## What Phase 03 inherits

- **The birth rule is still a gap.** Every pair is born at L1 by `resolveEffectivePolicy`, but
  nothing inventories which `(kind, capability)` pairs exist or should exist. That is Phase 03's
  subject, and Phase 01 deliberately did not guess at it.
- **The absence matrix is narrowed, with the obligation attached to the code.** `write`, `shell`
  and `spend` have runtime absence rows. `network`, `message`, `publish` and `deploy` do not,
  because no policed sender exists to observe — **the phase that puts any of them behind a real
  call takes its matrix row with it, in the same change.**
- **`arc-brief`'s group table is 22 kinds behind the closed vocabulary.** Not this lane's to fix:
  `develop.*`, `slice.*`, `experiment.*` and the leads pipeline all fall through to the
  `ungrouped` catch-all, which now names them instead of dropping them silently.

## Nothing needed from the owner

No keys, no accounts, no infrastructure. The two decisions Phase 01 was blocked on — where the
demotion emitter goes, and whether the absence matrix covers all seven capability classes — were
taken on 2026-08-07 (option A on each) and are built.

# Phase 09 — Steel thread for ENG-H: one classified failure, one hop decision, one receipt

**Goal (one line):** a mock-driven dispatch goes input → classified failure → `nextHop` decision → `run.completed`
carrying `failure_class` and `hops[]`, end to end, and the three behavioural invariants (a)(b)(d) hold.
**Appetite:** 1.25 days — blown appetite means cut or kill, never a silent extension.
**Depends on:** phase-00

Serves **REQ-08** and **REQ-09** (PLAN). Decision: **ADR-0228** (ENG-H, forks F1–F4).

## Exit criteria (Definition of Done)

- [ ] `.claude/scripts/engine/failure-class.mjs` exists and is the ONLY owner of: the six-value `FAILURE_CLASSES`
      set, `classifyAttempt(observation)` (arc-run's observation → class), `familyOf(driver, model)` (F2 table),
      and the pure `nextHop(chain, hops, terms, now)` returning `{hop: true, to}` or `{hop: false, why}`.
- [ ] `drivers/common.mjs`: a produce() that throws an error carrying `arcFailureClass` gets `failure_class`
      written to the cost sidecar on its exit-1 path; a value outside the set is written as-is and arc-run reads it
      as `unknown` loudly. Exit map unchanged (0/1/2).
- [ ] `drivers/mock.mjs`: a recording key `__failure` (`{class, message}`) makes the replay fail with exit 1 and
      that declared class; `class: null` fails with no declaration. Stripped like `__cost`.
- [ ] `arc-run.mjs`: `attempt()` returns `{verdict, failureClass}` with the class from `classifyAttempt`; the
      fallback loop's ONLY hop condition is `nextHop(...)`; the loop also runs for `model-invalid` (F1: the
      cross-family hop replaces ADR-0204's rung 1 when the chain holds a different family, else rung 1 stays);
      `policy-refusal` / `budget` / `unknown` surface as today's `reason` values.
- [ ] `run.completed` carries `failure_class` and `hops[]` (`driver`, `tier`, `class`, `ms`, `cost?`) on every
      emit path — success, `fail()`, budget, policy, schema/proposal — with `reason` unchanged.
- [ ] Invariants (a), (b), (d) green on CI, each with a positive control; the classifier-drop mutant fails ≥1 of them.
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `node tests/engine-failure-class.mjs` (wired from `tests/engine-driver-contract.bats`; CI only,
  read per job — never run locally, owner instruction 2026-10-07).
- **Expected failure first:** before `failure-class.mjs` exists the probe's first import throws
  `ERR_MODULE_NOT_FOUND ... failure-class.mjs` and the bats wrapper fails on `RAN: N checks` missing.
- **Live demo scenario:** fixture root with `classes.commit-msg-draft: {driver: mock, fallback: [generic-api]}` and a
  `generic-api` pin under the routed tier; a local HTTP server counts hits.
  1. mock recording `__failure: {class: transport}` → arc-run prints `falling back to generic-api (transport)`, the
     server count reads 1, the receipt's `hops` has two entries `transport` then `ok`.
  2. `__failure: {class: policy-refusal}` → exit 1, `reason: policy`, server count **0**.
  3. `__failure: {class: null}` → exit 1, `failure_class: unknown`, server count **0**.
  4. mock answers JSON that fails the contract, server answers invalid JSON too → exactly one hop, then the proposal
     receipt, `hops` length 2, both `model-invalid`.
- **Real-system check:** n/a — fakes only this phase (mock + local endpoint); the real drivers' declarations are Phase 10.
- **Expected evidence:** CI per-job log line `RAN: N checks`, no `FAIL `; the mutant line
  `ok mutant: a classifier that lets every failure hop turns invariant fixtures red`.

## Rabbit holes in this phase

- Re-plumbing ADR-0225's hop validation — untouched; `nextHop` decides whether to hop, ADR-0225 whether the target is allowed.
- Making the chain terms mandatory — that is Phase 10. Here a term that is absent is simply not enforced.

## Out of scope for this phase

Chain terms at load, refuse-before-spend on terms, and real-driver declarations → Phase 10.

## Your-setup / pending

None — no key, no network.

## Non-negotiables (verbatim from PLAN)

- ENG-D's driver exit map stays `0` ok, `1` driver-fail, `2` budget-declined; the failure class travels in the cost sidecar and this cycle adds no exit code (ADR-0219, ADR-0228).
- Zero new event kinds; `run.completed` gains payload fields only, its `reason` values are unchanged, and every emit is VERIFIED to have landed in `events/` and not in `_quarantine/`.
- No component changes a model tier at run time; a hop keeps the routed tier, and every routing change is a reviewed `router.yaml` diff citing ADR-0069.
- One module owns the class set and the hop decision; no second copy of the rule exists in arc-run, bench, the face or a driver ("validate one read, compare another" is this lane's recorded twin).
- Every gate ships with a negative control that actually runs and proves the check can fail; the classifier-drop mutant is invariant (d)'s negative control, and a probe asserts it RAN before asserting what it printed.
- An unavailable cost, duration or class stays absent or `unknown` — never estimated, never inferred from a stderr guess (ADR-0069 b5).
- Every gate and parser this cycle ships gets the two-surface adversarial pass (`/arc-attack`: logic and boundary) before its PR merges, carrying this lane's fixed-defect list (`initiatives/engine/fixed-defects.md`).
- Tests run on CI only, read per job; nothing is reported done on local evidence.
- Before editing a shared root organ — `engine/router.yaml`, `docs/adr/`, `tests/`, `.github/` — run `git log origin/main --oneline -5 -- PATH`, and at a merge take the STRONGER version.
- A program embedded in a shell string carries no apostrophes, no single quotes, and — inside double quotes — no backtick and no dollar sign; such a program goes in its own file.

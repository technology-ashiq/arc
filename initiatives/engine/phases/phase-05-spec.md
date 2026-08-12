# Phase 05 — The shim

**Goal (one line):** `drivers/hermes` behaves like every other engine driver on the real contract, its output parser survives a two-surface adversarial pass, and `drivers/mock` replays a pinned transcript without ever standing in for certification.
**Appetite:** 1.5 days — blown appetite means cut or kill, never a silent extension.
**Depends on:** phase-04

## Exit criteria (Definition of Done)

- [ ] `drivers/hermes` honours the **real** ENG-D contract (ADR-0219): `run PROCESS INPUT_JSON BUDGET` → JSON on stdout, a cost sidecar, and exits `0` ok / `1` driver-fail / `2` budget-declined. No new exit codes are added to the driver layer.
- [ ] `--version` returns the runtime version **plus** the pinned config hash (ADR-0209), so the MP-F model seat can be filled from it.
- [ ] ADR-0204's ladder is inherited exactly: a schema failure is `arc-run`'s judgement after a `0` exit, producing one same-tier retry and then an `approval.requested` proposal. The shim never escalates and never retries on its own.
- [ ] The wall-clock is charged to the **RUN**: the shim receives the run's *remaining* time and never starts a fresh budget. A timeout is `reason: budget`, never `reason: driver`, and must not trigger the fallback path it would otherwise multiply (ADR-0210).
- [ ] **Adversarial pass by TWO fresh agents on different surfaces** — one on the parser's decision logic, one on the shell/OS/process boundary — neither having seen the implementation. Their prompt carries this cycle's running list of already-fixed defects with the instruction to check each one in **every other file**. Every hole found is pinned as a red fixture.
- [ ] Red fixtures pinned and passing: junk bytes, an ANSI flood, truncated JSON, injection-shaped output, empty stdout, a process that writes valid JSON and then does not exit, and output larger than any single read.
- [ ] `drivers/mock` replays a pinned transcript for keyless CI regression, and **swaps the RESPONSE, never the code path**. A separate probe proves the real path executes — an unreachable target reaches the shim's own code and produces the correct failure exit.
- [ ] Each driver artifact (stdout, transcript, cost sidecar, spine payload) passes `scanSecrets()`, with a negative control proving the check can fail.
- [ ] tests added & green **on CI, read per-JOB**, with the run's head SHA confirmed equal to local HEAD.
- [ ] tracker updated (PROGRESS.md row ✅ + done-log).

## Verification plan

- **Test command:** `npx bats tests/engine-hermes-contract.bats`
- **Expected failure first:** the test `drivers/hermes honours the three-code exit map` fails with `driver hermes: not found` before the shim exists. Every probe in this file asserts it **RAN** before asserting what it printed, and every fixture builder asserts its fixture is non-empty — an assertion shaped "output does not contain X" is satisfied by a crash and never stands alone here.
- **Live demo scenario:** run `arc-run --process commit-msg-draft --driver hermes --budget min=2` against the fixture process and watch it produce JSON, a sidecar and exit `0`; then run it with a budget small enough to trip the wall-clock and watch it exit `2` with `reason: budget`.
- **Real-system check:** the contract suite runs against **both** `drivers/mock` and the real runtime installed in Phase 04. The real arm must reach the shim's own code — proven by the unreachable-target probe, because a fake that returns before the real path runs is this lane's recorded 2026-08-03 defect.
- **Expected evidence:** `initiatives/engine/evidence/phase-05/` holding the two adversarial reports (each recording the agent's session id and an explicit statement that it read no implementation file), the pinned red-fixture corpus, and the CI run id with its per-job conclusions.

## Rabbit holes in this phase

- **Runtime feature-parity chasing.** The output contract is the equalizer. The shim wraps a worker; it does not expose a platform.
- **A perfect parser.** The bar is the pinned red corpus plus whatever the two fresh agents find. A newly imagined attack class becomes a fixture, not an open-ended hardening sprint.
- **Fixing the mock until it looks real.** The mock is a regression instrument. The moment it is asked to stand in for the real runtime, it has become the 2026-08-03 defect again.

## Out of scope for this phase

Isolation certification (Phase 06) · the router row, policy row and capped key (Phase 07) · the draft process and context packs (Phase 08). No real job runs here — the shim is exercised against fixture processes only.

## Your-setup / pending

Nothing new. This phase depends on the runtime installed and proven runnable in Phase 04; if that did not happen, this phase does not start.

## Non-negotiables (verbatim from PLAN)

- ENG-D's **driver-level** contract is untouched and the runtime adapts to arc, never the reverse — `common.mjs`'s exit map stays `0` ok, `1` driver-fail, `2` budget-declined, and this cycle adds nothing to it (ADR-0219).
- The data boundary is refused **above** the driver, at the arc-run layer, exit `5`, before the runtime process starts (ADR-0219). The arc-run exit space is separate from the driver's and already uses `0`/`1`/`2` for its own failures, so ADR-0219 publishes the full arc-run table before any fixture asserts `5`. The mechanism is built in Phase 06 because REQ-02's fixtures 2 and 3 assert it; specs for earlier phases carry this bullet as a forward commitment, not a claim already true.
- Certification means the REAL runtime, human-started, with receipts attached; a mock-green run is labelled regression and never certification, and that label is asserted by a test rather than written by hand. No green suite, no dispatch.
- Every gate, parser and shim this cycle ships gets an adversarial construct-a-breaking-input pass **before the PR that ships it merges** — never deferred to the phase close, because a rule only the close can enforce gets skipped for a whole phase. TWO fresh agents on different surfaces (decision logic, and the shell/OS boundary), neither having seen the implementation, attacking the **fixtures and tests as well as the code** — a green suite the author wrote is evidence about the author. Every hole is pinned as a fixture, and the attacker's prompt carries this cycle's running list of already-fixed defects with the instruction to check each one in every OTHER file. This binds REQ-04's router loader, REQ-06's boundary refusal and the POL-I birth-lint exactly as it binds REQ-01's parser.
- Every gate ships with a negative control that actually runs and proves the check can fail; a pass condition that is only an absence is not a pass, and a probe that shells out asserts it RAN before asserting what it printed.
- No component changes a model tier at run time; every production routing change is a reviewed `router.yaml` diff citing ADR-0069, and escalation ends in a proposal receipt (ADR-0204). Runtimes never self-register.
- The L1-drafts ceiling and the human publish gate are absolute. A draft that publishes itself is an incident, and publishing is a human copying it out — always.
- arc constrains boundaries (data in, actions out, money, time) and verifies outcomes; it never prescribes the runtime's method, model choice, or reasoning style. Review is accept/reject plus one line, never a line-edit (ADR-0218).
- Zero new event kinds; the closed vocabulary is derived by query, never by a remembered count. Every emit is VERIFIED to have landed in `events/` and not in `_quarantine/` — exit 0 from a fire-and-forget writer is not evidence anything was written.
- An unavailable cost, duration or fingerprint field stays absent — never estimated, never inferred, never interpolated (ADR-0069 b5, Constitution E3). Budgets are calibrated from recorded receipts, never guessed.
- Money is capped at the credential, and the honest claim is that the request crossing the ceiling completes while every later one is refused — no zero-overshoot claim is made anywhere.
- Human-started runs only this cycle. No daemon, no runtime-side cron or webhook pointed at arc, no unattended execution.
- The 3 pilot processes' pinned baselines are another cycle's evidence and are never regenerated; any file the sync-golden manifest hashes gets a named regeneration step that diffs the delta first and confirms only intended paths moved.
- Before editing any shared root organ this cycle touches — `hq.policy.yaml`, `engine/router.yaml`, `docs/adr/`, `tests/`, `.github/` — run `git log origin/main --oneline -5 -- PATH`. A hit since this branch's point means the collision is already in flight, and at the merge take the STRONGER version, never the earlier one. This is not hypothetical here: another live lane already took ADR-0207 inside engine's own band.
- Zero-dep Node plus POSIX is inherited: no vendor SDK in the shim, plain process invocation — checked by `package.json` carrying no new runtime dependency.
- A program embedded in a shell string carries no apostrophes and no single quotes, in code OR in comments — enforced by a grep check inside the adversarial pass this cycle already requires, never by vigilance, because this rule was written down and then broken three times anyway.
- All new lint ships WARN-first in TRIAL; evidence bundles are lane-scoped (ADR-0055); the mandate accelerates SEQUENCING, never QUALITY.

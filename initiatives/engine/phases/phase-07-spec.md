# Phase 07 — The hire

**Goal (one line):** Hire the contractor in one reviewed diff that carries its routing row, its policy row and its termination path together, put a hard-capped credential behind it, and set the class budget from measured runs rather than a guess.
**Appetite:** 1 day — blown appetite means cut or kill, never a silent extension.
**Depends on:** phase-06

Nothing in this phase runs before Phase 06's certification is green. No green suite, no dispatch.

## Exit criteria (Definition of Done)

- [ ] **ONE reviewed `router.yaml` diff** adds the runtime row carrying `cap: L1-drafts`, `hosted:`, `judge:` and `review_by:` — **all four mandatory**. A row where any one of them is **absent, an empty string, `null`, or malformed** (a `review_by:` that is not a date, a `cap:` outside the known set) **fails the router load** — proven by hostile fixtures covering each of those four inputs for each of the four fields, plus a negative control. "Missing" and "present but empty" are different inputs, and a loader that only checks presence is a guard that cannot fail (ADR-0212, assumption A-07).
- [ ] The row takes **no `models:` entry** — a runtime chooses its own model, and an entry there would assert a routing decision nothing applies (ADR-0217).
- [ ] The row's comment cites **two ULIDs**: the Build-out Mandate decision from Phase 04 and the hire decision from this phase (ADR-0217).
- [ ] `review_by:` is set **2 weeks** out and is **enforced at load time** (ADR-0216): dispatching through an expired row refuses loudly, naming the row and the file to edit, and emits **one idempotent** `approval.requested` rejustify-or-retire proposal. Propose-only in both directions — expiry never disables a row by itself and never renews one by itself. Idempotence is proven by a fixture that dispatches through an expired row five times and asserts exactly one proposal exists.
- [ ] **The same change** carries the executor process's row in `hq.policy.yaml` at ceiling L1 (POL-I birth rule), with birth-lint green and the filename stem matching the `name:` field.
- [ ] The hire flows `approval.requested` → `decision.recorded`, both verified to have landed in `events/` and not `_quarantine/`.
- [ ] **Termination is specified and demonstrated, not just written:** revoking the capped key stops dispatch immediately, and disabling the row by reviewed diff stops it structurally. The emergency path is ADR-0069 block (f) carve-out 2 — human-approved, carrying an expiry, follow-up ADR inside 48 hours.
- [ ] The **OpenRouter capped key** — issued back in Phase 04 so Phase 06's fixtures 4 and 10 had a credential to audit and exhaust — has its non-resetting ceiling **reviewed and set to the figure the owner recorded**, now informed by what Phase 06 and the calibration runs actually consumed (ADR-0213). No figure is invented to unblock this step; if none is recorded, this criterion blocks and says so.
- [ ] The key row lands in `.env.example` if it did not already in Phase 04, and the key is never printed or committed.
- [ ] Fixture: an exhausted key produces `fail` / `reason: budget` asserting the provider's **real HTTP 402**, with zero silent continuation.
- [ ] **The calibration baseline exists:** three runs at a deliberately generous wall-clock, their durations recorded, and the class budget derived **from those receipts**. A budget written before the receipts exist is a guess and is not accepted here.
- [ ] **Adversarial pass by TWO fresh agents on different surfaces** against the router loader and the expiry check. Holes pinned.
- [ ] tests added & green **on CI, read per-JOB**, head SHA confirmed equal to local HEAD.
- [ ] tracker updated (PROGRESS.md row ✅ + done-log).

## Verification plan

Coarse at kickoff, refined via `/arc-change` when the phase starts: four hostile router fixtures (one per missing mandatory field) plus an expired-row fixture asserting refusal and exactly one idempotent proposal, plus an exhausted-key fixture asserting the real provider error. Detailed verification for a phase this far out would be fiction.

## Rabbit holes in this phase

- **Key-vending automation.** Issuing and rotating capped keys stays a human act in v1. Automating it is vendor-API archaeology with real money attached.
- **A general expiry framework.** One field, checked where it is used. No scheduler, no daemon, no cron.
- **Auto-updating routing.** The file is hand-edited, forever in v1.

## Out of scope for this phase

The draft process, context packs, real jobs and verdicts (Phase 08). No POL-G eligibility attempt — that belongs to a later rung with its own evidence.

## Your-setup / pending

- **The capped-key ceiling figure is an owner decision and is required before the key is issued.** It is deliberately not invented (assumption A-05, ADR-0213). Until it is recorded, REQ-05 blocks — that is the criterion working, not a stall to route around.
- The key itself must be provisioned by a human; arc never vends it.

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

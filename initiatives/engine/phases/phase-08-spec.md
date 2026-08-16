# Phase 08 — The job

**Goal (one line):** Give the contractor one real job on owner-approved context packs, run it at least three times with full receipts, and record an accept-or-reject verdict per draft — win, lose or split.
**Appetite:** 1.5 days — blown appetite means cut or kill, never a silent extension.
**Depends on:** phase-07

## Exit criteria (Definition of Done)

- [ ] A `build-in-public-draft` process file is authored in `processes/` with output schema `{draft, sources, task-class, pack-ref}`, and it lands **with its `hq.policy.yaml` row in the SAME change** (POL-I birth rule, ceiling L1, birth-lint green, filename stem matching the `name:` field). **The conditional "if Phase 07 did not already carry it" is resolved and removed (`/arc-change`, 2026-08-16): Phase 07 cannot carry it.** `policy-lint` refuses a `kinds` entry whose process file does not exist, and this phase authors that file — so the grant and the file are one change or neither. Phase 07's copy of this criterion is struck with the same reason.
- [ ] **Context packs work as specified** (ADR-0214): an `external-ok` digest assembled from spine and day events, **approved by the owner before dispatch**, with **N dispatches declared at approval time** and per-dispatch receipts staying individual. The pack bounds the **data, not the angle** — unless the job pins an angle, the take belongs to the runtime.
- [ ] Fixture: a pack carrying a planted `internal-only` marker is **refused before the runtime process starts**, exiting `5` at the arc-run layer (ADR-0219), with a negative control proving the check can fail.
- [ ] Accepted past drafts and one-line rejection reasons **ride the next pack**, and the runtime's own persistent memory stays off — state lives in arc receipts (ADR-0211).
- [ ] The process runs through the runtime **≥3 times on arc's own build-out journey** (owner's choice, 2026-08-12). `run.completed` receipts are confirmed **present in `.claude/state/hq/events/` and absent from `_quarantine/`** — counted from the spine, never from the fixture suite. **This clause is never cut.**
- [ ] Each draft gets an **accept/reject plus one-line reason** receipt (`approval.requested` → `decision.recorded`), in a grammar kept ABS-D-compatible so absorb inherits it. The ABS-D deferral is recorded in one line.
- [ ] **Review is accept/reject, never a line-edit** (ADR-0218). Style-shaping happens only as a reviewed diff to the process file's brief, never as ad-hoc steering inside a dispatch.
- [ ] The **capability-gap verdict arm** is used and the waiver is explicit: no current driver runs this class as a process, so a paired baseline is **impossible and honestly waived in one line** — never fabricated, never quietly omitted.
- [ ] Drafts are stored as lane-scoped evidence and surfaced through the inbox for human pickup. **Nothing auto-moves. Publishing is the owner copying it out**, and no draft is published in this cycle.
- [ ] A **hand-written results table** summarising the runs and their verdicts — retro prose, never a reader, script or dashboard, because a win-rate tool is a standing no-go. This is the Appetite section's **first pre-decided cut**, so it is named here as a real deliverable: a cut that removes something no spec ever promised recovers nothing.
- [ ] Retro run via `/arc-retro --lane engine`, reading **accepted-draft quality** and not only safety counts — a pass condition that is only an absence cannot detect mediocrity.
- [ ] The retro records the cycle's **production** receipt counts read from the spine, so the record shows whether the engine was pulled or pushed.
- [ ] tests added & green **on CI, read per-JOB**, head SHA confirmed equal to local HEAD.
- [ ] tracker updated (PROGRESS.md row ✅ + done-log), and the lane header, the board and `docs/HISTORY.md` move in the same commit as the close — a lane whose HISTORY says CLOSED while its PROGRESS says LIVE is a defect, not a habit.

## Verification plan

Coarse at kickoff, refined via `/arc-change` when the phase starts: the planted-`internal-only` fixture with its negative control, plus a spine query counting `run.completed` rows for this process in `events/` and in `_quarantine/` separately. The three real runs are demonstrated live, not asserted. Detailed verification for a phase this far out would be fiction.

## Rabbit holes in this phase

- **Scoring-system invention.** Accept/reject plus a reason. Scoring math is bench's, in its own slot, and inventing one here is out of appetite.
- **Editing the draft.** The urge arrives on the first mediocre output. A draft that is 80% right is rejected with a reason, not edited to 100% — the improvement arrives through the brief or the feedback pack (ADR-0218).
- **Transcript archaeology.** Scrub and store. Mining transcripts is absorb's job.
- **Publishing "just to see".** No.

## Out of scope for this phase

Any publishing · a win-rate reader or dashboard · review sampling · POL-G eligibility · a second runtime · messaging bindings. The unlock ladder's rungs 1–4 are documentation, not scope.

## Your-setup / pending

- **The owner approves each context pack before dispatch**, declaring N at approval. If the queue stalls more than 2 days, shrink to the three-dispatch minimum and note it in the retro (assumption A-07).
- **The owner reviews each draft** and records accept or reject with one line. Nothing publishes without a separate, explicit decision that is not part of this cycle.

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

# Phase 00 — A process names a role; arc-run seats an agent

**Goal (one line):** `process-lint` admits `role:`, `arc-run` resolves it to one bound agent (or a `--trial-seat` agent) and receipts which and why.
**Appetite:** 0.75 days
**Depends on:** none
**REQs closed here:** REQ-01, REQ-02

## Scope
- `.claude/scripts/engine/process-lint.mjs`: `role` joins `TOP_LEVEL_KEYS`; a check FAILs unless the role
  card exists and its `binds.process` equals this process's `name` (ADR-1626).
- `.claude/scripts/org/lib/seat.mjs` (new, pure): `resolveSeat(card, events, { trial, agentExists })` →
  `{ agent, source: "card"|"scored"|"trial" }`; scored = most `run.completed` ok receipts whose
  `payload.role === card.id` and `payload.role_agent` is in `binds.agents`; tie or none → first listed.
- `.claude/scripts/engine/arc-run.mjs`: `--trial-seat AGENT` (given twice / empty / not in `.claude/agents/`
  → exit 2, nothing emitted); for a process with `role:`, load the card, read the spine the run already reads,
  resolve, pass the agent's body (frontmatter stripped) to the driver as the seat persona, and add
  `role`, `role_agent`, `role_agent_source` to the `run.completed` payload only (closed-payload kinds such as
  `council.verdict` and `decision.recorded` refuse extra fields). A `--trial-seat` run receipts
  `role_agent_source: trial` and omits `payload.role`, so a trial earns the seat no scorecard credit. A fixture
  runs a `role:` process whose emitted kinds include a closed-payload kind and asserts the run still exits 0. `--trial-seat` on a
  process without `role:` → exit 2.
- Driver adapters (`claude-code`, `codex`): carry the persona as a prompt prefix block (A-01).
- `role:` added to the 11 processes bound by exactly one card (A-02 holds: develop-proof has two cards and
  is left without one): adr-record, attack-diff, brief-materialize, build-in-public-draft, commit-msg-draft,
  council-convene, day-close-roll, kickoff-plan, lesson-log, narrative-verify, review-diff.
- Regenerate compiled commands (`arc-compile --write --all --target claude-code`), the sync golden, product
  manifests for the new file, and the wiki, in the same commit.

## Exit criteria (Definition of Done)
- [ ] lint FAILs both mutants; all 14 real processes still lint clean
- [ ] resolver fixture: scored, tie → first, no evidence → first, trial
- [ ] `arc-run --dry-run` over a sandbox with a `role:` process receipts the three fields; `--trial-seat` receipts `trial` and the fake driver echoes the trial persona marker; the card's bytes unchanged
- [ ] tests added & green on CI (`tests/org/role-seat.mjs`, an arm in the process-lint bats)
- [ ] live demo run + output checked
- [ ] contract tests: n/a — no external dependency in this phase
- [ ] `/arc-attack` two surfaces once on the local commit before push, with the lane fixed-defect list
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node tests/org/role-seat.mjs` (run from a bats file on CI) + the process-lint bats arm.
- **Expected failure first:** before `seat.mjs` exists the fixture fails at import `ERR_MODULE_NOT_FOUND ... org/lib/seat.mjs`; before the lint change, a `role:` process fails `unknown top-level key "role"`.
- **Live demo scenario:** `node .claude/scripts/engine/arc-run.mjs --process lesson-log --dry-run` prints `role hr-performance -> AGENT (card)`; with `--trial-seat OTHER` prints `(trial)`.
- **Real-system check:** `node .claude/scripts/engine/process-lint.mjs` over the real `processes/` passes with the 11 `role:` lines.
- **Expected evidence:** CI per-JOB conclusions for the head SHA; the fixture's RAN line; the dry-run lines.

## Rabbit holes in this phase
- Do not reuse `seat`/`seat_source` (model seat). New fields only.
- Do not hand-edit `.claude/commands/arc-{commit,review,kickoff}.md`.

## Out of scope for this phase
Head-judge, skill import, hire-to-own (Phases 01–03). Scoring in `org-review` by `role_agent` (it already
attributes by `payload.role`).

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Nothing in this cycle writes to the owner's checkout or to `main`: every card or skill change is a proposal
  branch plus `approval.requested`.
- A refusal writes no event and no file, and names every failed condition.
- The role resolver is deterministic: the same cards and spine give the same agent.
- The model seat (`seat`, `seat_source`) keeps its meaning; the agent seat is new, separate fields.
- Tests run on CI, never on this box; a test asserts it RAN before asserting what it printed.

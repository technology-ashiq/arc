# Phase 00 — A process names a role; arc-run seats an agent

**Goal (one line):** `process-lint` admits `role:`, `arc-run` resolves it to one bound agent (or a `--trial-seat` agent) and receipts which and why.
**Appetite:** 0.75 days
**Depends on:** none
**REQs closed here:** REQ-01, REQ-02

## Scope
- `.claude/scripts/engine/process-lint.mjs`: `role` joins `TOP_LEVEL_KEYS`; a check FAILs unless the role
  card exists and its `binds.process` equals this process's `name` (ADR-1626).
- `.claude/scripts/engine/role-seat.mjs` (new, pure; engine-owned because arc-run imports it and a consumer repo may carry engine without org): `resolveSeat(card, events, { trial })` →
  `{ agent, source: "card"|"scored"|"trial"|"none", why }` per ADR-1626 (as amended): an agent qualifies
  with ≥3 runs for the role (`payload.role` or `payload.trial_role`); highest ok rate wins; tie or no
  qualifier → first listed; no bound agent → `none`.
- `.claude/scripts/engine/arc-run.mjs`: `--trial-seat AGENT` (given twice / empty / not in `.claude/agents/`, or
  on a process without `role:` → exit 2, nothing emitted); for a process with `role:`, load the card, read the
  spine (unreadable → no evidence, said so), resolve, and add `role`, `role_agent`, `role_agent_source` to the
  `run.completed` payload only (closed-payload kinds such as `council.verdict` refuse extra fields). A trial run
  receipts `trial_role` in place of `role`, so it earns the seat no scorecard credit. Only a trial run passes the
  agent's body (frontmatter stripped) to the driver as the seat persona (ADR-1626 amendment: default runs keep
  today's prompt, because several cards bind the subagents a process invokes, not its seat).
- Driver adapters (`claude-code`, `codex`): carry the persona as a prompt prefix block read from
  `ARC_SEAT_PERSONA_FILE` (A-01).
- `role:` added to the 9 engine processes bound by exactly one card (A-02 holds: develop-proof has two cards and
  is left without one; brief-materialize and day-close-roll are job stubs, which arc-run never runs): adr-record,
  attack-diff, build-in-public-draft, commit-msg-draft,
  council-convene, kickoff-plan, lesson-log, narrative-verify, review-diff.
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
- **Expected failure first:** before `role-seat.mjs` exists the fixture fails at import `ERR_MODULE_NOT_FOUND ... engine/role-seat.mjs`; before the lint change, a `role:` process fails `unknown top-level key "role"`.
- **Live demo scenario:** `node .claude/scripts/engine/arc-run.mjs --process lesson-log --dry-run` prints `role hr-performance -> AGENT (card)`; with `--trial-seat OTHER` prints `(trial)`.
- **Real-system check:** `node .claude/scripts/engine/process-lint.mjs` over the real `processes/` passes with the 9 `role:` lines.
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

# Phase 01 — A head's verdict lands on the spine

**Goal (one line):** `org-judge.mjs` emits one `review.completed` from a head over a worker's `handoff.ready`, only where ORG-O allows it.
**Appetite:** 0.5 days
**Depends on:** phase-00
**REQs closed here:** REQ-03

## Scope
- `.claude/scripts/org/org-judge.mjs` (ADR-1627): `--head ROLE --receipt ULID --verdict accept|rework
  --reason TEXT [--team VENTURE] [--root PATH] [--spine-dir PATH] [--dry-run]`; each flag at most once.
- Checks (all reported, not first-only): receipt exists and is `handoff.ready`; its role via `placeAll`
  (attribution map, then `payload.role`) is a worker in the team's `on_shift` and under `heads:` for the
  head's department; the department has ≥2 staffed workers (`isStaffed`); head ≠ worker; no earlier
  `review.completed` with `role: head` and `subject_receipt` equal to this receipt.
- Emits through `arc-event.sh emit review.completed --payload-file FILE` (never inline JSON, retro 2026-08-13)
  with payload `{ role, subject_role, subject_receipt, verdict, reason }`; `--reason` must pass `isOneLine`
  (`core/one-line.mjs`) and be at most 2000 bytes, mirroring `assertDecision`, else a sixth refusal `BAD_REASON`,
  zero events; verdict is exactly `accept|rework`, case-exact. `--dry-run` prints the payload and emits nothing.
- `lib/attribution.mjs` `scorecard` and `org-review.mjs` `independentTally` gain a `review.completed` arm:
  `verdict: accept` adds to the worker's `accepts`, `rework` to `rejects`, keyed on `payload.subject_role` (not
  `payload.role`, which places the event on the head). Without it the verdict is recorded and never judged.
- Each new CLI copies `agent-scaffold.mjs` `isMainModule()` verbatim; the test runs it through a symlinked path.
- PROGRESS records REQ-03 as fixture-proven and unused until an `org/teams/*.team.yaml` exists.
- `products/org/manifest.json`, sync golden and wiki updated in the same commit.

## Exit criteria (Definition of Done)
- [ ] happy path emits exactly one event with the five payload fields
- [ ] five mutants refuse by name, zero events written
- [ ] tests added & green on CI (`tests/org/judge.mjs` from a bats file)
- [ ] live demo run + output checked
- [ ] contract tests: n/a — no external dependency
- [ ] `/arc-attack` two surfaces once on the local commit before push
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node tests/org/judge.mjs` (sandbox root + spine + one fixture team with a head and two staffed workers).
- **Expected failure first:** `ERR_MODULE_NOT_FOUND ... org/org-judge.mjs`.
- **Live demo scenario:** on the real repo `org-judge.mjs --head solution-architect --receipt ULID --verdict accept --reason x --dry-run` refuses `NO_TEAM` (no team manifest exists, ADR-1612) — the honest live answer; the sandbox run shows the emitted line.
- **Real-system check:** the refusal names every failed condition and writes no event (spine line count unchanged).
- **Expected evidence:** CI per-JOB conclusions; fixture RAN line; the dry-run output.

## Rabbit holes in this phase
- Never read a receipt's role a second way: import `placeAll`, do not re-match actors.

## Out of scope for this phase
Running the head agent to produce the verdict; any dispatcher wiring.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Nothing in this cycle writes to the owner's checkout or to `main`: every card or skill change is a proposal
  branch plus `approval.requested`.
- A refusal writes no event and no file, and names every failed condition.
- The role resolver is deterministic: the same cards and spine give the same agent.
- The model seat (`seat`, `seat_source`) keeps its meaning; the agent seat is new, separate fields.
- Tests run on CI, never on this box; a test asserts it RAN before asserting what it printed.

# Phase 03 — A hired seat becomes an own agent in one branch

**Goal (one line):** `org-own.mjs` turns a `hired` role card into an `own` agent: the scaffold's files and the card change on one proposal branch (ADR-1629).
**Appetite:** 0.5 days
**Depends on:** phase-00
**REQs closed here:** REQ-05

## Scope
- FIRST extract `planScaffold({ repo, name, description, tools, tier, room, product })` →
  `{ files, allow, approval, message }` out of `agent-scaffold.mjs` `main()`, with `agent-scaffold` calling it and
  its existing tests unchanged (A-03; 0.2d).
- `.claude/scripts/org/org-own.mjs --role ROLE --name AGENT --description TEXT --tools LIST --room ROOM --product P [--dry-run | --expect DIGEST]`
  (`--room`/`--product` required because the planner requires them; tier comes from the card, `--tier` is not
  accepted). The card is read from main's text via `baseText` on the same `base`, never from the checkout; if
  the card is a synced file its golden line moves on the same branch. The fixture asserts the branch tree
  equals `planScaffold`'s `allow` plus the card path.
- Refuses (every failed condition listed): card `origin` not `hired` or `hire` null; agent name taken; card has
  no `binds.tier`; flags given twice.
- One `planProposal` carries every `planScaffold` file + the rewritten card (`origin: own`, `hire: null`,
  new agent first in `binds.agents`, one `history:` line naming the replaced hire); then `approval.requested`.
- The old hire's router row is left alone (ADR-0069 b1).
- Manifest, sync golden, wiki in the same commit.

## Exit criteria (Definition of Done)
- [x] fixture `hired` card → one branch whose tree equals `planScaffold` `allow` + the card path, + one `approval.requested`
- [x] three refusal mutants, no branch, no event
- [x] tests added & green on CI (`tests/org/own.mjs` from a bats file)
- [x] live demo run + output checked
- [x] contract tests: n/a — no external dependency
- [x] `/arc-attack` two surfaces once on the local commit before push
- [x] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node tests/org/own.mjs` (sandbox git repo with a fixture hired card).
- **Expected failure first:** `ERR_MODULE_NOT_FOUND ... org/org-own.mjs`.
- **Live demo scenario:** on the real repo `org-own.mjs --role build-in-public-social --name bip-writer --description x --tools Read --dry-run` refuses or plans according to that card's real `origin`; output shows which.
- **Real-system check:** the owner's checkout is byte-identical after the run.
- **Expected evidence:** CI per-JOB conclusions; fixture RAN line; the dry-run output.

## Rabbit holes in this phase
- Tier is read from the card, never typed; the model from `engine/router.yaml`'s `models` table, as the scaffold does.

## Out of scope for this phase
Retiring the hire's router row; `/arc-absorb` changes.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Nothing in this cycle writes to the owner's checkout or to `main`: every card or skill change is a proposal
  branch plus `approval.requested`.
- A refusal writes no event and no file, and names every failed condition.
- The role resolver is deterministic: the same cards and spine give the same agent.
- The model seat (`seat`, `seat_source`) keeps its meaning; the agent seat is new, separate fields.
- Tests run on CI, never on this box; a test asserts it RAN before asserting what it printed.

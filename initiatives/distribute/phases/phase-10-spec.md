# Phase 10 — `uninstall`, `init` for every harness, the consumer registry, the launch slot, the radar; retro and seal

**Goal (one line):** `arc uninstall` removes exactly what the manifest lists, `arc init` with no `--target` renders every harness and registers the project locally, a new venture is born through the launch `core` slot with every harness, and a weekly ₹0 radar reports consumer drift without writing to any consumer.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-09
**REQs closed here:** REQ-15, REQ-18, REQ-19

## Scope

1. `arc uninstall [--dir D] [--force]` (ADR-2024) with the mutant-manifest refusals and the `hooks_path_set` arms.
2. `arc init` with no `--target` = the union of the four targets under ADR-2023's owner rule, one v2 manifest; registry append/remove in `$ARC_PRIVATE_DIR/consumers.json` (ADR-2026); `outdated --all`.
3. Launch `core` slot calling `bin/arc.mjs init --dir <venture>`, after the launch lane confirms name and tier (paste-ready prompt to that session; A-17).
4. `distribute-radar` job (`hq.jobs.yaml` row `cadence: daily@07:45` self-throttled to 7 days like `launch-watch`, `processes/distribute-radar.process.yaml` `job_stub: true`, `hq.policy.yaml` row, `.claude/scripts/hq/jobs/distribute-radar.mjs`) emitting one path-free `metric.observed`.
5. The single cycle PR merged after CI green; from the main clone: tag `v0.2.0` on the merge commit (owner's explicit OK for that push), the kill check re-run on a clone of merged `main` ($0.05), the radar run once for real with its receipt found in `events/`; then retro, evidence bundle, HISTORY entry, lane IDLE.

## Exit criteria (Definition of Done)

- [x] REQ-15, REQ-18, REQ-19 bats green on all 3 CI legs per job
- [x] attack pass (`/arc-attack`, max 2 rounds), findings fixed or ledgered
- [x] retro + seal; tracker updated

Closed 2026-10-14 from the main clone after PR #419 merged (`b478b743`, CI 19/19 on head `f1fb1594`, run 38566913612).
REQ-18 validated. Owed, by PLAN's rule that whatever is unproven is recorded owed: REQ-15's launch `core` slot clause
(the launch lane answers `evidence/phase-08/launch-prompt.md`, A-17) and REQ-19's seal run (the owner applies
`owner-apply-radar-policy.mjs`, and `~/.arc-private/consumers.json` does not exist yet because no consumer has been
installed by `arc init`; the radar runs once from the main clone after both).
REQ-19 validated 2026-10-15: the owner applied the radar policy (PR #429, `77840115`), a trial project became the
first `arc init` consumer, and the radar ran once from the main clone: `metric.observed` 01M4Y4B7XPWXSFVC7NRFSYP62C,
1 of 1 behind, no path in the payload, nothing written in the consumer (`evidence/post-merge/req19-radar-seal.md`). REQ-15's
slot clause is still owed.

## Verification plan

- Coarse (refined at phase start via `/arc-change`): `tests/distribute-lifecycle.bats` gains uninstall / init-all / registry arms, `tests/distribute-radar.bats` hashes consumer dirs before and after; live demo = a launch scaffold fixture born with every harness, then `arc uninstall` leaving its unmanaged files byte-identical.

## Rabbit holes in this phase

- Registry paths leaking into the spine or any tracked file: the radar payload carries counts only.

## Out of scope for this phase

`upgrade --all` (no-go) · `npm publish` (no-go).

## Your-setup / pending

Launch-lane answer on slot name, tier and `launch-coverage` row, requested at P08 close; no answer by P10 start = clause owed, not blocked. The owner's explicit OK for the `v0.2.0` tag push.

## Non-negotiables (verbatim from PLAN)

- The Claude source (`.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/skills/`, `.claude/hooks/`, `.mcp.json`) is not moved, renamed or reformatted; the only source edits this cycle are `arc-ship.md`'s fence and step 4 (ADR-2027), goldened in the same PR (ADR-2001).
- No prose fallback: a construct a target cannot express is dropped only where the matrix cell says so, otherwise `[unsupported]` by name (ADR-2001, ADR-2003).
- Merge-time is the truth: nothing is enforced only in a Claude Code hook, and a git hook is never called the gate (ADR-2002, ADR-2013, ADR-2015).
- `AGENTS.md` is the brain and is never a render output; `CLAUDE.md` only imports it plus marked Claude-only blocks (ADR-2007, ADR-2023).
- Every lifecycle verb reads the manifest first and writes or removes only paths it names; a path that escapes the project is refused by name (ADR-2024).
- No consumer path in any tracked file, spine payload included (ADR-2026).
- A pushed tag is never moved or deleted (ADR-2025).
- Code lives in `engine` beside `arc-compile` and gates in `core`; no second compiler, no second walker (ADR-2012); new gates run as bats inside existing CI jobs (ADR-2016).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per phase, logic and boundary, carrying `initiatives/distribute/fixed-defects.md`; the author is never the attacker; max 2 rounds (ADR-2011).
- Zero npm deps; no `npm publish`; no public README rewrite; no bash port (ADR-2008); no model, driver, router, profile or tier change (ADR-2006).
- Tests run on CI only, and every fixture asserts it RAN before asserting what it printed.

# Phase 06 — `arc-ship` runnable in arc

**Goal (one line):** `arc-ship` runs end to end in arc and in any repo without a deploy target: real `lint`/`build`/`test` scripts, `ci-digest --wait`, and a named no-deploy branch, goldened across all four targets and the sync.
**Appetite:** 0.75 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-05
**REQs closed here:** REQ-13

## Scope

1. Root `package.json` `scripts` per ADR-2021; still no `prepare`/`install`; REQ-08's suite stays green.
2. `ci-digest.mjs --wait [--timeout-min N]` (extends the existing script; no new reader).
3. `.claude/commands/arc-ship.md` step 4 no-deploy branch + `Bash(gh pr view:*)`; regenerate the claude-code, opencode, codex, skills-only goldens and the sync golden; products manifest line if asked.
4. `tests/distribute-ship-nodeploy.bats` with a fake `gh` (pending → pending → success; never-settles → TIMEOUT; a `vercel.json` arm keeps the deploy line).

## Exit criteria (Definition of Done)

- [ ] REQ-13 green on 3 legs per job; every `--check` (goldens, sync golden, wiki) green
- [ ] attack pass on the phase commit (max 2 rounds)
- [ ] tracker updated

## Verification plan

- Coarse (refined at phase start): CI bats `tests/distribute-ship-nodeploy.bats` + the existing golden suites, read per job with `ci-digest`.

## Non-negotiables (verbatim from PLAN)

- The Claude source (`.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/skills/`, `.claude/hooks/`, `.mcp.json`) is not moved, renamed or reformatted; adding the `targets:` key is the only source edit, and a lint pins it (ADR-2001).
- No prose fallback: a construct a target cannot express is dropped only where the matrix cell says so, otherwise `[unsupported]` by name (ADR-2001, ADR-2003).
- Merge-time is the truth: nothing is enforced only in a Claude Code hook, and a git hook is never called the gate (ADR-2002, ADR-2013, ADR-2015).
- The gates phase (P01) precedes every adapter; phase order is never changed; undeclared surfaces are resolved before any new one (ADR-2004, ADR-2014).
- `sync-to-project.sh`'s output stays byte-identical to the golden committed in P00 for every root-mode consumer (ADR-2005).
- `AGENTS.md` is the brain and `CLAUDE.md` only imports it plus marked Claude-only blocks (ADR-2007).
- Subagents degrade to role skills, never to a nested harness call; only the four v1 targets install (ADR-2009, ADR-2010).
- Code lives in `engine` beside `arc-compile` and gates in `core`; no second compiler, no second walker (ADR-2012); new gates run as bats inside existing CI jobs (ADR-2016).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/distribute/fixed-defects.md`; the author is never the attacker; max 2 rounds (ADR-2011).
- Zero npm deps; no `npm publish`; no public README rewrite; no bash port (ADR-2008); no model, driver, router, profile or tier change (ADR-2006).
- Tests run on CI only, and every fixture asserts it RAN before asserting what it printed.

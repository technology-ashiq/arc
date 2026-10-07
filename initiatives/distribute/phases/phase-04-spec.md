# Phase 04 — `arc` CLI, the clean-machine proof, the retro

**Goal (one line):** `bin/arc.mjs` (`init · doctor · compile`, zero deps) installs arc from the git URL and from a local tarball on a fresh runner on all three OS legs, and nothing publishes.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-03
**REQs closed here:** REQ-08

## Scope

1. Root `package.json` (`name`, `version`, `bin: {"arc": "bin/arc.mjs"}`, `files`, `dependencies: {}`, no `publish` script) and `bin/arc.mjs`, which dispatches to the existing scripts. `arc init --target <t> [--dry-run|--force]` also sets `core.hooksPath` in the target repo when it is a git repo.
2. `tests/distribute-install-clean.bats` (ADR-2016): tarball arm and git-URL arm on each OS leg.
3. Runbook `docs/runbooks/distribute.md`, the retro (`/arc-retro --lane distribute`) and the lane seal.

## Exit criteria (Definition of Done)

- [ ] REQ-08 green on 3 legs per job; `grep -rn "npm publish"` outside this lane = 0
- [ ] closed via `/arc-phase-done 04`; retro written

## Verification plan

- Coarse (refined at phase start): CI bats `tests/distribute-install-clean.bats` + `tests/distribute-cli.bats`.

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

# Phase 02 — Source hygiene, no migration

**Goal (one line):** the Claude source declares itself — every frontmatter key has a recorded per-target fate, Claude-only commands carry `targets:`, an unknown key fails a lint, and `arc-compile` reads commands and agents with the `claude-code` adapter as the identity.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01
**REQs closed here:** REQ-05 (REQ-04's identity half is exercised here and closed with the rendered targets in P03)

## Scope

1. ADR 20xx (next free): the frontmatter-key table. Command keys are `description`, `allowed-tools`, `argument-hint`, `name` and `targets`. Agent keys are `name`, `description`, `tools` and `model`. For each key × target the table gives `render` (to a named field), `drop` (only where the matrix cell is `false`/`partial`) or `[unsupported]`.
2. `targets:` added to the Claude-only commands (e.g. `arc-face-module`), with a default of every verified row.
3. A frontmatter lint (`.claude/scripts/engine/frontmatter-lint.mjs`) that FAILs on an unknown key, with a mutant arm.
4. `arc-compile` gains `--input commands|agents` beside processes. The `claude-code` adapter renders each source file to itself (0 byte diff), and `.claude/commands/{arc-commit,arc-review,arc-kickoff}.md` stay process-generated.
5. **REQ-05 `[dirty]` check:** `arc-compile --check` lists every file under each rendered directory named in `engine/harnesses.yaml` (`.codex/`, `.opencode/`, the skills bundle) and exits 1 naming any file the compiler would not write; 3 fixtures, one per directory, each a temp tree with a planted file.
6. `face-coverage`'s command reader must tolerate the new `targets:` key (A-07 of the design source), so check it before adding the key.

## Exit criteria (Definition of Done)

- [ ] frontmatter lint green on the tree; the mutant (unknown key) red-as-expected on CI
- [ ] `arc-compile --check --all --input commands --target claude-code` reports 29/29 identical, and the same for 32 agents
- [ ] REQ-05: 3 `[dirty]` fixtures red-as-expected and the real tree clean, on CI per job
- [ ] closed via `/arc-phase-done 02`

## Verification plan

- Coarse (refined at phase start): CI bats `tests/distribute-frontmatter.bats` + an extended `tests/engine-compile.bats` arm for the command/agent identity.

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

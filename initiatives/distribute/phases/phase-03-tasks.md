# Build Brief — phase 03 · Install adapters

spec-hash: sha256:c69066fdae76ea424e91bef7791f4e0b4b68ff06729fd520367bb93f67f936f8
lane: distribute
reqs: 
adrs: 0226, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016
blast-radius: .claude/agents/*.md, .claude/arc-registry.json, .claude/commands/*.md, .claude/hooks/, .claude/skills/, .mcp.json, AGENTS.md, CLAUDE.md, initiatives/distribute/fixed-defects.md, sync-to-project.sh, tests/distribute-apply-boundary.bats, tests/distribute-compile-{codex,opencode,skills-only}.bats, tests/distribute-install.bats, tests/distribute-matrix.bats, tests/fixtures/distribute/goldens/<target>/, tests/sync.bats
no-gos: (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 7

### Non-negotiables

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

### Predictions

likely-failure-mode: a Windows-only path or line-ending difference between the staged temp file and the rename, or MSYS path conversion of --dir
likely-regression-site: sync-to-project.sh full mode (now a node call) against tests/fixtures/sync-golden/tree-manifest.txt, and the tests/sync.bats playbooks control
riskiest-file: .claude/scripts/engine/install-targets/common.mjs (the transaction and its rollback journal)
expected-blockers: REQ-03 needs a non-Anthropic OpenCode profile and a spend cap from the owner (A-05); without them it is recorded owed
expected-proof-failures: the CRLF fixture or a symlink fixture on the Windows leg

### Slices

#### slice: 01

title: REQ-02/04/07/10 green on CI per job; REQ-03 receipts found by id; `[unsupported]` count recorded
kind: logic
risk: high
proof: CI per job on 3 legs: tests/distribute-compile-{codex,opencode,skills-only,claude-code}.bats, distribute-matrix.bats (REQ-02, every row x cell, counts), distribute-install.bats (REQ-07), distribute-apply-boundary.bats (REQ-10, 8 fixtures incl. injected failure + rollback), sync.bats (re-pointed sync, golden unchanged). Local node: arc-compile --check --all --input source 62/62 codex, 83/83 opencode, 62/62 skills-only; unsupported-commands opencode 1 (stop rule 5). REQ-03 run in OpenCode or recorded owed
tier: integration
sources: phase-03-spec.md
decision: ADR-2018: one render module (source-render.mjs) feeds both the goldens and the installer; OpenCode fences render to permission (an agent denies by default, a command asks by default on a hidden companion subagent); install is one journaled transaction; sync full mode is the claude-code target with --force
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: closed via `/arc-phase-done 03`
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

# Build Brief — phase 02 · Source hygiene, no migration

spec-hash: sha256:728afe1cb7287624d9056140c1d69eee6b6f21dcf3913daa2c3f1cfa881773df
lane: distribute
reqs: 
adrs: 0226, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016
blast-radius: .claude/agents/*.md, .claude/commands/*.md, .claude/commands/{arc-commit,arc-review,arc-kickoff}.md, .claude/hooks/, .claude/scripts/engine/frontmatter-lint.mjs, .claude/skills/, .mcp.json, AGENTS.md, CLAUDE.md, engine/harnesses.yaml, initiatives/distribute/fixed-defects.md, sync-to-project.sh, tests/distribute-frontmatter.bats, tests/engine-compile.bats
no-gos: (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 3

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

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: frontmatter lint green on the tree; the mutant (unknown key) red-as-expected on CI
kind: logic
risk: high
proof: tests/distribute-frontmatter.bats (11 tests: tree clean, mutant selftest, unknown/duplicate/malformed/empty/targets/table/escape/COULD NOT SCAN, count asserted) green on CI per job
tier: contract
sources: phase-02-spec.md, code:grep-fallback(462; no .codegraph/, search stopped at 4000 files), adrs(18), learning(1), retro(33), churn(38)
decision: ADR-2017; the table is engine/frontmatter-keys.yaml; the matrix gains argument_hint + model_tier (9 -> 11 cells)
result: local node run: `frontmatter-lint: 29 commands, 32 agents, 9 keys, 0 failures` and `mutant-selftest: caught x-mutant-45440 (.claude/commands/arc-absorb.md)`; every planted class named in a manual dry run; CI pending
commit: (empty until proven)

#### slice: 02

title: `arc-compile --check --all --input commands --target claude-code` reports 29/29 identical, and the same for 32 agents
kind: logic
risk: medium
proof: tests/engine-compile.bats P02 arms: N/N for commands and agents (N from disk), a CRLF copy identical, a malformed line [compile], write/codex/flag refusals, green on CI per job
tier: contract
sources: phase-02-spec.md
decision: the claude-code adapter's renderSource rebuilds each file from frontmatter-lint's parse, not a string echo
result: local node run: `29/29 byte-identical for target claude-code (input commands)` and `32/32 ... (input agents)`; CI pending
commit: (empty until proven)

#### slice: 03

title: REQ-05: 3 `[dirty]` fixtures red-as-expected and the real tree clean, on CI per job
kind: logic
risk: medium
proof: tests/distribute-dirty.bats: 3 planted fixtures (.codex/, .opencode/, .agents/skills/) red by name, a foreign-files control, a symlink, the real tree 0 dirty, no rendered dir ignored, green on CI per job
tier: contract
sources: phase-02-spec.md
decision: harnesses.yaml rows declare rendered: and rendered_foreign:; the planned set is empty until the P03 adapters
result: local node probe: 3 planted files named [dirty], foreign files excluded, the .Codex case variant caught; real tree `3 rendered directories, 0 files, 0 dirty`; CI pending
commit: (empty until proven)

#### slice: 04

title: closed via `/arc-phase-done 02`
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-02-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

# Build Brief — phase 04 · `arc` CLI, the clean-machine proof, the retro

spec-hash: sha256:ac9ce19e58484fb7768d11ec758128f7b435306e9982570e814f23f9d988e42a
lane: distribute
reqs: 
adrs: 0226, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016
blast-radius: .claude/agents/*.md, .claude/commands/*.md, .claude/hooks/, .claude/skills/, .mcp.json, AGENTS.md, CLAUDE.md, bin/arc.mjs, docs/runbooks/distribute.md, initiatives/distribute/fixed-defects.md, package.json, sync-to-project.sh, tests/distribute-cli.bats, tests/distribute-install-clean.bats
no-gos: (unnamed), (unnamed), (unnamed), (unnamed)
blast-radius-dropped: 2

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

likely-failure-mode: npm on the Windows leg: the global shim lands in PREFIX not PREFIX/bin, or npx github: is slow or flaky on a runner
likely-regression-site: tests/develop-capability.bats, which asserted arc has no package.json dependencies key; and any .js file a root package.json reinterprets
riskiest-file: package.json (the files allowlist: a path an install reads that the tarball leaves out fails only on a clean machine)
expected-blockers: none for REQ-08; the retro and the seal close the cycle, and REQ-03 stays owed
expected-proof-failures: the npx git-URL arm on one leg (network), or the consumer pre-commit hook under Windows git

### Slices

#### slice: 01

title: REQ-08 green on 3 legs per job; `grep -rn "npm publish"` outside this lane = 0
kind: logic
risk: high
proof: CI per job on 3 legs: tests/distribute-install-clean.bats (npm pack -> npm i -g --prefix -> arc doctor exit 0 -> arc init a project from the installed copy -> doctor clean; npx github:technology-ashiq/arc#<PR head> doctor; no npm publish outside the lane; no package row in the sync golden) and tests/distribute-cli.bats (package.json private, bin, dependencies {}; doctor plans 4 targets; init sets core.hooksPath and the hook refuses a main commit).
tier: integration
sources: phase-04-spec.md
decision: package.json is private (npm refuses to publish it) with a files allowlist and no lifecycle scripts; bin/arc.mjs only dispatches; consumer hooks ship at .claude/templates/githooks (branch guard + secret scan), since arc own pre-commit runs arc-compile.
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: closed via `/arc-phase-done 04`; retro written
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-04-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

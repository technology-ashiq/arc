# Phase 03 — Install adapters

**Goal (one line):** `install-targets/{claude-code,codex,opencode,skills-only}.mjs` render and place arc through plan → apply → doctor with a manifest, `--dry-run`, refuse-unmanaged and transactional writes; every rendered target is goldened and dirty-diff gated; `sync-to-project.sh` calls the `claude-code` adapter with its golden unchanged; and arc's own loop runs in OpenCode.
**Appetite:** 3.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-02
**REQs closed here:** REQ-02, REQ-03, REQ-04, REQ-07, REQ-10
**Stop rule:** more than 5 of the 29 commands render `[unsupported]` on `opencode` → STOP, re-open the matrix and the frontmatter-key ADR. The count is printed in the evidence either way.

## Scope

1. Render adapters `adapters/opencode.mjs` and `adapters/skills-only.mjs`. `adapters/codex.mjs` is extended to commands-as-skills and agents. Each output carries a do-not-edit banner.
2. Install adapters with `plan(tree, dir) → ops[]`, `apply(ops)` (temp → rename, manifest-driven rollback) and `doctor(dir)`. The manifest is `<dir>/.arc-install.json`. The claude-code target reads `.claude/arc-registry.json` first and extends it rather than writing a second manifest, if its shape allows (memory rule: extend, never a parallel mechanism). The decision is recorded as an ADR.
3. Goldens under `tests/fixtures/distribute/goldens/<target>/`, a `[dirty]` check per rendered directory, and REQ-10 fixtures (file-as-dir, symlink, spaces, drive letter, failure on the Nth file) on 3 legs.
4. `sync-to-project.sh` becomes a thin caller of the claude-code adapter, which owns the `arc-settings-merge.mjs` call. The sync golden must be unchanged.
5. REQ-03 real run in OpenCode on the owner's non-Anthropic profile (A-05), through to a merged PR.
6. Two-surface attack per adapter (DST-K).

## Exit criteria (Definition of Done)

- [ ] REQ-02/04/07/10 green on CI per job; REQ-03 receipts found by id; `[unsupported]` count recorded
- [ ] closed via `/arc-phase-done 03`

## Verification plan

- Coarse (refined at phase start): CI bats `tests/distribute-compile-{codex,opencode,skills-only}.bats`, `tests/distribute-matrix.bats`, `tests/distribute-install.bats`, `tests/distribute-apply-boundary.bats`, plus the existing `tests/sync.bats` unchanged.

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

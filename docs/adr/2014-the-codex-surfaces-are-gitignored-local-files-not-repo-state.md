# ADR 2014 — `.codex/`, `.agents/` and `AGENTS.md` are gitignored local files, not repo state; P00 resolves them on the owner's machine and in `.gitignore`

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way
**Revisit trigger:** the owner names a consumer that reads the main clone's local `.codex/` or `.agents/skills/` (A-06). The moved-aside copies are then restored from `~/.arc-private/distribute/local-2026-07-11/`.

## Context

Kickoff verification (2026-10-07) falsified a premise of the design source. `.codex/` (agents, hook scripts, `hooks.json`, `config.toml`), `.agents/skills/` (8 `source-command-arc-*` + `seo-article-writer`) and `AGENTS.md` (118 lines, `Name: TODO`, `.Codex/rules` — a case-mangled find/replace of `CLAUDE.md`) are **not in the repository and never were**. `git log --all` finds none of them. `.gitignore:75-78` (`# Codex`, then `.codex`, `.agents`, `AGENTS.md`) has ignored them since `ab501994` (2026-07-11), the same day the local files were written. They exist only in the main clone `E:/Work_Hub/01_Automemory/arc`. DST-D's rule still holds ("output or deleted, no third state"), but its mechanics change. There is nothing to delete from git, and the ignore lines would make every rendered output **untrackable**. A gitignored `.codex/` cannot be byte-diffed by CI, so REQ-05 would be unprovable by construction.

## Options considered

1. **Leave the ignore lines; render into an ignored directory** — REQ-05's dirty-diff never sees the output.
2. **Remove the three ignore lines in P00, and move the main clone's local copies aside first** — the outputs become tracked, and the old copies are kept outside the repo as comparison evidence.

## Decision

Option 2. At P00 open, with the owner's OK (it is his machine), the session moves `.codex/`, `.agents/` and `AGENTS.md` out of the main clone into `~/.arc-private/distribute/local-2026-07-11/`. This is a move, not a delete, so it is reversible. The P00 birth PR then removes `.gitignore` lines 75-78. Each `source-command-arc-*` skill is compared against its current command. A faithful one is copied to `tests/fixtures/distribute/goldens/codex-seed/` (DST-D). Divergent ones are recorded and left in the private archive. `seo-article-writer` is already tracked at `.claude/skills/seo-article-writer/`, so the local copy is compared and dropped. `AGENTS.md` becomes a tracked file for the first time in P01 (DST-G). `hooks.json`'s absolute Windows paths are quoted in the P00 evidence as the standing exhibit for the boundary attacker (DST-K).

## Consequences

The order is load-bearing. If the ignore lines go before the copies move, the main clone shows them as untracked, and one `git add -A` commits a machine-path `hooks.json` to a public repo. Between P00 and P03 arc offers Codex nothing tracked. Before P00 it offered something local and false.

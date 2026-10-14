# ADR 2023 — arc renders its rendered targets into its own tree as committed outputs

**Status:** accepted
**Date:** 2026-10-14
**Product:** `distribute` (engine: `bin/arc.mjs`, `arc-install.mjs`, `install-targets/*`; DST-N of `docs/strategy/plans/PLAN-distribute.md` v1.4)
**Reversibility:** two-way
**Why two-way:** the outputs are generated; deleting the three directories and the CI test restores today's tree exactly
**Revisit trigger:** a harness in the v1 set starts reading `.claude/` natively (the rendered copy becomes a second source), or the committed outputs push a PR diff past what review can read (a source edit regenerating > 100 rendered files in one PR, twice).

## Context

`node bin/arc.mjs init --target opencode --dir . --dry-run` in the arc clone plans 475 files and then refuses
`[inside-source]` (`arc-install.mjs:89`). That guard exists because the **claude-code** target copies `.claude/` as its
support payload: installing over its own source would overwrite files the installer is still reading (attack 74bcf43 B4).
The rendered targets write only `.codex/`, `.opencode/` and `.agents/skills/` (the goldens under
`tests/fixtures/distribute/goldens/` hold exactly those three roots and nothing else) and read only `.claude/`, so the
reason does not apply to them. As a result, arc cannot be the first consumer of its own adapters. A fresh clone opened in
OpenCode or Codex shows no arc command at all.

Two facts the v1.4 draft did not have, both measured 2026-10-14:

1. **No rendered target writes `AGENTS.md`.** In arc, `AGENTS.md` is the hand-written brain (ADR-2007, gated by
   `brain-drift.mjs`). The draft listed it as a "committed output of `arc compile --self`". That is wrong: it is a
   committed *source*, already present in every clone, and Codex and OpenCode both read it as-is.
2. **`codex` and `skills-only` both write `.agents/skills/`**, with different bytes. Of codex's 30 skill files, 26
   differ from skills-only's copy (skills-only keeps `allowed-tools` and its banner names a different target). Two
   renders into one tree collide on 30 paths.

## Options considered

1. **Keep the guard for every target; ship the outputs only through `arc init` into other projects.** A clone of arc
   stays unusable in a second harness, and the owner's bar ("opening the arc clone in any harness shows the commands") is
   not met.
2. **Gitignored self-render run at clone time.** Ruler's documented failure: a clone that has not run the step sees no rules.
3. **`arc compile --self`: render the rendered targets into arc's own tree, commit them, and fail CI on a dirty diff.**
   `init` keeps its guard.

## Decision

Option 3.

- **`arc compile --self [--check]`** renders `.codex/`, `.opencode/` and `.agents/skills/` into the arc checkout that
  holds the compiler. It writes only the adapters' rendered files: no support payload, no `.arc-install.json`, no
  `AGENTS.md`. `--check` renders in memory and exits 1 naming every path whose bytes differ, every missing path and every
  extra file under the three roots. OpenCode's first-run files (`.opencode/package.json`, `node_modules/`, lockfiles,
  `.gitignore`) are excluded by the same list `tests/distribute-dirty.bats` already uses.
- **One owner per path.** Where codex and skills-only both write `.agents/skills/<name>/SKILL.md`, **skills-only owns
  it**. It is the superset (62 skills to codex's 30) and keeps `allowed-tools`. Codex reads `.agents/skills/` and needs
  nothing more. In a multi-target render the codex target writes `.codex/` only. A path claimed by two targets anywhere
  else is a hard error (`Refused("path-owner")`), never last-write-wins. The same rule governs `arc init` with no
  `--target` (ADR-2024).
- **The `inside-source` guard stays on `init` for every target.** The draft narrowed it to claude-code; building P08 found that
  each rendered target's `init` also copies the support payload (`.claude/scripts/`, `.claude/rules/`, `docs/templates/`),
  so an `init` into arc would copy those files onto themselves. Arc never runs `init` on itself. `--self` is the only
  self-render path, and it needs no guard because it writes no `.claude/` path and no payload.
- The outputs carry the existing `GENERATED … DO NOT EDIT` banner. The REQ-05 pre-commit `arc-compile --check` and the
  `generated-edit` negative already refuse a hand edit. A new bats test (`tests/distribute-self-render.bats`) runs
  `arc compile --self --check` on CI, beside `docs-coverage.bats`'s wiki check.
- ADR-2014 is not reopened: it removed the ignore lines so that exactly these files could be tracked.

## Consequences

- A fresh `git clone` of arc, opened in OpenCode, lists `/arc-resume` with no install step. That is the cycle's kill question.
- Every edit to a `.claude/commands|agents|skills` file now regenerates rendered files in the same PR. A source edit with
  no regeneration is red on CI, which is the point.
- The four goldens and the self-render are two renders of the same module (ADR-2018). They can disagree only when a test
  fixture tree differs from arc's tree, and that is expected.
- arc's own `.opencode/` gains OpenCode's first-run `node_modules/` the first time OpenCode opens the clone. The
  exclusion list keeps that untracked, and the P08 kill run shows `git status` after it.

## Evidence

- `node bin/arc.mjs init --target opencode --dry-run` (2026-10-14, `4741c770`): `plan: opencode — 475 file(s)` … `refused [inside-source]`.
- `find tests/fixtures/distribute/goldens/<t> -type f`: codex = `.codex/agents` 32 + `.agents/skills` 30; opencode = `.opencode/{agents 54, commands 25, skills 4}`; skills-only = `.agents/skills` 62; no `AGENTS.md` in any.
- `cmp` of codex vs skills-only `.agents/skills/*`: 4 identical, 26 differ (`allowed-tools` line, banner target).

**Confidence:** high. Every claim above is measured on the live tree.

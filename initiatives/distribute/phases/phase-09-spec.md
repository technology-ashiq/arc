# Phase 09 — `outdated`, `upgrade`, manifest v2, and the version lint

**Goal (one line):** a project can ask `arc outdated` how far it is behind arc (tag, commit, count, CHANGELOG range) and `arc upgrade [--to <tag>] [--confirm]` moves only the paths its manifest names, backing up local edits and refusing a BREAKING range without `--confirm`.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-08
**REQs closed here:** REQ-16, REQ-17

## Scope

1. Manifest v2 writer + v1/v2 reader in `install-targets/common.mjs` (ADR-2024): `targets`, `tag`, `commit`, `files:{path:{sha,target}}`, `hooks_path_set`; path-safety check shared by every verb (`Refused("manifest-path", <path>)`).
2. `arc outdated [--dir D]`: installed tag@commit vs the CLI checkout's tag@commit, `git rev-list --count`, CHANGELOG sections in range; exits 0 up to date / 1 behind / 3 not-installed / 4 unknown commit.
3. `arc upgrade [--dir D] [--to <tag>] [--confirm] [--force]`: re-render (`--to {tag}` renders from a read-only temp-index extract of that tag into a scratch dir, never a checkout or worktree; a tag absent locally exits 6 `tags: not fetched`), per-path replaced/backed-up/removed/added, BREAKING refusal (exit 5), v1→v2 rewrite.
4. `.claude/scripts/core/version-lint.mjs` (ADR-2025) wired into `npm run lint` and `tests/distribute-version-lint.bats`; `CHANGELOG.md` gains the `[0.2.0] - 2026-10-14` section.
5. `tests/distribute-lifecycle.bats` (outdated + upgrade arms), fixture repos built in `setup()` with repo-local git identity and full history; measured shard-weight entries.
6. Wiki / sync golden / products rows as the gates ask.

## Exit criteria (Definition of Done)

- [ ] REQ-16 and REQ-17 bats green on all 3 CI legs per job (`ci-digest` on the pushed head) — **50% tripwire: REQ-16's arms green**
- [ ] `version-lint` passes the committed tree and FAILs each mutant (VERSION ahead of CHANGELOG, out-of-order sections, missing tagged section)
- [ ] attack pass (`/arc-attack`, max 2 rounds), findings fixed or ledgered; fixed-defects rows added
- [ ] tracker updated (PROGRESS row + done-log)

## Verification plan

- **Test command:** CI `selftest` jobs running `tests/distribute-lifecycle.bats` and `tests/distribute-version-lint.bats`, read with `ci-digest`
- **Expected failure first:** before the verbs exist, each lifecycle arm fails at its RAN assertion with `arc: unknown verb outdated` / `upgrade`; before the lint, `distribute-version-lint.bats` fails with node `MODULE_NOT_FOUND`
- **Live demo scenario:** in a scratch project installed from `v0.2.0`, `node bin/arc.mjs outdated --dir <p>` prints `installed {fixture tag}@{c} · arc untagged@{head} · N commits behind` (the real `v0.2.0` is cut at seal) + the `[Unreleased]` entries; `upgrade --dir <p>` prints per-path actions and a second `outdated` prints `up to date`
- **Real-system check:** the same run against the Cycle 1 `arc-sandbox` consumer (v1 manifest) — `outdated` reads it, `upgrade` rewrites it v2; its `git status` shows only managed paths changed
- **Expected evidence:** `evidence/phase-09/demo.md` (both runs' output), CI run id per job

## Rabbit holes in this phase

- A 3-way merge of local edits: never; back up and replace.
- Shallow CI clones have no tags: fixtures build their own repos; the lint names `tags: not fetched`.

## Out of scope for this phase

`uninstall`, `init` default-all, registry, launch slot, radar (P10).

## Your-setup / pending

None.

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

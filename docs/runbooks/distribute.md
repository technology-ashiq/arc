# Runbook — `distribute`, arc in any harness

arc is written once, in the Claude Code dialect under `.claude/`, and rendered for every other harness
(ADR-2001). This runbook covers installing it, reading an install back, and changing what the render does.
Decisions: ADR-2000–2018. The capability matrix is `engine/harnesses.yaml`, and the fate of each
frontmatter key is `engine/frontmatter-keys.yaml`.

## Install arc into a project

From a checkout of arc:

```bash
node bin/arc.mjs init --target <claude-code|codex|opencode|skills-only> --dir /path/to/project [--dry-run] [--force]
```

Or without a checkout. The package is never published (ADR-2008), so it installs from git or from a
tarball:

```bash
npx --yes github:technology-ashiq/arc#<commit> init --target opencode --dir .
npm pack /path/to/arc && npm i -g ./arc-*.tgz && arc init --target codex --dir .
```

`sync-to-project.sh <dir>` is the same claude-code install with `--force`, plus the council `.env.example`
block. `--products` mode is unchanged.

| Target | What lands | What it cannot hold |
|---|---|---|
| `claude-code` | `.claude/` (minus local state), the meta docs, `CONSTITUTION.md`, the council skeleton | nothing: it is the source |
| `codex` | the support payload, commands as `.agents/skills/NAME/SKILL.md` (invoked `$NAME`), agents as `.codex/agents/NAME.toml` | tool fences, argument hints, model tiers, `$ARGUMENTS` |
| `opencode` | the support payload, `.opencode/commands/`, `.opencode/agents/` (each fenced command runs as a hidden `NAME-fence` subagent), `.opencode/skills/` | argument hints, model tiers; `arc-toolcheck` (needs `Artifact`) |
| `skills-only` | the support payload and every command and agent as an agentskills.io skill under `.agents/skills/` | hooks, user-only invocation, `$ARGUMENTS`, hints, tiers |

The **support payload** is the claude-code install minus what only Claude Code reads (`.claude/commands/`,
`agents/`, `hooks/`, `output-styles/`, `skills/`, `settings.json`). The rendered commands still call
`.claude/scripts/` and read `.claude/rules/`, so the payload ships with every target.

`--dry-run` prints the plan, one `degraded:` line per `false` matrix cell and one `partial:` line per
`partial:` cell, and writes nothing. A Claude-only command (`targets: claude-code`) is `[skipped]` on the
other targets, and a construct a target cannot hold is `[unsupported]` by name, never paraphrased.

In a git repo whose `core.hooksPath` is unset, `arc init` points it at `.claude/templates/githooks/`
(branch guard and staged-secret scan). It leaves a project's own hooks path alone and says so.

## Read an install back

```bash
node bin/arc.mjs doctor --dir /path/to/project     # or: node .claude/scripts/engine/arc-install.mjs --doctor DIR
node bin/arc.mjs doctor                            # checks this copy of arc can install at all
```

One line per managed path, then the counts:

| State | Meaning | What to do |
|---|---|---|
| `placed` | on disk, byte-identical (CR bytes ignored) to what the install wrote | nothing |
| `missing` | the install wrote it, and it is gone | re-run `arc init` with the same target |
| `unmanaged-conflict` | something else is there: a hand edit, a link, a directory | keep it, or re-run with `--force`; the original goes to `.arc-install-backup/<stamp>/` |
| `degraded` | a matrix cell the target cannot hold | nothing: it is a declared limit |

The record is `<dir>/.arc-install.json`, or the `install` key of `.claude/arc-registry.json` for
claude-code. A project holds one target's record. A second, different target refuses `other-target`.

## When an install refuses

Every refusal prints `refused [<reason>]` after the `plan:` line and writes nothing.

| Reason | Cause |
|---|---|
| `missing` · `not-a-directory` · `symlink` · `drive-letter` | the `--dir` itself (exit 2) |
| `inside-source` | the project and the arc source overlap |
| `file-as-dir` · `linked-parent` | a path the install needs is a file, or resolves outside the project |
| `other-target` | the project already holds a different target's install |
| `settings-merge` · `registry` | the claude-code merge of the project's `settings.json`, or the registry, failed |

A failure during apply prints `apply: FAILED`, then `rollback: R restored, N removed`. The run leaves 0
files, and every file it had replaced is back. A `rollback: COULD NOT UNDO <path>` line names a file to
restore by hand, from the path it gives.

## Change what a target renders

1. Change the adapter (`.claude/scripts/engine/adapters/<target>.mjs`) or `source-render.mjs`. A new
   frontmatter key needs a row in `engine/frontmatter-keys.yaml` first, or `frontmatter-lint.mjs` fails it.
2. `node .claude/scripts/engine/arc-compile.mjs --write --all --input source --target <t>` rewrites
   `tests/fixtures/distribute/goldens/<t>/`. Review that diff: it is exactly what users will get.
3. `--check` instead of `--write` is the CI gate: `[byte-diff]`, `[missing]`, `[lf-only]`, `[dirty]`
   (a golden file the render no longer makes), and `[stop-rule]` when more than 5 commands are
   unsupported on one target.
4. A file added under `.claude/` changes the sync golden too. Regenerate it last
   (`.claude/rules/testing.md`).

A matrix cell changes only with a dated read of that harness's docs in the `engine/harnesses.yaml`
header. Flipping one to `false` drops that whole kind from the target's install.

## Still owed

- **REQ-03:** arc's own commit → review → ship loop run inside OpenCode on a non-Anthropic profile, with
  `harness: opencode` receipts. It needs the owner's profile and spend cap. Until then it is recorded owed in
  `initiatives/distribute/PROGRESS.md`.
- **Debt row 13:** the first sync over a consumer with no install record backs up every arc file whose
  bytes changed into `.arc-install-backup/`.

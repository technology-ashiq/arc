# ADR 2018 — one render module feeds the goldens and the installer

**Status:** accepted
**Date:** 2026-10-09
**Product:** `distribute`
**Reversibility:** two-way (a target layout is one adapter file and its golden, reviewed as a diff; the install record is versioned)
**Revisit trigger:** a harness release documents a field this ADR maps around (an OpenCode command-level permission, a Codex per-skill tool allowlist), the stop rule fires (more than 5 commands `[unsupported]` on `opencode`), or a consumer reports an upgrade that left a stale arc file behind.

## Context

ADR-2005 makes install an adapter registry (`plan → apply → doctor`) and ADR-2012 forbids a second compiler or walker. Phase 03 has to put four things on one path without breaking either rule: the rendered files for `codex`, `opencode` and `skills-only`, their goldens, an installer that writes those same bytes into a project, and `sync-to-project.sh`, whose output the Phase 00 golden pins.

The census on 2026-10-09 settled what the render has to carry. 29 commands: 26 have `allowed-tools`, 3 carry `targets: claude-code` (ADR-2017). 32 agents: every one has `tools`. The tool tokens are `Bash`, `Bash(prefix:*)`, `Bash(exact)`, `Read`, `Write`, `Edit`, `Task`, `WebSearch`, `WebFetch`, `Glob`, `Grep`, `Artifact` (one command, `arc-toolcheck`) and `mcp__<server>` (agents only). 4 source skills live under `.claude/skills/`. OpenCode's permissions page (read 2026-10-09) keys `permission` by tool name, takes `"*"` as the catch-all, and lets the last matching rule win.

A rendered command still runs `node .claude/scripts/...` and reads `.claude/rules/...`, so a project installed for OpenCode needs those files too, not only `.opencode/`.

## Options considered

1. **Each target renders inside its installer.** No golden can then be checked without installing, and the golden would test a copy of the logic rather than the logic.
2. **arc-compile writes goldens and the installer re-renders.** Two renders of one tree. That is the second compiler ADR-2012 forbids, and the first bug fixed in one of them would split the goldens from what users get.
3. **One module, `source-render.mjs`, renders a target's whole tree; `arc-compile --input source` compares it with the golden and the installer writes it.** What is goldened is byte-for-byte what is installed.

## Decision

Option 3.

**Layouts.** `codex`: a command is `.agents/skills/NAME/SKILL.md` (`name`, `description`), an agent is `.codex/agents/NAME.toml` (`name`, `description`, `developer_instructions` as a TOML literal block, or a basic string when the body holds `'''` or a control character). `opencode`: a command is `.opencode/commands/NAME.md`, an agent `.opencode/agents/NAME.md` with `mode: subagent`. `skills-only`: both are `.agents/skills/NAME/SKILL.md`, an agent as a single-session role skill (ADR-2009). Source skills are copied as they are, to `.agents/skills/` or `.opencode/skills/`, because every v1 `skills` cell is true. Every rendered file carries a do-not-edit banner. A name outside the skill grammar, a collision between two sources, or a `name:` that differs from the file name is `[unsupported]` by name, never slugged.

**OpenCode fences.** An agent's `tools` is a hard allowlist, so it renders `"*": deny` and then `allow` per tool. A command's `allowed-tools` pre-approves, so it renders `"*": ask` and `allow` per tool on a hidden companion subagent, `NAME-fence`, which the command names in `agent:`. `Bash(x:*)` becomes the two rules `x` and `x *`, so `git diff-tree` stays outside `git diff:*`, and `Bash(x)` stays the one exact rule. `mcp__s` becomes `s_*`. A scope holding `*` or `?` is refused, because OpenCode would read it as a wildcard. A tool with no OpenCode key (`Artifact`) makes the file `[unsupported]`: 1 command of 26 today, under the stop rule of 5.

**skills-only fences** render as the space-separated `allowed-tools` in Claude's own token spelling, the form the agentskills specification gives as its example. A space is legal only inside a token's parentheses.

**The check.** `arc-compile --check --all --input source --target T` prints `[byte-diff]`, `[missing]` and `[lf-only]` against `tests/fixtures/distribute/goldens/T/`, and `[dirty]` for a golden file the render no longer produces. `--write` rewrites the golden and removes those. `[unsupported]` is a declared limit, printed and counted, not a diff. The stop rule makes it one: more than 5 unsupported commands is `[stop-rule]` and exit 1. A matrix cell `false` on `commands`, `agents` or `skills` is obeyed, and that kind is skipped, not only reported.

**Install.** `.claude/scripts/engine/arc-install.mjs` with one target file each under `install-targets/`. The claude-code payload is exactly what full sync copied. Each other target installs that payload minus what only Claude Code reads (`.claude/commands/`, `agents/`, `hooks/`, `output-styles/`, `skills/`, `settings.json`), plus its render. The plan prints first, then the target directory is judged: missing, a file, a symlink, or a drive-letter path off Windows is refused by name (exit 2), and so is a parent that is a file or a link. A file at a managed path that the last install did not write is `unmanaged-conflict` and refuses the run unless `--force`, which the record lists. Writes stage to temp files, then rename. A failure undoes every rename from the journal, and the record is written last, inside the transaction. `ARC_INSTALL_INJECT_FAIL_AT` is the test hook. The record is `<dir>/.arc-install.json`. For claude-code it is the `install` key of `.claude/arc-registry.json`, which the sync golden already excludes and every registry reader already ignores. Doctor prints `placed`, `missing` or `unmanaged-conflict` per path (sha256 with CR bytes stripped, as the sync golden hashes), then `degraded` per non-true cell. The dry run prints `degraded:` per false cell and `partial:` per partial cell (REQ-02).

**Sync.** `sync-to-project.sh` full mode is the claude-code target with `--force`, which keeps its contract of overwriting what an earlier sync left. It owns the settings merge, now done at plan time, so a merge that fails writes nothing. The env-block append stays in bash. `--products` mode keeps the resolver's line protocol, and `sync-to-project.ps1` keeps its copy semantics: it is Windows-native and not CI-gated.

## Consequences

- One render feeds two consumers. A render change shows up as a golden diff in the same PR, and a golden can never pass for a file nobody installs.
- On OpenCode, a fenced command runs as its companion subagent, so it does not see the conversation before it. That is the price of rendering the fence instead of dropping it (ADR-2017). The alternative was 25 primary agents in the Tab cycle.
- An upgrade does not remove a file the previous install placed and the new one does not. Ledgered, with the pay-down trigger "a consumer upgrade leaves a stale arc file". `--prune-report` still reports these files read-only.
- The sync is now one transaction. A failure leaves the consumer as it was, where the old copy loop left it half-installed.

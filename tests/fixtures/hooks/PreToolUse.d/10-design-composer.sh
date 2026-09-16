#!/usr/bin/env bash
# design -- ui-composer BASH boundary (PreToolUse/Bash). No-op for every caller except a subagent
# whose payload says agent_type "ui-composer"; for that one, only the renderer rendering its own
# variant is allowed. exit 2 = block.
#
# WHY THIS EXISTS. ui-composer.md declares Bash(bash .claude/scripts/design/design-render.sh:*),
# and a subagent's tools field takes tool NAMES, so that specifier granted all of Bash. On the
# lexos-p02 live demo every composer ran node, sed -i, python3 and PowerShell through it -- a full
# bypass of the read and write boundaries. A PreToolUse hook is the documented per-subagent control.
#
# Same shape as the read and edit fragments: thin here, the logic in a script, and a missing script
# fails OPEN rather than breaking every session's Bash.
#
# Canonical copy: tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh. The installed file must
# stay byte-identical to it; tests/design-composer-bash.bats checks.
set -uo pipefail
SC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/design/composer-bash-check.sh"
[ -f "$SC" ] || exit 0
exec bash "$SC"

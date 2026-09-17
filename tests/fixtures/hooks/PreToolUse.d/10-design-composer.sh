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
# Same shape as the read and edit fragments: thin here, the logic in a script. A missing script
# does not brick the session's Bash -- every other caller still runs -- but a call the harness
# marks with an agent_type that names ui-composer is BLOCKED. Failing open there meant one deleted
# file removed the whole composer boundary (fifth attack pass, 2026-09-17).
#
# Canonical copy: tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh. The installed file must
# stay byte-identical to it; tests/design-composer-bash.bats checks.
set -uo pipefail
SC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/design/composer-bash-check.sh"
if [ -f "$SC" ]; then
  exec bash "$SC"
fi
case "$(cat)" in
  *'"agent_type"'*[Uu][Ii]-[Cc][Oo][Mm][Pp][Oo][Ss][Ee][Rr]*)
    echo "BLOCKED by ui-composer bash scope: composer-bash-check.sh is missing, so a composer's Bash cannot be checked and is not run." >&2
    exit 2;;
esac
exit 0

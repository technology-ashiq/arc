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
# Thin here, the logic in a script. A broken install does not brick the session's Bash -- every
# other caller still runs -- but a call whose agent_type VALUE is ui-composer is BLOCKED when the
# check cannot run as written:
#   - the script is missing, or is not whole. Its last line is a sentinel, because an empty or
#     truncated script ran to its end and exited 0, which allowed a composer (seventh attack pass,
#     F2; the fifth pass found the missing-script case failing open);
#   - the script exits with anything other than 0 or 2, which the dispatcher would read as allow.
# The composer test reads the agent_type value, case-blind and with an optional namespace, not the
# word anywhere: that blocked other agents that only mentioned ui-composer (seventh pass, F3).
#
# Canonical copy: tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh. The installed file must
# stay byte-identical to it; tests/design-composer-bash.bats checks.
set -uo pipefail
SC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/design/composer-bash-check.sh"
PAYLOAD="$(cat)"

_is_composer() {
  printf '%s' "$PAYLOAD" \
    | grep -qE '"agent_type"[[:space:]]*:[[:space:]]*"([^"]*:)?[Uu][Ii]-[Cc][Oo][Mm][Pp][Oo][Ss][Ee][Rr][[:space:]]*"'
}

if [ -f "$SC" ] && [ "$(tail -n 1 "$SC" 2>/dev/null | tr -d '\r')" = "# composer-bash-check: end" ]; then
  printf '%s' "$PAYLOAD" | bash "$SC"
  rc=$?
  case "$rc" in 0|2) exit "$rc";; esac
  if _is_composer; then
    echo "BLOCKED by ui-composer bash scope: composer-bash-check.sh exited $rc, so a composer's Bash was not checked and is not run." >&2
    exit 2
  fi
  exit 0
fi

if _is_composer; then
  echo "BLOCKED by ui-composer bash scope: composer-bash-check.sh is missing or incomplete, so a composer's Bash cannot be checked and is not run." >&2
  exit 2
fi
exit 0

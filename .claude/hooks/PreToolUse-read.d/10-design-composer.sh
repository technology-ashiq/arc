#!/usr/bin/env bash
# design -- ui-composer read boundary (PreToolUse/Read). No-op unless an explore run armed
# .claude/state/design/composer-session. exit 2 = block a composer read outside its allowlist.
# Same shape as 10-design-critic.sh: the fragment stays thin, the logic lives in a script, and
# a missing script fails OPEN rather than breaking the session.
set -uo pipefail
SC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/design/composer-scope-check.sh"
[ -f "$SC" ] || exit 0
exec bash "$SC" "$@"

#!/usr/bin/env bash
# design -- ui-composer read boundary (PreToolUse/Read). No-op unless an explore run armed
# .claude/state/design/composer-session. exit 2 = block a composer read outside its allowlist.
# Same shape as 10-design-critic.sh: the fragment stays thin, the logic lives in a script, and
# a missing script fails OPEN rather than breaking the session.
set -uo pipefail
SC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/design/composer-scope-check.sh"
[ -f "$SC" ] || exit 0
# Unarmed (no per-variant marker) -> nothing to judge: exit before spawning bash on every Read (ci REQ-11).
# The dir stays quoted so a project path holding [ ] * ? or a backslash is literal, never a pattern (attack B1).
_armed=""; for _m in "${CLAUDE_PROJECT_DIR:-.}/.claude/state/design/"composer-session--*; do [ -f "$_m" ] && _armed=1 && break; done
[ -n "$_armed" ] || exit 0
# Tell the scope check that whatever follows came from a tool payload, not from an operator.
# Without this a read of a path named "--end" would be honoured as a control verb.
ARC_SCOPE_FORWARDED=1 exec bash "$SC" "$@"

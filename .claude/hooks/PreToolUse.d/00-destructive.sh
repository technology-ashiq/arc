#!/usr/bin/env bash
# core -- destructive-command guard (PreToolUse/Bash). Inspects the WHOLE command line
# (permission deny rules are prefix-matched and chain-bypassable). exit 2 = block.
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh"
PAYLOAD=$(cat)
CMD=$(arc_hook_field command "$PAYLOAD")
# Fail-safe: if the parser couldn't extract the command (no jq, broken python stub),
# scan the RAW payload -- a broken parser must never silently disarm this guard.
[ -z "$CMD" ] && CMD="$PAYLOAD"

if echo "$CMD" | grep -Eq 'rm -rf? +(/|~|\$HOME|\.\.)|git push[^;&|]*( --force[^ ]*| -f)( |$)|git clean -[a-z]*f|drop +(table|database) |supabase db reset --linked'; then
  echo "BLOCKED by destructive-guard: this command is irreversible. If it is truly intended, the human must run it themselves." >&2
  exit 2
fi
exit 0

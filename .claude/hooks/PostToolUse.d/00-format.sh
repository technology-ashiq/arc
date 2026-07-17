#!/usr/bin/env bash
# core -- auto-format the file Claude just edited (PostToolUse/Edit|Write).
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh"
PAYLOAD=$(cat)
FILE=$(arc_hook_field file_path "$PAYLOAD")
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    if command -v npx >/dev/null 2>&1; then
      npx --no-install prettier --write "$FILE" >/dev/null 2>&1 || true
      npx --no-install eslint --fix "$FILE"     >/dev/null 2>&1 || true
    fi ;;
esac
exit 0

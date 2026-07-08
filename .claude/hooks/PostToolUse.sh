#!/usr/bin/env bash
# === PostToolUse hook (matcher: Edit|Write|MultiEdit) ===  Keep code clean after edits.
# Auto-formats the file Claude just touched. (Another common PostToolUse use is auto-commit
# with a ticket prefix, e.g. NM-XXX — left out by default since it's opinionated.)
set -uo pipefail
PAYLOAD=$(cat)
if command -v python3 >/dev/null 2>&1; then
  FILE=$(printf '%s' "$PAYLOAD" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || echo "")
elif command -v jq >/dev/null 2>&1; then
  FILE=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // ""')
else
  FILE=""
fi
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

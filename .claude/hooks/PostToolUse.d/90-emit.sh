#!/usr/bin/env bash
# hq -- leave a tool-use receipt on the spine after an Edit|Write (PostToolUse, advisory).
# Payload is DATA not narrative (phase-01 rabbit-hole): just the file that changed, built with
# jq so a Windows path's backslashes can never produce invalid JSON. Hook-mode: never blocks.
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh"
PAYLOAD=$(cat)
FILE=$(arc_hook_field file_path "$PAYLOAD")
[ -z "$FILE" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
EVENT=".claude/scripts/hq/arc-event.sh"
[ -f "$EVENT" ] || exit 0
if command -v jq >/dev/null 2>&1; then
  PL=$(jq -cn --arg f "$FILE" '{event:"tool.postuse",file:$f}')
else
  PL='{"event":"tool.postuse"}'
fi
# ASYNC (measured ~2s/emit on the owner's Windows box > the 1s budget — the spec's
# "or async append" trigger). PostToolUse fires per edit, so it must never add latency:
# fire-and-forget in the background. The emitter's atomic lock still serialises concurrent
# background emits (Phase-0 concurrent-emitter fixture), so nothing tears.
nohup bash "$EVENT" emit note.logged --payload "$PL" >/dev/null 2>&1 &
exit 0

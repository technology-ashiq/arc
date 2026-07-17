#!/usr/bin/env bash
# _dispatch.sh -- shared composable-hook fragment runner (Phase 01).
#
# Each .claude/hooks/<Event>.sh dispatcher sources this file and calls arc_dispatch.
# Fragments live in .claude/hooks/<Event>.d/NN-*.sh and run in NN (lexical) order, so
# a product can drop in a fragment without editing the monolithic hook. A selective
# install simply omits an absent product's fragments -- there is nothing to skip.
#
#   arc_dispatch <event> <advisory|blocking> [--payload]
#     advisory  -- always returns 0; one fragment's failure never breaks the event
#                  (SessionStart / PostToolUse / PreCompact / SessionEnd).
#     blocking  -- a fragment exiting 2 blocks the event (dispatcher returns 2, first
#                  block wins, chain stops); any other exit is ignored, fail-open
#                  (PreToolUse / PreToolUse-edit).
#     --payload -- capture stdin ONCE and feed it to every fragment (the three tool
#                  hooks). Omit for session events so the dispatcher never waits on a
#                  stdin that Claude Code may not close -> no hangs.
# arc_hook_field <tool_input-key> <json-data> -- robustly extract .tool_input.<key>.
# jq FIRST (reliable, present in arc's toolchain + CI), then a REAL python fallback.
# The Windows Microsoft-Store `python3` shim is a stub that prints "Python was not
# found ..." instead of running -- it is on PATH, so a python-first extractor silently
# returns garbage and disarms the destructive/deploy guards. We detect + drop that
# noise and return "" so the caller can fail safe (scan the raw payload).
arc_hook_field() {
  local key="$1" data="$2" val=""
  if command -v jq >/dev/null 2>&1; then
    val=$(printf '%s' "$data" | jq -r ".tool_input.${key} // \"\"" 2>/dev/null)
  fi
  if [ -z "$val" ]; then
    local py; py=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)
    [ -n "$py" ] && val=$(printf '%s' "$data" | "$py" -c "import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('${key}',''))" 2>/dev/null)
  fi
  case "$val" in *"was not found"*|*"Microsoft Store"*|*"execution aliases"*) val="" ;; esac
  printf '%s' "$val"
}

arc_dispatch() {
  local event="$1" mode="${2:-advisory}" payload_flag="${3:-}"
  local root="${CLAUDE_PROJECT_DIR:-.}"
  local dir="$root/.claude/hooks/${event}.d"

  local input="/dev/null" pf=""
  if [ "$payload_flag" = "--payload" ]; then
    pf="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-hook.$$.$RANDOM")"
    cat > "$pf"
    input="$pf"
    export ARC_HOOK_PAYLOAD="$pf"
  fi

  local rc=0 f frc
  if [ -d "$dir" ]; then
    for f in "$dir"/[0-9]*.sh; do
      [ -f "$f" ] || continue                 # no-match glob stays literal -> skip
      if [ "$mode" = "blocking" ]; then
        bash "$f" < "$input"; frc=$?
        if [ "$frc" -eq 2 ]; then rc=2; break; fi
      else
        bash "$f" < "$input" || true          # advisory: isolate fragment failures
      fi
    done
  fi

  [ -n "$pf" ] && rm -f "$pf" 2>/dev/null
  return "$rc"
}

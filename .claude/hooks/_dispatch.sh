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
#
# Canonical copy: tests/fixtures/hooks/_dispatch.sh. .claude/hooks/** is edit-denied to agent
# sessions, so a change lands here first and the owner installs it; tests/hooks-dispatch.bats
# checks the installed file is byte-identical once it is there.
arc_hook_field() {
  # NOTE: <key> MUST be a literal identifier -- callers pass "command"/"file_path".
  # It is interpolated into the jq filter and the python -c program, so a key bearing
  # a quote/newline would break extraction (which then safely falls through to the raw
  # scan, but silently). Do not pass attacker-influenced keys (review N3).
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

  # The payload goes to a temp file when one can be made, and is held in memory only when it cannot.
  #   - The file is the normal path: `cat > file` is linear and byte-exact, and ARC_HOOK_PAYLOAD
  #     points at it, as the policy lane documents. Holding every payload in a shell variable cost
  #     time that grew with the square of its size on Windows, so a 36 MB call that used to be
  #     blocked in 55 s timed out instead, which reads as ALLOW (BS-4 attack pass, shell half).
  #   - Memory is the fallback. The old dispatcher had no fallback at all: when TMPDIR was missing
  #     or unwritable every fragment's `< "$input"` failed with exit 1, which blocking mode reads
  #     as ALLOW, disarming every PreToolUse guard (design lane, fifth attack pass, BS-4). In that
  #     case the payload is piped to each fragment and ARC_HOOK_PAYLOAD is unset, never left
  #     pointing at a stale or empty file.
  #   - A capture that fails part-way has already consumed stdin and cannot be recovered, so a
  #     blocking event refuses rather than letting unguarded calls through.
  local payload="" have_file=0
  ARC_DISPATCH_PF=""
  if [ "$payload_flag" = "--payload" ]; then
    ARC_DISPATCH_PF="$(mktemp 2>/dev/null || true)"
    if [ -n "$ARC_DISPATCH_PF" ] && [ -f "$ARC_DISPATCH_PF" ]; then
      # A hook killed by its timeout must not leave a copy of the call behind in TMPDIR.
      trap 'rm -f "$ARC_DISPATCH_PF" 2>/dev/null; exit 143' TERM
      trap 'rm -f "$ARC_DISPATCH_PF" 2>/dev/null; exit 130' INT
      if cat > "$ARC_DISPATCH_PF"; then
        have_file=1
        export ARC_HOOK_PAYLOAD="$ARC_DISPATCH_PF"
      else
        rm -f "$ARC_DISPATCH_PF" 2>/dev/null
        ARC_DISPATCH_PF=""
        unset ARC_HOOK_PAYLOAD
        trap - TERM INT
        if [ "$mode" = "blocking" ]; then
          echo "arc: the hook payload could not be captured, so no guard could see this call; blocking it." >&2
          return 2
        fi
        return 0
      fi
    else
      ARC_DISPATCH_PF=""
      unset ARC_HOOK_PAYLOAD
      payload="$(cat)"
      # Never into a fragment's environment, even if the caller's shell exported a `payload`:
      # a large one would make `bash "$f"` fail to start on Linux, and that exit reads as ALLOW.
      export -n payload 2>/dev/null || true
    fi
  fi

  local rc=0 f frc
  if [ -d "$dir" ]; then
    for f in "$dir"/[0-9]*.sh; do
      [ -f "$f" ] || continue                 # no-match glob stays literal -> skip
      if [ "$mode" = "blocking" ]; then
        if [ "$have_file" -eq 1 ]; then
          bash "$f" < "$ARC_DISPATCH_PF"; frc=$?
        elif [ "$payload_flag" = "--payload" ]; then
          # `builtin`: an exported function named printf must not stand between a guard and its
          # payload. PIPESTATUS[1] is the fragment's own status, whatever happened to the writer.
          builtin printf '%s' "$payload" 2>/dev/null | bash "$f"; frc=${PIPESTATUS[1]}
        else
          bash "$f" < /dev/null; frc=$?
        fi
        if [ "$frc" -eq 2 ]; then rc=2; break; fi
      else
        if [ "$have_file" -eq 1 ]; then
          bash "$f" < "$ARC_DISPATCH_PF" || true   # advisory: isolate fragment failures
        elif [ "$payload_flag" = "--payload" ]; then
          builtin printf '%s' "$payload" 2>/dev/null | bash "$f" || true
        else
          bash "$f" < /dev/null || true
        fi
      fi
    done
  fi

  if [ -n "$ARC_DISPATCH_PF" ]; then
    rm -f "$ARC_DISPATCH_PF" 2>/dev/null
    trap - TERM INT
  fi
  return "$rc"
}

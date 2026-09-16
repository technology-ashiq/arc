#!/usr/bin/env bash
# composer-bash-check.sh -- the ui-composer's BASH boundary (ADR-1415 amendment, 2026-09-17).
#
# ui-composer.md declares `Bash(bash .claude/scripts/design/design-render.sh:*)`: one entry point.
# On the lexos-p02 live demo every composer ran node, sed -i, python3, PowerShell and cmd through
# it, because a subagent's `tools:` field takes tool NAMES and the specifier granted all of Bash.
# Bash walks past both boundaries -- `cat` reads a sibling, `sed -i` writes anywhere, and
# `composer-scope-check.sh --end` releases the read boundary. Isolation held on that run only
# because no composer looked, which is compliance, not refusal.
#
# The documented per-subagent control is a PreToolUse hook, and a subagent's tool-call payload
# carries `agent_type` -- measured 2026-09-17 with an owner-approved probe: present for a subagent,
# absent for the main session. It is written by the harness, not by the agent, so it can be
# trusted where a marker file cannot.
#
# So for `ui-composer`, and nobody else, exactly one Bash command shape is allowed:
#
#   bash .claude/scripts/design/design-render.sh docs/design/explore/<id>/<variant>/<page>
#        --mode explore --session <id>--<variant> [--iter N] [--viewport WxH]
#
# where <id>/<variant> is the ONE armed composer boundary. The route and the session are both
# pinned to it: rendering a sibling into the composer's own session would put a sibling's pixels
# exactly where the composer is allowed to read.
#
#   composer-bash-check.sh     # payload JSON on stdin (the PreToolUse dispatcher's contract)
#
# Exit: 0 allow | 2 BLOCK. Never any other code. bash-3.2 / POSIX-safe.
set -uo pipefail

[ -t 0 ] && exit 0
PAYLOAD="$(cat)"

# Cheap first: nearly every call is not a composer's, and they must not pay for the parse.
case "$PAYLOAD" in *ui-composer*) ;; *) exit 0;; esac

# A top-level string field. jq when present; otherwise a grep that only accepts a value with no
# quote or backslash in it, so a value it cannot read exactly comes back EMPTY, never truncated.
_top() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$PAYLOAD" | jq -r --arg k "$1" 'if type == "object" then (.[$k] // empty) else empty end | strings' 2>/dev/null | head -1
  else
    printf '%s' "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"\\\\]*\"" 2>/dev/null | head -1 \
      | sed 's/^[^:]*:[[:space:]]*"//; s/"$//'
  fi
}

AGENT="$(_top agent_type)"
[ "$AGENT" = "ui-composer" ] || exit 0
TOOL="$(_top tool_name)"
[ "$TOOL" = "Bash" ] || exit 0

_refuse() {
  echo "BLOCKED by ui-composer bash scope: $1" >&2
  echo "A composer runs one command through Bash -- the renderer, on its own variant, into its own session:" >&2
  echo "  bash .claude/scripts/design/design-render.sh docs/design/explore/<id>/<variant>/index.html --mode explore --session <id>--<variant> --iter N --viewport WxH" >&2
  exit 2
}

if command -v jq >/dev/null 2>&1; then
  CMD="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // empty | strings' 2>/dev/null)"
else
  CMD="$(printf '%s' "$PAYLOAD" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"\\]*"' 2>/dev/null | head -1 \
    | sed 's/^[^:]*:[[:space:]]*"//; s/"$//')"
fi
[ -n "$CMD" ] || _refuse "the command could not be read from the payload, and an unreadable composer command is not run."

# One line, one command, from a closed alphabet. Anything a shell treats as syntax -- ; & | > < $
# backtick, quotes, backslash, parentheses, braces, globs, newlines -- is outside the alphabet, so a
# second command can never ride along. Checked with a case on explicit characters, never a regex
# range, which resolves through the locale's collation table.
case "$CMD" in
  *[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._/\ -]*)
    _refuse "'${CMD:0:120}' contains a character outside the renderer's argument alphabet (shell syntax, quotes or a line break).";;
esac
case "$CMD" in
  *"  "*) _refuse "the command must be single-spaced.";;
esac

# Word-split on spaces only, with globbing off (the alphabet has no glob characters, but a split
# that could glob is a split nobody should have to reason about).
set -f
IFS=' '
# shellcheck disable=SC2086
set -- $CMD
unset IFS
set +f

[ "${1:-}" = "bash" ] && [ "${2:-}" = ".claude/scripts/design/design-render.sh" ] \
  || _refuse "'${CMD:0:120}' is not the renderer."
ROUTE="${3:-}"
shift 3 2>/dev/null || _refuse "the renderer was given no page."

# The armed boundary names the variant this composer owns. Exactly one, valid, or nothing runs:
# a composer outside an explore has nothing to render, and two armed is the serial-composition
# refusal the read boundary makes.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true
type arc_cm_load >/dev/null 2>&1 || _refuse "core/common.sh cannot be loaded, so the armed composer boundary cannot be read."
_n=0; _mk=""
for _m in "$ROOT/.claude/state/design"/composer-session--*; do
  [ -f "$_m" ] || continue
  _n=$((_n + 1)); _mk="$_m"
done
[ "$_n" -eq 1 ] || _refuse "$_n composer boundaries are armed; a composer's render is judged against exactly one."
arc_cm_load "$_mk" || _refuse "the armed composer marker is malformed."
EX="$ARC_MF_EXPLORE"; VARIANT="$ARC_MF_VARIANT"

case "$ROUTE" in
  */../*|../*|*/..|..|*//*|/*) _refuse "the page '$ROUTE' is not a plain repo-relative path.";;
  "docs/design/explore/$EX/$VARIANT/"?*) ;;
  *) _refuse "the page '$ROUTE' is not inside your own variant, docs/design/explore/$EX/$VARIANT/.";;
esac

MODE=""; SESSION=""
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || _refuse "the flag '$1' has no value."
  case "$1" in
    --mode)     MODE="$2";;
    --session)  SESSION="$2";;
    --iter)     case "$2" in 1|2|3) ;; *) _refuse "--iter takes 1, 2 or 3.";; esac;;
    --viewport) case "$2" in *[!0123456789x]*|x*|*x|*x*x*|"") _refuse "--viewport takes WxH.";; *x*) ;; *) _refuse "--viewport takes WxH.";; esac;;
    *)          _refuse "the flag '$1' is not one a composer's render takes.";;
  esac
  shift 2
done
[ "$MODE" = "explore" ] || _refuse "a composer renders with --mode explore."
[ "$SESSION" = "$EX--$VARIANT" ] || _refuse "a composer renders into its own session, --session $EX--$VARIANT."
exit 0

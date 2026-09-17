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

# Cheap first: nearly every call is not a composer's, and they must not pay for the parse. The
# letters are matched without case, so `UI-Composer` still reaches the identity check.
case "$PAYLOAD" in *[Uu][Ii]-[Cc][Oo][Mm][Pp][Oo][Ss][Ee][Rr]*) ;; *) exit 0;; esac

_refuse() {
  echo "BLOCKED by ui-composer bash scope: $1" >&2
  echo "A composer runs one command through Bash -- the renderer, on its own variant, into its own session:" >&2
  echo "  bash .claude/scripts/design/design-render.sh docs/design/explore/<id>/<variant>/index.html --mode explore --session <id>--<variant> --iter N --viewport WxH" >&2
  exit 2
}

# From here the payload NAMES ui-composer, so anything that stops this script from reading who is
# calling refuses. It used to allow: the parser was picked by `command -v jq`, not by jq working,
# so a broken jq read the identity as empty and let a composer's `cat` of a sibling through
# (fifth attack pass, BL-3/BS-6). jq is used only once it has answered a probe correctly.
JQ_OK=0
if command -v jq >/dev/null 2>&1 && [ "$(printf '{"k":"v"}' | jq -r '.k' 2>/dev/null | tr -d '\r')" = "v" ]; then
  JQ_OK=1
fi

# `_field <key> <jq path> [all-cr]` sets FIELD. Returns 1 when the field cannot be read EXACTLY; a
# key that is simply absent reads as empty, which is not the same thing. Unreadable means:
#   - the key given twice: jq reads the last copy and grep the first, so the two readers once
#     disagreed on who was calling (BL-7);
#   - with jq working, jq and the raw count disagree on whether the key is there. A key spelled
#     with a JSON escape, or split from its colon by a line break, is invisible to grep, and read
#     as absent it let a composer through (seventh attack pass, F4);
#   - a value that is not a string, or one the grep reader would truncate.
# The jq programs are single-quoted and joined to the path: escaped quotes nested inside `"$( )"`
# have arrived malformed on one leg before (running defect #20).
_field() {
  _fk="$1"; _fp="$2"; _fcr="${3:-}"; FIELD=""
  _fn="$(printf '%s' "$PAYLOAD" | grep -o "\"$_fk\"[[:space:]]*:" 2>/dev/null | wc -l | tr -d ' ')"
  case "$_fn" in 0|1) ;; *) return 1;; esac
  if [ "$JQ_OK" -eq 1 ]; then
    _fs="$(printf '%s' "$PAYLOAD" | jq -r "$_fp"' | if . == null then "absent" elif type == "string" then "string" else "other" end' 2>/dev/null | tr -d '\r')" \
      || return 1
    case "$_fs:$_fn" in
      absent:0) return 0;;
      string:1) ;;
      *) return 1;;
    esac
    FIELD="$(printf '%s' "$PAYLOAD" | jq -r "$_fp" 2>/dev/null)" || return 1
  else
    # The grep reader cannot decode a JSON escape, so a payload carrying one cannot be read
    # exactly by it at all: an escaped key name would read as absent (F4).
    case "$PAYLOAD" in *'\u'*) return 1;; esac
    [ "$_fn" -eq 1 ] || return 0
    FIELD="$(printf '%s' "$PAYLOAD" | grep -o "\"$_fk\"[[:space:]]*:[[:space:]]*\"[^\"\\\\]*\"" 2>/dev/null | head -1 \
      | sed 's/^[^:]*:[[:space:]]*"//; s/"$//')"
  fi
  # jq.exe on Windows ends its line with CRLF, so ONE trailing CR is the reader's, not the value's.
  # Every CR is stripped only from the identity and the tool name (BS-11); a command keeps any
  # other CR, so the command checked is the command run, and the alphabet refuses it (F5).
  FIELD="${FIELD%$'\r'}"
  [ -z "$_fcr" ] || FIELD="$(printf '%s' "$FIELD" | tr -d '\r')"
  [ -n "$FIELD" ] || return 1
  return 0
}

_field agent_type '.agent_type' all-cr || _refuse "the calling agent cannot be identified exactly, and this call names ui-composer."
# Normalised, so a namespaced install (`arc:ui-composer`) or a case change is still the composer
# rather than silently nobody (BL-9). Letters spelled out: `tr '[:upper:]'` maps I to a dotless i
# under tr_TR.
AGENT="$(printf '%s' "$FIELD" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
AGENT="${AGENT##*:}"
AGENT="$(printf '%s' "$AGENT" | tr -d ' \t')"
[ "$AGENT" = "ui-composer" ] || exit 0
_field tool_name '.tool_name' all-cr || _refuse "the tool of a ui-composer call cannot be read exactly."
[ "$FIELD" = "Bash" ] || exit 0

# Only now, with the caller known to be a composer running Bash: a JSON escape for a control
# character refuses. jq decodes the escape for NUL to a real NUL, which bash then drops without a
# word, so the checked command and the run command could differ; the grep reader cannot decode
# escapes at all (BL-7). It ran before the identity check at first, and blocked the MAIN session's
# own probes that mentioned ui-composer (seventh attack pass, F1; running defect #19).
case "$PAYLOAD" in *'\u00'[01]*) _refuse "the call carries an escaped control character, and a command that cannot be read exactly is not run.";; esac

_field command '.tool_input.command' \
  || _refuse "the command could not be read from the payload, and an unreadable composer command is not run."
CMD="$FIELD"
[ -n "$CMD" ] || _refuse "the call carries no command, and an unreadable composer command is not run."

# Length before shape. A real render is under 200 bytes and a dozen words. An uncapped command was
# split into its words and THEN core/common.sh was sourced with every word still in `$@`, which
# grows with the word count: 240k words held this check for 129 s, past the hook timeout, and a
# timed-out hook is read as ALLOW (seventh attack pass, S1; running defects #14 and #17). The cap
# comes before anything whose cost depends on the command.
[ "${#CMD}" -le 400 ] || _refuse "the command is ${#CMD} bytes, longer than any render; nothing longer than 400 is checked or run."

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
# The project the harness names, not whatever repo the hook's cwd is in: the fragment finds this
# script through CLAUDE_PROJECT_DIR, and a marker read from another checkout allowed variant-b
# (BL-4, lane defect #3).
ROOT="${CLAUDE_PROJECT_DIR:-}"
[ -n "$ROOT" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true
type arc_cm_load >/dev/null 2>&1 || _refuse "core/common.sh cannot be loaded, so the armed composer boundary cannot be read."
_n=0; _mk=""
for _m in "$ROOT/.claude/state/design"/composer-session--*; do
  [ -f "$_m" ] || continue
  _n=$((_n + 1)); _mk="$_m"
  # Two is already a refusal, so the count stops there: a cap on the output must also cap the
  # work (running defect #17).
  [ "$_n" -lt 2 ] || break
done
[ "$_n" -eq 1 ] || _refuse "$([ "$_n" -eq 0 ] && echo "no composer boundary is" || echo "more than one composer boundary is") armed; a composer's render is judged against exactly one."
arc_cm_load "$_mk" || _refuse "the armed composer marker is malformed."
EX="$ARC_MF_EXPLORE"; VARIANT="$ARC_MF_VARIANT"

# Every echoed value is capped: a 20KB route used to come back as 20KB of stderr (BS-10, lane
# defect #14).
case "$ROUTE" in
  */../*|../*|*/..|..|*//*|/*) _refuse "the page '${ROUTE:0:120}' is not a plain repo-relative path.";;
  "docs/design/explore/$EX/$VARIANT/"?*) ;;
  *) _refuse "the page '${ROUTE:0:120}' is not inside your own variant, docs/design/explore/$EX/$VARIANT/.";;
esac

# A viewport the renderer can honour: two whole numbers, no leading zero, each 200 to 4096. `0x0`
# hung the renderer for 32 s and a leading zero never matches a declared viewport (BL-6). The
# renderer applies the same bound to itself.
_viewport_ok() {
  case "$1" in
    [123456789][0123456789][0123456789]x[123456789][0123456789][0123456789]) ;;
    [123456789][0123456789][0123456789]x[1234][0123456789][0123456789][0123456789]) ;;
    [1234][0123456789][0123456789][0123456789]x[123456789][0123456789][0123456789]) ;;
    [1234][0123456789][0123456789][0123456789]x[1234][0123456789][0123456789][0123456789]) ;;
    *) return 1;;
  esac
  [ "${1%x*}" -ge 200 ] && [ "${1%x*}" -le 4096 ] && [ "${1#*x}" -ge 200 ] && [ "${1#*x}" -le 4096 ]
}

# Each flag at most once. Last-wins let `--session lexos-v1--variant-b --session lexos-v1--variant-a`
# be judged on the second value while the renderer's own reading was never checked here (BL-5,
# lane defect #13).
MODE=""; SESSION=""; _seen=" "
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || _refuse "the flag '${1:0:40}' has no value."
  case "$_seen" in *" $1 "*) _refuse "the flag '${1:0:40}' is given twice.";; esac
  case "$1" in
    --mode)     MODE="$2";;
    --session)  SESSION="$2";;
    --iter)     case "$2" in 1|2|3) ;; *) _refuse "--iter takes 1, 2 or 3.";; esac;;
    --viewport) _viewport_ok "$2" || _refuse "--viewport takes WxH, each a whole number from 200 to 4096 with no leading zero.";;
    *)          _refuse "the flag '${1:0:40}' is not one a composer's render takes.";;
  esac
  _seen="$_seen$1 "
  shift 2
done
[ "$MODE" = "explore" ] || _refuse "a composer renders with --mode explore."
[ "$SESSION" = "$EX--$VARIANT" ] || _refuse "a composer renders into its own session, --session $EX--$VARIANT."
exit 0
# composer-bash-check: end

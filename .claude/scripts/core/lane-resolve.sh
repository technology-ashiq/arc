#!/usr/bin/env bash
# lane-resolve.sh -- which tracker workspace does this command operate on?
# Cycle 4 (arc-portfolio), ADR-0054 / PORT-E. Zero deps, offline, read-only:
# resolution NEVER creates, moves or writes anything. It reports a decision.
#
# Precedence, and the whole contract in four lines:
#   explicit --lane  >  auto-resolve (exactly ONE eligible lane)  >  ASK. Never guess.
#   no initiatives/ dir            -> ROOT-MODE, byte-identical to pre-portfolio arc
#   unknown lane, non-kickoff      -> hard STOP listing known lanes; creates nothing
#   unknown lane, --for kickoff    -> "create" (the birth ceremony is kickoff's alone)
#
# Usage:
#   lane-resolve.sh [--lane NAME] [--root DIR] [--for SURFACE] [--print machine|human]
#                   [--text FREE_TEXT] [anything else -- ignored]
# Every token that is not one of those flags belongs to the CALLING command (a phase
# number, a route, a goal sentence) and is never read as a lane: that is exactly why
# PORT-E round 6 dropped positional lane tokens.
#
# Output (stdout only, so a caller can capture one stream):
#   --print machine (default): stable KEY=value lines, order fixed
#   --print human            : the canonical operator lines -- and NOTHING in root-mode
# Exit: 0 resolved (root|lane|create) · 3 ambiguous (ask) · 4 unknown lane (STOP) · 5 invalid name
#
# A twin implementation lives at lane-resolve.mjs for Node callers (kickoff-lint must
# not require bash on PATH; a SessionStart hook must not spawn node). They are held
# byte-identical by the equivalence gate in tests/lane-resolver.bats.
set -uo pipefail

LANE_ARG=""; LANE_GIVEN=0; ROOT=""; SURFACE="command"; PRINT="machine"

while [ $# -gt 0 ]; do
  case "$1" in
    --lane)     LANE_GIVEN=1; if [ $# -ge 2 ]; then LANE_ARG="$2"; shift 2; else LANE_ARG=""; shift; fi;;
    --lane=*)   LANE_GIVEN=1; LANE_ARG="${1#--lane=}"; shift;;
    --root)     if [ $# -ge 2 ]; then ROOT="$2"; shift 2; else shift; fi;;
    --root=*)   ROOT="${1#--root=}"; shift;;
    --for)      if [ $# -ge 2 ]; then SURFACE="$2"; shift 2; else shift; fi;;
    --for=*)    SURFACE="${1#--for=}"; shift;;
    --print)    if [ $# -ge 2 ]; then PRINT="$2"; shift 2; else shift; fi;;
    --print=*)  PRINT="${1#--print=}"; shift;;
    --text)     if [ $# -ge 2 ]; then shift 2; else shift; fi;;
    --text=*)   shift;;
    *)          shift;;
  esac
done

[ -n "$ROOT" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# ---------- lane-name grammar (PORT-A) ----------
# [a-z][a-z0-9-]* , length-capped, and never a Windows reserved device name: `con`
# passes the grammar but mkdir fails on exactly one of the three CI legs, so it is
# rejected everywhere rather than becoming a one-OS surprise.
_valid_name() {
  local n="${1-}"
  [ -n "$n" ] || return 1
  [ "${#n}" -le 64 ] || return 1
  case "$n" in *[!a-z0-9-]*) return 1;; esac
  case "$n" in [!a-z]*) return 1;; esac
  case "$n" in
    con|prn|aux|nul) return 1;;
    com[0-9]|lpt[0-9]) return 1;;
  esac
  return 0
}

# ---------- PROGRESS machine header (ADR-0051 source grammar) ----------
# Tolerant DETECTION (case, bold, leading space), STRICT value grammar -- the
# council-v2/v3 markdown-contract checklist. Scans only the header block (stops at
# the first level-2+ heading), skips fenced blocks, and takes the LAST value when a
# key repeats. Anything that is not exactly LIVE/BLOCKED/QUEUED/IDLE is not a status.
_lane_status() {
  [ -f "$1" ] || { echo ""; return 0; }
  awk '
    BEGIN { fence = 0; v = "" }
    {
      line = $0; sub(/\r$/, "", line)
      t = line; sub(/^[ \t]+/, "", t)
      if (substr(t, 1, 3) == "```") { fence = !fence; next }
      if (fence) next
      if (t ~ /^##/) exit
      low = tolower(t); gsub(/\*/, "", low)
      if (low ~ /^status[ \t]*:/) {
        p = index(line, ":")
        val = substr(line, p + 1)
        gsub(/\*/, "", val); gsub(/`/, "", val)
        gsub(/^[ \t]+|[ \t]+$/, "", val)
        v = val
      }
    }
    END { print v }
  ' "$1"
}

_eligible_status() {
  case "${1-}" in LIVE|BLOCKED) return 0;; *) return 1;; esac
}

_sortlist() {
  [ "$#" -eq 0 ] && { echo ""; return 0; }
  printf '%s\n' "$@" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ *$//'
}

# ---------- inventory ----------
LANES=""; SKIPPED=""; ELIGIBLE=""
HAS_INITIATIVES=0
if [ -d "$ROOT/initiatives" ]; then
  HAS_INITIATIVES=1
  for d in "$ROOT/initiatives"/*; do
    [ -d "$d" ] || continue
    b="${d##*/}"
    # Membership is decided against what the directory listing actually returned,
    # compared exactly. On a case-insensitive filesystem `initiatives/Design` would
    # otherwise answer to `--lane design` on Windows/macOS and not on Linux.
    if _valid_name "$b"; then
      LANES="$LANES $b"
      _eligible_status "$(_lane_status "$d/PROGRESS.md")" && ELIGIBLE="$ELIGIBLE $b"
    else
      SKIPPED="$SKIPPED $b"
    fi
  done
fi
LANES="$(_sortlist $LANES)"
SKIPPED="$(_sortlist $SKIPPED)"
ELIGIBLE="$(_sortlist $ELIGIBLE)"
COUNTED=0
for _e in $ELIGIBLE; do COUNTED=$((COUNTED + 1)); done

_known() { for k in $LANES; do [ "$k" = "$1" ] && return 0; done; return 1; }
_commas() { printf '%s' "$*" | sed 's/ /, /g'; }

# ---------- decide ----------
MODE="lane"; STATUS="ok"; LANE=""; VIA="none"; TRACKER=""; REASON=""

if [ "$LANE_GIVEN" -eq 1 ]; then
  if ! _valid_name "$LANE_ARG"; then
    STATUS="invalid"; REASON="bad-name"
  elif _known "$LANE_ARG"; then
    LANE="$LANE_ARG"; VIA="arg"; TRACKER="initiatives/$LANE_ARG"
  elif [ "$SURFACE" = "kickoff" ]; then
    STATUS="create"; LANE="$LANE_ARG"; VIA="arg"; TRACKER="initiatives/$LANE_ARG"; REASON="new-lane"
  else
    STATUS="unknown"; REASON="no-such-lane"
  fi
elif [ "$HAS_INITIATIVES" -eq 0 ]; then
  MODE="root"; TRACKER="."
elif [ "$COUNTED" -eq 1 ]; then
  LANE="$ELIGIBLE"; VIA="auto"; TRACKER="initiatives/$LANE"
else
  STATUS="ambiguous"; REASON="eligible-count-$COUNTED"
fi

case "$STATUS" in
  ok|create) CODE=0;;
  ambiguous) CODE=3;;
  unknown)   CODE=4;;
  invalid)   CODE=5;;
esac

# ---------- report ----------
if [ "$PRINT" = "human" ]; then
  case "$STATUS" in
    ok)
      [ "$MODE" = "lane" ] && echo "Selected lane: $LANE (via $VIA)"
      ;;
    create)
      echo "Selected lane: $LANE (via arg · new lane)"
      ;;
    ambiguous)
      if [ "$COUNTED" -eq 0 ]; then
        echo "Lane not specified and no lane is eligible (LIVE or BLOCKED)."
      else
        echo "Lane not specified and $COUNTED lanes are eligible: $(_commas $ELIGIBLE)"
      fi
      echo "Known lanes: $(_commas $LANES)"
      echo "Pick one: --lane <name>"
      ;;
    unknown)
      echo "STOP: unknown lane '$LANE_ARG'."
      echo "Known lanes: $(_commas $LANES)"
      echo "Lanes are created by /arc-kickoff only — no other command creates one."
      ;;
    invalid)
      echo "STOP: invalid lane name '$LANE_ARG'."
      echo "Grammar: lowercase letters, digits and dashes, starting with a letter ([a-z][a-z0-9-]*), max 64 chars."
      echo "Reserved device names (con, prn, aux, nul, com0-9, lpt0-9) are refused on every OS."
      ;;
  esac
  exit "$CODE"
fi

echo "mode=$MODE"
echo "status=$STATUS"
echo "lane=$LANE"
echo "via=$VIA"
echo "tracker=$TRACKER"
echo "lanes=$LANES"
echo "eligible=$ELIGIBLE"
echo "counted=$COUNTED"
echo "skipped=$SKIPPED"
echo "reason=$REASON"
exit "$CODE"

#!/usr/bin/env bash
# lane-resolve.sh -- which tracker workspace does this command operate on?
# Cycle 4 (arc-portfolio), ADR-0054 / PORT-E. Zero deps, offline, read-only:
# resolution NEVER creates, moves or writes anything. It reports a decision.
#
# Precedence, and the whole contract in four lines:
#   explicit --lane  >  auto-resolve (exactly ONE eligible lane)  >  ASK. Never guess.
#   no lanes on disk               -> ROOT-MODE, byte-identical to pre-portfolio arc
#   unknown lane, non-kickoff      -> hard STOP listing known lanes; creates nothing
#   unknown lane, --for kickoff    -> "create" (the birth ceremony is kickoff's alone)
#
# Usage:
#   lane-resolve.sh [--lane NAME] [--root DIR] [--for SURFACE] [--print machine|human]
#                   [--text FREE_TEXT] [anything else -- ignored]
# Every token that is not one of those flags belongs to the CALLING command (a phase
# number, a route, a goal sentence) and is never read as a lane: that is exactly why
# PORT-E round 6 dropped positional lane tokens. ALWAYS QUOTE a flag's value at the
# call site -- an unquoted empty value silently eats the next flag.
#
# Output (stdout only, so a caller can capture one stream):
#   --print machine (default): stable KEY=value lines, order fixed
#   --print human            : the canonical operator lines -- and NOTHING in root-mode
# Exit: 0 resolved (root|lane|create) · 3 ambiguous (ask) · 4 unknown lane (STOP) · 5 invalid name
#
# WHY A TWIN EXISTS (lane-resolve.mjs): a SessionStart hook must still work on a box
# with no node on PATH -- the heads-up is core UX, and the spine already treats a
# missing node as SKIP rather than failure. It is NOT a speed argument: measured on
# Git Bash the two interpreters' startup costs are within ~30ms of each other, and
# node runs the resolution itself faster. Drift between the twins is the real risk,
# so every case in tests/lane-resolver.bats runs BOTH and requires identical bytes
# and identical exit codes. EDIT BOTH FILES TOGETHER.
set -uo pipefail

# Byte semantics, not the operator's collation. A bracket RANGE like [a-z] is ordered
# by the locale's collation table, not by ASCII: under macOS's default locale that
# table interleaves case (aAbBcC...), so `[a-z]` matches `D` and the grammar below
# accepted `Design` on exactly one of the three CI legs while the .mjs twin -- whose
# regex is codepoint-ranged and locale-blind -- correctly refused it. This also pins
# awk's [[:cntrl:]], filename globbing and sort order to the twin's byte order.
# Individual `sort`/`tr` calls keep their own LC_ALL=C prefix: this line must be
# removable-by-accident without silently changing how lane lists are ordered.
export LC_ALL=C LANG=C

LANE_ARG=""; LANE_GIVEN=0; LANE_DUP=0; ROOT=""; SURFACE="command"; PRINT="machine"

while [ $# -gt 0 ]; do
  case "$1" in
    --lane)
      if [ $# -ge 2 ]; then _nv="$2"; shift 2; else _nv=""; shift; fi
      [ "$LANE_GIVEN" -eq 1 ] && [ "$_nv" != "$LANE_ARG" ] && LANE_DUP=1
      LANE_GIVEN=1; LANE_ARG="$_nv";;
    --lane=*)
      _nv="${1#--lane=}"; shift
      [ "$LANE_GIVEN" -eq 1 ] && [ "$_nv" != "$LANE_ARG" ] && LANE_DUP=1
      LANE_GIVEN=1; LANE_ARG="$_nv";;
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
# [a-z][a-z0-9-]*, length-capped, and never a Windows reserved device name: `con`
# passes the grammar but mkdir fails on exactly one of the three CI legs, so it is
# rejected everywhere rather than becoming a one-OS surprise.
#
# The patterns spell every character out instead of writing a range. A range is
# resolved through the locale's collation table; an explicit LIST is compared
# byte-by-byte and no collation can reorder it. This is deliberate duplication with
# the LC_ALL=C export above -- the single check that decides whether a directory is
# a lane at all must not depend on one `export` line surviving a future refactor.
_valid_name() {
  local n="${1-}"
  [ -n "$n" ] || return 1
  [ "${#n}" -le 64 ] || return 1
  case "$n" in *[!abcdefghijklmnopqrstuvwxyz0123456789-]*) return 1;; esac
  case "$n" in [!abcdefghijklmnopqrstuvwxyz]*) return 1;; esac
  case "$n" in
    con|prn|aux|nul) return 1;;
    com[0123456789]|lpt[0123456789]) return 1;;
  esac
  return 0
}

# Render a name for human output with every non-printable-ASCII byte as `?`, so the
# two twins echo the same bytes for a name that was never valid anyway.
_safe_name() { printf '%s' "${1-}" | LC_ALL=C tr -c '\040-\176' '?'; }

_sorted_join() {
  [ "$#" -eq 0 ] && { printf ''; return 0; }
  printf '%s\n' "$@" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ *$//'
}

_commas() { printf '%s' "${1-}" | sed 's/ /, /g'; }

# ---------- inventory ----------
# Arrays, never word-split strings: a directory name may contain spaces or glob
# characters, and an unquoted expansion would splice the CALLER's working directory
# into a machine-readable field.
LANES=(); SKIPPED=(); ELIGIBLE=(); PROGFILES=()
if [ -d "$ROOT/initiatives" ]; then
  for d in "$ROOT/initiatives"/*; do
    [ -d "$d" ] || continue
    b="${d##*/}"
    case "$b" in .*) continue;; esac   # dot-entries (.git, .DS_Store) are not workspaces
    # Membership is decided against what the directory listing actually returned,
    # compared exactly. On a case-insensitive filesystem `initiatives/Design` would
    # otherwise answer to `--lane design` on Windows/macOS and not on Linux.
    if _valid_name "$b"; then
      LANES+=("$b")
      [ -f "$d/PROGRESS.md" ] && PROGFILES+=("$d/PROGRESS.md")
    else
      SKIPPED+=("$b")
    fi
  done
fi

# ---------- PROGRESS machine header (ADR-0051 source grammar) ----------
# Tolerant DETECTION (case, bold, leading space), STRICT value grammar -- the
# council-v2/v3 markdown-contract checklist. Header block only (stops at the first
# level-2+ heading), fenced blocks skipped (``` AND ~~~), LAST value wins when a key
# repeats. ONE awk pass over every lane: a spawn per lane made this the slowest thing
# in the session-start path at 400 lanes.
if [ "${#PROGFILES[@]}" -gt 0 ]; then
  _statuses="$(awk '
    function flush() { if (curname != "") print curname "\t" v }
    FNR == 1 {
      flush()
      fence = 0; fchar = ""; v = ""; stop = 0
      n = split(FILENAME, pp, "/"); curname = pp[n - 1]
    }
    stop { next }
    {
      line = $0; sub(/\r$/, "", line)
      t = line; sub(/^[ \t]+/, "", t)
      f3 = substr(t, 1, 3)
      if (f3 == "```" || f3 == "~~~") {
        if (!fence) { fence = 1; fchar = f3 } else if (f3 == fchar) { fence = 0; fchar = "" }
        next
      }
      if (fence) next
      if (t ~ /^##/) { stop = 1; next }
      low = tolower(t); gsub(/\*/, "", low)
      if (low ~ /^status[ \t]*:/) {
        p = index(line, ":"); val = substr(line, p + 1)
        gsub(/\*/, "", val); gsub(/`/, "", val); gsub(/[[:cntrl:]]/, "", val)
        gsub(/^[ \t]+|[ \t]+$/, "", val)
        v = val
      }
    }
    END { flush() }
  ' "${PROGFILES[@]}")"
  while IFS="$(printf '\t')" read -r _name _st; do
    case "$_st" in LIVE|BLOCKED) ELIGIBLE+=("$_name");; esac
  done <<< "$_statuses"
fi

LANES_S="$(_sorted_join ${LANES[@]+"${LANES[@]}"})"
SKIPPED_S="$(_sorted_join ${SKIPPED[@]+"${SKIPPED[@]}"})"
ELIGIBLE_S="$(_sorted_join ${ELIGIBLE[@]+"${ELIGIBLE[@]}"})"
COUNTED="${#ELIGIBLE[@]}"
NLANES="${#LANES[@]}"

# An `initiatives/` directory holding no valid lane is not lane-mode. Git does not
# track empty directories, so a stray mkdir or a partial checkout would otherwise
# strand every surface in an un-answerable "pick a lane" with nothing to pick.
HAS_LANES=0; [ "$NLANES" -gt 0 ] && HAS_LANES=1

_known() { for k in ${LANES[@]+"${LANES[@]}"}; do [ "$k" = "$1" ] && return 0; done; return 1; }

# ---------- decide ----------
MODE="lane"; STATUS="ok"; LANE=""; VIA="none"; TRACKER=""; REASON=""

if [ "$LANE_GIVEN" -eq 1 ]; then
  if [ "$LANE_DUP" -eq 1 ]; then
    STATUS="invalid"; REASON="duplicate-lane"
  elif ! _valid_name "$LANE_ARG"; then
    STATUS="invalid"; REASON="bad-name"
  elif _known "$LANE_ARG"; then
    LANE="$LANE_ARG"; VIA="arg"; TRACKER="initiatives/$LANE_ARG"
  elif [ "$SURFACE" = "kickoff" ]; then
    STATUS="create"; LANE="$LANE_ARG"; VIA="arg"; TRACKER="initiatives/$LANE_ARG"; REASON="new-lane"
  else
    STATUS="unknown"; REASON="no-such-lane"
  fi
elif [ "$HAS_LANES" -eq 0 ]; then
  MODE="root"; TRACKER="."
elif [ "$COUNTED" -eq 1 ]; then
  LANE="$ELIGIBLE_S"; VIA="auto"; TRACKER="initiatives/$LANE"
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
        echo "Lane not specified and $COUNTED lanes are eligible: $(_commas "$ELIGIBLE_S")"
      fi
      echo "Known lanes: $(_commas "$LANES_S")"
      echo "Pick one: --lane <name>"
      ;;
    unknown)
      echo "STOP: unknown lane '$(_safe_name "$LANE_ARG")'."
      echo "Known lanes: $(_commas "$LANES_S")"
      echo "Lanes are created by /arc-kickoff only — no other command creates one."
      ;;
    invalid)
      if [ "$REASON" = "duplicate-lane" ]; then
        echo "STOP: --lane given more than once with different values."
        echo "Name exactly one lane; a second --lane is an operator error, not an override."
      else
        echo "STOP: invalid lane name '$(_safe_name "$LANE_ARG")'."
        echo "Grammar: lowercase letters, digits and dashes, starting with a letter ([a-z][a-z0-9-]*), max 64 chars."
        echo "Reserved device names (con, prn, aux, nul, com0-9, lpt0-9) are refused on every OS."
      fi
      ;;
  esac
  exit "$CODE"
fi

echo "mode=$MODE"
echo "status=$STATUS"
echo "lane=$LANE"
echo "via=$VIA"
echo "tracker=$TRACKER"
echo "lanes=$LANES_S"
echo "eligible=$ELIGIBLE_S"
echo "counted=$COUNTED"
echo "skipped=$SKIPPED_S"
echo "reason=$REASON"
exit "$CODE"

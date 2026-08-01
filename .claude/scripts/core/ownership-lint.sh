#!/usr/bin/env bash
# ownership-lint.sh -- is this lane's diff editing another lane's files?
# Cycle 4 (arc-portfolio), Phase 02 / REQ-04. ADR-0057 (ownership is DERIVED from the
# existing `products/*/manifest.json`, never a second registry) · ADR-0053 (the company
# organs -- ADRs, HISTORY, the retro log, the trial ledger and tests/ -- are shared and
# belong to no lane) · ADR-0054 (never guess a lane).
#
# WARN-FIRST, and that is a contract rather than a style: this script EXITS 0 on every path
# -- no git, no lanes, an ambiguous resolution, an unreadable manifest. Promotion to BLOCK
# happens only on trial-ledger evidence (ADR-0057), never here.
#
# Zero deps, offline, READ-ONLY: it never creates, moves or writes anything.
#
# Usage: ownership-lint.sh [--root DIR] [--lane NAME] [--base REF]
#   --base compares REF...HEAD (review time). Without it the subject is the working tree:
#   tracked modifications plus untracked new files, because a NEW file dropped into another
#   lane is the cross-lane edit this exists to catch and `git diff` alone cannot see it.
#
# Output shape (STDOUT only), one block per offending path:
#
#   WARN [ownership-cross-lane] <bare repo-relative path> <U+2014> <summary>
#     Expected: <value>   <U+2190> <path>:<line>
#     Found:    <value>   <U+2190> <path>:<line>
#     Example:  <the correction>
#
# The head location is a BARE path with no line suffix (loc-kind `file`): the defect is the
# whole file being touched, not one line of it. Expected and Found still carry `path:line`
# -- the shape checker validates those two as citations regardless of the class's loc-kind.
set -uo pipefail

# Byte semantics, not the operator's collation -- same reasoning as lane-resolve.sh:34-42.
# Also pins `sort` below, so the order WARNs are emitted in cannot change with the box.
export LC_ALL=C LANG=C

printf -v _DASH  '\342\200\224'   # U+2014 EM DASH   -- the WARN-line separator
printf -v _ARROW '\342\206\220'   # U+2190 LEFTWARDS -- the derived-from pointer

_T=""; _EX=""

# ---------- flags ----------
ROOT=""; LANE_ARG=""; LANE_GIVEN=0; BASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --root)    if [ $# -ge 2 ]; then ROOT="$2"; shift 2; else shift; fi;;
    --root=*)  ROOT="${1#--root=}"; shift;;
    --lane)    if [ $# -ge 2 ]; then LANE_ARG="$2"; LANE_GIVEN=1; shift 2; else shift; fi;;
    --lane=*)  LANE_ARG="${1#--lane=}"; LANE_GIVEN=1; shift;;
    --base)    if [ $# -ge 2 ]; then BASE="$2"; shift 2; else shift; fi;;
    --base=*)  BASE="${1#--base=}"; shift;;
    *)         shift;;
  esac
done

[ -n "$ROOT" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# A PowerShell caller hands bash `E:\Work_Hub\arc`; bash reads `\W` as an escaped W and
# every path built from it silently misses. ROOT is used to OPEN files and is never
# interpolated into a citation -- citations are repo-relative literals.
ROOT="$(printf '%s' "$ROOT" | tr '\\' '/')"

HERE="$(dirname "$0")"
RESOLVER="$HERE/lane-resolve.sh"

_trim() {
  local s="${1-}"
  while :; do case "$s" in " "*|"	"*) s="${s#?}";; *) break;; esac; done
  while :; do case "$s" in *" "|*"	") s="${s%?}";; *) break;; esac; done
  _T="$s"
}

_w_head() { printf 'WARN [ownership-cross-lane] %s %s %s\n' "$1" "$_DASH" "$2"; }
_w_exp()  { printf '  Expected: %s   %s %s\n' "$1" "$_ARROW" "$2"; }
_w_fnd()  { printf '  Found:    %s   %s %s\n' "$1" "$_ARROW" "$2"; }
_w_ex()   { printf '  Example:  %s\n' "$1"; }

# ---------- which lane are we on? ----------
# Asked of the resolver, never re-derived: ADR-0054's precedence (explicit --lane beats
# auto beats ask) lives in exactly one place, and a second copy here would be a second
# answer to "which lane is this". Any non-ok status -- root-mode, ambiguous, unknown,
# invalid -- is SILENCE. A lint that guesses a lane in order to have something to say is
# the failure this whole cycle exists to prevent.
[ -x "$RESOLVER" ] || [ -f "$RESOLVER" ] || exit 0
if [ "$LANE_GIVEN" -eq 1 ]; then
  _RES="$(bash "$RESOLVER" --root "$ROOT" --lane "$LANE_ARG" --for change 2>/dev/null)" || :
else
  _RES="$(bash "$RESOLVER" --root "$ROOT" --for change 2>/dev/null)" || :
fi
[ -n "$_RES" ] || exit 0

_field() {
  printf '%s\n' "$_RES" | while IFS= read -r _kv; do
    case "$_kv" in "$1="*) printf '%s' "${_kv#*=}";; esac
  done
}
MODE="$(_field mode)"; STATUS="$(_field status)"; LANE="$(_field lane)"; LANES_S="$(_field lanes)"

[ "$MODE" = "lane" ] || exit 0
[ "$STATUS" = "ok" ] || exit 0
[ -n "$LANE" ] || exit 0

# ---------- what changed? ----------
git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 || exit 0
if [ -n "$BASE" ]; then
  # Three dots: the merge base, so commits that landed on the base after branching are not
  # attributed to this lane's diff. Two dots would blame the lane for other people's work.
  CHANGED="$(git -C "$ROOT" diff --name-only "$BASE...HEAD" 2>/dev/null)"
else
  CHANGED="$(git -C "$ROOT" diff --name-only HEAD 2>/dev/null)
$(git -C "$ROOT" ls-files --others --exclude-standard 2>/dev/null)"
fi
[ -n "$CHANGED" ] || exit 0

# ---------- the company organs (ADR-0053) ----------
# Shared by every lane and owned by none, so editing one from any lane is silent. Spelled
# as an explicit list rather than a pattern over `docs/`: `docs/` also holds per-product
# documentation that IS owned, and a prefix match would mute a real cross-lane edit.
_is_organ() {
  case "$1" in
    docs/adr/*)            return 0;;
    docs/HISTORY.md)       return 0;;
    docs/retro-log.md)     return 0;;
    docs/trial-ledger.md)  return 0;;
    tests/*)               return 0;;
  esac
  return 1
}

# Is <name> a lane on this disk? Ownership only conflicts BETWEEN LANES: `products/core`
# is a product with no lane, so editing a core file from lane `portfolio` is ordinary work
# and not this class's business. Without this test the lint would flag its own PR.
_is_lane() {
  local n
  for n in $LANES_S; do [ "$n" = "$1" ] && return 0; done
  return 1
}

# Which lane's manifest lists <path>, and on which line? Sets _OWNER and _OWNER_LINE.
# Derived from the EXISTING manifests (ADR-0057) and cited by line, so the fixture that
# adds a path to a manifest can prove the verdict followed the manifest rather than a
# literal in this file -- a hardcoded map and a derived one are indistinguishable from the
# outside unless the WARN points at the manifest line it read.
_OWNER=""; _OWNER_LINE=0
_manifest_owner() {
  local p="$1" mf d n hit
  _OWNER=""; _OWNER_LINE=0
  [ -d "$ROOT/products" ] || return 1
  for d in "$ROOT"/products/*/; do
    [ -d "$d" ] || continue
    n="${d%/}"; n="${n##*/}"
    mf="$d/manifest.json"
    [ -f "$mf" ] || continue
    # The path is matched as a QUOTED JSON string, so `.claude/scripts/core/board-lint.sh`
    # cannot be satisfied by a longer entry that merely contains it as a prefix.
    # -F, not a regex: every real path here contains `.` and `/`, and an unescaped `.`
    # matches any byte -- `.claude/x` would answer to a manifest entry `Xclaude/x`.
    hit="$(grep -Fn "\"$p\"" "$mf" 2>/dev/null | head -1 | cut -d: -f1)"
    [ -n "$hit" ] || continue
    _OWNER="$n"; _OWNER_LINE="$hit"
    return 0
  done
  return 1
}

# ---------- verdict ----------
# The selected lane's own tracker is the Expected citation: it is the file whose machine
# header says this lane is the live one, so it is a location a reviewer can open and check
# rather than a restatement of the rule.
_LANE_CITE="initiatives/$LANE/PROGRESS.md"
[ -f "$ROOT/$_LANE_CITE" ] || _LANE_CITE="PORTFOLIO.md"

printf '%s\n' "$CHANGED" | LC_ALL=C sort -u | while IFS= read -r _p; do
  _trim "$_p"; _p="$_T"
  [ -n "$_p" ] || continue

  _is_organ "$_p" && continue

  # --- owned by another lane's directory ---
  case "$_p" in
    initiatives/*)
      _other="${_p#initiatives/}"; _other="${_other%%/*}"
      [ -n "$_other" ] || continue
      [ "$_other" = "$LANE" ] && continue
      _is_lane "$_other" || continue
      _w_head "$_p" "lane \`$LANE\` is selected, but this path belongs to lane \`$_other\` (ADR-0053: a lane's tracker state is its own)"
      _w_exp "a path under initiatives/$LANE/" "$_LANE_CITE:1"
      _w_fnd "$_p" "initiatives/$_other/PROGRESS.md:1"
      _w_ex  "revert this path and route the change through \`/arc-change --lane $_other\`, or re-run the work with \`--lane $_other\` selected"
      continue
      ;;
  esac

  # --- owned by another lane's product manifest (ADR-0057) ---
  if _manifest_owner "$_p"; then
    [ "$_OWNER" = "$LANE" ] && continue
    _is_lane "$_OWNER" || continue
    _w_head "$_p" "lane \`$LANE\` is selected, but this file is listed in lane \`$_OWNER\`'s product manifest (ADR-0057)"
    _w_exp "a file owned by lane \`$LANE\`" "$_LANE_CITE:1"
    _w_fnd "$_p" "products/$_OWNER/manifest.json:$_OWNER_LINE"
    _w_ex  "revert this path and route the change through \`/arc-change --lane $_OWNER\`, or re-run the work with \`--lane $_OWNER\` selected"
  fi
done

# The pipeline above runs its loop in a subshell, so nothing it sets survives here -- which
# is fine precisely because this lint accumulates no state and returns no verdict in its
# exit code. WARN-first: the WARNs on stdout are the entire product.
exit 0

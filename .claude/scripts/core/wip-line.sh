#!/usr/bin/env bash
# wip-line.sh -- how many lanes are holding the owner's attention right now?
# Cycle 4 (arc-portfolio), Phase 02 / REQ-03, spec section C. ADR-0052 (WIP is VISIBLE,
# never gated: the counted number is LIVE + BLOCKED, kickoff prints it as ONE info line
# and ALWAYS proceeds -- no STOP, no ask, no override ceremony; the working guideline
# stays 2) - ADR-0051 (a lane's status derives from its PROGRESS machine header, which is
# why this script asks the resolver instead of reading any file itself).
#
# NEVER BLOCKS, and that is the entire contract rather than a style: this script EXITS 0
# on every path -- no resolver, no lanes, an ambiguous resolution, a resolver that
# contradicts itself. The v2-v3 pack drafts had a blocking WIP gate at kickoff and the
# owner removed it in round 4 (ADR-0052 options considered); a preflight that can refuse
# is that gate wearing an info line's label.
#
# Zero deps, offline, READ-ONLY: it never creates, moves or writes anything.
#
# Usage: wip-line.sh [--root DIR]
#   Whole-company by design; there is no `--lane`. WIP is a fact about every lane at once,
#   and half a count is not a count. Every other token is ignored, exactly as
#   lane-resolve.sh ignores tokens that belong to the calling command.
#
# Output shape (STDOUT only), exactly one line, or zero bytes:
#
#   WIP: <N> counted (LIVE+BLOCKED) <U+00B7> guideline 2 <U+00B7> informational, kickoff proceeds <U+2014> <lanes|none>
#
# ONE line, never two: ADR-0052 says "prints it as ONE info line", and a preflight that
# grows a second line is a preflight that grows a banner, then a summary, then a prompt.
set -uo pipefail

# Byte semantics, not the operator's collation -- same reasoning as lane-resolve.sh:34-42.
# The counted number is derived from the resolver's own eligible list, so this pins the
# `case` globs below to bytes rather than to a collation table.
export LC_ALL=C LANG=C

# Constants set with `printf -v`, never pasted glyphs: a source file re-saved in another
# encoding must not be able to change what this script emits, and the fixtures compare
# these bytes. Same discipline as board-lint.sh:46-48.
printf -v _DASH '\342\200\224'   # U+2014 EM DASH    -- separates the fixed preamble from
                                 #                      the variable lane list
printf -v _DOT  '\302\267'       # U+00B7 MIDDLE DOT -- the house clause separator, the
                                 #                      same one SessionStart's board line
                                 #                      and PORTFOLIO.md already use

# ADR-0052's working guideline. A NUMBER on the line, never a comparison: the moment this
# script decides whether the count is "too many" it has an opinion, and an opinion is one
# refactor away from an exit code. The operator reads `3 counted ... guideline 2` and
# draws their own conclusion -- that is the whole of what advisory means here.
_GUIDELINE=2

# ---------- flags ----------
ROOT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --root)    if [ $# -ge 2 ]; then ROOT="$2"; shift 2; else shift; fi;;
    --root=*)  ROOT="${1#--root=}"; shift;;
    *)         shift;;
  esac
done

[ -n "$ROOT" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# A PowerShell caller hands bash an `E:\Work_Hub\arc` string; bash then reads `\W` as an
# escaped W and every path built from it silently misses. Normalise ONCE, here.
ROOT="$(printf '%s' "$ROOT" | tr '\\' '/')"

HERE="$(dirname "$0")"
RESOLVER="$HERE/lane-resolve.sh"

# ---------- the count: asked, never re-derived ----------
# The lane set and its eligibility come from lane-resolve.sh, which owns the ADR-0051
# header grammar and the ADR-0054 lane grammar. A second header parser here would be a
# second answer to "does this lane count", and the two would drift on exactly the inputs
# that matter: a fenced-off `status:`, a `**LIVE**`, a lowercase `live`, a case-folded
# `initiatives/Design`, a reserved device name. board-lint.sh:161-166 refuses to keep its
# own copy for the same reason.
if [ ! -f "$RESOLVER" ]; then
  # Degrade LOUDLY, never silently: with no resolver there is no count, and inventing one
  # is the "gate reporting on itself" failure this phase exists to prevent.
  printf 'wip-line: lane-resolve.sh not found beside this script; no lane inventory, no count.\n' >&2
  exit 0
fi

# THE RESOLVER'S EXIT CODE IS DELIBERATELY DROPPED, and this is the single most important
# line in the file. `status=ambiguous` (exit 3) is the NORMAL state of a repo with two
# eligible lanes -- precisely the state ADR-0052 says kickoff must proceed through -- and
# propagating it would turn the info line into the blocking WIP gate the owner removed.
# Exit 4/5 are equally not this script's business: it never takes a `--lane`.
_RES="$(bash "$RESOLVER" --root "$ROOT" --for kickoff --print machine 2>/dev/null | tr -d '\r')"

_field() { printf '%s\n' "$_RES" | sed -n "s/^$1=//p" | head -n1; }

_MODE="$(_field mode)"
_COUNTED="$(_field counted)"
_ELIG_S="$(_field eligible)"

# ROOT-MODE SILENCE is a permanent consumer contract (ADR-0054): LexOS and every venture
# repo run root-mode, where there is no such thing as a lane and therefore nothing to
# count. Zero bytes on stdout AND stderr. An `initiatives/` directory holding no VALID
# lane is root-mode too, by the resolver's own words, so this one check covers both.
[ -n "$_MODE" ] || exit 0
[ "$_MODE" = "root" ] && exit 0

# `eligible=` is space-joined and the lane grammar forbids spaces and glob characters in a
# name, which is why that ONE field may be word-split -- and why `skipped=`, whose entries
# are arbitrary directory names, is never read here at all.
ELIG=()
for _e in $_ELIG_S; do ELIG+=("$_e"); done

# The number printed is the length of the list printed, so the two can never disagree on
# the line. `counted=` is then checked AGAINST it rather than trusted: they come from one
# source today, and a line that says `3 counted` beside two names is the small version of
# this project's most expensive recurring bug -- a gate reporting on its own parse instead
# of on the thing. Digits are spelled out; a negated LETTER range fails open under a
# collation table (A5), and an empty value must not read as a valid number.
_N="${#ELIG[@]}"
_bad_count=0
[ -n "$_COUNTED" ] || _bad_count=1
case "$_COUNTED" in *[!0123456789]*) _bad_count=1;; esac
[ "$_bad_count" -eq 0 ] && [ "$_COUNTED" != "$_N" ] && _bad_count=1
if [ "$_bad_count" -eq 1 ]; then
  printf 'wip-line: resolver reported counted=%s beside %s eligible lane(s); no info line printed.\n' \
    "$_COUNTED" "$_N" >&2
  exit 0
fi

# A genuinely empty list is SPELLED. A trailing separator with nothing after it reads as a
# truncated line, and "0 counted" followed by blank space is the shape an operator skims
# past without registering that it is a real, correct, zero.
if [ "$_N" -eq 0 ]; then
  _LIST="none"
else
  _LIST="$(printf '%s' "$_ELIG_S" | sed 's/ /, /g')"
fi

printf 'WIP: %s counted (LIVE+BLOCKED) %s guideline %s %s informational, kickoff proceeds %s %s\n' \
  "$_N" "$_DOT" "$_GUIDELINE" "$_DOT" "$_DASH" "$_LIST"

exit 0

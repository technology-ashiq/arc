#!/usr/bin/env bash
# critic-scope-check.sh -- the design critic's write boundary (ADR-0034 mechanism 2).
#
# The critic is read-only BY CONSTRUCTION, not by instruction. Three mechanisms enforce it;
# this is the second: while a critique run is active, the only path the critic may write is
# under docs/design/critique/. Anything else blocks.
#
# Scoped to the RUN, never global. The boundary exists only while the marker file written by
# --begin exists, exactly like /arc-freeze's state file: an always-on rule would block the
# creation side from ever fixing what the critic found, which is the other half of the loop.
#
#   critic-scope-check.sh --begin <route>   # arm the boundary for a critique run
#   critic-scope-check.sh --end             # disarm (the runner does this even on FAIL)
#   critic-scope-check.sh [<path>]          # enforce; path from $1 or tool_input JSON on stdin
#
# Exit: 0 allow | 2 BLOCK. Never any other code -- this runs in a PreToolUse hook, where a
# stray exit code is somebody's session breaking for no reason.
#
# bash-3.2 / POSIX-safe (macOS BSD leg): no arrays, no GNU-only flags.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MARKER_DIR="$ROOT/.claude/state/design"
MARKER="$MARKER_DIR/critic-session"
ALLOWED="docs/design/critique"

case "${1:-}" in
  --begin)
    route="${2:-}"
    if [ -z "$route" ]; then
      echo "critic-scope-check: --begin needs the route being critiqued" >&2
      exit 2
    fi
    mkdir -p "$MARKER_DIR" || exit 2
    # The marker records WHAT is being critiqued, so a stale marker is diagnosable rather
    # than just mysteriously blocking edits.
    {
      echo "route=$route"
      echo "allowed=$ALLOWED"
      echo "pid=$$"
    } > "$MARKER" || exit 2
    echo "critic-scope-check: boundary armed -- writes restricted to $ALLOWED/ (route: $route)"
    exit 0
    ;;
  --end)
    rm -f "$MARKER" 2>/dev/null || true
    echo "critic-scope-check: boundary released"
    exit 0
    ;;
esac

# ---------- enforcement ----------

# No marker -> no critique run in flight -> nothing to enforce.
[ -f "$MARKER" ] || exit 0

TARGET="${1:-}"
if [ -z "$TARGET" ] && [ ! -t 0 ]; then
  STDIN="$(cat)"
  if command -v jq >/dev/null 2>&1; then
    TARGET="$(printf '%s' "$STDIN" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)"
  else
    TARGET="$(printf '%s' "$STDIN" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
  fi
fi
[ -z "$TARGET" ] && exit 0   # can't tell what is being written -> don't block

TARGET="$(printf '%s' "$TARGET" | tr '\\' '/')"

# A `..` segment escapes any prefix match: "docs/design/critique/../../../README.md" carries
# the allowed prefix and still lands on README. Prefix matching cannot see that, so traversal
# is refused outright BEFORE any normalising -- and refused on every OS, not just the ones
# whose path tools happen to collapse it, so all three CI legs behave identically.
# (freeze-check.sh shares this hole; fixing it is a core change, tracked separately.)
case "$TARGET" in
  ..|../*|*/..|*/../*)
    echo "BLOCKED by design-critic scope: '$TARGET' contains a '..' segment." >&2
    echo "The critic may write only inside $ALLOWED/ -- traversal paths are refused." >&2
    exit 2
    ;;
esac

# Normalise to repo-relative.
#
# NEVER compare path strings here. One machine calls a directory /var/folders/x and another
# calls the same directory /private/var/folders/x (macOS symlinks /var); Windows calls one
# path both C:/Users/RUNNER~1 and C:/Users/runneradmin (8.3 short names), and Git Bash
# disagrees with git itself about /tmp (MSYS vs native). Every one of those is the same
# directory under a different spelling, and a prefix strip that misses leaves the path
# absolute, matches no allowed prefix, and BLOCKS the critic's own legitimate write --
# read-only enforcement that also blocks the one write it must allow is just broken.
# Caught by 3-OS CI: this passed on the author's Windows box only because a short username
# meant the two spellings happened to be identical there.
#
# So both sides go through one resolver instead: cd into the deepest part of the path that
# exists and ask the shell for the physical path, then re-attach whatever did not exist yet
# (the critique file is normally about to be created, so the tail often does not exist).
_canon() {
  _cp="$1"; _cs=""
  while [ -n "$_cp" ] && [ "$_cp" != "/" ] && [ ! -d "$_cp" ]; do
    _cs="$(basename "$_cp")${_cs:+/$_cs}"
    _cparent="$(dirname "$_cp")"
    [ "$_cparent" = "$_cp" ] && break
    _cp="$_cparent"
  done
  if [ -d "$_cp" ]; then
    _cbase="$(cd "$_cp" 2>/dev/null && pwd -P)" || _cbase="$_cp"
    printf '%s' "$_cbase${_cs:+/$_cs}"
  else
    printf '%s' "$1"
  fi
}

# Only absolute targets need resolving; a relative one is already repo-relative.
case "$TARGET" in
  /*|[A-Za-z]:/*)
    TARGET="$(_canon "$TARGET" | tr '\\' '/')"
    ROOT_N="$(_canon "$ROOT" | tr '\\' '/')"
    case "$TARGET" in "$ROOT_N"/*) TARGET="${TARGET#"$ROOT_N"/}";; esac
    ;;
esac

case "$TARGET" in
  "$ALLOWED"|"$ALLOWED"/*) exit 0;;
esac

echo "BLOCKED by design-critic scope: writes restricted to $ALLOWED/ during a critique run." >&2
echo "Target '$TARGET' is outside it. The critic reports; the creation side fixes (ADR-0034)." >&2
exit 2

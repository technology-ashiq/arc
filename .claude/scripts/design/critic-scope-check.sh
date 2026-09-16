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

# common.sh is loaded where it is first needed, never on the unarmed path: every Edit and Write in
# every session runs this hook, and the first cut of the stamp loaded core before the no-marker
# exit, charging all of them for a critique run that is almost never in flight. It is loaded by
# --begin (for the stamp) and right after the marker check (for every refusal and the resolver).

# A critique run that dies before `finish` leaves this boundary armed, and it then refuses every
# write outside docs/design/critique/ for everyone, indefinitely. The composer boundary did that
# for three weeks behind a refusal that said nothing about when or how to release it, and this
# file wrote the same dead-on-arrival pid. So every refusal once a marker exists says what is
# armed, since when, and the release. Describing is all it does -- see arc_armed_desc.
# The note goes to STDERR, which is what a PreToolUse hook exiting 2 is shown by. The route is
# reduced to a safe alphabet before it is printed, in pure bash (no tr under a UTF-8 locale, where
# BSD tr aborts on invalid bytes), and the release is anchored at the repo root so it works when
# pasted from any directory in the repo.
_refuse() {
  if type arc_armed_desc >/dev/null 2>&1 && type arc_marker_read >/dev/null 2>&1; then
    arc_marker_read "$MARKER"
    _rf_route="${ARC_MF_ROUTE//[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._\/-]/}"
    arc_armed_desc "$ARC_MF_AT" "$ARC_MF_EPOCH"
    echo "design critic boundary ARMED for route ${_rf_route:0:120} -- $ARC_ARMED_DESC. It never expires on its own." >&2
    echo "  if no critique is running it is stale; release: cd \"\$(git rev-parse --show-toplevel)\" && bash .claude/scripts/design/critic-scope-check.sh --end" >&2
  fi
  exit 2
}

case "${1:-}" in
  --begin)
    route="${2:-}"
    if [ -z "$route" ]; then
      echo "critic-scope-check: --begin needs the route being critiqued" >&2
      exit 2
    fi
    mkdir -p "$MARKER_DIR" || exit 2
    # The marker records WHAT is being critiqued and WHEN, so an abandoned one is diagnosable
    # rather than mysteriously blocking edits. It used to record `pid=$$` -- this process, gone
    # one line later -- which looked like a liveness signal and could only ever say "dead".
    #
    # Written whole or not at all, and the stamp is optional. `type ... && arc_armed_stamp` as the
    # group's last command made a missing stamp exit 2 AFTER the redirect had created the marker,
    # and design-critique.sh treats a failed --begin as "not armed" and never calls --end: an
    # abandoned boundary, manufactured by the change meant to diagnose one. A dot-name the marker
    # path never equals, the body chained with && so a failed printf is a failed write, then a move.
    . "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true
    _ck_tmp="$MARKER_DIR/.critic-session.$$"
    if ! { printf 'route=%s\nallowed=%s\n' "$route" "$ALLOWED" \
             && if type arc_armed_stamp >/dev/null 2>&1; then arc_armed_stamp; fi
         } > "$_ck_tmp" 2>/dev/null || ! mv -f "$_ck_tmp" "$MARKER" 2>/dev/null; then
      rm -f "$_ck_tmp" 2>/dev/null
      echo "critic-scope-check: could not write the marker -- the boundary is NOT armed" >&2
      exit 2
    fi
    echo "critic-scope-check: boundary armed -- writes restricted to $ALLOWED/ (route: $route)"
    exit 0
    ;;
  --end)
    rm -f "$MARKER" "$MARKER_DIR"/.critic-session.* 2>/dev/null || true
    echo "critic-scope-check: boundary released"
    exit 0
    ;;
esac

# ---------- enforcement ----------

# No marker -> no critique run in flight -> nothing to enforce.
[ -f "$MARKER" ] || exit 0
# Armed: load core now, for every refusal below and for the resolver. See the note at the top.
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true

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
    _refuse
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
# One canonicaliser, now in core as arc_canon_path -- composer-scope-check.sh (ADR-1415)
# needs the identical resolver, and a second copy of a path helper that three-OS CI had
# already hardened is the twin-fix shape this repo keeps paying for. There is no local copy:
# a duplicate no test can reach is not a safety net (see the block below).
# (common.sh is loaded right after the marker check above, so the refusal below has something to check.)
if ! type arc_canon_path >/dev/null 2>&1; then
  # The inline fallback that used to sit here was a PRE-FIX copy of common.sh's resolver --
  # the same body without the root-of-"/" normalisation, so it returned "//no-such/f" where the
  # canonical one returns "/no-such/f", and "//host/share" is a UNC path on Cygwin/MSYS. The
  # comment above called it fail-safe; a fresh attacker measured it and it was a second
  # implementation drifting in the dark, unreachable by any test because test_helper.bash
  # always copies common.sh into the sandbox.
  #
  # composer-scope-check.sh carried the identical twin and is fixed the same way. A hook that
  # cannot load its path resolver is not fail-safe -- for a scope boundary it is unguarded.
  echo "BLOCKED by design-critic scope: cannot load .claude/scripts/core/common.sh, so paths cannot be canonicalised." >&2
  echo "A boundary that cannot resolve a path cannot decide anything about it. Refusing rather than guessing." >&2
  exit 2
fi

# Only absolute targets need resolving; a relative one is already repo-relative.
case "$TARGET" in
  /*|[A-Za-z]:/*)
    TARGET="$(arc_canon_path "$TARGET" | tr '\\' '/')"
    ROOT_N="$(arc_canon_path "$ROOT" | tr '\\' '/')"
    case "$TARGET" in "$ROOT_N"/*) TARGET="${TARGET#"$ROOT_N"/}";; esac
    ;;
esac

case "$TARGET" in
  "$ALLOWED"|"$ALLOWED"/*) exit 0;;
esac

echo "BLOCKED by design-critic scope: writes restricted to $ALLOWED/ during a critique run." >&2
echo "Target '$TARGET' is outside it. The critic reports; the creation side fixes (ADR-0034)." >&2
_refuse

#!/usr/bin/env bash
# composer-write-check.sh -- the ui-composer's WRITE boundary (adversarial pass, 2026-08-25).
#
# ADR-1415 built the composer a READ boundary and left `Write` unbounded. A fresh attacker
# showed what that is worth: blocked from READING variant-b, the composer used its own Write
# tool on the marker file that constrains it, and then read variant-b. It can equally rewrite
# composer-scope-check.sh. Cycle 7 already paid for this exact shape -- a propose-only guard
# that a mutant module walked past by overwriting the canonical file -- and the lesson is
# written in this repo's own rules: the mutant IS the negative control.
#
# So the composer may write to ONE place: its own variant directory. Everything else is
# refused, and the two refusals that matter most are named separately because they are the
# escape rather than an ordinary mistake:
#
#   * the marker directory, .claude/state/design/  -- rewriting the constraint
#   * .claude/scripts/design/                      -- rewriting the guard
#
# Scoped to the RUN. With no composer armed this is a no-op, exactly like the read boundary:
# an always-on rule would block every other agent in the repo, including the one that fixes
# what the composer got wrong.
#
#   composer-write-check.sh [<path>]   # enforce; path from $1 or tool_input JSON on stdin
#
# Exit: 0 allow | 2 BLOCK. Never any other code -- this runs in a PreToolUse hook, where a
# stray exit is somebody's session breaking for no reason.
#
# bash-3.2 / POSIX-safe (macOS BSD leg): no arrays, no GNU-only flags.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MARKER_DIR="$ROOT/.claude/state/design"

# One canonicaliser, from core. No local copy: the read boundary carried a PRE-FIX duplicate of
# this resolver for a whole cycle and no test could reach it. A hook that cannot load its path
# resolver is not fail-safe -- for a scope boundary it is unguarded.
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true
if ! command -v arc_canon_path >/dev/null 2>&1 && ! type arc_canon_path >/dev/null 2>&1; then
  echo "BLOCKED by ui-composer write scope: cannot load .claude/scripts/core/common.sh, so paths cannot be canonicalised." >&2
  exit 2
fi

# ---------- which composer, if any ----------
#
# Same per-composer marker set the read boundary reads, and the same rule: more than one armed
# means this write cannot be attributed to one of them, and picking is how composer a came to
# read variant-b.
_MK_N=0; MARKER=""
for _mk in "$MARKER_DIR"/composer-session--*; do
  [ -f "$_mk" ] || continue
  _MK_N=$((_MK_N + 1)); MARKER="$_mk"
done
[ "$_MK_N" -eq 0 ] && exit 0
if [ "$_MK_N" -gt 1 ]; then
  echo "BLOCKED by ui-composer write scope: $_MK_N composer boundaries are armed at once." >&2
  echo "This write cannot be attributed to one of them. Compose serially." >&2
  exit 2
fi

# tr -d '\r' before the anchored sed: a CRLF marker reads clean on Windows (MSYS2 strips it)
# and yields an empty id on ubuntu and macOS, which would build a prefix ending in '/'.
EX="$(tr -d '\r' < "$MARKER" 2>/dev/null | sed -n 's/^explore=//p' | head -1)"
VARIANT="$(tr -d '\r' < "$MARKER" 2>/dev/null | sed -n 's/^variant=//p' | head -1)"
if [ -z "$EX" ] || [ -z "$VARIANT" ]; then
  echo "BLOCKED by ui-composer write scope: the marker exists but names no explore/variant." >&2
  exit 2
fi

# ---------- what is being written ----------

TARGET="${1:-}"
if [ -z "$TARGET" ] && [ ! -t 0 ]; then
  STDIN="$(cat)"
  if command -v jq >/dev/null 2>&1; then
    TARGET="$(printf '%s' "$STDIN" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)"
  else
    TARGET="$(printf '%s' "$STDIN" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    [ -z "$TARGET" ] && TARGET="$(printf '%s' "$STDIN" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
  fi
fi
# A write we cannot identify fails CLOSED, and that is the opposite of the read boundary's
# choice on purpose. An unjudgeable READ blocks unrelated work for no visible reason; an
# unjudgeable WRITE while a composer is armed is the one thing this guard exists to stop.
if [ -z "$TARGET" ]; then
  echo "BLOCKED by ui-composer write scope: a write is in flight and its path could not be read from the payload." >&2
  echo "A write that cannot be identified cannot be allowed while a composer boundary is armed." >&2
  exit 2
fi

TARGET="$(printf '%s' "$TARGET" | tr '\\' '/')"

# Traversal is refused BEFORE any normalising, on every OS: a '..' segment carries an allowed
# prefix and still lands elsewhere, and prefix matching cannot see that.
case "$TARGET" in
  ..|../*|*/..|*/../*)
    echo "BLOCKED by ui-composer write scope: '$TARGET' contains a '..' segment." >&2
    exit 2;;
esac

# Normalise a relative target so an ordinary './x' spelling is judged as the path it is.
case "$TARGET" in
  /*|[A-Za-z]:/*)
    TARGET="$(arc_canon_path "$TARGET" | tr '\\' '/')"
    ROOT_N="$(arc_canon_path "$ROOT" | tr '\\' '/')"
    case "$TARGET" in "$ROOT_N"/*) TARGET="${TARGET#"$ROOT_N"/}";; esac
    ;;
  *)
    while :; do
      case "$TARGET" in
        ./*)   TARGET="${TARGET#./}"; continue;;
        *//*)  TARGET="$(printf '%s' "$TARGET" | sed 's#//*#/#g')"; continue;;
        */./*) TARGET="$(printf '%s' "$TARGET" | sed 's#/\./#/#g')"; continue;;
      esac
      break
    done
    ;;
esac

OWN_VARIANT="docs/design/explore/$EX/$VARIANT"

# The allowlist is one directory. The composer's deliverables -- index.html, tokens.css, assets,
# its self-review manifest -- all live inside it, and nothing it produces belongs anywhere else.
case "$TARGET" in
  "$OWN_VARIANT"|"$OWN_VARIANT"/*) exit 0;;
esac

# The two escapes, named separately: a generic "outside your directory" message would describe
# rewriting the guard and adding a stray file in the same words, and only one of those is an
# attempt to leave the boundary.
case "$TARGET" in
  .claude/state/design|.claude/state/design/*)
    echo "BLOCKED by ui-composer write scope: '$TARGET' is the boundary's own state." >&2
    echo "Rewriting the marker that constrains you is not a write, it is an escape." >&2
    exit 2;;
  .claude/scripts/design|.claude/scripts/design/*|.claude/hooks|.claude/hooks/*)
    echo "BLOCKED by ui-composer write scope: '$TARGET' is the guard itself." >&2
    echo "A boundary its subject can rewrite is not a boundary." >&2
    exit 2;;
esac

case "$TARGET" in
  docs/design/explore/"$EX"/variant-*|docs/design/explore/"$EX"/variant-*/*)
    echo "BLOCKED by ui-composer write scope: '$TARGET' belongs to a sibling variant." >&2
    echo "You are $VARIANT. Writing into another composer's work is not independence." >&2
    exit 2;;
esac

echo "BLOCKED by ui-composer write scope: '$TARGET' is outside $OWN_VARIANT/." >&2
echo "Your variant directory is the only place you write -- page, tokens, assets, self-review." >&2
exit 2

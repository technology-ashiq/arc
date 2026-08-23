#!/usr/bin/env bash
# composer-scope-check.sh -- the ui-composer's READ boundary (ADR-1415).
#
# Iron law 1 said "your directory only". Design v2 requires the composer to read two things
# outside variant-<x>/: its own rendered PNG (ADR-1401) and the brief's reference pack
# (ADR-1404). Unlike the brief's TEXT, an image cannot be inlined into a subagent prompt, so
# there is no other delivery mechanism -- the law has to widen, by enumeration.
#
# It widens HERE and not only in the prompt, because `ui-composer` declares bare `Read`, which
# is unscoped. A rule that lives only in prose is obeyed when the agent chooses to obey it, and
# a negative control over prose tests COMPLIANCE rather than REFUSAL. That distinction is the
# whole finding of Phase 00's adversarial pass.
#
# Scoped to the RUN, never global -- same shape as critic-scope-check.sh and /arc-freeze. An
# always-on rule would block every other agent in the repo, including the one that fixes what
# the composer got wrong.
#
#   composer-scope-check.sh --begin <explore-id> <variant>   # arm for one composer
#   composer-scope-check.sh --end                            # disarm
#   composer-scope-check.sh [<path>]                         # enforce; path from $1 or stdin
#
# Exit: 0 allow | 2 BLOCK. Never any other code -- this runs in a PreToolUse hook, where a
# stray exit is somebody's session breaking for no reason.
#
# bash-3.2 / POSIX-safe (macOS BSD leg): no arrays, no GNU-only flags.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MARKER_DIR="$ROOT/.claude/state/design"
MARKER="$MARKER_DIR/composer-session"

# One canonicaliser, shared with critic-scope-check.sh via common.sh. It was duplicated here
# first; a second copy of a path resolver that three-OS CI had already hardened is precisely
# the twin-fix shape this repo keeps paying for, so the helper moved to core and both callers
# use it. The local fallback keeps the hook fail-safe if common.sh is missing.
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true
if ! command -v arc_canon_path >/dev/null 2>&1 && ! type arc_canon_path >/dev/null 2>&1; then
  arc_canon_path() {
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
fi

# Control verbs are only honoured when this script is invoked DIRECTLY, never when a path is
# forwarded into it as argv. A read of a file literally named "--end" would otherwise disarm
# the boundary: the fragment forwards "$@", so a future caller passing the path positionally
# turns a filename into a control command. lanes.md already prescribes this shape -- a value
# is carried behind an explicit flag, never inferred from position.
ARC_SCOPE_VERB=""
case "${1:-}" in
  --begin|--end) [ "${ARC_SCOPE_FORWARDED:-0}" = "1" ] || ARC_SCOPE_VERB="$1";; esac

case "$ARC_SCOPE_VERB" in
  --begin)
    ex="${2:-}"; variant="${3:-}"
    if [ -z "$ex" ] || [ -z "$variant" ]; then
      echo "composer-scope-check: --begin needs the explore id AND the variant (the boundary is per-composer, not per-run)" >&2
      exit 2
    fi
    # Both become path segments. Spelled out, not `a-z`: a bracket range resolves through the
    # locale collation table, which on macOS interleaves case -- the defect design-explore.sh
    # documents for its explore id and Phase 00 hit again on the session id.
    case "$ex$variant" in
      *[!abcdefghijklmnopqrstuvwxyz0123456789-]*)
        echo "composer-scope-check: explore id and variant must be lowercase letters, digits and hyphens" >&2
        exit 2;;
    esac
    mkdir -p "$MARKER_DIR" || exit 2
    # The marker records WHO is armed, so a stale marker is diagnosable rather than just
    # mysteriously refusing reads.
    {
      echo "explore=$ex"
      echo "variant=$variant"
      echo "pid=$$"
    } > "$MARKER" || exit 2
    echo "composer-scope-check: read boundary armed for $ex/$variant"
    exit 0
    ;;
  --end)
    rm -f "$MARKER" 2>/dev/null || true
    echo "composer-scope-check: read boundary released"
    exit 0
    ;;
esac

# ---------- enforcement ----------

# No marker -> no composer in flight -> nothing to enforce.
[ -f "$MARKER" ] || exit 0

EX="$(sed -n 's/^explore=//p' "$MARKER" 2>/dev/null | head -1)"
VARIANT="$(sed -n 's/^variant=//p' "$MARKER" 2>/dev/null | head -1)"
# A marker we cannot read is not a licence to allow everything: it is a broken boundary, and
# an empty read here would build allowlist prefixes ending in `/`, which match far too much.
if [ -z "$EX" ] || [ -z "$VARIANT" ]; then
  echo "BLOCKED by ui-composer scope: the marker exists but names no explore/variant." >&2
  echo "A boundary that cannot say what it protects is not a boundary. Re-arm or --end it." >&2
  exit 2
fi

TARGET="${1:-}"
if [ -z "$TARGET" ] && [ ! -t 0 ]; then
  STDIN="$(cat)"
  if command -v jq >/dev/null 2>&1; then
    TARGET="$(printf '%s' "$STDIN" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)"
  else
    TARGET="$(printf '%s' "$STDIN" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
  fi
fi
[ -z "$TARGET" ] && exit 0   # cannot tell what is being read -> do not block

TARGET="$(printf '%s' "$TARGET" | tr '\\' '/')"

# Traversal is refused BEFORE any normalising, on every OS. A `..` segment carries an allowed
# prefix and still lands elsewhere, and prefix matching cannot see that.
case "$TARGET" in
  ..|../*|*/..|*/../*)
    echo "BLOCKED by ui-composer scope: '$TARGET' contains a '..' segment." >&2
    exit 2
    ;;
esac

# Only absolute targets need resolving; a relative one is already repo-relative. Never compare
# path STRINGS: one machine calls a directory /var/folders/x and another /private/var/folders/x,
# Windows spells one path two ways with 8.3 short names, and Git Bash disagrees with git about
# /tmp. Each is the same directory under a different spelling.
case "$TARGET" in
  /*|[A-Za-z]:/*)
    TARGET="$(arc_canon_path "$TARGET" | tr '\\' '/')"
    ROOT_N="$(arc_canon_path "$ROOT" | tr '\\' '/')"
    case "$TARGET" in "$ROOT_N"/*) TARGET="${TARGET#"$ROOT_N"/}";; esac
    ;;
esac

OWN_VARIANT="docs/design/explore/$EX/$VARIANT"
OWN_RENDERS=".claude/state/design/renders/$EX--$VARIANT"
PACK=".claude/state/design/refpacks/$EX"

# The allowlist, enumerated. Everything iron law 1 forbade stays forbidden: another variant's
# dir, the matrix, the brief FILE, product files. The pack is admitted because it is images the
# composer must open itself; the brief is not, because its text is carried by the prompt --
# widening to "anything about this brief" would quietly re-permit the file the law names.
case "$TARGET" in
  "$OWN_VARIANT"|"$OWN_VARIANT"/*) exit 0;;
  "$OWN_RENDERS"|"$OWN_RENDERS"/*) exit 0;;
  "$PACK"|"$PACK"/*)               exit 0;;
esac

# A sibling gets its own message, because it is the failure this boundary exists for: widening
# the composer's reach must not hand every composer every other composer's work. The blindness
# is what makes the panel worth anything.
case "$TARGET" in
  docs/design/explore/"$EX"/variant-*|docs/design/explore/"$EX"/variant-*/*|\
  .claude/state/design/renders/"$EX"--variant-*|.claude/state/design/renders/"$EX"--variant-*/*)
    echo "BLOCKED by ui-composer scope: '$TARGET' belongs to a sibling variant." >&2
    echo "You are $VARIANT. Your variant's value is its independence -- you may not look." >&2
    exit 2
    ;;
esac

echo "BLOCKED by ui-composer scope: '$TARGET' is outside the read allowlist for $EX/$VARIANT." >&2
echo "Allowed: your variant dir, your own session's renders, and the brief's reference pack." >&2
exit 2

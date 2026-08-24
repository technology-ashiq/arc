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

# ONE canonicaliser, and no local copy of it.
#
# There used to be a fallback definition inlined here, and a comment calling it "fail-safe".
# A fresh attacker measured what it actually was: a PRE-FIX copy. common.sh normalises a root
# of "/" to "" for the UNC reason spelled out there; the inline copy was that body WITHOUT the
# normalisation, so it returned "//no-such/f" where the canonical one returns "/no-such/f".
# critic-scope-check.sh carried the identical stale twin. Third instance of that shape this
# cycle -- and neither copy was ever exercised, because test_helper.bash always copies
# common.sh into the sandbox, so no test could see the divergence.
#
# A duplicate that no test reaches is not a safety net, it is a second implementation drifting
# in the dark. So: load the real one, and if it is missing, REFUSE. A hook that cannot load its
# path resolver is not fail-safe -- it is unguarded, which for a read boundary is the failure
# and not the fallback.
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true
if ! command -v arc_canon_path >/dev/null 2>&1 && ! type arc_canon_path >/dev/null 2>&1; then
  echo "BLOCKED by ui-composer scope: cannot load .claude/scripts/core/common.sh, so paths cannot be canonicalised." >&2
  echo "A boundary that cannot resolve a path cannot decide anything about it. Refusing rather than guessing." >&2
  exit 2
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
    } > "$MARKER_DIR/composer-session--$ex--$variant" || exit 2
    echo "composer-scope-check: read boundary armed for $ex/$variant"
    exit 0
    ;;
  --end)
    # --end NAMES what it releases. The single global marker made `--end` mean "release
    # whatever is armed", so `compose-done <id> --variant c` cheerfully disarmed variant-b's
    # boundary and left b reading siblings. With no arguments it still clears everything,
    # because a session that has lost track must be able to get back to a known state.
    _e="${2:-}"; _v="${3:-}"
    if [ -n "$_e" ] && [ -n "$_v" ]; then
      rm -f "$MARKER_DIR/composer-session--$_e--$_v" 2>/dev/null || true
      echo "composer-scope-check: read boundary released for $_e/$_v"
    else
      rm -f "$MARKER_DIR"/composer-session--* "$MARKER" 2>/dev/null || true
      echo "composer-scope-check: read boundary released (all)"
    fi
    exit 0
    ;;
esac

# ---------- enforcement ----------

# No marker -> no composer in flight -> nothing to enforce.
# ONE marker per composer, and MORE THAN ONE is a refusal rather than a guess.
#
# This was a single global file while explore mode runs three composers. A fresh attacker
# armed A, then armed B, and the marker simply became B's: composer A was then allowed to read
# variant-b and REFUSED its own directory. Both halves of the boundary inverted at once, and
# the marker's `pid=` field -- the one thing that could have detected it -- was written by
# --begin and read by nothing.
#
# A filesystem marker cannot tell which composer is calling: the hook payload carries no
# caller identity this script can trust. So the honest contract is SERIAL composition, and
# more than one armed boundary fails CLOSED with a message that says why. Parallel composition
# needs per-caller identity in the payload, which is a later question and not one to fake here
# by picking a marker and hoping.
_MK_N=0; MARKER=""
for _mk in "$MARKER_DIR"/composer-session--*; do
  [ -f "$_mk" ] || continue
  _MK_N=$((_MK_N + 1)); MARKER="$_mk"
done
[ "$_MK_N" -eq 0 ] && exit 0
if [ "$_MK_N" -gt 1 ]; then
  echo "BLOCKED by ui-composer scope: $_MK_N composer boundaries are armed at once." >&2
  echo "This read cannot be attributed to one of them, and picking is how composer A came to read variant-b." >&2
  echo "Compose serially -- one compose / compose-done pair at a time." >&2
  exit 2
fi

# tr -d '\r' before the anchored sed, the same guard _sha_of and _vw_of carry in
# design-explore.sh. Without it a CRLF marker -- written by PowerShell, an editor, or the
# composer's own Write tool -- yields an empty EX on ubuntu and macOS while MSYS2 strips the CR
# and reads clean on Windows. The consequence is not a silent pass but a total refusal: every
# composer read blocked, on two legs out of three, for a reason invisible on the third.
EX="$(tr -d '\r' < "$MARKER" 2>/dev/null | sed -n 's/^explore=//p' | head -1)"
VARIANT="$(tr -d '\r' < "$MARKER" 2>/dev/null | sed -n 's/^variant=//p' | head -1)"
# A marker we cannot read is not a licence to allow everything: it is a broken boundary, and
# an empty read here would build allowlist prefixes ending in `/`, which match far too much.
if [ -z "$EX" ] || [ -z "$VARIANT" ]; then
  echo "BLOCKED by ui-composer scope: the marker exists but names no explore/variant." >&2
  echo "A boundary that cannot say what it protects is not a boundary. Re-arm or --end it." >&2
  exit 2
fi

TARGET="${1:-}"
# The TOOL matters as much as the path, and reading only the path is why this boundary
# covered one of the three read tools the composer holds.
#
# `Read` carries tool_input.file_path. `Grep` and `Glob` carry a pattern plus an OPTIONAL
# path, and BOTH return a sibling variant's content. Widening settings.json to
# `Read|Grep|Glob` is necessary and not sufficient: a Grep that NAMES a sibling is caught by
# the .path fallback below, but a Grep with NO path searches from the repo root -- every
# variant, the matrix, the brief -- and arrives here as an empty target.
#
# An empty target used to mean one thing. It means two:
#   Read  + no file_path -> a malformed payload nobody can judge. Blocking it would break
#                           unrelated reads for a reason with no visible cause. Fail OPEN.
#   Grep  + no path      -> "all of it". That is the widest possible read, not an absent
#   Glob  + no path         one, and it must fail CLOSED.
TOOL=""
PATTERN=""
if [ -z "$TARGET" ] && [ ! -t 0 ]; then
  STDIN="$(cat)"
  if command -v jq >/dev/null 2>&1; then
    TARGET="$(printf '%s' "$STDIN" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)"
    TOOL="$(printf '%s' "$STDIN" | jq -r '.tool_name // empty' 2>/dev/null)"
    PATTERN="$(printf '%s' "$STDIN" | jq -r '.tool_input.pattern // empty' 2>/dev/null)"
  else
    TARGET="$(printf '%s' "$STDIN" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    [ -z "$TARGET" ] && TARGET="$(printf '%s' "$STDIN" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    TOOL="$(printf '%s' "$STDIN" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
    PATTERN="$(printf '%s' "$STDIN" | grep -o '"pattern"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
  fi
fi

# THE PATTERN IS A PATH TOO, for Glob and Grep. Judging only `path` left the boundary open in
# the most ordinary way there is: an ALLOWED path plus an ABSOLUTE pattern returns the sibling,
# because the tool resolves the pattern against the filesystem and not against the path it was
# handed. A fresh attacker did exactly that and got variant-b's index.html back while the gate
# said 0.
#
# `../` in a pattern is refused too. That form happens not to escape today -- the tool declines
# to walk `..` in a pattern -- but a rule that depends on another tool's current behaviour is a
# rule with an expiry date nobody will notice passing.
case "$TOOL" in
  Grep|Glob)
    case "$PATTERN" in
      "") ;;
      /*|[A-Za-z]:/*|[A-Za-z]:\\*)
        echo "BLOCKED by ui-composer scope: an ABSOLUTE $TOOL pattern ('$PATTERN') is resolved against the filesystem, not against the path you passed." >&2
        echo "That is the whole tree, including every sibling variant. Keep the pattern relative and scope it with path." >&2
        exit 2;;
      ..|../*|*/..|*/../*)
        echo "BLOCKED by ui-composer scope: a $TOOL pattern containing '..' ('$PATTERN') leaves whatever path scopes it." >&2
        exit 2;;
    esac
    ;;
esac

if [ -z "$TARGET" ]; then
  case "$TOOL" in
    Grep|Glob)
      echo "BLOCKED by ui-composer scope: an unscoped $TOOL searches the whole tree, which includes every sibling variant, the matrix and the brief." >&2
      echo "Pass an explicit path inside $EX/$VARIANT (or your session's renders / the brief's refpack)." >&2
      exit 2;;
  esac
  exit 0   # cannot tell what is being read -> do not block
fi

TARGET="$(printf '%s' "$TARGET" | tr '\\' '/')"

# Traversal is refused BEFORE any normalising, on every OS. A `..` segment carries an allowed
# prefix and still lands elsewhere, and prefix matching cannot see that.
case "$TARGET" in
  ..|../*|*/..|*/../*)
    echo "BLOCKED by ui-composer scope: '$TARGET' contains a '..' segment." >&2
    exit 2
    ;;
esac

# A RELATIVE target still needs normalising before it can be compared, and skipping that was a
# false refusal rather than a hole: `./docs/.../variant-a/index.html` is the composer's OWN file
# and was BLOCKED, as were `docs/./design/...` and `docs//design/...`. Grep and Glob take
# relative paths as a matter of course, so this is the ordinary spelling, not an exotic one.
#
# Done AFTER the traversal refusal above, deliberately: `..` is judged on the raw string, and a
# normaliser that collapsed segments first would be resolving the very thing the refusal exists
# to catch. Nothing here can introduce a `..` -- it only removes `./` and doubled slashes.
case "$TARGET" in
  /*|[A-Za-z]:/*) ;;
  *)
    while :; do
      case "$TARGET" in
        ./*)  TARGET="${TARGET#./}"; continue;;
        *//*) TARGET="$(printf '%s' "$TARGET" | sed 's#//*#/#g')"; continue;;
        */./*) TARGET="$(printf '%s' "$TARGET" | sed 's#/\./#/#g')"; continue;;
      esac
      break
    done
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

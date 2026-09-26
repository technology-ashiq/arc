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
#   composer-scope-check.sh --describe                       # what is armed, since when, how to release
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

# Whether this copy of common.sh can run the boundary: the resolver, plus the marker helpers that a
# common.sh one version behind lacks. Without them the first marker read is "command not found" and
# an unbound variable -- exit 1, which the dispatcher treats as ALLOW.
#
# CHECKED WHERE IT IS NEEDED, never up front. The first cut checked before the verbs and before the
# no-marker exit, so a stale common.sh refused every Read, Grep and Glob in the tree with NOTHING
# armed -- the repo-wide lock that "scoped to the RUN" above forbids. It happened for real, to the
# session writing this: mid-edit, common.sh briefly lacked the reader, and the working-tree hook
# refused that session's own reads. --end needs none of it and is never refused for it.
_core_ok() {
  type arc_canon_path >/dev/null 2>&1 && type arc_design_id_ok >/dev/null 2>&1 \
    && type arc_cm_load >/dev/null 2>&1 && type arc_cm_describe >/dev/null 2>&1
}
_core_refuse() {
  echo "BLOCKED by ui-composer scope: .claude/scripts/core/common.sh is missing or older than this boundary, so an armed marker cannot be read or a path resolved." >&2
  echo "A boundary that cannot read what it protects cannot decide anything. Refusing rather than guessing; re-sync core, then retry." >&2
  exit 2
}

# ---------- an armed boundary, described ----------
#
# A boundary outlives the compose that armed it whenever that compose dies before compose-done,
# and then it refuses every read and write in the tree -- the operator's too, because a marker
# cannot tell who is calling. lexos-p01/variant-a sat armed for three weeks that way, behind a
# refusal that said neither when it was armed nor how to release it.
#
# So every read and write refusal DESCRIBES what is armed -- arc_cm_describe in common.sh, shared
# with composer-write-check.sh -- and describing is all it does; arc_armed_desc's comment says why
# age never relaxes a refusal. A stale boundary is released by a person, on purpose.
#
# The note goes to STDERR: a PreToolUse hook that exits 2 is shown by its stderr, and a note on
# stdout would be printed to nobody. Every refusal once a marker exists goes through here, so none
# of them can forget it.
_refuse() { arc_cm_describe "$ROOT" >&2; exit 2; }

# Control verbs are only honoured when this script is invoked DIRECTLY, never when a path is
# forwarded into it as argv. A read of a file literally named "--end" would otherwise disarm
# the boundary: the fragment forwards "$@", so a future caller passing the path positionally
# turns a filename into a control command. lanes.md already prescribes this shape -- a value
# is carried behind an explicit flag, never inferred from position.
ARC_SCOPE_VERB=""
case "${1:-}" in
  --begin|--end|--describe) [ "${ARC_SCOPE_FORWARDED:-0}" = "1" ] || ARC_SCOPE_VERB="$1";; esac

case "$ARC_SCOPE_VERB" in
  --begin)
    ex="${2:-}"; variant="${3:-}"
    if [ -z "$ex" ] || [ -z "$variant" ]; then
      echo "composer-scope-check: --begin needs the explore id AND the variant (the boundary is per-composer, not per-run)" >&2
      exit 2
    fi
    # Arming a boundary this copy of core cannot read back would be the lock this file prevents.
    _core_ok || _core_refuse
    # Both become path segments of the marker's name; the grammar and its reasons are at
    # arc_design_id_ok in common.sh.
    if ! arc_design_id_ok "$ex" || ! arc_design_id_ok "$variant"; then
      echo "composer-scope-check: explore id and variant must be lowercase letters, digits and single hyphens, not first or last, at most 64 characters" >&2
      exit 2
    fi
    mkdir -p "$MARKER_DIR" || exit 2
    # The marker records WHO is armed and WHEN, so an abandoned one is diagnosable rather than
    # mysteriously refusing reads. It used to record `pid=$$` -- this process, gone one line
    # later -- which looked like a liveness signal and could only ever say "dead".
    #
    # WRITTEN WHOLE OR NOT AT ALL. The stamp was the last command inside the redirect group, so a
    # common.sh without arc_armed_stamp made --begin exit 2 AFTER the redirect had already created
    # the marker: the caller was told "not armed", never ran compose-done, and the boundary stayed
    # armed -- manufacturing exactly the abandoned lock the stamp exists to diagnose. So the body
    # goes to a dot-name the marker glob never matches, the stamp is optional, and only a complete
    # file is moved into place. The body's commands are chained with && so a failed printf is a
    # failed write, not a partial file carried in by a stamp that happened to succeed. The exit
    # code and the marker agree in every outcome.
    _mk_path="$MARKER_DIR/composer-session--$ex--$variant"
    _mk_tmp="$MARKER_DIR/.composer-session--$ex--$variant.$$"
    if { printf 'explore=%s\nvariant=%s\n' "$ex" "$variant" \
           && if type arc_armed_stamp >/dev/null 2>&1; then arc_armed_stamp; fi
       } > "$_mk_tmp" 2>/dev/null && mv -f "$_mk_tmp" "$_mk_path" 2>/dev/null; then
      echo "composer-scope-check: read boundary armed for $ex/$variant"
      exit 0
    fi
    rm -f "$_mk_tmp" 2>/dev/null
    echo "composer-scope-check: could not write the marker for $ex/$variant -- the boundary is NOT armed" >&2
    exit 2
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
      # The dot-named temp files too: a --begin killed between its write and its move leaves one,
      # and a release-everything that leaves debris is not a known state.
      rm -f "$MARKER_DIR"/composer-session--* "$MARKER_DIR"/.composer-session--* "$MARKER" 2>/dev/null || true
      echo "composer-scope-check: read boundary released (all)"
    fi
    exit 0
    ;;
  --describe)
    # Prints nothing when core cannot describe: an operator asking "what is armed" gets silence
    # rather than a refusal, and every real refusal still names the stale core itself.
    if _core_ok; then arc_cm_describe "$ROOT"; fi
    exit 0
    ;;
esac

# ---------- enforcement ----------

# No marker -> no composer in flight -> nothing to enforce.
# ONE marker per composer, and MORE THAN ONE is a refusal rather than a guess.
#
# This was a single global file while explore mode runs three composers. A fresh attacker
# armed A, then armed B, and the marker simply became B's: composer A was then allowed to read
# variant-b and REFUSED its own directory. Both halves of the boundary inverted at once.
#
# A filesystem marker cannot tell which composer is calling: the payload says a ui-composer is,
# not which variant it owns (BL-8, deferred by ADR-1419). So the honest contract is SERIAL composition, and
# more than one armed boundary fails CLOSED with a message that says why. Parallel composition
# needs per-caller identity in the payload, which is a later question and not one to fake here
# by picking a marker and hoping.
_MK_N=0; MARKER=""
for _mk in "$MARKER_DIR"/composer-session--*; do
  [ -f "$_mk" ] || continue
  _MK_N=$((_MK_N + 1)); MARKER="$_mk"
done
[ "$_MK_N" -eq 0 ] && exit 0

# ONLY A ui-composer CALL IS JUDGED (ADR-1419). A marker says a compose is armed, not who is
# calling, so every caller used to be refused -- the operator too, and an abandoned compose locked
# the whole tree for three weeks. The harness writes agent_type into a subagent's payload, and the
# Bash boundary already parses it; this asks that one parser (--identity) rather than keeping a
# second. Asked FIRST, before the marker count, a malformed marker or a stale core: none of those
# refuses the main session any more. A path given as argv carries no caller, so a direct call is
# judged as a composer's, which is what every argv case in the suite means.
TARGET="${1:-}"
STDIN=""
if [ -z "$TARGET" ] && [ ! -t 0 ]; then STDIN="$(cat)"; fi
if [ -z "$TARGET" ]; then
  _IDC="$ROOT/.claude/scripts/design/composer-bash-check.sh"
  # A missing or incomplete parser answers nothing, and then every caller is judged, as before
  # this ADR: a broken install leans closed, never open for a composer. So does a whole parser
  # that predates --identity: it would run as the Bash boundary and exit 0 for a Read, and 0 means
  # "a composer" here. The handshake line says it understands the question (attack r1, B8).
  if [ -f "$_IDC" ] && [ "$(tail -n 1 "$_IDC" 2>/dev/null | tr -d '\r')" = "# composer-bash-check: end" ] \
     && grep -qx '# composer-bash-check: speaks --identity' "$_IDC" 2>/dev/null; then
    printf '%s' "$STDIN" | bash "$_IDC" --identity
    _idrc=$?
    case $_idrc in
      0) ;;
      10) exit 0;;
      12) echo "BLOCKED by ui-composer scope: this call may be ui-composer's, and who is calling cannot be read exactly." >&2
          if _core_ok; then _refuse; fi
          exit 2;;
      # Not a verdict: the parser crashed (1), did not parse (2), or was not found (127). Judged,
      # and the note names the parser so a refusal that follows is not blamed on the payload.
      *) echo "ui-composer scope: composer-bash-check.sh --identity exited $_idrc, which is not an answer; every caller is judged until it is fixed." >&2;;
    esac
  fi
fi

# Only now, with a marker armed, does a stale or missing core matter -- and then it is a refusal,
# because a boundary that cannot read its marker or resolve a path cannot decide anything.
_core_ok || _core_refuse
if [ "$_MK_N" -gt 1 ]; then
  echo "BLOCKED by ui-composer scope: $_MK_N composer boundaries are armed at once." >&2
  echo "This read cannot be attributed to one of them, and picking is how composer A came to read variant-b." >&2
  echo "Compose serially -- one compose / compose-done pair at a time." >&2
  _refuse
fi

# Read through arc_cm_load, which strips CR (a CRLF marker -- from PowerShell, an editor, or the
# composer's own Write tool -- once yielded an empty EX on ubuntu and macOS while MSYS2 read it
# clean) and validates before anything is used. A marker we cannot read, or that fails the
# grammar, or whose name disagrees with its content, is not a licence to allow everything: it is
# a broken boundary. An empty or hostile EX here would build allowlist prefixes that match far
# too much, and was echoed raw into the refusal text below.
if ! arc_cm_load "$MARKER"; then
  echo "BLOCKED by ui-composer scope: an armed composer marker is malformed -- its explore/variant is missing or invalid, or its filename disagrees with its content." >&2
  echo "A boundary that cannot say what it protects is not a boundary." >&2
  _refuse
fi
EX="$ARC_MF_EXPLORE"; VARIANT="$ARC_MF_VARIANT"

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
if [ -z "$TARGET" ] && [ -n "$STDIN" ]; then
  # jq only once it answers a probe: a jq that is found and broken read every target as empty,
  # and an empty Read target is allowed (the Bash check's BL-3, left open here; ADR-1419 CI).
  if command -v jq >/dev/null 2>&1 && [ "$(printf '{"k":"v"}' | jq -r .k 2>/dev/null | tr -d '\r')" = "v" ]; then
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
        _refuse;;
      ..|../*|*/..|*/../*)
        echo "BLOCKED by ui-composer scope: a $TOOL pattern containing '..' ('$PATTERN') leaves whatever path scopes it." >&2
        _refuse;;
    esac
    ;;
esac

if [ -z "$TARGET" ]; then
  case "$TOOL" in
    Grep|Glob)
      echo "BLOCKED by ui-composer scope: an unscoped $TOOL searches the whole tree, which includes every sibling variant, the matrix and the brief." >&2
      echo "Pass an explicit path inside $EX/$VARIANT (or your session's renders / the brief's refpack)." >&2
      _refuse;;
  esac
  exit 0   # cannot tell what is being read -> do not block
fi

TARGET="$(printf '%s' "$TARGET" | tr '\\' '/')"

# Traversal is refused BEFORE any normalising, on every OS. A `..` segment carries an allowed
# prefix and still lands elsewhere, and prefix matching cannot see that.
case "$TARGET" in
  ..|../*|*/..|*/../*)
    echo "BLOCKED by ui-composer scope: '$TARGET' contains a '..' segment." >&2
    _refuse
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
    _refuse
    ;;
esac

echo "BLOCKED by ui-composer scope: '$TARGET' is outside the read allowlist for $EX/$VARIANT." >&2
echo "Allowed: your variant dir, your own session's renders, and the brief's reference pack." >&2
_refuse

#!/usr/bin/env bats
# Phase 02 (macOS amendment, ADR-0007) -- enforce bash-3.2 / POSIX portability.
# Static audit: runtime shell scripts must avoid bash-4+ syntax and GNU-only util
# flags, so they run on macOS (bash 3.2 + BSD userland) as well as Linux/Windows.
bats_require_minimum_version 1.5.0
load 'test_helper'

# Scope: the runtime scripts + hooks (NOT the bats files, which run under bats' bash).
# .github/scripts is in scope too: repo-local tooling still runs on all three legs, and
# moving a file out of .claude/ to keep it off the shipped surface must not also move it
# out of this ratchet. tracker-migrate.sh made that gap real in Phase 01.
ROOTS() { echo "$ARC_ROOT/.claude/scripts $ARC_ROOT/.claude/hooks $ARC_ROOT/.github/scripts $ARC_ROOT/sync-to-project.sh"; }

@test "portability: no bash-4+ syntax (mapfile/readarray, associative arrays, case-mod)" {
  run grep -rnE '\b(mapfile|readarray)\b|(declare|local|typeset)[ \t]+-A|\$\{[A-Za-z_]+(,,|\^\^)' $(ROOTS)
  [ "$status" -ne 0 ] || { echo "$output"; false; }   # grep exit 1 => no matches => pass
}

@test "portability: no GNU-only date/grep flags" {
  run grep -rnE 'date[ \t]+-d[ \t]|grep[ \t]+-oP|grep[ \t]+-P[ \t]' $(ROOTS)
  [ "$status" -ne 0 ] || { echo "$output"; false; }
}

@test "portability: no bare GNU 'stat -c' without a BSD 'stat -f' fallback on the line" {
  # `stat -c` is allowed ONLY when the same line also has the BSD `stat -f` form.
  local hits
  hits="$(grep -rn 'stat -c' $(ROOTS) 2>/dev/null | grep -v 'stat -f' || true)"
  [ -z "$hits" ] || { echo "$hits"; false; }
}

# ---------- locale collation (macOS CI, 2026-07-30) ----------
# A bracket RANGE is resolved through the locale's collation table, not ASCII. macOS's
# default table interleaves case (aAbBcC...), so `*[!a-z0-9-]*` did NOT fire for
# `Design` and lane-resolve.sh accepted an invalid lane name on one of five CI legs
# while its .mjs twin refused it. A NEGATED range is the dangerous shape: it fails
# OPEN, admitting input a validator meant to reject. Spell the characters out.
#
# This is a ratchet, not a clean sweep: the four hits below are pre-existing and each
# needs a behaviour decision (the `_slug` pair changes artifact filenames), so they are
# named here and tracked. Anything NOT on this list fails the build.

_LOCALE_RANGE_KNOWN() {
  cat <<'EOF'
.claude/scripts/design/design-critique.sh:42
.claude/scripts/design/design-render.sh:157
.claude/scripts/design/design-critique.sh:124
.claude/scripts/design/design-render.sh:468
EOF
}

@test "portability: no NEW negated letter-range bracket expression (locale-collation trap)" {
  local hits new
  # Same scope as ROOTS(), spelled out because the allowlist stores repo-relative
  # `path:lineno` keys and a $ARC_ROOT-absolute grep would never match one.
  hits="$(cd "$ARC_ROOT" && grep -rnE '\[[!^][^]]*[a-zA-Z]-[a-zA-Z]' \
            .claude/scripts .claude/hooks .github/scripts sync-to-project.sh 2>/dev/null || true)"
  local line loc body
  new=""
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    loc="$(printf '%s' "$line" | cut -d: -f1,2)"   # path:lineno, content dropped
    body="$(printf '%s' "$line" | cut -d: -f3-)"
    # A whole-line comment cannot execute a pattern -- and the fix's own explanation
    # necessarily quotes the broken form. Only code counts.
    case "$body" in [[:space:]]*\#*|\#*) continue;; esac
    _LOCALE_RANGE_KNOWN | grep -qxF "$loc" || new="$new$line
"
  done <<EOF
$hits
EOF
  [ -z "$new" ] || {
    echo "New locale-collation-dependent range(s). Spell the characters out --"
    echo "e.g. *[!abcdefghijklmnopqrstuvwxyz0123456789-]* instead of *[!a-z0-9-]*:"
    echo "$new"
    false
  }
}

@test "portability: the locale-range allowlist has no stale entries" {
  # An allowlist that outlives its violations is a gate that lies about what it checks.
  local stale=""
  while IFS= read -r loc; do
    [ -n "$loc" ] || continue
    local f="${loc%%:*}" n="${loc##*:}"
    sed -n "${n}p" "$ARC_ROOT/$f" 2>/dev/null \
      | grep -qE '\[[!^][^]]*[a-zA-Z]-[a-zA-Z]' || stale="$stale  $loc
"
  done <<EOF
$(_LOCALE_RANGE_KNOWN)
EOF
  [ -z "$stale" ] || {
    echo "Fixed or moved -- delete from _LOCALE_RANGE_KNOWN:"; echo "$stale"; false
  }
}

@test "portability: lane-resolve.sh pins byte collation for the whole process" {
  # Belt to the explicit-character-list braces in _valid_name: this script's awk
  # [[:cntrl:]], filename globbing and sort order must match the .mjs twin's bytes.
  grep -qE '^export LC_ALL=C' "$ARC_ROOT/.claude/scripts/core/lane-resolve.sh"
}

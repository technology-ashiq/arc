#!/usr/bin/env bats
# Phase 02 (macOS amendment, ADR-0007) -- enforce bash-3.2 / POSIX portability.
# Static audit: runtime shell scripts must avoid bash-4+ syntax and GNU-only util
# flags, so they run on macOS (bash 3.2 + BSD userland) as well as Linux/Windows.
bats_require_minimum_version 1.5.0
load 'test_helper'

# Scope: the runtime scripts + hooks (NOT the bats files, which run under bats' bash).
ROOTS() { echo "$ARC_ROOT/.claude/scripts $ARC_ROOT/.claude/hooks $ARC_ROOT/sync-to-project.sh"; }

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

#!/usr/bin/env bats
# distribute Phase 01 -- REQ-06: AGENTS.md is the brain and CLAUDE.md cannot disagree (ADR-2007).
#
# Outside a <!-- claude-only --> block, CLAUDE.md may carry only its title, the @AGENTS.md import,
# blank lines and comments; any heading there must also exist in AGENTS.md. Each negative test
# plants one defect in a temp copy and asserts brain-drift names it.

bats_require_minimum_version 1.5.0
load 'test_helper'

BD() { printf '%s' "$ARC_ROOT/.claude/scripts/core/brain-drift.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
ran() { printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN brain-drift' || { echo "brain-drift never reached its end: $output"; return 1; }; }

copy_brain() {
  local t="$BATS_TEST_TMPDIR/brain"
  mkdir -p "$t" && cp "$ARC_ROOT/CLAUDE.md" "$ARC_ROOT/AGENTS.md" "$t/"
  [ -s "$t/CLAUDE.md" ] && [ -s "$t/AGENTS.md" ] || { echo "copy_brain built empty files"; return 1; }
  printf '%s' "$t"
}

@test "distribute-brain-drift: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-brain-drift: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 5 ] || { echo "declared $declared, expected 5"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-brain-drift: the real brain is tracked, imported and drift-free" {
  run git -C "$ARC_ROOT" ls-files --error-unmatch AGENTS.md
  [ "$status" -eq 0 ] || { echo "AGENTS.md is not tracked"; false; }
  grep -qx '@AGENTS.md' "$ARC_ROOT/CLAUDE.md" || { echo "CLAUDE.md does not import AGENTS.md"; false; }
  run --separate-stderr node "$(BD)" --root "$(native "$ARC_ROOT")"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  printf '%s\n' "$output" | grep -qE '^brain-drift: [1-9][0-9]* headings checked, 0 drift$' || { echo "$output"; false; }
}

@test "distribute-brain-drift: an unmarked rule heading in CLAUDE.md is named" {
  local t; t=$(copy_brain)
  printf '\n## Planted rule\n\nonly one harness reads this\n' >> "$t/CLAUDE.md"
  run --separate-stderr node "$(BD)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^DRIFT .*Planted rule' || { echo "$output"; false; }
}

@test "distribute-brain-drift: an unclosed claude-only block is named" {
  local t; t=$(copy_brain)
  printf '\n<!-- claude-only -->\n## Never closed\n' >> "$t/CLAUDE.md"
  run --separate-stderr node "$(BD)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^DRIFT .*unclosed' || { echo "$output"; false; }
}

@test "distribute-brain-drift: a template placeholder in either file is named, and the real files have none" {
  run grep -c 'TO''DO' "$ARC_ROOT/AGENTS.md" "$ARC_ROOT/CLAUDE.md"
  [ "$output" = "$(printf '%s\n%s' "$ARC_ROOT/AGENTS.md:0" "$ARC_ROOT/CLAUDE.md:0")" ] || { echo "placeholders left: $output"; false; }
  local t; t=$(copy_brain)
  printf -- '- **Name:** TO%s (e.g. Tilted)\n' 'DO' >> "$t/AGENTS.md"
  run --separate-stderr node "$(BD)" --root "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | grep -q '^DRIFT AGENTS.md: placeholder' || { echo "$output"; false; }
}

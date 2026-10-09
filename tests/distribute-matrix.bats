#!/usr/bin/env bats
# distribute Phase 03 -- REQ-02: an install never claims a feature the harness cannot hold.
#
# `arc-install --target T --dry-run` prints one `degraded:` line per `false` cell of T's row in
# engine/harnesses.yaml and one `partial:` line per `partial:` cell, and exits 0. Every verified row is
# iterated, every cell is checked by name, and the COUNT is asserted, not only presence. The expected set
# comes from tests/distribute/matrix-probe.mjs, so a cell added to the matrix is checked without a test edit.

bats_require_minimum_version 1.5.0
load 'test_helper'

I() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-install.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }

probe() {
  run --separate-stderr node "$ARC_ROOT/tests/distribute/matrix-probe.mjs" "$(native "$1")"
  [ "$status" -eq 0 ] && printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN matrix-probe' || { echo "probe: $output $stderr"; return 1; }
  CELLS=$(printf '%s\n' "$output" | tr -d '\r' | grep '^cell ')
  [ -n "$CELLS" ] || { echo "the probe printed no cells"; return 1; }
}

dry() {
  run --separate-stderr node "$(I)" --target "$1" --dry-run --quiet --source "$(native "${2:-$ARC_ROOT}")"
  [ "$status" -eq 0 ] || { echo "dry-run $1: status $status: $output $stderr"; return 1; }
  [ "$(count "^plan: $1 — [0-9]+ file\(s\), ")" -eq 1 ] && [ "$(count '^dry-run: nothing written$')" -eq 1 ] || { echo "dry-run $1 never planned: $output"; return 1; }
}

# For one row: every false cell has its named degraded line, every partial its partial line, and the
# counts are exact, so an extra or a missing line both fail.
row_matches() {
  local row="$1" want_f want_p cell
  want_f=$(printf '%s\n' "$CELLS" | grep -c "^cell $row [a-z_]* false$" || true)
  want_p=$(printf '%s\n' "$CELLS" | grep -c "^cell $row [a-z_]* partial$" || true)
  [ "$(count '^degraded: ')" -eq "$want_f" ] || { echo "$row: $(count '^degraded: ') degraded lines, $want_f false cells: $output"; return 1; }
  [ "$(count '^partial: ')" -eq "$want_p" ] || { echo "$row: $(count '^partial: ') partial lines, $want_p partial cells: $output"; return 1; }
  for cell in $(printf '%s\n' "$CELLS" | sed -n "s/^cell $row \([a-z_]*\) false$/\1/p"); do
    [ "$(count "^degraded: $cell — .$row. cannot hold it$")" -eq 1 ] || { echo "$row: no degraded line for $cell"; return 1; }
  done
  for cell in $(printf '%s\n' "$CELLS" | sed -n "s/^cell $row \([a-z_]*\) partial$/\1/p"); do
    [ "$(count "^partial: $cell — ")" -eq 1 ] || { echo "$row: no partial line for $cell"; return 1; }
  done
}

@test "distribute-matrix: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-matrix: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 5 ] || { echo "declared $declared, expected 5"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-matrix: skills-only names one degraded line per false cell" {
  probe "$ARC_ROOT" || false
  dry skills-only || false
  row_matches skills-only || false
  [ "$(count '^degraded: ')" -ge 5 ] || { echo "skills-only holds fewer false cells than at birth: $output"; false; }
}

@test "distribute-matrix: every verified row names exactly its false and partial cells" {
  probe "$ARC_ROOT" || false
  local rows row n=0
  rows=$(printf '%s\n' "$CELLS" | cut -d' ' -f2 | sort -u)
  for row in $rows; do
    dry "$row" || false
    row_matches "$row" || false
    n=$((n + 1))
  done
  [ "$n" -eq 4 ] || { echo "iterated $n rows, expected the 4 verified v1 targets"; false; }
}

@test "distribute-matrix: claude-code claims everything and degrades nothing" {
  probe "$ARC_ROOT" || false
  [ "$(printf '%s\n' "$CELLS" | grep -c '^cell claude-code [a-z_]* true$')" -eq "$(printf '%s\n' "$CELLS" | grep -c '^cell claude-code ')" ] || { echo "claude-code has a cell that is not true"; false; }
  dry claude-code || false
  [ "$(count '^(degraded|partial): ')" -eq 0 ] || { echo "$output"; false; }
}

# The negative control: flip one true cell to false in a temp tree, and the dry-run grows by exactly that line.
@test "distribute-matrix: a cell flipped to false adds exactly its degraded line" {
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/engine" "$t/.claude"
  cp "$ARC_ROOT/engine/harnesses.yaml" "$ARC_ROOT/engine/frontmatter-keys.yaml" "$t/engine/"
  cp -R "$ARC_ROOT/.claude/commands" "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$t/.claude/"
  awk '/^  - id: opencode$/{o=1} /^  - id: skills-only$/{o=0} { if (o && $0 ~ /^      skills: "true"$/) { print "      skills: \"false\""; next } print }' "$ARC_ROOT/engine/harnesses.yaml" > "$t/engine/harnesses.yaml"
  [ "$(grep -c '^      skills: "false"$' "$t/engine/harnesses.yaml")" -eq "$(( $(grep -c '^      skills: "false"$' "$ARC_ROOT/engine/harnesses.yaml") + 1 ))" ] || { echo "the mutant changed nothing"; false; }
  probe "$t" || false
  dry opencode "$t" || false
  row_matches opencode || false
  [ "$(count '^degraded: skills — .opencode. cannot hold it$')" -eq 1 ] || { echo "$output"; false; }
  # A false kind cell is obeyed, not only reported: the skills are not placed.
  [ "$(count '^\[skipped\] \.claude/skills/ — the .skills. cell of .opencode. is false$')" -eq 1 ] || { echo "$output"; false; }
}

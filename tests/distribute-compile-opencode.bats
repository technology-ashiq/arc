#!/usr/bin/env bats
# distribute Phase 03 -- REQ-04 for `opencode`, and the P03 stop rule.
#
# Commands render to .opencode/commands/NAME.md, agents to .opencode/agents/NAME.md, and a command's tool
# fence to a hidden companion subagent it names in `agent:` (ADR-2017). The stop rule: more than 5 commands
# `[unsupported]` on opencode fails the check and reopens the matrix; the count is printed either way.

bats_require_minimum_version 1.5.0
load 'test_helper'
T=opencode
load 'distribute/compile-target'

@test "distribute-compile-opencode: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-compile-opencode: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 7 ] || { echo "declared $declared, expected 7"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-compile-opencode: the real tree renders byte-identical to the golden" {
  compile_real_tree_identical
}

@test "distribute-compile-opencode: a source edit is a byte-diff naming the rendered command" {
  compile_source_edit_is_byte_diff ".opencode/commands/arc-commit.md"
}

@test "distribute-compile-opencode: a golden file the render does not produce is dirty" {
  compile_stale_golden_is_dirty
}

@test "distribute-compile-opencode: the unsupported command count is printed and under the stop rule" {
  check "$ARC_ROOT"
  ran "$ARC_ROOT" || false
  [ "$(count '^unsupported-commands: 1$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^\[unsupported\] \.claude/commands/arc-toolcheck\.md — the tool .Artifact. has no OpenCode permission key$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^\[stop-rule\] ')" -eq 0 ] || { echo "$output"; false; }
}

@test "distribute-compile-opencode: six unsupported commands trip the stop rule" {
  local t c; t=$(tree) || false
  for c in arc-commit arc-change arc-audit arc-canary arc-council; do
    sed -e '/^allowed-tools: /s/$/, Artifact/' "$t/.claude/commands/$c.md" > "$t/x" && mv "$t/x" "$t/.claude/commands/$c.md"
    grep -q '^allowed-tools: .*, Artifact$' "$t/.claude/commands/$c.md" || { echo "the mutant changed nothing in $c"; false; }
  done
  check "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^unsupported-commands: 6$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^\[stop-rule\] 6 commands are \[unsupported\] on .opencode., more than 5')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-compile-opencode: a tool fence renders as a companion agent and an exact scope stays exact" {
  local cmd="$ARC_ROOT/$(G)/.opencode/commands/arc-commit.md" fence="$ARC_ROOT/$(G)/.opencode/agents/arc-commit-fence.md"
  [ -s "$cmd" ] && [ -s "$fence" ] || { echo "the golden has no arc-commit command or fence"; false; }
  grep -qx 'agent: arc-commit-fence' "$cmd" || { cat "$cmd"; false; }
  grep -qxF '  "*": ask' "$fence" && grep -qx 'hidden: true' "$fence" || { cat "$fence"; false; }
  grep -qxF '    "git diff *": allow' "$fence" && grep -qxF '    "git status": allow' "$fence" || { cat "$fence"; false; }
  [ "$(grep -cF '"git status *"' "$fence")" -eq 0 ] || { echo "Bash(git status) widened to git status anything"; false; }
}

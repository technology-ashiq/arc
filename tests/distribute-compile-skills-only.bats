#!/usr/bin/env bats
# distribute Phase 03 -- REQ-04 for `skills-only`: every command and agent is an agentskills.io skill.
#
# Each renders to .agents/skills/NAME/SKILL.md with `name`, `description` and the space-separated
# `allowed-tools`; an agent becomes a single-session role skill (ADR-2009).

bats_require_minimum_version 1.5.0
load 'test_helper'
T=skills-only
load 'distribute/compile-target'

@test "distribute-compile-skills-only: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-compile-skills-only: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 6 ] || { echo "declared $declared, expected 6"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-compile-skills-only: the real tree renders byte-identical to the golden" {
  compile_real_tree_identical
}

@test "distribute-compile-skills-only: a source edit is a byte-diff naming the rendered skill" {
  compile_source_edit_is_byte_diff ".agents/skills/arc-commit/SKILL.md"
}

@test "distribute-compile-skills-only: a golden file the render does not produce is dirty" {
  compile_stale_golden_is_dirty
}

@test "distribute-compile-skills-only: every rendered skill is named for its directory" {
  local n=0 bad=0 f d
  while IFS= read -r f; do
    d=$(basename "$(dirname "$f")")
    n=$((n + 1))
    grep -qx "name: $d" "$f" || { echo "$f is not named $d"; bad=$((bad + 1)); }
  done < <(find "$ARC_ROOT/$(G)/.agents/skills" -mindepth 2 -maxdepth 2 -name SKILL.md)
  [ "$n" -gt 50 ] && [ "$bad" -eq 0 ] || { echo "$n skills, $bad misnamed"; false; }
}

@test "distribute-compile-skills-only: a tool holding a space outside its parentheses is unsupported" {
  local t; t=$(tree) || false
  sed -e '/^allowed-tools: /s/$/, Read Write/' "$t/.claude/commands/arc-commit.md" > "$t/x" && mv "$t/x" "$t/.claude/commands/arc-commit.md"
  grep -q '^allowed-tools: .*, Read Write$' "$t/.claude/commands/arc-commit.md" || { echo "the mutant changed nothing"; false; }
  check "$t"
  [ "$(count '^\[unsupported\] \.claude/commands/arc-commit\.md — the tool .Read Write. holds a space outside its parentheses')" -eq 1 ] || { echo "$output"; false; }
  [ "$status" -eq 1 ] && [ "$(count '^\[dirty\] .*/\.agents/skills/arc-commit/SKILL\.md ')" -eq 1 ] || { echo "status $status: $output"; false; }
}

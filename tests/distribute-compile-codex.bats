#!/usr/bin/env bats
# distribute Phase 03 -- REQ-04 for `codex`: the source renders byte-identical to its golden on every re-run.
#
# `arc-compile --check --all --input source --target codex` renders commands as skills
# (.agents/skills/NAME/SKILL.md) and agents as .codex/agents/NAME.toml through source-render.mjs, the module
# the installer writes from, and compares each file with tests/fixtures/distribute/goldens/codex/.

bats_require_minimum_version 1.5.0
load 'test_helper'
T=codex
load 'distribute/compile-target'

@test "distribute-compile-codex: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-compile-codex: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 6 ] || { echo "declared $declared, expected 6"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-compile-codex: the real tree renders byte-identical to the golden" {
  compile_real_tree_identical
}

@test "distribute-compile-codex: a source edit is a byte-diff naming the rendered skill" {
  compile_source_edit_is_byte_diff ".agents/skills/arc-commit/SKILL.md"
}

@test "distribute-compile-codex: a golden file the render does not produce is dirty" {
  compile_stale_golden_is_dirty
}

@test "distribute-compile-codex: every agent is one toml and a Claude-only command renders nothing" {
  check "$ARC_ROOT"
  ran "$ARC_ROOT" || false
  local agents tomls
  agents=$(find "$ARC_ROOT/.claude/agents" -type f -name '*.md' | wc -l | tr -d ' ')
  tomls=$(find "$ARC_ROOT/$(G)/.codex/agents" -type f -name '*.toml' | wc -l | tr -d ' ')
  [ "$agents" -gt 0 ] && [ "$tomls" -eq "$agents" ] || { echo "agents $agents, tomls $tomls"; false; }
  [ "$(count '^\[skipped\] \.claude/commands/arc-freeze\.md — targets: claude-code$')" -eq 1 ] || { echo "$output"; false; }
  [ ! -e "$ARC_ROOT/$(G)/.agents/skills/arc-freeze" ] || { echo "a Claude-only command was rendered"; false; }
}

# Three single quotes would end a toml literal string early, so the body must fall back to a basic string.
@test "distribute-compile-codex: a body holding three quotes falls back to a basic toml string" {
  local t q3; t=$(tree) || false
  q3=$(printf '\047\047\047')
  printf '\nNever write %s here.\n' "$q3" >> "$t/.claude/agents/plan-attacker.md"
  grep -qF "$q3" "$t/.claude/agents/plan-attacker.md" || { echo "the mutant changed nothing"; false; }
  run --separate-stderr node "$(CC)" --write --all --input source --target codex --root "$(native "$t")"
  [ "$status" -eq 0 ] && [ "$(count '^arc-compile: wrote ')" -eq 1 ] || { echo "write: $status $output $stderr"; false; }
  local f="$t/$(G)/.codex/agents/plan-attacker.toml"
  grep -q '^developer_instructions = "' "$f" || { echo "not a basic string:"; cat "$f"; false; }
  [ "$(grep -cF "developer_instructions = $q3" "$f")" -eq 0 ] || { echo "a literal string would end early"; false; }
}

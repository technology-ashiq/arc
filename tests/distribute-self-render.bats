#!/usr/bin/env bats
# distribute Phase 08 -- REQ-14: arc renders codex, opencode and skills-only into its own tree (ADR-2023).
#
# `arc compile --self --check` on the checked-out tree must be clean, so a source edit merged without
# regenerating the committed outputs is red here (merge-time line of enforcement.yaml's
# action-stale-self-render). On a fixture copy the check names a flipped byte, a deleted file and a planted
# extra; the writer never touches AGENTS.md, a manifest or anything outside the three roots; the owner rule is
# driven through a probe; and `init` into arc itself stays refused for every target. Every run asserts RAN first.

bats_require_minimum_version 1.5.0
load 'test_helper'

ARC() { printf '%s' "$ARC_ROOT/bin/arc.mjs"; }
INST() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-install.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }
ran() { [ "$(count '^self-render: ([0-9]+ file\(s\) checked |wrote [0-9]+ of [0-9]+ file\(s\) )')" -eq 1 ] ||{ echo "self-render never reached its summary line: $output $stderr"; return 1; }; }

# A copy of what the render reads, plus the committed outputs and the brain; asserted non-empty.
fixture() {
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/.claude"
  cp -R "$ARC_ROOT/engine" "$t/"
  for d in commands agents skills; do cp -R "$ARC_ROOT/.claude/$d" "$t/.claude/"; done
  for d in .codex .opencode .agents; do cp -R "$ARC_ROOT/$d" "$t/"; done
  cp "$ARC_ROOT/AGENTS.md" "$t/"
  [ -s "$t/engine/harnesses.yaml" ] && [ -s "$t/AGENTS.md" ] && [ -s "$t/.opencode/commands/arc-resume.md" ] || { echo "fixture built an empty tree"; return 1; }
  printf '%s' "$t"
}

listing() { (cd "$1" && find . -type f ! -path './.codex/*' ! -path './.opencode/*' ! -path './.agents/*' -exec sha1sum {} + | sort); }

@test "distribute-self-render: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-self-render: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 8 ] || { echo "declared $declared, expected 8"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-self-render: the committed outputs match a fresh render of this tree" {
  run --separate-stderr node "$(ARC)" compile --self --check
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [ "$(count '^self-render: [0-9]+ file\(s\) checked under \.codex/ \.opencode/ \.agents/skills/; 0 finding\(s\)$')" -eq 1 ] || { echo "$output"; false; }
  local n
  n=$(printf '%s\n' "$output" | tr -d '\r' | sed -nE 's/^self-render: ([0-9]+) file.*/\1/p')
  [ "$n" -ge 100 ] || { echo "only $n files checked: $output"; false; }
}

@test "distribute-self-render: a flipped byte, a deleted file and a planted extra are each named" {
  local t; t=$(fixture) || false
  printf 'x' >> "$t/.opencode/commands/arc-resume.md"
  rm "$t/.codex/agents/code-reviewer.toml"
  [ ! -e "$t/.codex/agents/code-reviewer.toml" ] || { echo "delete did not happen"; false; }
  printf 'planted\n' > "$t/.agents/skills/planted.md"
  run --separate-stderr node "$(INST)" --self --check --source "$(native "$t")"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^\[differs\] \.opencode/commands/arc-resume\.md .*compile --self$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^\[missing\] \.codex/agents/code-reviewer\.toml ')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^\[extra\] \.agents/skills/planted\.md ')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '; 3 finding\(s\)$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-self-render: the writer restores the outputs and touches nothing else" {
  local t; t=$(fixture) || false
  rm -rf "$t/.codex" "$t/.opencode" "$t/.agents"
  local before; before=$(listing "$t")
  [ -n "$before" ] || { echo "empty listing"; false; }
  run --separate-stderr node "$(INST)" --self --source "$(native "$t")"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  [ "$(count '^self-render: wrote ([0-9]+) of \1 file\(s\) .*AGENTS\.md untouched$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(listing "$t")" = "$before" ] || { echo "a file outside the three roots changed"; false; }
  [ ! -e "$t/.arc-install.json" ] || { echo "a manifest was written"; false; }
  run --separate-stderr node "$(INST)" --self --check --source "$(native "$t")"
  ran || false
  [ "$status" -eq 0 ] || { echo "re-check status $status: $output"; false; }
}

@test "distribute-self-render: two targets claiming one path are refused by name" {
  run --separate-stderr node "$ARC_ROOT/tests/distribute/self-render-probe.mjs" double
  [ "$(count '^RAN self-render-probe$')" -eq 1 ] || { echo "probe never ran: $output $stderr"; false; }
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^refused \[path-owner\] \.opencode/x is rendered by both opencode and skills-only$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-self-render: skills-only owns a shared skill in either render order" {
  run --separate-stderr node "$ARC_ROOT/tests/distribute/self-render-probe.mjs" shared
  [ "$(count '^RAN self-render-probe$')" -eq 1 ] || { echo "probe never ran: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [ "$(count '^plan \.agents/skills/s/SKILL\.md skills-only skills-only$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^reversed \.agents/skills/s/SKILL\.md skills-only$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-self-render: init into arc itself stays refused for every target" {
  local t
  for t in claude-code codex opencode skills-only; do
    run --separate-stderr node "$(ARC)" init --target "$t" --dir "$(native "$ARC_ROOT")" --dry-run
    [ "$(count "^plan: $t ")" -eq 1 ] || { echo "$t: installer never planned: $output $stderr"; false; }
    [ "$(count '^refused \[inside-source\] ')" -eq 1 ] || { echo "$t: not refused: $output"; false; }
    [ "$status" -ne 0 ] || { echo "$t: exit 0"; false; }
  done
}

@test "distribute-self-render: --check is refused without --self and --self refuses install flags" {
  run --separate-stderr node "$(INST)" --check
  [ "$status" -eq 2 ] && [ "$(printf '%s' "$stderr" | grep -c 'arc-install: --check goes with --self')" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
  run --separate-stderr node "$(INST)" --self --target opencode
  [ "$status" -eq 2 ] && [ "$(printf '%s' "$stderr" | grep -c 'arc-install: --self takes --check and --source and nothing else')" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
}

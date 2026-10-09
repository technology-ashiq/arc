#!/usr/bin/env bats
# distribute Phase 02 -- every Claude frontmatter key has a declared fate per target (ADR-2017).
#
# frontmatter-lint checks the key table against the capability matrix, then the command and agent tree
# against the table. Each negative test plants one defect in a temp copy, proves the copy changed (cmp),
# and asserts the lint names it; every run asserts the RAN marker before its output is believed.

bats_require_minimum_version 1.5.0
load 'test_helper'

FL() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/frontmatter-lint.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
ran() { printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN frontmatter-lint' || { echo "frontmatter-lint never reached its end: $output $stderr"; return 1; }; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }

# A temp copy of everything the lint reads. Asserts its own fixture is non-empty.
copy_tree() {
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/engine" "$t/.claude"
  cp "$ARC_ROOT/engine/harnesses.yaml" "$ARC_ROOT/engine/frontmatter-keys.yaml" "$t/engine/"
  cp -R "$ARC_ROOT/.claude/commands" "$ARC_ROOT/.claude/agents" "$t/.claude/"
  [ -s "$t/engine/frontmatter-keys.yaml" ] && [ -s "$t/.claude/commands/arc-freeze.md" ] && [ -s "$t/.claude/agents/code-reviewer.md" ] || { echo "copy_tree built an empty fixture"; return 1; }
  printf '%s' "$t"
}

# Rewrites one file through an awk program file-free: insert LINE after line N.
insert_after() { awk -v n="$2" -v l="$3" '{print} NR==n{print l}' "$1" > "$1.tmp" && mv "$1.tmp" "$1"; }

lint() { run --separate-stderr node "$(FL)" --root "$(native "$1")"; }

@test "distribute-frontmatter: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-frontmatter: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 11 ] || { echo "declared $declared, expected 11"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-frontmatter: the real tree is clean and every file was read" {
  local nc na
  nc=$(find "$ARC_ROOT/.claude/commands" -type f | wc -l | tr -d ' ')
  na=$(find "$ARC_ROOT/.claude/agents" -type f | wc -l | tr -d ' ')
  [ "$nc" -gt 0 ] && [ "$na" -gt 0 ] || { echo "no source files: $nc $na"; false; }
  lint "$ARC_ROOT"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | tr -d '\r' | grep -qxE "frontmatter-lint: $nc commands, $na agents, [1-9][0-9]* keys, 0 failures" || { echo "$output"; false; }
}

@test "distribute-frontmatter: the mutant selftest plants an unknown key and catches it" {
  run --separate-stderr node "$(FL)" --mutant-selftest --root "$(native "$ARC_ROOT")"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | tr -d '\r' | grep -qE '^mutant-selftest: caught x-mutant-[0-9]+ \(\.claude/commands/[a-z0-9-]+\.md\)$' || { echo "$output"; false; }
}

@test "distribute-frontmatter: an unknown key in a command and in an agent is named by line" {
  local t; t=$(copy_tree) || false
  cp "$t/.claude/commands/arc-freeze.md" "$BATS_TEST_TMPDIR/before"
  insert_after "$t/.claude/commands/arc-freeze.md" 1 "context: fork"
  insert_after "$t/.claude/agents/code-reviewer.md" 1 "color: blue"
  if cmp -s "$BATS_TEST_TMPDIR/before" "$t/.claude/commands/arc-freeze.md"; then echo "the mutant changed nothing"; false; fi
  lint "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^FAIL \.claude/commands/arc-freeze\.md:2 \[unknown-key\] `context`')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^FAIL \.claude/agents/code-reviewer\.md:2 \[unknown-key\] `color`')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^FAIL ')" -eq 2 ] || { echo "expected exactly 2 failures: $output"; false; }
}

@test "distribute-frontmatter: a repeated key, a continuation line and an empty value each fail by class" {
  local t; t=$(copy_tree) || false
  insert_after "$t/.claude/commands/arc-freeze.md" 1 "allowed-tools: Bash, Write"
  insert_after "$t/.claude/commands/arc-unfreeze.md" 1 "  continued: on an indented line"
  insert_after "$t/.claude/commands/arc-face-module.md" 1 "argument-hint: "
  lint "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^FAIL \.claude/commands/arc-freeze\.md:[0-9]+ \[duplicate-key\] `allowed-tools`')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^FAIL \.claude/commands/arc-unfreeze\.md:2 \[malformed\]')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^FAIL \.claude/commands/arc-face-module\.md:[0-9]+ \[duplicate-key\] `argument-hint`')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^FAIL \.claude/commands/arc-face-module\.md:2 \[empty-value\] `argument-hint`')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-frontmatter: targets must name verified rows and always claude-code" {
  local t; t=$(copy_tree) || false
  awk '{ if ($0 == "targets: claude-code") print "targets: opencode, hermes, opencode"; else print }' "$t/.claude/commands/arc-freeze.md" > "$t/x" && mv "$t/x" "$t/.claude/commands/arc-freeze.md"
  grep -qx 'targets: opencode, hermes, opencode' "$t/.claude/commands/arc-freeze.md" || { echo "the mutant changed nothing"; false; }
  lint "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '\[bad-targets\] `hermes` is not a verified row')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '\[bad-targets\] `opencode` is named twice')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '\[bad-targets\] `claude-code` is missing')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-frontmatter: the three Claude-only commands declare targets claude-code" {
  local c
  for c in arc-face-module arc-freeze arc-unfreeze; do
    grep -qx 'targets: claude-code' "$ARC_ROOT/.claude/commands/$c.md" || { echo "$c has no targets line"; false; }
  done
}

@test "distribute-frontmatter: the table is checked against the matrix, one class per planted defect" {
  local t; t=$(copy_tree) || false
  cp "$t/engine/frontmatter-keys.yaml" "$BATS_TEST_TMPDIR/keys-before"
  # 1 drop-on-true: the opencode argument_hint cell flips to true under an existing drop.
  awk '/^  - id: opencode$/{o=1} /^  - id: skills-only$/{o=0} { if (o && $0 ~ /^[[:space:]]+argument_hint: "false"$/) print "      argument_hint: \"true\""; else print }' "$t/engine/harnesses.yaml" > "$t/h" && mv "$t/h" "$t/engine/harnesses.yaml"
  # 2 not-identity: the claude-code fate of commands.description is renamed.
  # 3 missing-fate: the skills-only fate of agents.model is deleted.
  awk '
    /^commands:$/ {k="c"} /^agents:$/ {k="a"}
    /^  [a-z-]+:$/ {key=$1}
    { if (k=="c" && key=="description:" && $0 ~ /^[[:space:]]+claude-code: render:description$/) print "    claude-code: render:summary";
      else if (k=="a" && key=="model:" && $0 ~ /^[[:space:]]+skills-only: /) next;
      else print }' "$t/engine/frontmatter-keys.yaml" > "$t/k" && mv "$t/k" "$t/engine/frontmatter-keys.yaml"
  if cmp -s "$BATS_TEST_TMPDIR/keys-before" "$t/engine/frontmatter-keys.yaml"; then echo "the table mutant changed nothing"; false; fi
  lint "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^FAIL engine/frontmatter-keys\.yaml \[drop-on-true\] commands\.argument-hint drops on `opencode`')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^FAIL engine/frontmatter-keys\.yaml \[not-identity\] commands\.description')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^FAIL engine/frontmatter-keys\.yaml \[missing-fate\] agents\.model has no fate for `skills-only`')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-frontmatter: a rendered directory that escapes the repository fails the table" {
  local t; t=$(copy_tree) || false
  awk '{ if ($0 ~ /^[[:space:]]+- \.opencode\/$/) print "      - ../outside/"; else print }' "$t/engine/harnesses.yaml" > "$t/h" && mv "$t/h" "$t/engine/harnesses.yaml"
  grep -qF -- '- ../outside/' "$t/engine/harnesses.yaml" || { echo "the mutant changed nothing"; false; }
  lint "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '\[bad-rendered\] opencode\.rendered entry "\.\./outside/" escapes the repository')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-frontmatter: a missing agents directory is COULD NOT SCAN, never clean" {
  local t; t=$(copy_tree) || false
  mv "$t/.claude/agents" "$t/.claude/agents-gone"
  lint "$t"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$output" | tr -d '\r' | grep -qE '^frontmatter-lint: COULD NOT SCAN — \.claude/agents/ does not exist' || { echo "$output"; false; }
  if printf '%s\n' "$output" | grep -q 'RAN frontmatter-lint'; then echo "a scan that could not read claimed to finish"; false; fi
}

@test "distribute-frontmatter: a flag with no value is refused, not consumed" {
  run --separate-stderr node "$(FL)" --root --mutant-selftest
  [ "$status" -eq 2 ] || { echo "status $status: $output $stderr"; false; }
  [[ "$stderr" == *"--root needs a directory"* ]] || { echo "$stderr"; false; }
}

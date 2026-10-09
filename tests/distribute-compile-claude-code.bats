#!/usr/bin/env bats
# distribute Phase 03 -- REQ-04 for `claude-code`: every hand-written command and agent renders itself.
#
# The claude-code target is the source (ADR-2001), so its check is identity: 0 byte diff for every command
# and agent. Identity is hashed the way the sync golden hashes, CR bytes removed first (`_arc_tree_manifest`),
# so an LF and a CRLF copy of one command must render the same bytes and hash to the same sha256, and that
# sha256 must be the one the sync golden records for the file.

bats_require_minimum_version 1.5.0
load 'test_helper'

CC() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-compile.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }

@test "distribute-compile-claude-code: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-compile-claude-code: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 3 ] || { echo "declared $declared, expected 3"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-compile-claude-code: every command and agent renders itself" {
  local k n
  for k in commands agents; do
    n=$(find "$ARC_ROOT/.claude/$k" -type f -name '*.md' | wc -l | tr -d ' ')
    [ "$n" -gt 0 ] || { echo "no $k"; false; }
    run --separate-stderr node "$(CC)" --check --all --input "$k" --target claude-code --root "$(native "$ARC_ROOT")"
    [ "$status" -eq 0 ] && [ "$(count "^arc-compile: $n/$n byte-identical for target .claude-code. \(input $k\)$")" -eq 1 ] || { echo "$k: status $status: $output $stderr"; false; }
  done
}

@test "distribute-compile-claude-code: an LF and a CRLF copy of one command render to one sha256" {
  local lf="$BATS_TEST_TMPDIR/lf" cr="$BATS_TEST_TMPDIR/cr" f=".claude/commands/arc-freeze.md" n a b g
  mkdir -p "$lf/engine" "$cr/engine"
  cp "$ARC_ROOT/engine/harnesses.yaml" "$lf/engine/" && cp "$ARC_ROOT/engine/harnesses.yaml" "$cr/engine/"
  mkdir -p "$lf/.claude" "$cr/.claude"
  cp -R "$ARC_ROOT/.claude/commands" "$lf/.claude/" && cp -R "$ARC_ROOT/.claude/commands" "$cr/.claude/"
  awk '{ printf "%s\r\n", $0 }' "$ARC_ROOT/$f" > "$cr/$f"
  [ "$(tr -cd '\r' < "$cr/$f" | wc -c | tr -d ' ')" -gt 0 ] && [ "$(tr -cd '\r' < "$lf/$f" | wc -c | tr -d ' ')" -eq 0 ] || { echo "the copies do not differ in line endings"; false; }
  n=$(find "$ARC_ROOT/.claude/commands" -type f -name '*.md' | wc -l | tr -d ' ')
  for root in "$lf" "$cr"; do
    run --separate-stderr node "$(CC)" --check --all --input commands --target claude-code --root "$(native "$root")"
    [ "$status" -eq 0 ] && [ "$(count "^arc-compile: $n/$n byte-identical for target .claude-code. \(input commands\)$")" -eq 1 ] || { echo "$root: status $status: $output $stderr"; false; }
  done
  a=$(tr -d '\r' < "$lf/$f" | _arc_sha256)
  b=$(tr -d '\r' < "$cr/$f" | _arc_sha256)
  g=$(awk -F'\t' -v p="$f" '$1 == p { print $2 }' "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt")
  [ -n "$a" ] && [ "$a" = "$b" ] && [ "$a" = "$g" ] || { echo "lf $a, crlf $b, golden $g"; false; }
}

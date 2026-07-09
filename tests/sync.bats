#!/usr/bin/env bats
# Phase 01 -- cross-platform sync (bash twin of sync-to-project.ps1).
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  TARGET="$(mktemp -d)"
  mkdir -p "$TARGET/.git"          # look like a project root
}
teardown() { [ -n "${TARGET:-}" ] && rm -rf "$TARGET" 2>/dev/null || true; }

@test "sync: copies machinery into target .claude" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET"
  [ "$status" -eq 0 ]
  [ -f "$TARGET/.claude/settings.json" ]
  [ -f "$TARGET/.claude/scripts/arc-scan/arc-scan.sh" ]
  [ -f "$TARGET/.claude/scripts/arc-profile.sh" ]
}

@test "sync: copies the meta docs" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ -f "$TARGET/docs/how-it-works.md" ]
  [ -f "$TARGET/docs/usermanual.md" ]
}

@test "sync: never leaks personal settings or working state" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ ! -e "$TARGET/.claude/settings.local.json" ]
  [ ! -e "$TARGET/.claude/state" ]
}

@test "sync: never overwrites project-owned files (CLAUDE.md, PLAN.md)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ ! -e "$TARGET/CLAUDE.md" ]
  [ ! -e "$TARGET/CLAUDE.local.md" ]
  [ ! -e "$TARGET/PLAN.md" ]
}

@test "sync: missing target dir fails cleanly (exit 1)" {
  run bash "$ARC_ROOT/sync-to-project.sh" "/no/such/target/$$"
  [ "$status" -eq 1 ]
  [[ "$output" == *"not found"* ]]
}

@test "sync: requires a target argument" {
  run bash "$ARC_ROOT/sync-to-project.sh"
  [ "$status" -ne 0 ]
}

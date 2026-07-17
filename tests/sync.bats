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

@test "sync: never leaks the scheduled_tasks.lock runtime file (REQ-04)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ ! -e "$TARGET/.claude/scheduled_tasks.lock" ]
}

@test "sync (ps1): never leaks state/ or scheduled_tasks.lock (REQ-04)" {
  local ps
  ps="$(command -v pwsh 2>/dev/null || command -v powershell 2>/dev/null)" || skip "no PowerShell on this runner"
  "$ps" -NoProfile -File "$(cygpath -w "$ARC_ROOT/sync-to-project.ps1")" -Target "$(cygpath -w "$TARGET")" >/dev/null 2>&1 || true
  [ ! -e "$TARGET/.claude/state" ]
  [ ! -e "$TARGET/.claude/scheduled_tasks.lock" ]
}

@test "sync: never overwrites project-owned files (CLAUDE.md, PLAN.md)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ ! -e "$TARGET/CLAUDE.md" ]
  [ ! -e "$TARGET/CLAUDE.local.md" ]
  [ ! -e "$TARGET/PLAN.md" ]
}

@test "sync: bare install is byte-identical to the golden fixture, rsync path (REQ-02)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  _arc_tree_manifest "$TARGET" > "$BATS_TEST_TMPDIR/actual.txt"
  run diff "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt" "$BATS_TEST_TMPDIR/actual.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "sync: bare install is byte-identical to the golden fixture, cp-r fallback path (REQ-02)" {
  ARC_SYNC_NO_RSYNC=1 bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  _arc_tree_manifest "$TARGET" > "$BATS_TEST_TMPDIR/actual.txt"
  run diff "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt" "$BATS_TEST_TMPDIR/actual.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "sync: --list prints product names (no target needed)" {
  run bash "$ARC_ROOT/sync-to-project.sh" --list
  [ "$status" -eq 0 ]
  [[ "$output" == *"council"* ]]
  [[ "$output" == *"core"* ]]
}

@test "sync: --products council installs council + core only (REQ-01)" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council
  [ "$status" -eq 0 ]
  [ -f "$TARGET/.claude/commands/arc-council.md" ]
  [ -f "$TARGET/.claude/scripts/council-lint.mjs" ]
  [ -f "$TARGET/.claude/scripts/arc-gates.sh" ]             # core rides along
  [ -f "$TARGET/.claude/scripts/arc-scan/lib/common.sh" ]  # core-owned (ADR-0018)
  [ ! -e "$TARGET/.claude/scripts/kickoff-lint.mjs" ]      # plan absent
  [ ! -e "$TARGET/.claude/scripts/arc-scan/arc-scan.sh" ]  # review absent
  [ ! -e "$TARGET/.claude/agents/qa-tester.md" ]           # qa absent
  [ ! -e "$TARGET/.claude/commands/arc-commit.md" ]        # git absent
  [ -d "$TARGET/docs/council/sessions/.juror" ]            # skeleton created
}

@test "sync: --products unknown name fails (exit 2) and prints the valid list" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products nosuch
  [ "$status" -eq 2 ]
  [[ "$output" == *"council"* ]]
}

@test "sync: an unknown option is rejected (exit 2)" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --frobnicate
  [ "$status" -eq 2 ]
}

@test "sync (ps1): --products council installs council + core, not other products" {
  local ps
  ps="$(command -v pwsh 2>/dev/null || command -v powershell 2>/dev/null)" || skip "no PowerShell on this runner"
  "$ps" -NoProfile -File "$(cygpath -w "$ARC_ROOT/sync-to-project.ps1")" -Target "$(cygpath -w "$TARGET")" -Products council >/dev/null 2>&1 || true
  [ -f "$TARGET/.claude/commands/arc-council.md" ]
  [ -f "$TARGET/.claude/scripts/arc-gates.sh" ]
  [ ! -e "$TARGET/.claude/scripts/kickoff-lint.mjs" ]
  [ ! -e "$TARGET/.claude/scripts/arc-scan/arc-scan.sh" ]
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

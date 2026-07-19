#!/usr/bin/env bats
# Phase 04 / REQ-10 -- `--prune-report`: make stale files in a consumer tree VISIBLE.
#
# Why this exists, concretely: Phase 03 re-homed every script into a product directory. Every
# sync path is additive (non-negotiable #51 forbids deleting in a consumer repo), so a target
# that installed arc before Phase 03 now carries BOTH layouts. Measured on a real consumer
# (venturemind, 2026-07-19): 5 flat scripts plus statusline.sh left behind, and the stale
# review-ledger.sh still executes. The registry reports the target clean because it lists what
# was installed, not what is present.
#
# This gate reports. It never deletes -- that is REQ-11 (attic), Phase 05, and even there the
# move is to .claude/attic/DATE/, never rm.
bats_require_minimum_version 1.5.0
load 'test_helper'

R="$ARC_ROOT/.claude/scripts/core/arc-products.mjs"

setup() {
  TARGET="$(mktemp -d)"
  mkdir -p "$TARGET/.git"
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council >/dev/null 2>&1
}
teardown() { [ -n "${TARGET:-}" ] && rm -rf "$TARGET" 2>/dev/null || true; }

@test "prune-report: a freshly synced target has zero unowned files" {
  run node "$R" --prune-report --target "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 unowned"* ]]
}

@test "prune-report: a stale pre-move script is listed (the venturemind case)" {
  # exactly what a pre-Phase-03 install leaves behind
  printf '#!/bin/sh\necho stale\n' > "$TARGET/.claude/scripts/review-ledger.sh"
  run node "$R" --prune-report --target "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" == *".claude/scripts/review-ledger.sh"* ]]
}

@test "prune-report: exit 0 even when unowned files are found -- it reports, never fails" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  run node "$R" --prune-report --target "$TARGET"
  [ "$status" -eq 0 ]          # REQ-10 says exit 0; blocking is not this gate's job
}

@test "prune-report: never deletes -- the reported file is still there afterwards" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  run node "$R" --prune-report --target "$TARGET"
  [ -f "$TARGET/.claude/scripts/ghost.sh" ]     # non-negotiable #51
}

@test "prune-report: the consumer's OWN personal files are not reported as unowned" {
  printf '{}' > "$TARGET/.claude/settings.local.json"
  mkdir -p "$TARGET/.claude/state/reviews"
  printf 'x\n' > "$TARGET/.claude/state/reviews/abc.txt"
  run node "$R" --prune-report --target "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" != *"settings.local.json"* ]]    # theirs, deliberately never synced
  [[ "$output" != *"state/"* ]]                 # their working state
}

@test "prune-report: the registry itself is not reported as unowned" {
  run node "$R" --prune-report --target "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" != *"arc-registry.json"* ]]
}

@test "prune-report: a target with no registry degrades loudly (cannot infer ownership)" {
  rm -f "$TARGET/.claude/arc-registry.json"
  run node "$R" --prune-report --target "$TARGET"
  [ "$status" -ne 0 ]
  [[ "$output" == *"registry"* ]]               # say WHY, never guess ownership from file presence
}

@test "prune-report: reachable through the sync twin's own flag" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --prune-report
  [ "$status" -eq 0 ]
  [[ "$output" == *"ghost.sh"* ]]
}

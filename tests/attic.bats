#!/usr/bin/env bats
# Phase 05 / REQ-11 -- `--attic`: quarantine stale files in a consumer tree. MOVE, never delete.
#
# The other half of ADR-0020. Phase 04 shipped `--prune-report`, which makes stale files VISIBLE
# (measured on venturemind, 2026-07-19: 21 unowned files, 6 of them left by Phase 03's re-homing
# and still executable). Seeing them is not enough -- a stale `review-ledger.sh` that still runs is
# a live hazard. This mode moves them out of the way.
#
# The rule that shapes every test below: NOTHING IS EVER DELETED. Not the stale file, not an
# earlier quarantined copy of it, not an emptied directory. A move that loses a byte is a delete
# with better manners, so the tests assert survival, not just absence.
bats_require_minimum_version 1.5.0
load 'test_helper'

R="$ARC_ROOT/.claude/scripts/core/arc-products.mjs"

setup() {
  TARGET="$(mktemp -d)"
  mkdir -p "$TARGET/.git"
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council >/dev/null 2>&1
}
teardown() { [ -n "${TARGET:-}" ] && rm -rf "$TARGET" 2>/dev/null || true; }

# Resolve the single dated attic dir a run created (tests must not guess today's date).
_attic_dir() { find "$TARGET/.claude/attic" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1; }

@test "attic: a freshly synced target has nothing to quarantine" {
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 unowned"* ]]
}

@test "attic: an empty run creates no dated directory -- no litter to explain later" {
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  [ -z "$(_attic_dir)" ]
}

@test "attic: a stale pre-move script is MOVED out of its original location (the venturemind case)" {
  printf '#!/bin/sh\necho stale\n' > "$TARGET/.claude/scripts/review-ledger.sh"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  [ ! -f "$TARGET/.claude/scripts/review-ledger.sh" ]   # no longer executable in place
}

@test "attic: the moved file still exists in the attic -- moved, not vanished" {
  printf '#!/bin/sh\necho stale\n' > "$TARGET/.claude/scripts/review-ledger.sh"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  local a; a="$(_attic_dir)"
  [ -n "$a" ]
  [ -f "$a/.claude/scripts/review-ledger.sh" ]
}

@test "attic: content survives the move byte-for-byte (a lossy move is a delete)" {
  printf 'line1\nline2\twith-tab\n' > "$TARGET/.claude/scripts/ghost.sh"
  local before; before="$(cksum < "$TARGET/.claude/scripts/ghost.sh")"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  local a; a="$(_attic_dir)"
  [ "$(cksum < "$a/.claude/scripts/ghost.sh")" = "$before" ]
}

@test "attic: a MANIFEST.tsv records original -> attic for restore" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  local a; a="$(_attic_dir)"
  [ -f "$a/MANIFEST.tsv" ]
  run cat "$a/MANIFEST.tsv"
  [[ "$output" == *".claude/scripts/ghost.sh"* ]]
}

@test "attic: the manifest makes a restore work -- put it back, it is byte-identical" {
  printf 'restore-me\n' > "$TARGET/.claude/scripts/ghost.sh"
  local before; before="$(cksum < "$TARGET/.claude/scripts/ghost.sh")"
  node "$R" --attic --target "$TARGET" >/dev/null
  local a; a="$(_attic_dir)"
  # the documented restore: move the second column back to the first, relative to target root
  local orig atticked
  orig="$(grep -v '^#' "$a/MANIFEST.tsv" | head -1 | cut -f1)"
  atticked="$(grep -v '^#' "$a/MANIFEST.tsv" | head -1 | cut -f2)"
  mv "$TARGET/$atticked" "$TARGET/$orig"
  [ -f "$TARGET/.claude/scripts/ghost.sh" ]
  [ "$(cksum < "$TARGET/.claude/scripts/ghost.sh")" = "$before" ]
}

@test "attic: the consumer's OWN personal files are never moved" {
  printf '{}' > "$TARGET/.claude/settings.local.json"
  mkdir -p "$TARGET/.claude/state/reviews"
  printf 'x\n' > "$TARGET/.claude/state/reviews/abc.txt"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  [ -f "$TARGET/.claude/settings.local.json" ]          # theirs, deliberately never synced
  [ -f "$TARGET/.claude/state/reviews/abc.txt" ]        # their working state
}

@test "attic: the registry itself is never moved" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  [ -f "$TARGET/.claude/arc-registry.json" ]
}

@test "attic: a target with no registry degrades loudly and moves NOTHING" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  rm -f "$TARGET/.claude/arc-registry.json"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -ne 0 ]
  [[ "$output" == *"registry"* ]]                       # say WHY, never guess ownership
  [ -f "$TARGET/.claude/scripts/ghost.sh" ]             # refusing to decide means refusing to move
}

@test "attic: a second run on the same day does NOT clobber the first quarantined copy" {
  printf 'first\n' > "$TARGET/.claude/scripts/ghost.sh"
  node "$R" --attic --target "$TARGET" >/dev/null
  printf 'second\n' > "$TARGET/.claude/scripts/ghost.sh"   # same path comes back (e.g. a re-sync)
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  local a; a="$(_attic_dir)"
  # both generations survive: overwriting the first would be a delete wearing a move's clothes
  run cat "$a/.claude/scripts/ghost.sh"
  [[ "$output" == *"first"* ]]
  [ -f "$a/.claude/scripts/ghost.sh.2" ]
  run cat "$a/.claude/scripts/ghost.sh.2"
  [[ "$output" == *"second"* ]]
}

@test "attic: the attic is not re-atticed on a later run (no infinite quarantine)" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  node "$R" --attic --target "$TARGET" >/dev/null
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 unowned"* ]]                      # attic/ is skipped by the walk
}

@test "attic: paths with spaces survive the move (the TAB protocol's whole point)" {
  mkdir -p "$TARGET/.claude/scripts/my dir"
  printf 'spaced\n' > "$TARGET/.claude/scripts/my dir/ghost file.sh"
  run node "$R" --attic --target "$TARGET"
  [ "$status" -eq 0 ]
  local a; a="$(_attic_dir)"
  [ -f "$a/.claude/scripts/my dir/ghost file.sh" ]
  [ ! -f "$TARGET/.claude/scripts/my dir/ghost file.sh" ]
}

@test "attic: --prune-report and --attic agree on the file set (report IS the dry run)" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost-a.sh"
  printf 'x\n' > "$TARGET/.claude/scripts/ghost-b.sh"
  local reported; reported="$(node "$R" --prune-report --target "$TARGET" | grep '^unowned' | awk '{print $2}' | sort)"
  local moved;    moved="$(node "$R" --attic --target "$TARGET" | grep '^moved' | awk '{print $2}' | sort)"
  [ -n "$reported" ]
  [ "$reported" = "$moved" ]                            # one shared walk, so they cannot drift
}

@test "attic: reachable through the sync twin's own flag" {
  printf 'x\n' > "$TARGET/.claude/scripts/ghost.sh"
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --attic
  [ "$status" -eq 0 ]
  [[ "$output" == *"ghost.sh"* ]]
  [ ! -f "$TARGET/.claude/scripts/ghost.sh" ]
}

@test "attic: NO delete call exists in the resolver -- the non-negotiable is grep-checkable" {
  # non-negotiable #51: "Consumer repos: never delete -- attic move to .claude/attic/DATE/ only".
  # A promise in a comment rots; this asserts the property on the source itself.
  run grep -nE 'unlinkSync|rmSync|rmdirSync|\brm -rf\b|fs\.unlink|fs\.rm\b' "$R"
  [ "$status" -ne 0 ]                                   # grep finds nothing = exit 1
}

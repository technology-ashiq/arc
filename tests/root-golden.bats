#!/usr/bin/env bats
# Root-mode goldens — Cycle 4 portfolio Phase 00, REQ-01 (ADR-0054).
#
# PINNED BEFORE any resolver code exists: these goldens capture today's ROOT-MODE
# behavior of the tracker surfaces (SessionStart/SessionEnd hooks, kickoff-lint,
# arc-evidence) so the --lane refactor has a byte-level regression net. Root-mode
# (no initiatives/ dir) is a PERMANENT consumer contract — these tests must stay
# green at every commit of the lane work and forever after.
#
# Normalization is DECLARED in _arc_root_norm (test_helper.bash): it removes only
# CR bytes, commit hashes, wall-clock, and machine paths — never wording, order,
# counts, branch names, tracker content, or truncation. Regen is a NAMED step:
#   ARC_ROOT_GOLDEN_RECORD=1 bats tests/root-golden.bats
# and its diff must be reviewed naming the intentional change (sync-golden rule).
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_teardown; }

# ---------- SessionStart hook (00-context.sh) ----------

@test "root-golden: SessionStart context output is byte-stable in a root-mode repo" {
  _arc_tracker_sandbox
  run bash "$SANDBOX/.claude/hooks/SessionStart.d/00-context.sh"
  [ "$status" -eq 0 ]
  local groot; groot="$(git -C "$SANDBOX" rev-parse --show-toplevel 2>/dev/null)"
  printf '%s\n' "$output" | _arc_root_norm "$groot" | _arc_root_golden_check sessionstart-context
}

@test "root-golden: SessionStart outside a git repo prints the heads-up and exits 0" {
  NG="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-nogit.$$.$RANDOM")"
  mkdir -p "$NG"
  CLAUDE_PROJECT_DIR="$NG" run bash "$ARC_ROOT/.claude/hooks/SessionStart.d/00-context.sh"
  [ "$status" -eq 0 ]
  printf '%s\n' "$output" | _arc_root_norm "$NG" | _arc_root_golden_check sessionstart-nogit
  rm -rf "$NG" 2>/dev/null || true
}

# ---------- SessionEnd hook (00-session-log.sh) ----------

@test "root-golden: SessionEnd writes a byte-stable session-log entry" {
  _arc_tracker_sandbox
  run bash "$SANDBOX/.claude/hooks/SessionEnd.d/00-session-log.sh"
  [ "$status" -eq 0 ]
  [ -f "$SANDBOX/docs/session-log.md" ]
  local groot; groot="$(git -C "$SANDBOX" rev-parse --show-toplevel 2>/dev/null)"
  _arc_root_norm "$groot" < "$SANDBOX/docs/session-log.md" | _arc_root_golden_check sessionend-log
}

# ---------- kickoff-lint ----------

@test "root-golden: kickoff-lint output on the good fixture is byte-stable (exit 0)" {
  run node "$ARC_ROOT/.claude/scripts/plan/kickoff-lint.mjs" "$ARC_ROOT/tests/fixtures/kickoff-lint/good"
  [ "$status" -eq 0 ]
  printf '%s\n' "$output" | _arc_root_norm "$ARC_ROOT" | _arc_root_golden_check kickoff-lint-good
}

@test "root-golden: kickoff-lint failure output on an empty root is byte-stable (exit 1)" {
  local empty="$BATS_TEST_TMPDIR/empty"; mkdir -p "$empty"
  run node "$ARC_ROOT/.claude/scripts/plan/kickoff-lint.mjs" "$empty"
  [ "$status" -eq 1 ]
  printf '%s\n' "$output" | _arc_root_norm "$empty" | _arc_root_golden_check kickoff-lint-missing-plan
}

# ---------- arc-evidence ----------

@test "root-golden: arc-evidence usage error is byte-stable (exit 1)" {
  _arc_tracker_sandbox
  run bash "$SANDBOX/.claude/scripts/plan/arc-evidence.sh"
  [ "$status" -eq 1 ]
  local groot; groot="$(git -C "$SANDBOX" rev-parse --show-toplevel 2>/dev/null)"
  printf '%s\n' "$output" | _arc_root_norm "$groot" | _arc_root_golden_check evidence-usage
}

@test "root-golden: arc-evidence verify with no bundle reports the ROOT-MODE default path (exit 2)" {
  _arc_tracker_sandbox
  run bash "$SANDBOX/.claude/scripts/plan/arc-evidence.sh" verify 7
  [ "$status" -eq 2 ]
  local groot; groot="$(git -C "$SANDBOX" rev-parse --show-toplevel 2>/dev/null)"
  printf '%s\n' "$output" | _arc_root_norm "$groot" | _arc_root_golden_check evidence-verify-missing
}

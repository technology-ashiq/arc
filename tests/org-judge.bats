#!/usr/bin/env bats
# org Cycle 20 Phase 01 -- a head's verdict on a worker's handoff lands on the spine (REQ-03, ADR-1627).
#
# The tree is a scratch copy of arc with one real team: solution-architect heads e-engineering, and code-reviewer
# and devops-release (both staffed, both reporting to it) are on shift. The spine holds one review-diff handoff.
bats_require_minimum_version 1.5.0
load 'test_helper'

READ() { node "$ARC_ROOT/tests/fixtures/engine/read-receipt.mjs" "$ARC_SPINE_ROOT" "$@"; }

judge_tree() {
  local d="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$d/.claude" "$d/engine" "$d/org/teams" || return 1
  cp -r "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$ARC_ROOT/.claude/scripts" "$d/.claude/" || return 1
  cp -r "$ARC_ROOT/processes" "$ARC_ROOT/products" "$d/" || return 1
  cp -r "$ARC_ROOT/org/." "$d/org/" || return 1
  cp "$ARC_ROOT/engine/router.yaml" "$d/engine/" && cp "$ARC_ROOT/hq.policy.yaml" "$ARC_ROOT/ventures.yaml" "$d/" || return 1
  cat > "$d/org/teams/lexos.team.yaml" <<'YAML'
venture: lexos
stage: build
mission: private
on_shift:
  build:
    - solution-architect
    - code-reviewer
    - devops-release
heads:
  e-engineering: solution-architect
seats: {}
dispatch:
  heartbeat: daily
  queue_cap: 7
YAML
  [ -s "$d/org/teams/lexos.team.yaml" ] || return 1
  printf '%s' "$d"
}

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
  run node "$ARC_ROOT/tests/org/judge-spine.mjs" "$ARC_SPINE_ROOT"
  [[ "$output" == "judge-spine: HANDOFF=01M0JDGESPNEX0000000000001 RUN=01M0JDGESPNEX0000000000002" ]] || { echo "the spine fixture was not written: $output"; return 1; }
}

@test "org-judge: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "org-judge: the decision fixture runs every check clean" {
  run node "$ARC_ROOT/tests/org/judge.mjs"
  [[ "$output" == *"RAN judge "* ]] || { echo "the fixture never ran: $output"; false; }
  [[ "$output" == *", 0 failed"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ]
}

@test "org-judge: a head's verdict lands once, judges the worker, and the audit still agrees" {
  local t; t=$(judge_tree) || { echo "fixture failed"; false; }
  run node "$t/.claude/scripts/org/org-judge.mjs" --head solution-architect --receipt 01M0JDGESPNEX0000000000001 --verdict rework --reason "tests missing for the parser" --root "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "org-judge: review.completed "* ]] || { echo "$output"; false; }
  [ "$(READ kindcount review.completed)" = "1" ] || { echo "count=$(READ kindcount review.completed)"; false; }
  run node "$t/.claude/scripts/org/org-review.mjs" --role code-reviewer --json --root "$t" --spine-dir "$ARC_SPINE_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"rejects": 1'* ]] || { echo "the verdict was recorded and never judged: $output"; false; }
  run node "$t/.claude/scripts/org/org-review.mjs" --audit --root "$t" --spine-dir "$ARC_SPINE_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 difference(s)"* ]] || { echo "$output"; false; }

  # a second verdict on the same receipt is refused, and nothing more is written
  run node "$t/.claude/scripts/org/org-judge.mjs" --head solution-architect --receipt 01M0JDGESPNEX0000000000001 --verdict accept --reason "fixed" --root "$t"
  [ "$status" -eq 1 ] && [[ "$output" == *"ALREADY_JUDGED:"* ]] || { echo "$output"; false; }
  [ "$(READ kindcount review.completed)" = "1" ]
}

@test "org-judge: refusals name every failed condition and write nothing" {
  local t; t=$(judge_tree) || { echo "fixture failed"; false; }
  run node "$t/.claude/scripts/org/org-judge.mjs" --head solution-architect --receipt 01M0JDGESPNEX0000000000002 --verdict Accept --reason "two" --root "$t"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"NOT_HANDOFF:"* && "$output" == *"BAD_VERDICT:"* ]] || { echo "$output"; false; }
  rm "$t/org/teams/lexos.team.yaml"
  run node "$t/.claude/scripts/org/org-judge.mjs" --head solution-architect --receipt 01M0JDGESPNEX0000000000001 --verdict accept --reason "fine" --root "$t" --dry-run
  [ "$status" -eq 1 ] && [[ "$output" == *"NO_TEAM:"* ]] || { echo "$output"; false; }
  [ "$(READ kindcount review.completed)" = "0" ]
}

@test "org-judge: a dry run prints the payload and emits nothing" {
  local t; t=$(judge_tree) || { echo "fixture failed"; false; }
  run node "$t/.claude/scripts/org/org-judge.mjs" --head solution-architect --receipt 01M0JDGESPNEX0000000000001 --verdict accept --reason "clean" --root "$t" --dry-run
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"subject_role":"code-reviewer"'* ]] || { echo "$output"; false; }
  [ "$(READ kindcount review.completed)" = "0" ]
}

@test "org-judge: run through a symlinked path, the CLI still runs (main guard realpaths both sides)" {
  [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]] && skip "Git Bash ln -s copies instead of linking"
  local t; t=$(judge_tree) || { echo "fixture failed"; false; }
  ln -s "$t" "$BATS_TEST_TMPDIR/link" || { echo "no symlink"; false; }
  run node "$BATS_TEST_TMPDIR/link/.claude/scripts/org/org-judge.mjs" --head solution-architect --receipt 01M0JDGESPNEX0000000000001 --verdict accept --reason "clean" --root "$t" --dry-run
  [ "$status" -eq 0 ] && [[ "$output" == *"org-judge: would emit review.completed"* ]] || { echo "the guard no-oped: status $status output [$output]"; false; }
}

#!/usr/bin/env bats
# org Phase 03 -- the dispatcher proposes, it never does (REQ-08, REQ-10; ADR-1602 / ADR-1605 /
# ADR-1606 / ADR-1616 / ADR-1623).
#
# Each test drives org-dispatch against a scratch tree holding a proposed lexos team and a written
# spine in one state. Nothing here emits: --emit writes to a real spine and is exercised only from
# the main clone by the scheduler.
bats_require_minimum_version 1.5.0
load 'test_helper'

DISPATCH() { printf '%s' "$ARC_ROOT/.claude/scripts/org/org-dispatch.mjs"; }

# scratch tree + proposed lexos team + a spine in SCENARIO; prints "TREE SPINE"
setup_scenario() {
  local d="$BATS_TEST_TMPDIR/tree"
  if [ ! -d "$d" ]; then
    mkdir -p "$d/.claude" "$d/engine" || return 1
    cp -r "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$ARC_ROOT/.claude/scripts" "$d/.claude/" || return 1
    cp -r "$ARC_ROOT/processes" "$ARC_ROOT/org" "$ARC_ROOT/products" "$d/" || return 1
    cp "$ARC_ROOT/engine/router.yaml" "$d/engine/" && cp "$ARC_ROOT/hq.policy.yaml" "$ARC_ROOT/ventures.yaml" "$d/" || return 1
    node "$ARC_ROOT/.claude/scripts/org/org-team.mjs" --init lexos --root "$d" >/dev/null || return 1
  fi
  local dg; dg=$(node "$ARC_ROOT/.claude/scripts/org/org-team.mjs" --digest lexos --root "$d" | sed -n 's/^digest: //p')
  [[ "$dg" =~ ^[0-9a-f]{64}$ ]] || return 1
  node "$ARC_ROOT/tests/org/dispatch-spine.mjs" "$d/sp-$1" lexos "$dg" "$1" >/dev/null || return 1
  printf '%s %s' "$d" "$d/sp-$1"
}
run_dispatch() { run node "$(DISPATCH)" --venture lexos --root "$1" --spine-dir "$2" --today 2026-09-30; }

@test "org-dispatch: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "org-dispatch: an ungoverned team gets no proposals at all" {
  local s; s=$(setup_scenario governed) || { echo "fixture failed"; false; }
  set -- $s
  mkdir -p "$1/empty/events"
  run_dispatch "$1" "$1/empty"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == "UNRECEIPTED TEAM CHANGE: lexos digest "* ]] || { echo "$output"; false; }
  if [[ "$output" == *"PROPOSE"* ]]; then echo "proposed for an ungoverned team: $output"; false; fi
}

@test "org-dispatch: a governed team gets a proposal with full goal ancestry for each unmet criterion" {
  local s; s=$(setup_scenario governed) || { echo "fixture failed"; false; }
  set -- $s
  run_dispatch "$1" "$2"
  [[ "$output" == "lexos @ discover: "* ]] || { echo "did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PROPOSE board-advisors: Put the idea to the board and record its verdict.  [discover exit criterion board-verdict unmet (0 of 1 council.verdict)] ancestry: private > discover > board-verdict > "* ]] || { echo "$output"; false; }
}

@test "org-dispatch: a vacant owner is a counted demand, and the third demand proposes a hire" {
  local s; s=$(setup_scenario governed) || { echo "fixture failed"; false; }
  set -- $s
  run_dispatch "$1" "$2"
  [[ "$output" == *"DEMAND pain-point-miner (1 of 3)"* ]] || { echo "$output"; false; }
  if [[ "$output" == *"PROPOSE recruiter"* ]]; then echo "hired at one demand: $output"; false; fi
  s=$(setup_scenario demand2) || false
  set -- $s
  run_dispatch "$1" "$2"
  [[ "$output" == *"DEMAND pain-point-miner (3 of 3)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"PROPOSE recruiter: Hire for pain-point-miner: real work has wanted it 3 times  [vacancy-demand]"* ]] || { echo "$output"; false; }
}

@test "org-dispatch: a full queue proposes nothing more that day (REQ-10)" {
  local s; s=$(setup_scenario queuefull) || { echo "fixture failed"; false; }
  set -- $s
  run_dispatch "$1" "$2"
  [[ "$output" == "lexos @ discover: 0 proposal(s), 0 vacancy demand(s); 7 already today of cap 7"* ]] || { echo "$output"; false; }
  [[ "$output" == *"skip queue full: 7 proposal(s) today against a cap of 7 (REQ-10)"* ]] || { echo "$output"; false; }
}

@test "org-dispatch: a seat over its budget line gets one budget-cap request and no work (ADR-1616)" {
  local s; s=$(setup_scenario budget) || { echo "fixture failed"; false; }
  set -- $s
  run_dispatch "$1" "$2"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PROPOSE board-advisors: Budget line for board-advisors is spent (500 minor INR, 0 tokens)"*"[budget-cap]"* ]] || { echo "$output"; false; }
  if [[ "$output" == *"PROPOSE board-advisors: Put the idea"* ]]; then echo "proposed work to a capped seat: $output"; false; fi
}

@test "org-dispatch: every criterion met proposes the stage change, and only proposes it" {
  local s; s=$(setup_scenario stage-exit) || { echo "fixture failed"; false; }
  set -- $s
  run_dispatch "$1" "$2"
  [[ "$output" == *"PROPOSE coo-dispatcher: Move lexos from discover to validate: every discover exit criterion reads true  [stage-exit]"* ]] || { echo "$output"; false; }
  grep -q "^stage: 'discover'$" "$1/org/teams/lexos.team.yaml" || { echo "the dispatcher moved the stage itself"; false; }
}

@test "org-dispatch: an open proposal for the same role and criterion is never raised twice" {
  local s; s=$(setup_scenario open) || { echo "fixture failed"; false; }
  set -- $s
  run_dispatch "$1" "$2"
  [[ "$output" == *"skip discover.board-verdict: a proposal to board-advisors is already open"* ]] || { echo "$output"; false; }
  if [[ "$output" == *"PROPOSE board-advisors"* ]]; then echo "raised twice: $output"; false; fi
}

@test "org-dispatch: usage -- one of --venture or --all, flags never twice, unknown refused" {
  run node "$(DISPATCH)" --venture lexos --all
  [ "$status" -eq 2 ] && [[ "$output" == *"exactly one of --venture V or --all"* ]] || { echo "$output"; false; }
  run node "$(DISPATCH)" --all --today 2026-09-30 --today 2026-10-01
  [ "$status" -eq 2 ] && [[ "$output" == *"--today given twice"* ]] || { echo "$output"; false; }
  run node "$(DISPATCH)" --al
  [ "$status" -eq 2 ] && [[ "$output" == *'unknown flag "--al"'* ]] || { echo "$output"; false; }
}

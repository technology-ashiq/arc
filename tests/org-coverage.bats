#!/usr/bin/env bats
# org Phase 00 -- the role catalog and its gate (REQ-01, REQ-03, REQ-13; REQ-11's gate arms;
# ADR-1609 / ADR-1610 / ADR-1614 / ADR-1615 / ADR-1620).
#
# org-coverage fails, naming it, on an agent with no role and on a role naming something that is
# not in the tree. These tests run it on the real tree, through its own mutant self-test, and end
# to end on scratch copies with one plant each. Counts are DERIVED from the tree in the test, never
# pinned: a literal 71 or 30 breaks the day an agent is added and proves nothing on the day it holds.
#
# Every test asserts the gate RAN before asserting what it printed.
bats_require_minimum_version 1.5.0
load 'test_helper'

GATE() { printf '%s' "$ARC_ROOT/.claude/scripts/org/org-coverage.mjs"; }

# A scratch tree holding exactly what the gate reads; prints its root.
org_scratch() {
  local d="$BATS_TEST_TMPDIR/tree-$1"
  mkdir -p "$d/.claude" "$d/engine" || return 1
  cp -r "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$ARC_ROOT/.claude/scripts" "$d/.claude/" || return 1
  cp -r "$ARC_ROOT/processes" "$ARC_ROOT/org" "$d/" || return 1
  cp "$ARC_ROOT/engine/router.yaml" "$d/engine/" || return 1
  cp "$ARC_ROOT/hq.policy.yaml" "$ARC_ROOT/ventures.yaml" "$d/" || return 1
  if [ -f "$ARC_ROOT/.mcp.json" ]; then cp "$ARC_ROOT/.mcp.json" "$d/"; fi
  printf '%s' "$d"
}

@test "org-coverage: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "org-coverage: the real tree is covered, with counts derived from the tree" {
  local roles agents
  roles=$(find "$ARC_ROOT/org/roles" -name '*.role.yaml' | wc -l | tr -d ' ')
  agents=$(find "$ARC_ROOT/.claude/agents" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')
  [ "$roles" -gt 0 ] && [ "$agents" -gt 0 ]
  run node "$(GATE)"
  [[ "$output" == *"org-coverage: "* ]] || { echo "the gate did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"org-coverage: $roles roles ("* ]] || { echo "role count is not the tree's $roles: $output"; false; }
  [[ "$output" == *", $agents agents, "* ]] || { echo "agent count is not the tree's $agents: $output"; false; }
  [[ "$output" == *"-- all covered"* ]] || { echo "$output"; false; }
}

@test "org-coverage: the mutant self-test runs every arm and each fails closed" {
  run node "$(GATE)" --mutant-selftest
  [[ "$output" =~ mutant-selftest:\ ran\ ([0-9]+)\ of\ ([0-9]+) ]] || { echo "the self-test did not run: $output"; false; }
  local ran="${BASH_REMATCH[1]}" total="${BASH_REMATCH[2]}"
  [ "$ran" -eq "$total" ] || { echo "ran $ran of $total: $output"; false; }
  [ "$total" -ge 13 ] || { echo "only $total arms -- an arm was dropped: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  if [[ "$output" == *"FAILED-ARM"* ]]; then echo "an arm failed: $output"; false; fi
  local i
  for ((i = 0; i < total; i++)); do
    printf '%s\n' "$output" | grep -Eq "^M$i .*: PASS \(exit [01]\)$" || { echo "arm M$i is not PASS: $output"; false; }
  done
  # Every planted arm names what it caught; only M0, the clean control, exits 0.
  [ "$(printf '%s\n' "$output" | grep -c 'EXPECTED-FAIL')" -eq "$((total - 1))" ] || { echo "$output"; false; }
  printf '%s\n' "$output" | grep -Eq '^M0 .*: PASS \(exit 0\)$'
}

@test "org-coverage: an orphan agent fails end to end, named" {
  local t; t=$(org_scratch orphan) || { echo "scratch failed"; false; }
  printf -- '---\nname: zz-orphan-agent\n---\n' > "$t/.claude/agents/zz-orphan-agent.md"
  run node "$(GATE)" --root "$t"
  [[ "$output" == *"org-coverage: "* ]] || { echo "the gate did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *'FAIL agent "zz-orphan-agent" belongs to no role'* ]] || { echo "$output"; false; }
}

@test "org-coverage: an E2 role moved to an agent seat fails, naming role and action" {
  local t; t=$(org_scratch e2) || { echo "scratch failed"; false; }
  local card="$t/org/roles/c-research/pricing-strategist.role.yaml"
  [ -f "$card" ] || { echo "fixture card missing"; false; }
  grep -q "^seat: 'human'$" "$card"
  sed -i.bak "s/^seat: 'human'$/seat: 'agent'/" "$card" && rm -f "$card.bak"
  run node "$(GATE)" --root "$t"
  [[ "$output" == *"org-coverage: "* ]] || { echo "the gate did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"pricing-strategist: touches E2 (changing prices)"* ]] || { echo "$output"; false; }
}

@test "org-coverage: a role binding a script that does not exist fails, named" {
  local t; t=$(org_scratch ghost-script) || { echo "scratch failed"; false; }
  rm "$t/.claude/scripts/leads/arc-leads.mjs"
  run node "$(GATE)" --root "$t"
  [[ "$output" == *"org-coverage: "* ]] || { echo "the gate did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *'lead-researcher: binds script ".claude/scripts/leads/arc-leads.mjs", which does not exist'* ]] || { echo "$output"; false; }
}

@test "org-coverage: an unknown flag is refused by name, exit 2" {
  run node "$(GATE)" --roots /tmp
  [ "$status" -eq 2 ]
  [[ "$output" == *'unknown flag "--roots"'* ]] || { echo "$output"; false; }
}

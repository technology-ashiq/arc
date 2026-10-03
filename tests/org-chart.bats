#!/usr/bin/env bats
# org Phase 00 -- the generated org chart and the catalog digest (REQ-04; ADR-1602 genesis).
#
# The chart is rendered from the cards, never typed: --check fails on a hand edit, every vacant
# role carries a VACANT banner, and every count equals a count taken from the cards in the test.
# The digest is over PARSED values, so reformatting a card leaves it alone and changing a value
# moves it. Edits happen on scratch copies only; the repo tree is never touched by a test.
bats_require_minimum_version 1.5.0
load 'test_helper'

CAT() { printf '%s' "$ARC_ROOT/.claude/scripts/org/org-catalog.mjs"; }

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

@test "org-chart: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "org-chart: the committed chart is exactly what the cards render" {
  run node "$(CAT)" --chart --check
  [[ "$output" == *"org-catalog: "* ]] || { echo "the renderer did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "org-chart: every vacant card has a VACANT banner and the counts are the cards' own" {
  local vacant roles
  vacant=$(grep -rl "^seat: 'vacant'$" "$ARC_ROOT/org/roles" | wc -l | tr -d ' ')
  roles=$(find "$ARC_ROOT/org/roles" -name '*.role.yaml' | wc -l | tr -d ' ')
  [ "$vacant" -gt 0 ] && [ "$roles" -gt 0 ]
  [ "$(grep -c '\*\*VACANT\*\*' "$ARC_ROOT/org/CHART.md")" -eq "$vacant" ] || { echo "banners != $vacant vacant cards"; false; }
  grep -q "^\*\*$roles roles\*\* " "$ARC_ROOT/org/CHART.md" || { echo "chart does not report $roles roles"; false; }
  grep -q " $vacant vacant " "$ARC_ROOT/org/CHART.md" || { echo "chart does not report $vacant vacant"; false; }
}

@test "org-chart: a hand edit to the chart is caught by --check" {
  local t; t=$(org_scratch edit) || { echo "scratch failed"; false; }
  printf 'hand edit\n' >> "$t/org/CHART.md"
  run node "$(CAT)" --chart --check --root "$t"
  [[ "$output" == *"org-catalog: "* ]] || { echo "the renderer did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"STALE org/CHART.md"* ]] || { echo "$output"; false; }
}

@test "org-chart: the digest ignores formatting and moves on any value change" {
  local t; t=$(org_scratch digest) || { echo "scratch failed"; false; }
  run node "$(CAT)" --digest --root "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" =~ digest:\ ([0-9a-f]{64}) ]] || { echo "no digest: $output"; false; }
  local d0="${BASH_REMATCH[1]}"
  local card="$t/org/roles/b-ceo-office/ceo.role.yaml"
  printf '# a comment changes bytes, not values\n' >> "$card"
  run node "$(CAT)" --digest --root "$t"
  [[ "$output" == *"digest: $d0"* ]] || { echo "a comment moved the digest: $output"; false; }
  sed -i.bak "s/^autonomy_ceiling: 'L1'$/autonomy_ceiling: 'L0'/" "$card" && rm -f "$card.bak"
  run node "$(CAT)" --digest --root "$t"
  [[ "$output" =~ digest:\ ([0-9a-f]{64}) ]] || { echo "no digest: $output"; false; }
  [ "${BASH_REMATCH[1]}" != "$d0" ] || { echo "a value change did not move the digest"; false; }
}

@test "org-chart: modes are exclusive and unknown flags refused, exit 2" {
  run node "$(CAT)" --chart --digest
  [ "$status" -eq 2 ]
  [[ "$output" == *"separate modes"* ]] || { echo "$output"; false; }
  run node "$(CAT)" --chrt
  [ "$status" -eq 2 ]
  [[ "$output" == *'unknown flag "--chrt"'* ]] || { echo "$output"; false; }
}

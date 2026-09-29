#!/usr/bin/env bats
# org Phase 00 -- the role card grammar (ADR-1601 / ADR-1609 / ADR-1614), through tests/org/probe.mjs.
#
# The worked example must validate, and each single-field mutation of it must fail naming the
# field. The mutations are made with sed on a copy, so each test proves one rule and the example
# itself is the negative control for all of them.
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { printf '%s' "$ARC_ROOT/tests/org/probe.mjs"; }
EXAMPLE() { printf '%s' "$ARC_ROOT/org/schema/example.role.yaml"; }

# copy the example to a scratch card named after it, apply one sed expression, print its path
mutant() {
  local f="$BATS_TEST_TMPDIR/example-seo-strategist.role.yaml"
  cp "$(EXAMPLE)" "$f" || return 1
  sed -i.bak "$1" "$f" && rm -f "$f.bak" || return 1
  cmp -s "$(EXAMPLE)" "$f" && { echo "sed changed nothing: $1" >&2; return 1; }
  printf '%s' "$f"
}

@test "org-card: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "org-card: the worked example validates and is staffed" {
  run node "$(PROBE)" validate "$ARC_ROOT" "$(EXAMPLE)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "VALID staffed=true" ] || { echo "$output"; false; }
}

@test "org-card: a model string as the tier fails, naming the model" {
  local f; f=$(mutant "s/^  tier: 'balanced-workhorse'$/  tier: 'claude-sonnet'/") || false
  run node "$(PROBE)" validate "$ARC_ROOT" "$f"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *'binds.tier names a model ("claude")'* ]] || { echo "$output"; false; }
}

@test "org-card: an unknown key fails, naming it" {
  # one-line replacement: BSD sed on the macOS leg does not expand \n in a replacement
  local f; f=$(mutant "s/^autonomy_ceiling: 'L1'$/salary: '5'/") || false
  run node "$(PROBE)" validate "$ARC_ROOT" "$f"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *'unknown key "salary"'* ]] || { echo "$output"; false; }
}

@test "org-card: a hired seat cannot be legitimised by genesis" {
  local f; f=$(mutant "s/^legitimacy: 'interview:01ARZ3NDEKTSV4RRFFQ69G5FAV'$/legitimacy: 'genesis'/") || false
  run node "$(PROBE)" validate "$ARC_ROOT" "$f"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"a hired seat cannot be legitimised by genesis"* ]] || { echo "$output"; false; }
}

@test "org-card: a third origin state is refused" {
  local f; f=$(mutant "s/^origin: 'hired'$/origin: 'converted'/") || false
  run node "$(PROBE)" validate "$ARC_ROOT" "$f"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"origin must be own or hired -- there is no third state"* ]] || { echo "$output"; false; }
}

@test "org-card: a KPI over a kind the spine does not have fails" {
  local f; f=$(mutant "s/^    over: 'content.published'$/    over: 'content.viral'/") || false
  run node "$(PROBE)" validate "$ARC_ROOT" "$f"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *'kpi over "content.viral" is not a spine kind'* ]] || { echo "$output"; false; }
}

@test "org-card: the emitter round-trips through the yaml subset" {
  run node "$(PROBE)" roundtrip
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "ROUNDTRIP OK" ] || { echo "$output"; false; }
}

@test "org-card: the emitter refuses a list item the subset would misread as a mapping" {
  run node "$(PROBE)" emit-colon
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "REFUSED "*'contains ": "'* ]] || { echo "$output"; false; }
}

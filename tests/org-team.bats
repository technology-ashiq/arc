#!/usr/bin/env bats
# org Phase 02 -- a venture's team manifest: proposal, grammar, governance, install closure
# (REQ-06, REQ-07; ADR-1606 / ADR-1615 / ADR-1616 / ADR-1619).
#
# A team manifest cannot change silently: org-team --check passes only when an org.team approval
# carries the manifest's exact digest and the owner approved it. The digest is over PARSED values,
# so a comment never moves it and a value always does. `sync-to-project --team` must install
# exactly what `--products <the team's closure>` installs -- one installer, never a second.
# Scratch trees only; the repo's own org/teams/ is never written by a test.
bats_require_minimum_version 1.5.0
load 'test_helper'

TEAM() { printf '%s' "$ARC_ROOT/.claude/scripts/org/org-team.mjs"; }

# A scratch arc tree with one venture (lexos, from ventures.yaml) and its team proposed; prints root.
team_tree() {
  local d="$BATS_TEST_TMPDIR/tree-$1"
  mkdir -p "$d/.claude" "$d/engine" || return 1
  cp -r "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$ARC_ROOT/.claude/scripts" "$d/.claude/" || return 1
  cp -r "$ARC_ROOT/processes" "$ARC_ROOT/org" "$ARC_ROOT/products" "$d/" || return 1
  cp "$ARC_ROOT/engine/router.yaml" "$d/engine/" && cp "$ARC_ROOT/hq.policy.yaml" "$ARC_ROOT/ventures.yaml" "$d/" || return 1
  node "$(TEAM)" --init lexos --root "$d" >/dev/null || return 1
  [ -s "$d/org/teams/lexos.team.yaml" ] || return 1
  printf '%s' "$d"
}
digest_of() { node "$(TEAM)" --digest lexos --root "$1" | sed -n 's/^digest: //p'; }

@test "org-team: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "org-team: --init proposes a valid discover team with E2 seats held by the owner, and never overwrites" {
  local t; t=$(team_tree init) || { echo "fixture failed"; false; }
  run node "$(TEAM)" --validate lexos --root "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "org-team: lexos valid -- digest "* ]] || { echo "$output"; false; }
  grep -q "^mission: 'private'$" "$t/org/teams/lexos.team.yaml"
  run node "$(TEAM)" --init lexos --root "$t"
  [ "$status" -eq 1 ] && [[ "$output" == *"never overwritten"* ]] || { echo "$output"; false; }
}

@test "org-team: --init refuses a venture that is not registered" {
  local t; t=$(team_tree unreg) || { echo "fixture failed"; false; }
  run node "$(TEAM)" --init zz-unregistered --root "$t"
  [ "$status" -eq 1 ] && [[ "$output" == *"not in ventures.yaml"* ]] || { echo "$output"; false; }
  [ ! -e "$t/org/teams/zz-unregistered.team.yaml" ]
}

@test "org-team: an unapproved team is an UNRECEIPTED TEAM CHANGE (REQ-06)" {
  local t; t=$(team_tree none) || { echo "fixture failed"; false; }
  local d; d=$(digest_of "$t"); [[ "$d" =~ ^[0-9a-f]{64}$ ]] || { echo "no digest"; false; }
  for mode in none reject near-miss; do
    node "$ARC_ROOT/tests/org/team-spine.mjs" "$t/sp-$mode" lexos "$d" "$mode" >/dev/null || false
    run node "$(TEAM)" --check lexos --root "$t" --spine-dir "$t/sp-$mode"
    [ "$status" -eq 1 ] || { echo "$mode governed a team: $output"; false; }
    [[ "$output" == "UNRECEIPTED TEAM CHANGE: "* ]] || { echo "$mode: $output"; false; }
  done
}

@test "org-team: an approved digest governs, a comment keeps it, a value change breaks it" {
  local t; t=$(team_tree gov) || { echo "fixture failed"; false; }
  local d; d=$(digest_of "$t"); [[ "$d" =~ ^[0-9a-f]{64}$ ]] || { echo "no digest"; false; }
  node "$ARC_ROOT/tests/org/team-spine.mjs" "$t/sp" lexos "$d" approve >/dev/null || false
  run node "$(TEAM)" --check lexos --root "$t" --spine-dir "$t/sp"
  [ "$status" -eq 0 ] && [[ "$output" == "org-team: lexos governed -- digest $d approved by "* ]] || { echo "$output"; false; }
  printf '# a comment is bytes, not values\n' >> "$t/org/teams/lexos.team.yaml"
  run node "$(TEAM)" --check lexos --root "$t" --spine-dir "$t/sp"
  [ "$status" -eq 0 ] || { echo "a comment broke governance: $output"; false; }
  sed -i.bak "s/^  queue_cap: 7$/  queue_cap: 6/" "$t/org/teams/lexos.team.yaml" && rm -f "$t/org/teams/lexos.team.yaml.bak"
  run node "$(TEAM)" --check lexos --root "$t" --spine-dir "$t/sp"
  [ "$status" -eq 1 ] && [[ "$output" == "UNRECEIPTED TEAM CHANGE: "* ]] || { echo "a silent edit passed: $output"; false; }
}

@test "org-team: the gate refuses an E2 role on shift that the owner does not hold" {
  local t; t=$(team_tree e2) || { echo "fixture failed"; false; }
  printf "venture: 'lexos'\nstage: 'validate'\nmission: 'private'\non_shift:\n  validate:\n    - 'pricing-strategist'\nseats:\n  pricing-strategist:\n    holder: 'card'\ndispatch:\n  heartbeat: 'daily'\n  queue_cap: 7\n" > "$t/org/teams/lexos.team.yaml"
  run node "$ARC_ROOT/.claude/scripts/org/org-coverage.mjs" --root "$t"
  [[ "$output" == *"org-coverage: "* ]] || { echo "did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"pricing-strategist touches E2 (changing prices) -- its holder must be human:ashiq"* ]] || { echo "$output"; false; }
}

@test "org-team: a queue cap above 7 is refused (REQ-10)" {
  local t; t=$(team_tree cap) || { echo "fixture failed"; false; }
  sed -i.bak "s/^  queue_cap: 7$/  queue_cap: 8/" "$t/org/teams/lexos.team.yaml" && rm -f "$t/org/teams/lexos.team.yaml.bak"
  run node "$(TEAM)" --validate lexos --root "$t"
  [ "$status" -eq 1 ] && [[ "$output" == *"queue_cap must be 1..7"* ]] || { echo "$output"; false; }
}

@test "org-team: sync --team installs byte-for-byte what --products <the team closure> installs (REQ-07)" {
  local src="$BATS_TEST_TMPDIR/src"
  mkdir -p "$src" && (cd "$ARC_ROOT" && git archive HEAD) | tar -x -C "$src" || { echo "archive failed"; false; }
  [ -f "$src/sync-to-project.sh" ] || { echo "archive is empty"; false; }
  node "$src/.claude/scripts/org/org-team.mjs" --init lexos --root "$src" >/dev/null || { echo "init failed"; false; }
  run node "$src/.claude/scripts/org/org-team.mjs" --products-for lexos --root "$src"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local closure="$output"
  [[ ",$closure," == *",core,"* ]] || { echo "core missing from $closure"; false; }
  mkdir -p "$BATS_TEST_TMPDIR/a" "$BATS_TEST_TMPDIR/b"
  run bash "$src/sync-to-project.sh" "$BATS_TEST_TMPDIR/a" --team lexos
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"sync: team lexos -> products $closure"* ]] || { echo "$output"; false; }
  run bash "$src/sync-to-project.sh" "$BATS_TEST_TMPDIR/b" --products "$closure"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _arc_tree_manifest "$BATS_TEST_TMPDIR/a" > "$BATS_TEST_TMPDIR/a.txt"
  _arc_tree_manifest "$BATS_TEST_TMPDIR/b" > "$BATS_TEST_TMPDIR/b.txt"
  [ -s "$BATS_TEST_TMPDIR/a.txt" ] || { echo "nothing installed"; false; }
  run diff "$BATS_TEST_TMPDIR/a.txt" "$BATS_TEST_TMPDIR/b.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "org-team: --team and --products are exclusive, and an unknown team fails the sync" {
  mkdir -p "$BATS_TEST_TMPDIR/t"
  run bash "$ARC_ROOT/sync-to-project.sh" "$BATS_TEST_TMPDIR/t" --team zz-none
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"--team zz-none did not resolve"* ]] || { echo "$output"; false; }
  run bash "$ARC_ROOT/sync-to-project.sh" "$BATS_TEST_TMPDIR/t" --products core --team zz-none
  [ "$status" -eq 2 ] || { echo "$output"; false; }
}

@test "org-hire: a seat is staffed only by an approved org.role interview naming it (REQ-11)" {
  local t; t=$(team_tree hire) || { echo "fixture failed"; false; }
  local c="$t/org/roles/e-engineering/qa-tester.role.yaml" u=01M0VEWDEC0000000000000001
  run node "$ARC_ROOT/.claude/scripts/org/org-catalog.mjs" --hire qa-tester --interview "$u" --spine-dir "$t/none" --root "$t"
  [ "$status" -eq 1 ] && [[ "$output" == *"fixtures: pending -- an interview needs a fixture set"* ]] || { echo "$output"; false; }
  # portable on all three legs: no sed replacement newlines (BSD sed does not expand them)
  grep -v "^fixtures: 'pending'$" "$c" > "$c.new" && printf "fixtures:\n  - 'products/bench/fixtures/qa-01.json'\n" >> "$c.new" && mv "$c.new" "$c"
  grep -q "qa-01.json" "$c" || { echo "fixture edit failed"; false; }
  for mode in reject other-role wrong-subject; do
    node "$ARC_ROOT/tests/org/interview-spine.mjs" "$t/sp-$mode" qa-tester "$mode" >/dev/null || false
    run node "$ARC_ROOT/.claude/scripts/org/org-catalog.mjs" --hire qa-tester --interview "$u" --spine-dir "$t/sp-$mode" --root "$t"
    [ "$status" -eq 1 ] && [[ "$output" == "FAIL qa-tester: "* ]] || { echo "$mode hired: $output"; false; }
  done
  node "$ARC_ROOT/tests/org/interview-spine.mjs" "$t/sp-ok" qa-tester approve >/dev/null || false
  run node "$ARC_ROOT/.claude/scripts/org/org-catalog.mjs" --hire qa-tester --interview "$u" --spine-dir "$t/sp-ok" --root "$t"
  [ "$status" -eq 0 ] && [[ "$output" == "org-catalog: qa-tester staffed by interview $u; review_by 2026-10-03" ]] || { echo "$output"; false; }
  grep -q "^legitimacy: 'interview:$u'$" "$c"
  run node "$ARC_ROOT/.claude/scripts/org/org-coverage.mjs" --root "$t" --spine-dir "$t/sp-ok"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$ARC_ROOT/.claude/scripts/org/org-coverage.mjs" --root "$t" --spine-dir "$t/sp-reject"
  [ "$status" -eq 1 ] && [[ "$output" == *"qa-tester: interview $u was not approved (REQ-11)"* ]] || { echo "$output"; false; }
}

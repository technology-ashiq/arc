#!/usr/bin/env bats
# face Phase 05 -- the room birth-rule and the coverage law (REQ-01, ADR-1306/1311).
#
# These run in CI because `.github/workflows/**` is not mine to edit: a gate that only ever
# runs on the author's box is a gate nobody enforces, so it bites through the bats suite.
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "face-coverage: every lane, kind, command and agent in the tree has a home" {
  run node "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"all covered"* ]] || { echo "$output"; false; }
}

@test "face-coverage fails CLOSED on a mutant tree, naming both the ghost lane and the ghost kind" {
  # The negative control. A coverage gate that cannot fail proves nothing, and this repo has
  # shipped exactly that shape before (a golden gate passable by deleting the failing row).
  run node "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" "$ARC_ROOT" --selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"mutant lane named:  PASS"* ]] || { echo "$output"; false; }
  [[ "$output" == *"mutant kind named:  PASS"* ]] || { echo "$output"; false; }
  [[ "$output" == *"clean tree passes: PASS"* ]] || { echo "$output"; false; }
}

@test "face sections in every product manifest match the frozen contract (no hand-edits)" {
  # The sections are GENERATED from initiatives/face/contracts/expected-set.json. A hand-edit
  # there is a second spelling of the room map, and second spellings drift.
  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$ARC_ROOT" --check
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"matches the contract"* ]] || { echo "$output"; false; }
}

@test "the frozen contract still parses and still carries its declared counts" {
  # Guards against a contract edit that silently drops a section: the counts are the ones
  # Phase 00 froze, and a change to them is a decision, not a typo.
  run node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync(process.argv[1] + '/initiatives/face/contracts/expected-set.json', 'utf8'));
    const n = { rooms: s.rooms.list.length, kinds: Object.keys(s.kinds.map).length, commands: Object.keys(s.commands.map).length, agents: Object.keys(s.agents.map).length, lanes: Object.keys(s.lanes.map).length };
    if (n.rooms !== 32) { console.log('rooms', n.rooms); process.exit(1); }
    if (n.kinds !== 46) { console.log('kinds', n.kinds); process.exit(1); }
    if (n.commands !== 26) { console.log('commands', n.commands); process.exit(1); }
    if (n.agents !== 30) { console.log('agents', n.agents); process.exit(1); }
    console.log('RAN: contract carries', JSON.stringify(n));
  " "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: contract carries"* ]] || { echo "$output"; false; }
}

@test "face-coverage suite registers all 5 tests (a dropped test reads as a pass)" {
  run grep -c '^@test ' "$ARC_ROOT/tests/face-coverage.bats"
  [ "$status" -eq 0 ]
  [ "$output" -eq 5 ]
}

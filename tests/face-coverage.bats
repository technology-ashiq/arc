#!/usr/bin/env bats
# face Phase 05 -- the room birth-rule and the coverage law (REQ-01, ADR-1306/1311).
#
# These run in CI because `.github/workflows/**` is not mine to edit: a gate that only ever
# runs on the author's box is a gate nobody enforces, so it bites through the bats suite.
#
# REWRITTEN 2026-08-19 after a fresh adversarial pass. The first cut asserted substrings
# that print even when nothing was compared: `face-sections --check` says "matches the
# contract" with ZERO manifests examined, and five separate mutants of that gate survived.
# Every test here now pins a DERIVED count and carries a negative arm.
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "face-coverage: every lane, kind, command, agent and product in the tree has a home" {
  run node "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The COUNTS are asserted, not merely printed. Mutants that made the tree readers return
  # nothing (`0 kinds ... all covered`) passed the old substring check; a count derived from
  # the tree in this test kills them.
  # Counts derived in pure SHELL. An inline `node -e` interpolating $ARC_ROOT into a
  # file:// URL is how this suite already went red on the Windows leg alone; the shell
  # does not need the path escaped into a URL, so it cannot make that mistake.
  local lanes cmds agents prods kinds
  lanes=$(ls -d "$ARC_ROOT"/initiatives/*/ 2>/dev/null | wc -l | tr -d " ")
  cmds=$(ls "$ARC_ROOT"/.claude/commands/*.md 2>/dev/null | wc -l | tr -d " ")
  agents=$(ls "$ARC_ROOT"/.claude/agents/*.md 2>/dev/null | wc -l | tr -d " ")
  prods=$(ls -d "$ARC_ROOT"/products/*/ 2>/dev/null | wc -l | tr -d " ")
  [[ "$output" == *"lanes, $cmds commands, $agents agents, $prods products -- all covered"* ]] || { echo "expected tree-derived counts (lanes=$lanes cmds=$cmds agents=$agents prods=$prods); got: $output"; false; }
  [[ "$output" == *" $lanes lanes,"* ]] || { echo "lane count is not the tree's $lanes: $output"; false; }
  # The kinds count is read back off the line and floored, which kills the mutant that made
  # the kind reader return nothing and still printed "all covered".
  kinds=$(printf '%s\n' "$output" | sed -n 's/.*face-coverage: \([0-9]\{1,\}\) kinds.*/\1/p')
  [ -n "$kinds" ] && [ "$kinds" -ge 40 ] || { echo "kinds count missing or implausible ($kinds): $output"; false; }
}

@test "face-coverage fails CLOSED on every mutant arm, and exits non-zero on a real gap" {
  # The negative control. The first version had two arms (a ghost lane, a ghost kind) and
  # seven implementation mutants walked past it -- deleting the command loop, the agent loop
  # or a whole tree reader is invisible to a mutation applied after the tree is read. It now
  # carries an arm per dimension, three VALUE-corruption arms, and an exit-code arm.
  run node "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" "$ARC_ROOT" --selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"clean tree passes: PASS"* ]] || { echo "$output"; false; }
  [[ "$output" == *"exit code on a real gap:      PASS"* ]] || { echo "$output"; false; }
  # every arm must report PASS, and there must be at least eight of them
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  local arms; arms=$(printf '%s\n' "$output" | grep -c "^mutant ")
  [ "$arms" -ge 8 ] || { echo "only $arms mutant arms: $output"; false; }
}

@test "face-coverage REFUSES a tree with a real gap (negative arm on disk, not in memory)" {
  # Builds a throwaway tree carrying an extra lane the contract does not name, and asserts
  # the CLI exits 1 AND names it. The selftest exercises the pure function; this exercises
  # the binary, which is what CI actually runs.
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/initiatives/ghostlane"
  cp -r "$ARC_ROOT/.claude" "$t/.claude"
  cp -r "$ARC_ROOT/products" "$t/products"
  mkdir -p "$t/initiatives/face/contracts"
  cp "$ARC_ROOT/initiatives/face/contracts/expected-set.json" "$t/initiatives/face/contracts/"
  for d in "$ARC_ROOT"/initiatives/*/; do mkdir -p "$t/initiatives/$(basename "$d")"; done
  run node "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" "$t"
  [ "$status" -eq 1 ] || { echo "expected exit 1 on a tree with an unnamed lane; got $status: $output"; false; }
  [[ "$output" == *"ghostlane"* ]] || { echo "$output"; false; }
}

@test "face sections in every product manifest match the contract, and the count is pinned" {
  # "matches the contract" prints even when ZERO manifests were compared -- five mutants of
  # this gate survived on that substring alone. The mapped/unmapped numbers are the assertion.
  local prods; prods=$(ls -d "$ARC_ROOT"/products/*/ 2>/dev/null | wc -l | tr -d " ")
  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$ARC_ROOT" --check
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"($prods mapped, 0 unmapped by design)"* ]] || { echo "expected all $prods products mapped; got: $output"; false; }
}

@test "face-sections REFUSES a hand-edited section (negative arm)" {
  local t="$BATS_TEST_TMPDIR/tree2"
  mkdir -p "$t/initiatives/face/contracts"
  cp -r "$ARC_ROOT/products" "$t/products"
  cp "$ARC_ROOT/initiatives/face/contracts/expected-set.json" "$t/initiatives/face/contracts/"
  node -e "
    const fs=require('fs'); const f=process.argv[1]+'/products/hq/manifest.json';
    const m=JSON.parse(fs.readFileSync(f,'utf8')); m.face.room='hand-edited-room';
    fs.writeFileSync(f, JSON.stringify(m,null,2));
  " "$t"
  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$t" --check
  [ "$status" -eq 1 ] || { echo "expected exit 1 on a hand-edited section; got $status: $output"; false; }
  [[ "$output" == *"hq"* ]] || { echo "$output"; false; }
}

@test "the frozen contract still parses and still carries its declared counts" {
  run node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync(process.argv[1] + '/initiatives/face/contracts/expected-set.json', 'utf8'));
    const n = { rooms: s.rooms.list.length, kinds: Object.keys(s.kinds.map).length, commands: Object.keys(s.commands.map).length, agents: Object.keys(s.agents.map).length, lanes: Object.keys(s.lanes.map).length, products: Object.keys(s.products.map).length };
    if (n.rooms !== 32) { console.log('rooms', n.rooms); process.exit(1); }
    if (n.kinds !== 46) { console.log('kinds', n.kinds); process.exit(1); }
    if (n.commands !== 26) { console.log('commands', n.commands); process.exit(1); }
    if (n.agents !== 30) { console.log('agents', n.agents); process.exit(1); }
    if (n.products !== 16) { console.log('products', n.products); process.exit(1); }
    // A count pins KEY COUNT, never truth -- room ids are checked as values by the gate.
    console.log('RAN: contract carries', JSON.stringify(n));
  " "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: contract carries"* ]] || { echo "$output"; false; }
}

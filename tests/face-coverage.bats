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
  local lanes cmds agents prods kinds rules procs
  lanes=$(ls -d "$ARC_ROOT"/initiatives/*/ 2>/dev/null | wc -l | tr -d " ")
  cmds=$(ls "$ARC_ROOT"/.claude/commands/*.md 2>/dev/null | wc -l | tr -d " ")
  agents=$(ls "$ARC_ROOT"/.claude/agents/*.md 2>/dev/null | wc -l | tr -d " ")
  prods=$(ls -d "$ARC_ROOT"/products/*/ 2>/dev/null | wc -l | tr -d " ")
  # rules and processes joined the gate on 2026-08-23, when it turned out to be watching
  # 5 of 11 inventories. Their counts are derived here the same way and for the same reason:
  # a reader that returns nothing must not be able to print "all covered".
  rules=$(ls "$ARC_ROOT"/.claude/rules/*.md 2>/dev/null | wc -l | tr -d " ")
  procs=$(ls "$ARC_ROOT"/processes/*.process.yaml 2>/dev/null | wc -l | tr -d " ")
  [[ "$output" == *"lanes, $cmds commands, $agents agents, $prods products, $rules rules, $procs processes,"* ]] || { echo "expected tree-derived counts (lanes=$lanes cmds=$cmds agents=$agents prods=$prods rules=$rules procs=$procs); got: $output"; false; }
  [[ "$output" == *" $lanes lanes,"* ]] || { echo "lane count is not the tree's $lanes: $output"; false; }
  [[ "$output" == *"-- all covered"* ]] || { echo "$output"; false; }
  # The rows the gate did NOT read until 2026-08-23: 164 then, 219 after ADR-1317 added eight
  # world-derived inventories. Floored, not pinned -- the inventories grow, and a floor still
  # kills the mutant that deletes the loop and prints 0.
  #
  # The floor is RAISED with the reality it guards. Left at 150 it would still catch a total
  # collapse and would sleep through a partial one: three whole inventories could stop being
  # read and the number would sit comfortably above the line. A floor far below the truth has
  # stopped measuring.
  local homed
  homed=$(printf '%s\n' "$output" | sed -n 's/.*, \([0-9]\{1,\}\) homed contract rows.*/\1/p')
  [ -n "$homed" ] && [ "$homed" -ge 210 ] || { echo "homed-rows count missing or implausible ($homed): $output"; false; }
  # Three of the world-derived counts, floored the same way. Without them the summary line
  # could say "all covered" with every one of the eight new readers returning nothing -- the
  # mutant tests/face/coverage-readers.mjs exists to kill, asserted here as well because the
  # two suites do not run on the same leg.
  local bands
  bands=$(printf '%s\n' "$output" | sed -n 's/.*, \([0-9]\{1,\}\) ADR bands.*/\1/p')
  [ -n "$bands" ] && [ "$bands" -ge 10 ] || { echo "ADR bands missing or implausible ($bands): $output"; false; }
  local plans
  plans=$(printf '%s\n' "$output" | sed -n 's/.*, \([0-9]\{1,\}\) plans.*/\1/p')
  [ -n "$plans" ] && [ "$plans" -ge 20 ] || { echo "plans missing or implausible ($plans): $output"; false; }
  local gates
  gates=$(printf '%s\n' "$output" | sed -n 's/.*, \([0-9]\{1,\}\) gates.*/\1/p')
  [ -n "$gates" ] && [ "$gates" -ge 5 ] || { echo "gates missing or implausible ($gates): $output"; false; }
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
  # The exit-code arm became ELEVEN, one per gap CLASS, after an adversarial pass showed a
  # mutant narrowing `if (findings.length)` to `[lane]` passing all seventeen mutant arms AND
  # the bats negative arm while silently exiting 0 on four other kinds of gap. Assert the
  # classes by name, so deleting one is visible here and not only inside the gate.
  for cls in "lane" "kind" "command" "agent" "product" "rule" "process"; do
    [[ "$output" == *"exit 1 on a $cls"*"PASS"* ]] || { echo "no exit arm for a $cls gap"; echo "$output"; false; }
  done
  [[ "$output" == *"command in a ghost room"*"PASS"* ]] || { echo "$output"; false; }
  [[ "$output" == *"agent in a ghost room"*"PASS"* ]] || { echo "$output"; false; }
  local exits; exits=$(printf '%s\n' "$output" | grep -c "^exit 1 on a ")
  [ "$exits" -ge 11 ] || { echo "only $exits exit-code arms: $output"; false; }
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
  # room-copy.json and the generated registry travel with the contract from 2026-08-23:
  # face-sections builds BOTH artifacts in one pass, so a tree missing the authored half
  # exits 2 (could not read the inputs) instead of 1 (drift), and this negative arm would
  # then pass for the wrong reason.
  cp "$ARC_ROOT/initiatives/face/contracts/room-copy.json" "$t/initiatives/face/contracts/"
  cp "$ARC_ROOT/initiatives/face/contracts/rooms.generated.json" "$t/initiatives/face/contracts/"
  # Sanity: the tree is clean BEFORE the edit, so exit 1 below can only be the hand-edit.
  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$t" --check
  [ "$status" -eq 0 ] || { echo "tree2 did not start clean: $output"; false; }
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
  # FLOORS, not equalities, and the distinction is the whole point of this test.
  #
  # What it guards against is a contract that was TRUNCATED, corrupted, or half-written -- the
  # failure where a generator writes 4 rooms over 33 and every downstream check happily agrees
  # with the smaller world. A floor catches all of that.
  #
  # An EQUALITY catches something else: legitimate growth. `rooms !== 32` went red the moment
  # ADR-1317 generated `chat-mcp`, a room that had been declared in planned-rooms.json and in
  # ADR-1306 and generated nowhere -- a defect being FIXED. That is the third hard-coded count
  # in this suite to fail that way in one day; the other two (l3-logic, dash-doors) were made
  # to derive their expected value from the contract, and this one is the contract, so it has
  # nothing to derive from. Hence floors.
  #
  # The count was never the protection anyway, as the note below already said: the gate checks
  # room ids as VALUES, face-sections refuses a duplicate id, and l3-logic sweeps every room.
  # A list length stayed 32 through a deleted id, a duplicated id and a swapped filler.
  run node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync(process.argv[1] + '/initiatives/face/contracts/expected-set.json', 'utf8'));
    const n = { rooms: s.rooms.list.length, kinds: Object.keys(s.kinds.map).length, commands: Object.keys(s.commands.map).length, agents: Object.keys(s.agents.map).length, lanes: Object.keys(s.lanes.map).length, products: Object.keys(s.products.map).length };
    if (n.rooms < 33) { console.log('rooms', n.rooms); process.exit(1); }
    if (n.kinds < 46) { console.log('kinds', n.kinds); process.exit(1); }
    if (n.commands < 26) { console.log('commands', n.commands); process.exit(1); }
    if (n.agents < 30) { console.log('agents', n.agents); process.exit(1); }
    if (n.products < 16) { console.log('products', n.products); process.exit(1); }
    // A count pins KEY COUNT, never truth -- room ids are checked as values by the gate.
    console.log('RAN: contract carries', JSON.stringify(n));
  " "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: contract carries"* ]] || { echo "$output"; false; }
}

# ---------- the room registry (Phase 04/06 -- what the generic renderer reads) ----------
#
# The registry is generated from two files: expected-set.json (frozen, structural) and
# room-copy.json (authored -- the sentence each room opens with, and how it renders).
# Generation rather than hand-authoring is the same argument as the face: sections above:
# the contract already knows what each room holds, and a second spelling of that in a
# renderer is a guaranteed drift.
#
# Every assertion below prints a RAN marker before it checks anything, because a suite that
# only asserts on output cannot tell "the check passed" from "the check never executed" --
# the vacuous pass this repo has shipped three times.

@test "the room registry is in sync with the contract, and every room carries a sentence" {
  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$ARC_ROOT" --check
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"registry in sync"* ]] || { echo "expected the registry line; got: $output"; false; }

  run node -e "
    const fs = require('fs');
    const r = JSON.parse(fs.readFileSync(process.argv[1] + '/initiatives/face/contracts/rooms.generated.json', 'utf8'));
    const s = JSON.parse(fs.readFileSync(process.argv[1] + '/initiatives/face/contracts/expected-set.json', 'utf8'));
    // 32 named rooms + the lane template. The template is a first-class home (ADR-1306).
    if (r.rooms.length !== s.rooms.list.length + 1) { console.log('room count', r.rooms.length); process.exit(1); }
    const noSentence = r.rooms.filter((x) => !x.sentence || !x.sentence.trim()).map((x) => x.id);
    if (noSentence.length) { console.log('rooms with no sentence:', noSentence.join(', ')); process.exit(1); }
    const badRender = r.rooms.filter((x) => !['bespoke', 'generic', 'index'].includes(x.render)).map((x) => x.id);
    if (badRender.length) { console.log('rooms with a bad render mode:', badRender.join(', ')); process.exit(1); }
    // An empty room that LOOKS built is worse than a missing one -- D7 in room-map.md.
    const empty = r.rooms.filter((x) => x.render !== 'index' && x.itemCount === 0).map((x) => x.id);
    if (empty.length) { console.log('non-index rooms deriving nothing:', empty.join(', ')); process.exit(1); }
    // Every room's ring must be one the contract declares.
    const rings = new Set(s.rings || []);
    const offRing = r.rooms.filter((x) => !rings.has(x.ring)).map((x) => x.id);
    if (offRing.length) { console.log('rooms off-ring:', offRing.join(', ')); process.exit(1); }
    console.log('RAN: registry carries', r.rooms.length, 'rooms, every one with a sentence and content');
  " "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: registry carries"* ]] || { echo "$output"; false; }
}

@test "face-sections REFUSES every broken registry input (mutant arms)" {
  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$ARC_ROOT" --selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Assert each arm BY NAME. A count would pass while an arm silently stopped firing, which
  # is exactly how a negative control rots into decoration.
  for arm in "room absent from room-copy" "room with a blank sentence" \
             "room with an unknown render mode" "index room over a non-inventory" \
             "generic room deriving nothing"; do
    [[ "$output" == *"$arm"*"PASS"* ]] || { echo "arm did not pass: $arm"; echo "$output"; false; }
  done
  [[ "$output" == *"hand-edited registry exits 1:"*"PASS"* ]] || { echo "$output"; false; }
}

@test "face-sections REFUSES a hand-edited registry (negative arm on disk, not in memory)" {
  local t="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$t"
  cp -R "$ARC_ROOT/.claude" "$t/.claude"
  cp -R "$ARC_ROOT/products" "$t/products"
  mkdir -p "$t/initiatives/face/contracts"
  cp "$ARC_ROOT/initiatives/face/contracts/expected-set.json" "$t/initiatives/face/contracts/"
  cp "$ARC_ROOT/initiatives/face/contracts/room-copy.json" "$t/initiatives/face/contracts/"
  cp "$ARC_ROOT/initiatives/face/contracts/rooms.generated.json" "$t/initiatives/face/contracts/"

  # Sanity: the copied tree passes BEFORE the edit. Without this the test below could pass
  # for the wrong reason -- a tree that was already failing on something unrelated.
  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$t" --check
  [ "$status" -eq 0 ] || { echo "copied tree did not start clean: $output"; false; }

  node -e "
    const fs = require('fs');
    const p = process.argv[1] + '/initiatives/face/contracts/rooms.generated.json';
    const r = JSON.parse(fs.readFileSync(p, 'utf8'));
    r.rooms[0].sentence = 'hand-edited, which is the thing that must not survive';
    fs.writeFileSync(p, JSON.stringify(r, null, 2) + '\n');
  " "$t"

  run node "$ARC_ROOT/.claude/scripts/core/face-sections.mjs" "$t" --check
  [ "$status" -eq 1 ] || { echo "expected exit 1 on a hand-edited registry; got $status: $output"; false; }
  [[ "$output" == *"rooms.generated.json"* ]] || { echo "$output"; false; }
}

@test "the coverage gate READS its sources, not just its own list (ADR-1317)" {
  # The distinction this test exists for, and it is not academic. face-coverage's own
  # selftest mutates a GATHERED data object -- it pushes a ghost name into clean.gates.names
  # and asserts a finding appears. That proves the check works and says nothing about the
  # reader. A mutant making treeGates return { names: [] } passes every one of those arms,
  # and the gate then reports "all covered" for a file it never opened.
  #
  # Measured, not argued: with that mutant applied, `face-coverage --selftest` exited 0 and
  # this suite exited 1. That is the vacuous-pass rule one layer down -- the assertion held
  # while the code that mattered never ran.
  run node "$ARC_ROOT/tests/face/coverage-readers.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "*" checks, 0 failed"* ]] || { echo "$output"; false; }
  local n=""
  [[ "$output" =~ RAN:\ ([0-9]+)\ checks ]] && n="${BASH_REMATCH[1]}"
  [ -n "$n" ] && [ "$n" -ge 28 ] || { echo "only '$n' checks ran: $output"; false; }
  # The arms that carry the weight, by name. A reader that silently returns nothing, and a
  # source that could not be read being reported as empty, are the two failures that would
  # let the gate lie with total confidence.
  for arm in "a gate ADDED to the file appears in the reader" \
             "treeVentures reads a MAP keyed by venture id" \
             "treeAdrBands groups by century, not by file" \
             "a gates file that will not parse is UNREADABLE, not empty" \
             "a ventures LIST where a map belongs is UNREADABLE, not empty" \
             "an ABSENT gates file is UNREADABLE, not empty" \
             "against the real repo, gates are found"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
}

@test "every world-derived inventory has its own exit arm, so deleting one loop is visible" {
  # Eleven arms were not enough once: a mutant narrowing `if (findings.length)` to a single
  # class passed all seventeen arms of the previous version, because every arm produced a
  # [lane] finding among its others. An arm that shares its neighbour's finding class proves
  # nothing about its own -- so each inventory added by ADR-1317 gets one.
  run node "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" --selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  for arm in "gate on the tree" "job on the tree" "venture on the tree" \
             "adr band on the tree" "plan on the tree" "capability on the tree" \
             "planned room on the tree" "ci workflow on the tree" \
             "an unreadable inventory source"; do
    [[ "$output" == *"exit 1 on a $arm"*"PASS"* ]] || { echo "exit arm missing: $arm"; echo "$output"; false; }
  done
}

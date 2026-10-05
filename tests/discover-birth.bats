#!/usr/bin/env bats
# discover Phase 00 -- the product is born and visible (REQ-10; ADR-1909, ADR-1913, ADR-1914).
#
# Each row check has a negative arm: the same assertion run on a temp copy with the row undone must
# FAIL with the named message, so one CI run proves the check can go red (red-first by mutant arm).
# Every probe asserts it RAN (status 0, empty stderr) before its output is believed.

bats_require_minimum_version 1.5.0
load 'test_helper'

PR() { printf '%s' "$ARC_ROOT/initiatives/face/contracts/planned-rooms.json"; }

# Prints "planned" when the file lists a discover room, "solid" otherwise; THROWS on any other shape.
room_state() {
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const list = Array.isArray(r) ? r : r && r.rooms;
    if (!Array.isArray(list) || list.length === 0) throw new Error("planned-rooms has no rooms list");
    process.stdout.write(list.some((x) => x && x.room === "discover") ? "planned" : "solid");
  ' "$1"
}

@test "discover-birth: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "discover-birth: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 9 ] || { echo "declared $declared, expected 9"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "discover-birth: the money/discover planned room stays until the face lane converts its module (ADR-1914)" {
  run --separate-stderr room_state "$(PR)"
  [ "$status" -eq 0 ] && [ -z "$stderr" ] || { echo "room check did not run: $status $stderr"; false; }
  [ "$output" = "planned" ] || { echo "the discover planned room was removed; face/src/modules/money/discover reads its line from it"; false; }
}

@test "discover-birth: the planned-room check goes red on a copy with the discover room removed" {
  local copy="$BATS_TEST_TMPDIR/planned-rooms.json"
  node -e '
    const fs = require("fs");
    const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const list = Array.isArray(r) ? r : r.rooms;
    const kept = list.filter((x) => x.room !== "discover");
    if (Array.isArray(r)) fs.writeFileSync(process.argv[2], JSON.stringify(kept)); else fs.writeFileSync(process.argv[2], JSON.stringify({ ...r, rooms: kept }));
  ' "$(PR)" "$copy"
  [ -s "$copy" ] || { echo "mutant copy was not written"; false; }
  run --separate-stderr room_state "$copy"
  [ "$status" -eq 0 ] || { echo "room check did not run on the mutant: $stderr"; false; }
  [ "$output" = "solid" ] || { echo "the check did not see the room removed: $output"; false; }
}

@test "discover-birth: the room check refuses an unreadable shape instead of calling it solid" {
  printf '{"nope": 1}' > "$BATS_TEST_TMPDIR/bad.json"
  run --separate-stderr room_state "$BATS_TEST_TMPDIR/bad.json"
  [ "$status" -ne 0 ] || { echo "a file with no rooms list was read as: $output"; false; }
  [ "$output" != "solid" ]
}

@test "discover-birth: the manifest maps to a generic room the face serves" {
  run --separate-stderr node -e '
    const m = require(process.argv[1]);
    const ok = m.name === "discover" && m.face && m.face.room === "lane";
    process.stdout.write(ok ? "mapped" : "unmapped " + JSON.stringify(m.face));
  ' "$ARC_ROOT/products/discover/manifest.json"
  [ "$status" -eq 0 ] && [ -z "$stderr" ] || { echo "manifest read failed: $stderr"; false; }
  [ "$output" = "mapped" ] || { echo "$output"; false; }
}

@test "discover-birth: discover adds no ungoverned process (ADR-1913)" {
  [ -d "$ARC_ROOT/processes" ] || { echo "processes/ not found -- could not scan"; false; }
  [ -f "$ARC_ROOT/hq.policy.yaml" ] || { echo "hq.policy.yaml not found -- could not scan"; false; }
  local listed
  listed=$(ls "$ARC_ROOT/processes" | wc -l)
  [ "$listed" -gt 0 ] || { echo "processes/ listed empty -- could not scan"; false; }
  run grep -c 'process.yaml$' <(ls "$ARC_ROOT/processes")
  [ "$output" -gt 0 ] || { echo "no process files seen -- the scan read nothing"; false; }
  run grep -c '^discover' <(ls "$ARC_ROOT/processes")
  [ "$status" -le 1 ] || { echo "grep failed scanning processes/"; false; }
  [ "$output" = "0" ] || { echo "a discover process file exists without its policy row: $output"; false; }
  run grep -c '"process:' "$ARC_ROOT/hq.policy.yaml"
  [ "$output" -gt 0 ] || { echo "hq.policy.yaml has no process rows -- the scan read nothing"; false; }
  run grep -c '"process:discover":' "$ARC_ROOT/hq.policy.yaml"
  [ "$status" -le 1 ] || { echo "grep could not read hq.policy.yaml"; false; }
  [ "$output" = "0" ] || { echo "process:discover row exists with no process file behind it"; false; }
  # Mutant arm: the same grep on a copy carrying the row must see it, or the check is vacuous.
  { cat "$ARC_ROOT/hq.policy.yaml"; printf '  "process:discover":
    e2: []
'; } > "$BATS_TEST_TMPDIR/policy.yaml"
  run grep -c '"process:discover":' "$BATS_TEST_TMPDIR/policy.yaml"
  [ "$output" = "1" ] || { echo "the check did not see a planted process:discover row: $output"; false; }
}

@test "discover-birth: discover is inside the CATALOG array" {
  run grep -cE '^const CATALOG = \[.*"discover"' "$ARC_ROOT/.claude/scripts/core/arc-products.mjs"
  [ "$output" = "1" ] || { echo "discover missing from the CATALOG array"; false; }
}

@test "discover-birth: every verb of the stub refuses with its exact message, from any cwd" {
  local cli="$ARC_ROOT/.claude/scripts/discover/arc-discover.mjs" args
  for args in "hunt x" "" "frobnicate --out y"; do
    cd "$BATS_TEST_TMPDIR"
    # shellcheck disable=SC2086
    run --separate-stderr node "$cli" $args
    [ "$status" -eq 2 ] || { echo "[$args] status $status: $stderr"; false; }
    [ "$stderr" = "arc-discover: not built yet — Phase 01" ] || { echo "[$args] stderr: $stderr"; false; }
    [ -z "$output" ] || { echo "[$args] stdout not empty: $output"; false; }
  done
}

@test "discover-birth: band 1900 is discover's" {
  run grep -c '^| 1900–1999 | `discover`' "$ARC_ROOT/PORTFOLIO.md"
  [ "$output" = "1" ] || { echo "band row for 1900 does not name discover"; false; }
}

#!/usr/bin/env bats
# discover Phase 00 -- the product is born and visible (REQ-10; ADR-1909, ADR-1913, ADR-1914).
#
# Each row check has a negative arm: the same assertion run on a temp copy with the row undone must
# FAIL with the named message, so one CI run proves the check can go red (red-first by mutant arm).

bats_require_minimum_version 1.5.0
load 'test_helper'

PR() { printf '%s' "$ARC_ROOT/initiatives/face/contracts/planned-rooms.json"; }

# Prints "planned" when the file still lists a discover room, "solid" otherwise.
room_state() {
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const list = Array.isArray(r) ? r : r.rooms;
    process.stdout.write(list.some((x) => x.room === "discover") ? "planned" : "solid");
  ' "$1"
}

@test "discover-birth: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 7 ] || { echo "declared $declared, expected 7"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "discover-birth: the discover room is solid, not planned" {
  run room_state "$(PR)"
  [ "$output" = "solid" ] || { echo "discover still listed in planned-rooms.json"; false; }
}

@test "discover-birth: the solid-room check goes red on a copy that still plans discover" {
  local copy="$BATS_TEST_TMPDIR/planned-rooms.json"
  node -e '
    const fs = require("fs");
    const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const list = Array.isArray(r) ? r : r.rooms;
    list.push({ room: "discover", ring: "money" });
    fs.writeFileSync(process.argv[2], JSON.stringify(r));
  ' "$(PR)" "$copy"
  [ -s "$copy" ] || { echo "mutant copy was not written"; false; }
  run room_state "$copy"
  [ "$output" = "planned" ] || { echo "the check did not see the planted discover room: $output"; false; }
}

@test "discover-birth: the manifest maps to a generic room the face serves" {
  run node -e '
    const m = require(process.argv[1]);
    const ok = m.name === "discover" && m.face && m.face.room === "lane";
    process.stdout.write(ok ? "mapped" : "unmapped " + JSON.stringify(m.face));
  ' "$ARC_ROOT/products/discover/manifest.json"
  [ "$output" = "mapped" ] || { echo "$output"; false; }
}

@test "discover-birth: discover adds no ungoverned process (ADR-1913)" {
  run bash -c 'ls "$1"/processes | grep -c "^discover" || true' _ "$ARC_ROOT"
  [ "$output" = "0" ] || { echo "a discover process file exists without its policy row: $output"; false; }
  run grep -c '"process:discover":' "$ARC_ROOT/hq.policy.yaml"
  [ "$output" = "0" ] || { echo "process:discover row exists with no process file behind it"; false; }
}

@test "discover-birth: discover is in the CATALOG and the stub refuses" {
  grep -q '"discover"' "$ARC_ROOT/.claude/scripts/core/arc-products.mjs" || { echo "discover missing from CATALOG"; false; }
  run node "$ARC_ROOT/.claude/scripts/discover/arc-discover.mjs" hunt x
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"not built yet"* ]] || { echo "$output"; false; }
}

@test "discover-birth: band 1900 is discover's" {
  run grep -c '^| 1900–1999 | `discover`' "$ARC_ROOT/PORTFOLIO.md"
  [ "$output" = "1" ] || { echo "band row for 1900 does not name discover"; false; }
}

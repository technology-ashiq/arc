#!/usr/bin/env bats
# discover Phase 01 -- the miner (REQ-01; ADR-1901, ADR-1904, ADR-1915).
#
# Every source failure is an ERROR with growth's own code, never an empty result; the recorded real
# response replays through growth's real adapter (only the transport is swapped); hostile text comes
# out single-line, bounded and free of control/format characters. Hostile strings live in fixture
# FILES, never in this file's shell lines or test names (fixed-defects f).

bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { printf '%s' "$ARC_ROOT/.claude/scripts/discover/arc-discover.mjs"; }
FX() { printf '%s' "$ARC_ROOT/tests/discover/fixtures/$1"; }

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
}

@test "discover-miner: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "discover-miner: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 11 ] || { echo "declared $declared, expected 11"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "discover-miner: the recorded real response exists and is not empty (fails, never skips)" {
  [ -f "$(FX recorded/hn.json)" ] || { echo "tests/discover/fixtures/recorded/hn.json is missing"; false; }
  run --separate-stderr node -e '
    const f = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const n = f.responses.reduce((s, r) => s + JSON.parse(r.body).hits.length, 0);
    process.stdout.write(String(n));
  ' "$(FX recorded/hn.json)"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [ "$output" -ge 12 ] || { echo "recording has only $output hits"; false; }
}

@test "discover-miner: the real recording replays through growth's adapter into records" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "chasing late payments" --query "invoicing software pain" --offline-fixture "$(FX recorded/hn.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ] || { echo "status $status: $stderr"; false; }
  [[ "$output" == *'hunt "invoice reminders": '*' records, '*' clusters'* ]] || { echo "$output"; false; }
  local n
  n=$(grep -c '"source_id":"hn:[0-9]*"' "$BATS_TEST_TMPDIR/out/records.ndjson")
  [ "$n" -ge 12 ] || { echo "only $n records came out of the replay"; false; }
  grep -q '"source_url":"https://news.ycombinator.com/item?id=[0-9]*"' "$BATS_TEST_TMPDIR/out/records.ndjson" || { echo "no objectID-derived url"; false; }
}

@test "discover-miner: a 200 with no hits array is growth's SOURCE_SHAPE (the adapter ran), not a quiet market" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --offline-fixture "$(FX no-hits.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
  [[ "$stderr" == *"SOURCE_SHAPE"*"no hits array"* ]] || { echo "$stderr"; false; }
  [ ! -e "$BATS_TEST_TMPDIR/out/clusters.json" ] || { echo "a failed source still wrote clusters.json"; false; }
}

@test "discover-miner: HTTP 429 is SOURCE_HTTP, never an empty result" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --offline-fixture "$(FX http-429.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
  [[ "$stderr" == *"SOURCE_HTTP"*"429"* ]] || { echo "$stderr"; false; }
  [ ! -e "$BATS_TEST_TMPDIR/out/clusters.json" ]
}

@test "discover-miner: an oversized body is SOURCE_OVERSIZE" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --offline-fixture "$(FX oversize.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
  [[ "$stderr" == *"SOURCE_OVERSIZE"* ]] || { echo "$stderr"; false; }
}

@test "discover-miner: hostile hits come out single-line, bounded, format-free, with bad counts ABSENT" {
  cd "$BATS_TEST_TMPDIR"
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "invoice payments" --offline-fixture "$(FX hostile.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ] || { echo "status $status: $stderr"; false; }
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" hostile "$BATS_TEST_TMPDIR/out/records.ndjson"
  [ "$status" -eq 0 ] && [[ "$output" == *"RAN hostile"* ]] || { echo "probe did not run: $stderr"; false; }
  [[ "$output" == *"rows 8"* ]] || { echo "$output"; false; }
  [[ "$output" == *"singleLine true"* ]] || { echo "$output"; false; }
  [[ "$output" == *"noFormat true"* ]] || { echo "$output"; false; }
  [[ "$output" == *"textCapped true"* ]] || { echo "$output"; false; }
  [[ "$output" == *'badCounts {"points":"ABSENT","comments":"ABSENT"} ABSENT'* ]] || { echo "$output"; false; }
  [[ "$output" == *"replacement true"* ]] || { echo "$output"; false; }
}

@test "discover-miner: hostile titles are data -- nothing they name is executed" {
  cd "$BATS_TEST_TMPDIR"
  mkdir victim
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "invoice payments" --offline-fixture "$(FX hostile.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ] || { echo "status $status: $stderr"; false; }
  [ -d victim ] || { echo "the victim dir was removed"; false; }
  [ ! -e PWNED_SUBST ] && [ ! -e PWNED_TICK ] || { echo "a title was executed"; false; }
  [ ! -e "$ARC_ROOT/PWNED_SUBST" ] && [ ! -e "$ARC_ROOT/PWNED_TICK" ]
  grep -qF 'touch PWNED_SUBST' "$BATS_TEST_TMPDIR/out/records.ndjson" || { echo "the hostile title did not survive as data"; false; }
}

@test "discover-miner: deleted, empty and id-less hits are skipped and counted, never invented" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "invoice payments" --offline-fixture "$(FX hostile.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" shape "$BATS_TEST_TMPDIR/out/clusters.json"
  [[ "$output" == *"RAN shape"* ]] || { echo "$stderr"; false; }
  [[ "$output" == *'skipped {"deleted-or-empty":2,"no-object-id":1}'* ]] || { echo "$output"; false; }
}

@test "discover-miner: normalize pins every hostile class" {
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" normalize
  [ "$status" -eq 0 ] && [[ "$output" == *"RAN normalize"* ]] || { echo "$stderr"; false; }
  [ "$(grep -c '^PASS ' <<< "$output")" -eq 12 ] || { echo "$output"; false; }
  [[ "$output" != *"FAIL "* ]] || { echo "$output"; false; }
}

@test "discover-miner: flags refuse empty values, foreign paths and an off-grammar niche" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --out --emit
  [ "$status" -eq 2 ] && [[ "$stderr" == *"--out needs a value"* ]] || { echo "[empty value] $status $stderr"; false; }
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --offline-fixture "$(FX empty-hits.json)" --out "/proc/../discover-escape"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"--out is outside"* ]] || { echo "[foreign out] $status $stderr"; false; }
  cp "$(FX hostile.json)" "$BATS_TEST_TMPDIR/niche.txt"
  run --separate-stderr node "$(CLI)" hunt --niche-file "$BATS_TEST_TMPDIR/niche.txt" --offline-fixture "$(FX empty-hits.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"the niche must be"* ]] || { echo "[grammar] $status $stderr"; false; }
  run --separate-stderr node "$(CLI)" frobnicate
  [ "$status" -eq 2 ] && [[ "$stderr" == *'unknown verb "frobnicate"'* ]] || { echo "[verb] $status $stderr"; false; }
}

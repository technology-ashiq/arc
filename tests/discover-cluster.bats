#!/usr/bin/env bats
# discover Phase 01 -- dedupe and cluster (REQ-02; ADR-1902, ADR-1907, ADR-1916).
#
# The snapshot is asserted NON-EMPTY by count before any hash is compared, and the hash is compared
# to a committed golden, so all three OS legs must equal one value -- not just themselves.

bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { printf '%s' "$ARC_ROOT/.claude/scripts/discover/arc-discover.mjs"; }
FX() { printf '%s' "$ARC_ROOT/tests/discover/fixtures/$1"; }
EVENT() { printf '%s' "$ARC_ROOT/.claude/scripts/hq/arc-event.mjs"; }

hunt_recorded() {
  node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "chasing late payments" --query "invoicing software pain" --offline-fixture "$(FX recorded/hn.json)" --out "$1"
}

idem_for() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update("decision.recorded|" + process.argv[1]).digest("hex"))' "$1"; }

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
}

@test "discover-cluster: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "discover-cluster: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 7 ] || { echo "declared $declared, expected 7"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "discover-cluster: the snapshot is non-empty, then byte-identical twice and equal to the committed golden" {
  run --separate-stderr hunt_recorded "$BATS_TEST_TMPDIR/a"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" shape "$BATS_TEST_TMPDIR/a/clusters.json"
  [[ "$output" == *"RAN shape"* ]] || { echo "$stderr"; false; }
  local recs clus multi
  recs=$(sed -n 's/^records //p' <<< "$output"); clus=$(sed -n 's/^clusters //p' <<< "$output"); multi=$(sed -n 's/^multi //p' <<< "$output")
  [ "$recs" -ge 12 ] && [ "$clus" -ge 3 ] && [ "$multi" -ge 1 ] || { echo "snapshot too thin: $output"; false; }
  [[ "$output" == *"noFloat true"* ]] || { echo "$output"; false; }
  run --separate-stderr hunt_recorded "$BATS_TEST_TMPDIR/b"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  local ha hb golden
  ha=$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$BATS_TEST_TMPDIR/a/clusters.json")
  hb=$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$BATS_TEST_TMPDIR/b/clusters.json")
  golden=$(tr -d '\r\n' < "$(FX recorded/clusters.sha256)")
  [ "${#ha}" -eq 64 ] || { echo "hash did not compute: $ha"; false; }
  [ "$ha" = "$hb" ] || { echo "two runs differ: $ha $hb"; false; }
  [ "$ha" = "$golden" ] || { echo "this leg's hash $ha is not the committed golden $golden"; false; }
}

@test "discover-cluster: input order does not move a byte" {
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" shuffle tests/discover/fixtures/recorded/hn.json
  [ "$status" -eq 0 ] && [[ "$output" == *"RAN shuffle"* ]] || { echo "$stderr"; false; }
  [[ "$output" == *"SHUFFLE_EQUAL "* ]] || { echo "$output"; false; }
}

@test "discover-cluster: similarity is integer Jaccard and the stem is conservative" {
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" jaccard
  [ "$status" -eq 0 ] && [[ "$output" == *"RAN jaccard"* ]] || { echo "$stderr"; false; }
  [[ "$output" == *"same 10000"* ]] && [[ "$output" == *"half 3333"* ]] && [[ "$output" == *"empty 0"* ]] || { echo "$output"; false; }
  [[ "$output" == *"stem invoice company class"* ]] || { echo "$output"; false; }
}

@test "discover-cluster: hostile titles survive into clusters.json as escaped data" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "invoice payments" --offline-fixture "$(FX hostile.json)" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  run --separate-stderr node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const titles = d.clusters.flatMap((c) => c.members.map((m) => m.title));
    process.stdout.write(titles.some((t) => t.includes("touch PWNED_SUBST")) && titles.every((t) => !/[\r\n]/.test(t)) ? "inert" : "bad " + JSON.stringify(titles));
  ' "$BATS_TEST_TMPDIR/out/clusters.json"
  [ "$status" -eq 0 ] && [ "$output" = "inert" ] || { echo "$output $stderr"; false; }
  [ ! -e "$BATS_TEST_TMPDIR/PWNED_SUBST" ] && [ ! -e "$ARC_ROOT/PWNED_SUBST" ]
}

@test "discover-cluster: a cluster matching a reject is marked, through the spine reader" {
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" rejectmatch tests/discover/fixtures/recorded/hn.json
  [ "$status" -eq 0 ] && [[ "$output" == *"RAN rejectmatch"* ]] || { echo "$stderr"; false; }
  [[ "$output" == *"marked 1 target true"* ]] || { echo "$output"; false; }
  # The writer shape (fixtures/reject-request.json) goes on a scratch spine; the reader must find it.
  local ask dec
  ask=$(node "$(EVENT)" emit approval.requested --strict --process discover@0.1.0 --payload-file "$(FX reject-request.json)" | tail -1)
  [[ "$ask" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "approval.requested not recorded: $ask"; false; }
  printf '{"decides":"%s","verdict":"reject","reason":"fixture reject"}' "$ask" > "$BATS_TEST_TMPDIR/dec.json"
  dec=$(node "$(EVENT)" emit decision.recorded --strict --payload-file "$BATS_TEST_TMPDIR/dec.json" --idem "$(idem_for "$ask")" | tail -1)
  [[ "$dec" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "decision.recorded not recorded: $dec"; false; }
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" rejects
  [[ "$output" == *"RAN rejects"* ]] || { echo "$stderr"; false; }
  [[ "$output" == *"rejects 1 invoice+reminder"* ]] || { echo "$output"; false; }
  run --separate-stderr hunt_recorded "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [[ "$output" == *"previously rejected $dec"* ]] || { echo "the hunt did not surface the reject: $output"; false; }
}

@test "discover-cluster: the same item fetched twice is one idea.captured, and a rerun emits none" {
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "freelancer invoices" --offline-fixture "$(FX double-fetch.json)" --out "$BATS_TEST_TMPDIR/out" --emit
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [[ "$output" == *"emitted 2 idea.captured, run.completed "* ]] || { echo "$output"; false; }
  run --separate-stderr node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "freelancer invoices" --offline-fixture "$(FX double-fetch.json)" --out "$BATS_TEST_TMPDIR/out" --emit
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [[ "$output" == *"emitted 0 idea.captured"* ]] || { echo "$output"; false; }
  run --separate-stderr node "$ARC_ROOT/tests/discover/probe.mjs" captured
  [[ "$output" == *"RAN captured"* ]] || { echo "$stderr"; false; }
  [[ "$output" == *"captured 2"* ]] || { echo "$output"; false; }
  [ -z "$(ls -A "$ARC_SPINE_ROOT/events/_quarantine" 2>/dev/null)" ] || { echo "something quarantined"; ls "$ARC_SPINE_ROOT/events/_quarantine"; false; }
}

#!/usr/bin/env bats
# discover Phase 02 -- the council judges each finalist on a fixed question; evolve reads the pair
# (REQ-04, REQ-08; ADR-1910). No council code is touched: the verdict is the council's own closed
# receipt, joined back to its cluster by sha256(question), and calibration runs unmodified.

bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { printf '%s' "$ARC_ROOT/.claude/scripts/discover/arc-discover.mjs"; }
FX() { printf '%s' "$ARC_ROOT/tests/discover/fixtures/$1"; }
EVENT() { printf '%s' "$ARC_ROOT/.claude/scripts/hq/arc-event.mjs"; }

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
}

scored_hunt() {
  node "$(CLI)" hunt --niche "invoice reminders" --query "invoice reminders" --query "chasing late payments" --query "invoicing software pain" --offline-fixture "$(FX recorded/hn.json)" --out "$1" >/dev/null &&
    node "$(CLI)" score --in "$1" >/dev/null
}

field() { node -e 'const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(eval("j" + process.argv[2])))' "$1" "$2"; }

emit_council() { # kind session_id payload-json
  printf '%s' "$3" > "$BATS_TEST_TMPDIR/c.json"
  node "$(EVENT)" emit "$1" --strict --process council-convene@1.0.0 --payload-file "$BATS_TEST_TMPDIR/c.json" | tail -1
}

@test "discover-council: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "discover-council: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 6 ] || { echo "declared $declared, expected 6"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "discover-council: the top two get the fixed 90-day question, hashed, with a launch-grammar slug" {
  scored_hunt "$BATS_TEST_TMPDIR/h"
  run --separate-stderr node "$(CLI)" judge --in "$BATS_TEST_TMPDIR/h"
  [ "$status" -eq 0 ] && [[ "$output" == "judge: 2 finalist(s)"* ]] || { echo "$status $output $stderr"; false; }
  run --separate-stderr node -e '
    const { createHash } = require("crypto");
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const ok = j.finalists.length === 2 && j.finalists.every((f) =>
      /^[a-z][a-z0-9-]{1,40}$/.test(f.slug) && f.slug.startsWith("invoice-reminders-") &&
      f.question === "Within 90 days of the owner running arc launch new for " + f.slug + ", will it reach its first paying customer?" &&
      f.question_hash === createHash("sha256").update(f.question, "utf8").digest("hex") && f.evidence.length > 0);
    process.stdout.write(ok && j.finalists[0].score >= j.finalists[1].score ? "fixed" : "bad " + JSON.stringify(j.finalists));
  ' "$BATS_TEST_TMPDIR/h/judge.json"
  [ "$status" -eq 0 ] && [ "$output" = "fixed" ] || { echo "$output $stderr"; false; }
}

@test "discover-council: zero finalists ends the hunt with no-finalists and no approval request" {
  mkdir -p "$BATS_TEST_TMPDIR/z"
  node -e '
    const fs = require("fs");
    const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    c.clusters.forEach((x) => { x.previously_rejected = "01TESTRECEIPT0000000000000"; });
    fs.writeFileSync(process.argv[2], JSON.stringify(c));
  ' "$(FX clusters-absent.json)" "$BATS_TEST_TMPDIR/z/clusters.json"
  run --separate-stderr node "$(CLI)" score --in "$BATS_TEST_TMPDIR/z"
  [ "$status" -eq 0 ] && [[ "$output" == "score: 0 scored, 2 previously rejected"* ]] || { echo "$output $stderr"; false; }
  run --separate-stderr node "$(CLI)" judge --in "$BATS_TEST_TMPDIR/z" --emit
  [ "$status" -eq 0 ] && [[ "$output" == *"no-finalists"* ]] && [[ "$output" == *"run.completed "* ]] || { echo "$status $output $stderr"; false; }
  run --separate-stderr node "$(CLI)" propose --in "$BATS_TEST_TMPDIR/z" --emit
  [ "$status" -eq 2 ] && [[ "$stderr" == *"no finalists"* ]] || { echo "[propose] $status $stderr"; false; }
  ! grep -rq '"approval.requested"' "$ARC_SPINE_ROOT/events" || { echo "an approval was requested for nothing"; false; }
}

@test "discover-council: one scorable cluster gives one finalist" {
  mkdir -p "$BATS_TEST_TMPDIR/j" && cp "$(FX judge-one/clusters.json)" "$BATS_TEST_TMPDIR/j/clusters.json"
  node "$(CLI)" score --in "$BATS_TEST_TMPDIR/j" >/dev/null
  run --separate-stderr node "$(CLI)" judge --in "$BATS_TEST_TMPDIR/j"
  [ "$status" -eq 0 ] && [[ "$output" == "judge: 1 finalist(s)"* ]] || { echo "$status $output $stderr"; false; }
}

@test "discover-council: a council.verdict is joined back to its finalist by question_hash" {
  scored_hunt "$BATS_TEST_TMPDIR/h"
  node "$(CLI)" judge --in "$BATS_TEST_TMPDIR/h" >/dev/null
  local qh id
  qh=$(field "$BATS_TEST_TMPDIR/h/judge.json" '.finalists[0].question_hash')
  [ "${#qh}" -eq 64 ] || { echo "no question hash: $qh"; false; }
  id=$(emit_council council.verdict c-disc-1 "{\"session_id\":\"c-disc-1\",\"question_hash\":\"$qh\",\"call\":\"proceed\",\"confidence\":\"High\"}")
  [[ "$id" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "verdict not recorded: $id"; false; }
  run --separate-stderr node "$(CLI)" verdicts --in "$BATS_TEST_TMPDIR/h"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [[ "$output" == *": proceed (High) c-disc-1 $id"* ]] || { echo "$output"; false; }
  [[ "$output" == *"no council.verdict yet"* ]] || { echo "the second finalist was not reported as waiting: $output"; false; }
}

@test "discover-council: evolve's calibration scores a launched pair and excludes a never-launched one, unmodified" {
  local a b
  a=$(emit_council council.verdict x '{"session_id":"c-disc-a","question_hash":"'"$(printf '%064d' 1)"'","call":"proceed","confidence":"High"}')
  b=$(emit_council council.verdict x '{"session_id":"c-disc-b","question_hash":"'"$(printf '%064d' 2)"'","call":"proceed","confidence":"Medium"}')
  [[ "$a" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] && [[ "$b" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "verdicts not recorded: $a $b"; false; }
  emit_council council.outcome x '{"session_id":"c-disc-a","outcome":"happened","observed_at":"2027-01-04","source_id":"disc-a"}' >/dev/null
  emit_council council.outcome x '{"session_id":"c-disc-b","outcome":"unresolved","observed_at":"2027-01-04","source_id":"disc-b"}' >/dev/null
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/council/council-calibrate.mjs" --from-spine
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  [[ "$output" == *"COUNCIL CALIBRATION"* ]] || { echo "$output"; false; }
  [[ "$output" == *"scored        1 "* ]] || { echo "$output"; false; }
  [[ "$output" == *"excluded      1 "* ]] || { echo "$output"; false; }
}

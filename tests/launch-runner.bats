#!/usr/bin/env bats
# launch Phase 00 -- the durable runner (REQ-02; ADR-1718, ADR-1708, ADR-1700, ADR-1720).
#
# A crashed or concurrent apply never loses or doubles work. The fixture adapter's "provider" is a file that outlives
# a killed process, so every crash test counts what REALLY exists afterwards, not what the runner believes. Kills are
# real (the fake adapter SIGKILLs itself or its runner); receipts go to a temp spine (ARC_SPINE_ROOT), never a real one.
bats_require_minimum_version 1.5.0
load 'test_helper'

L() { printf '%s' "$ARC_ROOT/.claude/scripts/launch/arc-launch.mjs"; }

setup() {
  local out; out=$(node "$ARC_ROOT/tests/launch/make-fixture.mjs" "$BATS_TEST_TMPDIR/fx") || { echo "fixture failed"; return 1; }
  eval "$out"
  [ -n "$FX_FLAGS" ] && [ -s "$FX_DIR/catalog.yaml" ] || { echo "fixture empty"; return 1; }
}

# node reads the state / provider files; paths travel as argv, never inside the program text.
slot_field() { node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=s.slots[process.argv[2]][process.argv[3]];console.log(Array.isArray(v)?v.length:v)' "$FX_STATE" "$1" "$2"; }
provider_count() { node -e 'const fs=require("fs");const f=process.argv[1];const a=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):[];console.log(a.filter(r=>r.tag.endsWith("@"+process.argv[2]+"@fake")).length)' "$FAKE_PROVIDER_FILE" "$1"; }
spine_count() { cat "$ARC_SPINE_ROOT"/events/*.jsonl 2>/dev/null | wc -l | tr -d ' '; }
spine_kind() { cat "$ARC_SPINE_ROOT"/events/*.jsonl 2>/dev/null | grep -c "\"kind\":\"$1\"" || true; }

@test "launch-runner: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "launch-runner: new creates the board once and a second new changes nothing" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"board created"* && "$output" == *"applies to this venture: 6 · skipped: 1"* ]] || { echo "$output"; false; }
  local gen; gen=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).generation)' "$FX_STATE")
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  [[ "$output" == *"board exists, unchanged"* ]] || { echo "$output"; false; }
  [ "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).generation)' "$FX_STATE")" = "$gen" ]
}

@test "launch-runner: apply verifies through the provider and leaves one receipt" {
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: verified -- attempt 1, receipt "* ]] || { echo "$output"; false; }
  [ "$(slot_field probe answerer)" = "fake-provider-file" ]
  [ "$(provider_count probe)" -eq 2 ]
  [ "$(spine_kind run.completed)" -eq 1 ]
  grep -q '"honesty_class":"rehearsal"' "$ARC_SPINE_ROOT"/events/*.jsonl
  grep -q '"key":"fx-sandbox@probe@fake@1"' "$ARC_SPINE_ROOT"/events/*.jsonl
}

@test "launch-runner: (d) apply on a verified slot is a no-op with the same receipt and no new event" {
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local receipt; receipt=$(slot_field probe receipt); local before; before=$(spine_count)
  [ -n "$receipt" ] && [ "$before" -gt 0 ]
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"verified -- no-op (receipt $receipt)"* ]] || { echo "$output"; false; }
  [ "$(spine_count)" -eq "$before" ]
}

@test "launch-runner: (a) killed after reporting 1 of 2 resources, a re-run resumes to exactly 2" {
  run env FAKE_DIE_AFTER=r1 node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAKE_CREATED r1"* ]] || { echo "the kill fixture never reached r1: $output"; false; }
  [ "$(slot_field probe state)" = "failed" ]
  [ "$(provider_count probe)" -eq 1 ]
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(slot_field probe attempt)" -eq 2 ]
  [ "$(provider_count probe)" -eq 2 ]
  [ "$(slot_field probe resources)" -eq 2 ]
}

@test "launch-runner: (e) killed after the provider created r2 but before it was recorded, the tag finds it" {
  run env FAKE_DIE_BEFORE_REPORT=r2 node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAKE_CREATED r2"* ]] || { echo "$output"; false; }
  [ "$(provider_count probe)" -eq 2 ]
  [ "$(slot_field probe resources)" -eq 1 ]
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"FAKE_CREATED"* ]] || { echo "a resource was created twice: $output"; false; }
  [ "$(provider_count probe)" -eq 2 ]
  [ "$(slot_field probe resources)" -eq 2 ]
}

@test "launch-runner: (c) a slot past its timeout is killed, failed(timeout), resources kept" {
  run env FAKE_SLEEP_MS=20000 node "$(L)" apply slow --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAKE_CREATED r1"* ]] || { echo "$output"; false; }
  [[ "$output" == *"slow: failed (timeout)"* ]] || { echo "$output"; false; }
  [ "$(slot_field slow reason)" = "timeout" ]
  [ "$(slot_field slow resources)" -eq 1 ]
  [ "$(provider_count slow)" -eq 1 ]
}

@test "launch-runner: (b) a second concurrent apply refuses and names the holder's pid" {
  ( FAKE_HOLD_MS=6000 node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS > "$BATS_TEST_TMPDIR/a.out" 2>&1; echo "A_RC=$?" >> "$BATS_TEST_TMPDIR/a.out" ) &
  local i; for i in $(seq 1 100); do grep -q FAKE_HOLDING "$BATS_TEST_TMPDIR/a.out" 2>/dev/null && break; sleep 0.1; done
  grep -q FAKE_HOLDING "$BATS_TEST_TMPDIR/a.out" || { echo "holder never started"; cat "$BATS_TEST_TMPDIR/a.out"; false; }
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  wait
  [ "$status" -eq 3 ] || { echo "$output"; false; }
  [[ "$output" == *"holds fx-sandbox's lock (pid "* ]] || { echo "$output"; false; }
  grep -q "A_RC=0" "$BATS_TEST_TMPDIR/a.out" || { cat "$BATS_TEST_TMPDIR/a.out"; false; }
  [ "$(provider_count probe)" -eq 2 ]
}

@test "launch-runner: (g) a lock left by a killed runner is taken over and its attempt gets a receipt" {
  run env FAKE_KILL_PARENT=r1 node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [[ "$output" == *"FAKE_CREATED r1"* ]] || { echo "$output"; false; }
  [ "$(slot_field probe state)" = "applying" ]
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"taking over the lock left by dead pid "* ]] || { echo "$output"; false; }
  [[ "$output" == *"attempt 1 was orphaned by a dead runner -- closed as failed"* ]] || { echo "$output"; false; }
  [ "$(spine_kind run.completed)" -eq 2 ]
  [ "$(provider_count probe)" -eq 2 ]
}

@test "launch-runner: (f) a state file truncated mid-write loads the previous generation" {
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$FX_STATE.prev" ]
  printf '{"schema":1,"slots":{' > "$FX_STATE"
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"did not parse"*"loaded the previous generation"* ]] || { echo "$output"; false; }
}

@test "launch-runner: unmet dependencies refuse with exit 4 and name the slot" {
  run node "$(L)" apply after-probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  [[ "$output" == *"after-probe: waiting on probe"* ]] || { echo "$output"; false; }
  [ "$(provider_count after-probe)" -eq 0 ]
}

@test "launch-runner: a slot whose predicate is false is skipped, not applied" {
  run node "$(L)" apply no-money --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no-money: skipped (predicate false: payment_model == none)"* ]] || { echo "$output"; false; }
  [ "$(provider_count no-money)" -eq 0 ]
}

@test "launch-runner: gate-2 pauses for the owner, and an arc-inbox approval lets it through" {
  run node "$(L)" apply gated --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 5 ] || { echo "$output"; false; }
  [ "$(provider_count gated)" -eq 0 ]
  local id; id=$(slot_field gated approval_id)
  [[ "$id" =~ ^[0-9A-Z]{26}$ ]] || { echo "no approval id: $id"; false; }
  run node "$(L)" apply gated --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 5 ] || { echo "$output"; false; }
  run node "$ARC_ROOT/.claude/scripts/hq/arc-inbox.mjs" approve "$id" --reason "fixture approval"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(L)" apply gated --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(slot_field gated state)" = "verified" ]
}

@test "launch-runner: gate-3 on a rehearsal venture records the request and refuses to cross" {
  run node "$(L)" apply live-money --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"a rehearsal venture never crosses gate-3; approval.requested "* ]] || { echo "$output"; false; }
  [ "$(spine_kind approval.requested)" -eq 1 ]
  [ "$(slot_field live-money state)" = "absent" ]
  [ "$(provider_count live-money)" -eq 0 ]
}

@test "launch-runner: a missing env key fails the slot by name and never prompts" {
  run env FAKE_NEEDS_KEY=LAUNCH_FIXTURE_ABSENT_KEY node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS < /dev/null
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [ "$(slot_field probe reason)" = "env:LAUNCH_FIXTURE_ABSENT_KEY" ]
  [ "$(provider_count probe)" -eq 0 ]
}

@test "launch-runner: apply without --venture-root refuses and names the flag" {
  run node "$(L)" apply probe --venture fx-sandbox --catalog "$FX_DIR/catalog.yaml" --registry "$FX_DIR/registry.yaml" --ventures-dir "$FX_DIR/ventures" --state-dir "$FX_DIR/state"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"--venture-root is required"* ]] || { echo "$output"; false; }
}

@test "launch-runner: a second gate-3 apply on a rehearsal refuses again from the record, no new request (L2)" {
  run node "$(L)" apply live-money --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  run node "$(L)" apply live-money --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"never crosses gate-3 (already recorded: "* ]] || { echo "$output"; false; }
  [ "$(spine_kind approval.requested)" -eq 1 ]
}

@test "launch-runner: a state file whose slots is null is a named refusal, not a crash (L3)" {
  mkdir -p "$FX_DIR/state"
  printf '{"schema":1,"venture":"fx-sandbox","slots":null,"generation":5}' > "$FX_STATE"
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"is not a schema-1 launch state"* ]] || { echo "$output"; false; }
  [[ "$output" != *"TypeError"* ]] || { echo "$output"; false; }
}

@test "launch-runner: a venture root inside arc's own tree is refused (B9)" {
  run node "$(L)" apply probe --venture fx-sandbox --catalog "$FX_DIR/catalog.yaml" --registry "$FX_DIR/registry.yaml" --providers-dir "$FX_DIR/providers" --ventures-dir "$FX_DIR/ventures" --state-dir "$FX_DIR/state" --venture-root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"is arc's own tree"* ]] || { echo "$output"; false; }
  [ "$(provider_count probe)" -eq 0 ]
}

@test "launch-runner: an adapter path that climbs out of the providers tree is refused before anything runs (B4)" {
  sed 's#adapter: providers/probe/fake.mjs#adapter: providers/probe/../../outside/fake.mjs#' "$FX_DIR/registry.yaml" > "$FX_DIR/r2.yaml"
  ! cmp -s "$FX_DIR/registry.yaml" "$FX_DIR/r2.yaml" || { echo "fixture edit did not land"; false; }
  run node "$(L)" apply probe --venture fx-sandbox --catalog "$FX_DIR/catalog.yaml" --registry "$FX_DIR/r2.yaml" --providers-dir "$FX_DIR/providers" --ventures-dir "$FX_DIR/ventures" --state-dir "$FX_DIR/state" --venture-root "$FX_DIR/venture-root"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"is not <id>.mjs inside the providers tree"* ]] || { echo "$output"; false; }
}

@test "launch-runner: the adapter sees only the env keys its row declares (B2 runtime)" {
  run env FAKE_NEEDS_KEY=LAUNCH_UNDECLARED_KEY LAUNCH_UNDECLARED_KEY=x node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$(slot_field probe reason)" == "refused:ENV_UNDECLARED LAUNCH_UNDECLARED_KEY"* ]] || { echo "$(slot_field probe reason)"; false; }
}

@test "launch-runner: an adapter sees its depends_on slots' recorded resources, and only those (ADR-1725)" {
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run env FAKE_PRINT_UPSTREAM=1 node "$(L)" apply after-probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'FAKE_UPSTREAM {"probe":[{"kind":"fake","id":"r1-1"},{"kind":"fake","id":"r2-2"}]}'* ]] || { echo "$output"; false; }
}

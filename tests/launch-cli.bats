#!/usr/bin/env bats
# launch Phase 01 -- the read verbs: plan, status, verify, teardown --plan (REQ-03 CLI half; ADR-1703, 1714, 1716).
#
# plan derives each pick or prints REFUSED, never a fallback; status shows every slot, skipped ones included; verify
# re-asks the outside world without changing a slot's state; teardown --plan names every recorded resource and never
# applies. Receipts go to a temp spine.
bats_require_minimum_version 1.5.0
load 'test_helper'

L() { printf '%s' "$ARC_ROOT/.claude/scripts/launch/arc-launch.mjs"; }

setup() {
  local out; out=$(node "$ARC_ROOT/tests/launch/make-fixture.mjs" "$BATS_TEST_TMPDIR/fx") || { echo "fixture failed"; return 1; }
  eval "$out"
  [ -n "$FX_FLAGS" ] && [ -s "$FX_DIR/catalog.yaml" ] || { echo "fixture empty"; return 1; }
}

slot_field() { node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=s.slots[process.argv[2]][process.argv[3]];console.log(v&&typeof v==="object"?JSON.stringify(v):v)' "$FX_STATE" "$1" "$2"; }

@test "launch-cli: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "launch-cli: plan on the real registry REFUSES every arc-sandbox core slot and names candidates, never a fallback" {
  run node "$(L)" new --venture arc-sandbox --state-dir "$BATS_TEST_TMPDIR/st"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(L)" plan --venture arc-sandbox --state-dir "$BATS_TEST_TMPDIR/st"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"dns: REFUSED -- no vetted provider for dns · candidates: cloudflare-dns (candidate)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"payment-test: REFUSED"*"stripe (blocked: India new-account onboarding"* ]] || { echo "$output"; false; }
  [[ "$output" != *"recommended"* ]] || { echo "a candidate was recommended: $output"; false; }
  [[ "$output" == *"arc-sandbox: 85 slots · "*" REFUSED (no vetted provider)"* ]] || { echo "$output"; false; }
}

@test "launch-cli: plan recommends a vetted, fitting row with the reasons it fits" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" plan --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: recommended fake -- why: type saas-b2b, region in, payment_model gateway · status vetted"* ]] || { echo "$output"; false; }
  [[ "$output" == *"no-money: skipped (predicate false: payment_model == none)"* ]] || { echo "$output"; false; }
}

@test "launch-cli: plan writes no state" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  local before; before=$(cat "$FX_STATE")
  run node "$(L)" plan --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(cat "$FX_STATE")" = "$before" ]
}

@test "launch-cli: status shows every slot, skipped ones included, with a count line" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(L)" status --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"verified          probe via fake (receipt "* ]] || { echo "$output"; false; }
  [[ "$output" == *"skipped           no-money -- predicate false"* ]] || { echo "$output"; false; }
  [[ "$output" == *"fx-sandbox (rehearsal): 1 verified · 5 pending · 1 skipped"* ]] || { echo "$output"; false; }
}

@test "launch-cli: verify --all re-asks the provider and leaves one receipt per probe" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local before; before=$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | wc -l | tr -d ' ')
  run node "$(L)" verify --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: verified now (answered by fake-provider-file)"* ]] || { echo "$output"; false; }
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | wc -l | tr -d ' ')" -eq $((before + 1)) ]
  grep -q '"mode":"verify"' "$ARC_SPINE_ROOT"/events/*.jsonl
}

@test "launch-cli: verify after the provider lost a resource fails, names why, and leaves the slot state alone" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  node -e 'const fs=require("fs");const f=process.argv[1];fs.writeFileSync(f,JSON.stringify(JSON.parse(fs.readFileSync(f,"utf8")).slice(1)))' "$FAKE_PROVIDER_FILE"
  run node "$(L)" verify probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: VERIFY FAILED -- provider holds 1 of 2"* ]] || { echo "$output"; false; }
  [ "$(slot_field probe state)" = "verified" ]
  [[ "$(slot_field probe last_verify)" == *'"ok":false'* ]] || { echo "$(slot_field probe last_verify)"; false; }
}

@test "launch-cli: verify with nothing applied says so and exits 0" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" verify --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"nothing applied yet -- nothing to verify"* ]] || { echo "$output"; false; }
}

@test "launch-cli: teardown --plan names every recorded resource in reverse order and applies nothing" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local before; before=$(cat "$FAKE_PROVIDER_FILE")
  run node "$(L)" teardown --plan --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"rendered, never applied in v1"* ]] || { echo "$output"; false; }
  [[ "$output" == *"4.1 probe via fake: fake r1-1"*"4.2 probe via fake: fake r2-2"* ]] || { echo "$output"; false; }
  [ "$(cat "$FAKE_PROVIDER_FILE")" = "$before" ]
}

@test "launch-cli: teardown without --plan is refused (apply is Cycle 2)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" teardown --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"--apply is Cycle 2"* ]] || { echo "$output"; false; }
}

@test "launch-cli: read verbs on a venture with no board refuse and say run new first" {
  run node "$(L)" status --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"no board for fx-sandbox -- run new first"* ]] || { echo "$output"; false; }
}

@test "launch-cli: verify refuses a venture root inside arc's own tree, and a missing one by name (405007a B2)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local base="--catalog $FX_DIR/catalog.yaml --registry $FX_DIR/registry.yaml --providers-dir $FX_DIR/providers --ventures-dir $FX_DIR/ventures --state-dir $FX_DIR/state"
  run node "$(L)" verify --all --venture fx-sandbox $base --venture-root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"is arc's own tree"* ]] || { echo "$output"; false; }
  run node "$(L)" verify --all --venture fx-sandbox $base --venture-root "$FX_DIR/nope"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"does not exist"* && "$output" != *"ENOENT"* ]] || { echo "$output"; false; }
}

@test "launch-cli: verify refuses an adapter path that climbs out of the providers tree (405007a B1)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  sed 's#adapter: providers/probe/fake.mjs#adapter: providers/probe/../../outside/fake.mjs#' "$FX_DIR/registry.yaml" > "$FX_DIR/r2.yaml"
  grep -q 'outside/fake.mjs' "$FX_DIR/r2.yaml" || { echo "fixture edit did not land"; false; }
  run node "$(L)" verify probe --venture fx-sandbox --catalog "$FX_DIR/catalog.yaml" --registry "$FX_DIR/r2.yaml" --providers-dir "$FX_DIR/providers" --ventures-dir "$FX_DIR/ventures" --state-dir "$FX_DIR/state" --venture-root "$FX_DIR/venture-root"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: UNVERIFIABLE -- "*"is not <id>.mjs inside the providers tree"* ]] || { echo "$output"; false; }
}

@test "launch-cli: verify --all skips a slot whose lock a live apply holds and still verifies the rest (405007a B6)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  ( FAKE_HOLD_MS=6000 node "$(L)" apply slow --venture fx-sandbox $FX_FLAGS > "$BATS_TEST_TMPDIR/a.out" 2>&1 ) &
  local i; for i in $(seq 1 100); do grep -q FAKE_HOLDING "$BATS_TEST_TMPDIR/a.out" 2>/dev/null && break; sleep 0.1; done
  grep -q FAKE_HOLDING "$BATS_TEST_TMPDIR/a.out" || { echo "holder never started"; false; }
  run node "$(L)" verify --all --venture fx-sandbox $FX_FLAGS
  wait
  [ "$status" -eq 3 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: SKIPPED -- another apply holds"* ]] || { echo "$output"; false; }
  [[ "$output" == *"0/1 slot(s) verified now · 1 skipped (locked)"* ]] || { echo "$output"; false; }
}

@test "launch-cli: adapter-supplied text is printed with control characters replaced (405007a B7)" {
  run node -e 'import(require("url").pathToFileURL(process.argv[1]).href).then(m=>console.log(JSON.stringify(m.clean("a\nverified now\u001b[2K"))))' "$ARC_ROOT/.claude/scripts/launch/lib/board.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = '"a?verified now?[2K"' ] || { echo "$output"; false; }
}

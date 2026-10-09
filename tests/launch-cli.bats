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
  [[ "$output" == *"probe: recommended fake -- why: FIT-1 type saas-b2b, FIT-2 region any, FIT-3 payment_model any · status vetted"* ]] || { echo "$output"; false; }
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

@test "launch-cli: clean() replaces bidi overrides and separators too (e37494d L4)" {
  run node -e 'import(require("url").pathToFileURL(process.argv[1]).href).then(m=>console.log(JSON.stringify(m.clean("a\u202eb\u2066c\u2028d"))))' "$ARC_ROOT/.claude/scripts/launch/lib/board.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = '"a?b?c?d"' ] || { echo "$output"; false; }
}

@test "launch-cli: a state value outside the known set is refused at load, never printed raw (e37494d L2)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  node -e 'const fs=require("fs");const f=process.argv[1];const s=JSON.parse(fs.readFileSync(f,"utf8"));s.slots.slow={state:"x\nverified forged",attempt:0,resources:[]};fs.writeFileSync(f,JSON.stringify(s))' "$FX_STATE"
  rm -f "$FX_STATE.prev"
  run node "$(L)" status --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"slot slow has state"* ]] || { echo "$output"; false; }
  [[ "$output" != *$'\n''verified forged'* ]] || { echo "forged line printed: $output"; false; }
}

@test "launch-cli: apply payment-live on arc-sandbox records gate-3's request and exits 2, before any dependency or provider (ADR-1741)" {
  mkdir -p "$BATS_TEST_TMPDIR/vr"
  run node "$(L)" new --venture arc-sandbox --state-dir "$BATS_TEST_TMPDIR/st"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(L)" apply payment-live --venture arc-sandbox --state-dir "$BATS_TEST_TMPDIR/st" --venture-root "$BATS_TEST_TMPDIR/vr"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"payment-live: REFUSED -- a rehearsal venture never crosses gate-3; approval.requested "* ]] || { echo "$output"; false; }
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c '"kind":"approval.requested"')" -eq 1 ]
  grep '"kind":"approval.requested"' "$ARC_SPINE_ROOT"/events/*.jsonl | grep -q '"gate":"gate-3"'
  grep '"kind":"approval.requested"' "$ARC_SPINE_ROOT"/events/*.jsonl | grep -q '"provider":"none"'
  [ "$(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(s.slots["payment-live"].state)' "$BATS_TEST_TMPDIR/st/arc-sandbox.json")" = "absent" ]
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c '"kind":"run.completed"' || true)" -eq 0 ]
  run node "$(L)" apply payment-live --venture arc-sandbox --state-dir "$BATS_TEST_TMPDIR/st" --venture-root "$BATS_TEST_TMPDIR/vr"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"never crosses gate-3 (already recorded: "* ]] || { echo "$output"; false; }
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c '"kind":"approval.requested"')" -eq 1 ]
}

# Three more vetted rows on the fixture's probe slot: two that fit, one whose region does not (ADR-1706, ADR-1748).
add_probe_rows() {
  local d; d=$(grep -m1 "digest:" "$FX_DIR/registry.yaml" | awk '{print $2}' | tr -d '\r')
  [ -n "$d" ] || { echo "no digest in the fixture registry"; return 1; }
  local spec
  for spec in "aa-new 2026-09-01 in" "zz-old 2026-01-01 in" "far-row 2026-09-05 global"; do
    set -- $spec
    printf '%s\n' "  - id: $1" "    slot: probe" "    status: vetted" "    region: $3" "    hosts:" "      - fixture.invalid" \
      "    adapter: providers/probe/$1.mjs" "    digest: $d" "    approved_by: ashiq" "    vetted_by: 01M40ZHP72PYVBJT17R7A4WZ3W" \
      "    scout: tests/launch/fixtures/scout.md" "    last_verified: \"$2\"" >> "$FX_DIR/registry.yaml"
  done
}

@test "launch-cli: plan ranks vetted fitting rows by RANK-1 then RANK-2 and names the fit rule a vetted row failed (ADR-1706)" {
  add_probe_rows
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" plan --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: recommended aa-new -- why: FIT-1 type saas-b2b, FIT-2 region in, FIT-3 payment_model any · status vetted · last_verified 2026-09-01 · ranked by RANK-1 last_verified newest first, RANK-2 row id"* ]] || { echo "$output"; false; }
  [[ "$output" == *"alternatives: zz-old ("*"), fake ("*"far-row (vetted: FIT-2 region global excludes in)"* ]] || { echo "$output"; false; }
}

@test "launch-cli: an override is a request until the owner approves it, and then plan cites the decision id (ADR-1748)" {
  add_probe_rows
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" override probe --venture fx-sandbox --provider zz-old --reason "owner prefers the older row for this fixture" $FX_FLAGS
  [ "$status" -eq 5 ] || { echo "$output"; false; }
  local ask; ask=$(printf '%s\n' "$output" | sed -n 's/.*approval.requested \([0-9A-Z]\{26\}\);.*/\1/p')
  [ -n "$ask" ] || { echo "no request id: $output"; false; }
  run node "$(L)" plan --venture fx-sandbox $FX_FLAGS
  [[ "$output" == *"probe: recommended aa-new"* ]] || { echo "an undecided override was taken: $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/hq/arc-inbox.mjs" approve "$ask" --reason "fixture approval of the override"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(L)" plan --venture fx-sandbox $FX_FLAGS
  [[ "$output" == *"probe: recommended zz-old -- why: owner override, decision "* ]] || { echo "$output"; false; }
}

@test "launch-cli: override refuses a blocked or unknown row and a missing reason, and requests nothing (ADR-1748)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" override probe --venture fx-sandbox --provider nope --reason "a reason long enough" $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"no provider row nope for slot probe"* ]] || { echo "$output"; false; }
  run node "$(L)" override probe --venture fx-sandbox --provider fake $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"--reason must say why"* ]] || { echo "$output"; false; }
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl 2>/dev/null | grep -c '"launch.override"' || true)" -eq 0 ]
}

@test "launch-cli: the weekly watch raises one needs-you line for a regressed slot and none for a slot whose token is not here (REQ-10, ADR-1750)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The forced regression: the provider lost a resource after verify (the expired-cert stand-in for a fake provider).
  node -e 'const fs=require("fs");const f=process.argv[1];fs.writeFileSync(f,JSON.stringify(JSON.parse(fs.readFileSync(f,"utf8")).slice(1)))' "$FAKE_PROVIDER_FILE"
  run node "$(L)" verify --all --public-only --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"1 raised to needs-you"* ]] || { echo "$output"; false; }
  [[ "$output" == *"watch-result failed=1 raised=1"* ]] || { echo "$output"; false; }
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c '"kind":"incident.raised"')" -eq 1 ]
  # The same watch on a box without the slot's token: skipped(env), no new incident, exit 0.
  run env FAKE_NEEDS_KEY=LAUNCH_FIXTURE_ABSENT_KEY node "$(L)" verify --all --public-only --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"probe: skipped(env:LAUNCH_FIXTURE_ABSENT_KEY)"* ]] || { echo "$output"; false; }
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c '"kind":"incident.raised"')" -eq 1 ]
  run node "$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The brief lists each needs-you event by kind: exactly one incident line, from the regression, none from skipped(env).
  [[ "$output" == *"needs-you ("* ]] || { echo "$output"; false; }
  [ "$(printf '%s\n' "$output" | grep -cx '  incident.raised')" -eq 1 ] || { echo "$output"; false; }
  grep '"kind":"incident.raised"' "$ARC_SPINE_ROOT"/events/*.jsonl | grep -q 'launch verify: probe regressed for fx-sandbox'
}

@test "launch-watch: stamps the week only when every board was watched; a future stamp is no stamp (attack 143525f B5, B6)" {
  local sd="$BATS_TEST_TMPDIR/wst" job="$ARC_ROOT/.claude/scripts/hq/jobs/launch-watch.mjs"
  mkdir -p "$sd"
  # A board the runner refuses (not a board at all) is not watched: exit 1, and no stamp, so tomorrow retries.
  printf 'not json' > "$sd/zz-broken.json"
  run env ARC_LAUNCH_STATE_DIR="$sd" node "$job"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"1 not watched, retried next run"* ]] || { echo "$output"; false; }
  [ ! -e "$sd/.watch-last" ] || { echo "stamped after a failed watch"; false; }
  # No boards at all: every board (none) was watched, the week is stamped, and a second run waits.
  rm "$sd/zz-broken.json"
  run env ARC_LAUNCH_STATE_DIR="$sd" node "$job"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"all watched"* ]] || { echo "$output"; false; }
  [ -s "$sd/.watch-last" ] || { echo "no stamp written"; false; }
  run env ARC_LAUNCH_STATE_DIR="$sd" node "$job"
  [[ "$output" == *"next in 7 day(s)"* ]] || { echo "$output"; false; }
  # A stamp in the future would skip for ever: it is read as no stamp, and the watch runs.
  printf '2099-01-01\n' > "$sd/.watch-last"
  run env ARC_LAUNCH_STATE_DIR="$sd" node "$job"
  [[ "$output" == *"all watched"* ]] || { echo "$output"; false; }
}

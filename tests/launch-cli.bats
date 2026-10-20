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

@test "launch-cli: plan on the real registry recommends only vetted rows and REFUSES the rest by name, never a fallback (ADR-1764)" {
  run node "$(L)" new --venture arc-sandbox --state-dir "$BATS_TEST_TMPDIR/st"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(L)" plan --venture arc-sandbox --state-dir "$BATS_TEST_TMPDIR/st"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The owner vetted 32 rows (decision.recorded 01M4YYNSS3H8N5A5HWAG77BM3J); domain and legal-pages hold only candidates.
  # cloudflare-dns awaits its re-vet after F4 (ADR-1719), so dns is REFUSED by name until the owner stamps it.
  [[ "$output" == *"dns: REFUSED -- no vetted provider for dns · candidates: cloudflare-dns (candidate)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"hosting: recommended "*"status vetted"* ]] || { echo "$output"; false; }
  [[ "$output" == *"payment-test: recommended razorpay"*"stripe (blocked: India new-account onboarding"* ]] || { echo "$output"; false; }
  [[ "$output" == *"domain: REFUSED -- no vetted provider for domain · candidates: cloudflare-registrar (candidate), cloudflare-zone (candidate)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"legal-pages: REFUSED -- no vetted provider for legal-pages · candidates: arc-legal (candidate)"* ]] || { echo "$output"; false; }
  # A candidate is never the pick: no line recommends a row whose status is not vetted.
  [ "$(printf '%s
' "$output" | grep -c ': recommended .*status vetted')" -eq "$(printf '%s
' "$output" | grep -c ': recommended ')" ] || { echo "$output"; false; }
  [[ "$output" == *"arc-sandbox: 86 slots · "*" REFUSED (no vetted provider)"* ]] || { echo "$output"; false; }
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

@test "launch-cli: the first attempt verifies on what its scaffold reported, and --again re-applies only a verified, ungated slot (ADR-1760)" {
  export FAKE_VERIFY_RECORDED=1
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply --again probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] && [[ "$output" == *"--again re-applies a verified slot only"* ]] || { echo "$output"; false; }
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] && [[ "$output" == *"probe: verified -- attempt 1,"* ]] || { echo "$output"; false; }
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [[ "$output" == *"verified -- no-op"* ]] || { echo "$output"; false; }
  run node "$(L)" apply probe --again --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] && [[ "$output" == *"probe: verified -- attempt 2,"* ]] || { echo "$output"; false; }
  [ "$(grep -c '"slot":"probe"' "$ARC_SPINE_ROOT"/events/*.jsonl | awk -F: '{s+=$NF} END{print s}')" -eq 2 ] || { cat "$ARC_SPINE_ROOT"/events/*.jsonl; false; }
}

@test "launch-cli: a verify worker that dies after saving ok fails on any exit but the Windows libuv abort (attack 5ce0104 B1, d8f943a B1)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  export FAKE_DIE_AFTER=7
  run node "$(L)" verify probe --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 1 ] && [[ "$output" == *"probe: VERIFY FAILED -- worker saved an answer, then ended with exit 7"* ]] || { echo "$output"; false; }
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      export FAKE_DIE_AFTER=3221226505
      run node "$(L)" verify probe --venture fx-sandbox $FX_FLAGS
      [ "$status" -eq 0 ] && [[ "$output" == *"probe: verified now"* ]] || { echo "$output"; false; } ;;
  esac
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

@test "launch-watch: a board is stamped only when watched, a stamp holds it seven days, a future stamp is no stamp (attack 143525f B5 B6, 530c056 B2)" {
  local sd="$BATS_TEST_TMPDIR/wst" job="$ARC_ROOT/.claude/scripts/hq/jobs/launch-watch.mjs" today
  mkdir -p "$sd"
  today=$(cd "$ARC_ROOT" && node --input-type=module -e 'import { formatIst, dayOf, nowMs } from "./.claude/scripts/hq/lib/canonical.mjs"; console.log(dayOf(formatIst(nowMs())))')
  [[ "$today" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "no day: $today"; false; }
  # A board the runner refuses (not a board at all) is not watched: exit 1, and it gets no stamp, so tomorrow retries it.
  printf 'not json' > "$sd/zz-broken.json"
  run env ARC_LAUNCH_STATE_DIR="$sd" node "$job"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"1 of 1 board(s) due"*"1 not watched, retried next run"* ]] || { echo "$output"; false; }
  [ "$(tr -d '\r\n' < "$sd/.watch-last")" = "{}" ] || { cat "$sd/.watch-last"; false; }
  # A stamp in the future would skip the board for ever: it is read as no stamp, and the board is due again.
  printf '{"zz-broken":"2099-01-01"}' > "$sd/.watch-last"
  run env ARC_LAUNCH_STATE_DIR="$sd" node "$job"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"1 of 1 board(s) due"* ]] || { echo "$output"; false; }
  # A board stamped today waits its seven days: nothing is due, exit 0, and a stamp for a board that is gone is dropped.
  printf '{"zz-broken":"%s","gone":"%s"}' "$today" "$today" > "$sd/.watch-last"
  run env ARC_LAUNCH_STATE_DIR="$sd" node "$job"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 of 1 board(s) due"*"all due boards watched"* ]] || { echo "$output"; false; }
  [ "$(tr -d '\r\n' < "$sd/.watch-last")" = "{\"zz-broken\":\"$today\"}" ] || { cat "$sd/.watch-last"; false; }
}

# ---------- apply --next / --all (ADR-1767): core slots in DAG order, stopping on every non-zero exit ----------

# The walk fixture adds `rowless` (core, no row), `ghost` (required) and `orphan` (core, depends on ghost) at the end,
# and a `real` venture. Its own dir, so the default fixture's tests are untouched.
walk_fx() {
  local out; out=$(FX_WALK=1 node "$ARC_ROOT/tests/launch/make-fixture.mjs" "$BATS_TEST_TMPDIR/wfx") || { echo "walk fixture failed"; return 1; }
  eval "$out"
  grep -q 'id: orphan' "$FX_DIR/catalog.yaml" && [ -s "$FX_DIR/ventures/fx-real.venture.yaml" ] || { echo "walk fixture empty"; return 1; }
}
walk_set() { node "$ARC_ROOT/tests/launch/walk-state.mjs" "$FX_STATE_DIR" "$@" >/dev/null || { echo "walk-state failed"; return 1; }; }
spine_slot() { cat "$ARC_SPINE_ROOT"/events/*.jsonl 2>/dev/null | grep "\"kind\":\"$1\"" | grep -c "\"slot\":\"$2\"" || true; }
EARLY="probe=verified slow=verified after-probe=verified gated=verified live-money=verified sens=verified"

@test "launch-cli: apply --all walks the fake board in DAG order and stops at the first gate with exit 5" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 5 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at gated: exit 5 gated: gate-2 -- approval.requested "* ]] || { echo "$output"; false; }
  # F5: each slot is named before it runs, with its provider, and the walk ends on one summary line.
  [[ "$output" == *"→ ["*"] applying probe via fake"* ]] || { echo "$output"; false; }
  [[ "$output" == *"→ ["*"] applying gated via fake"* ]] || { echo "$output"; false; }
  [[ "$output" == *"walk summary: "*" verified · 3 applied · "*" skipped · stopped at gated"* ]] || { echo "$output"; false; }
  [ "$(slot_field probe state) $(slot_field slow state) $(slot_field after-probe state)" = "verified verified verified" ] || { echo "$output"; false; }
  [ "$(spine_slot approval.requested gated)" -eq 1 ]
  # A second walk meets the same gate and asks the owner nothing new.
  run node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 5 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at gated: exit 5 "* ]] || { echo "$output"; false; }
  [ "$(spine_slot approval.requested gated)" -eq 1 ]
}

@test "launch-cli: apply --all retries a failed slot once, at once, then stops at it with exit 1" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  export FAKE_SLEEP_MS=4000
  run node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  unset FAKE_SLEEP_MS
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at slow: exit 1 "* ]] || { echo "$output"; false; }
  [ "$(slot_field probe state)" = "verified" ] || { echo "$output"; false; }
  [ "$(slot_field slow state)" = "failed" ]
  [ "$(slot_field slow attempt)" -eq 2 ]
}

@test "launch-cli: apply --all stops with exit 2 at a core slot with no provider and never walks past it" {
  walk_fx
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  walk_set fx-sandbox $EARLY
  run node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at rowless: exit 2 REFUSED -- no vetted provider for rowless"* ]] || { echo "$output"; false; }
  [ "$(slot_field orphan state)" = "pending" ]
}

@test "launch-cli: apply --all stops with exit 4 on an unmet dependency and never walks a required slot" {
  walk_fx
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  walk_set fx-sandbox $EARLY rowless=verified
  run node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at orphan: exit 4 orphan: waiting on ghost"* ]] || { echo "$output"; false; }
  [ "$(slot_field ghost state)" = "pending" ]
}

@test "launch-cli: apply --all stops with exit 3 while another apply holds the lock" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  ( FAKE_HOLD_MS=6000 node "$(L)" apply probe --venture fx-sandbox $FX_FLAGS > "$BATS_TEST_TMPDIR/a.out" 2>&1; echo "A_RC=$?" >> "$BATS_TEST_TMPDIR/a.out" ) &
  local i; for i in $(seq 1 100); do grep -q FAKE_HOLDING "$BATS_TEST_TMPDIR/a.out" 2>/dev/null && break; sleep 0.1; done
  grep -q FAKE_HOLDING "$BATS_TEST_TMPDIR/a.out" || { echo "holder never started"; cat "$BATS_TEST_TMPDIR/a.out"; false; }
  run node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  wait
  [ "$status" -eq 3 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at probe: exit 3 another apply holds fx-sandbox's lock"* ]] || { echo "$output"; false; }
  grep -q "A_RC=0" "$BATS_TEST_TMPDIR/a.out" || { cat "$BATS_TEST_TMPDIR/a.out"; false; }
}

@test "launch-cli: an absent slot is passed over on a rehearsal and stops a real venture with exit 2" {
  walk_fx
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" new --venture fx-real $FX_FLAGS
  walk_set fx-sandbox probe=absent
  walk_set fx-real probe=absent
  run node "$(L)" apply --next --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"walk complete: 1 applied, 1 skipped"* ]] || { echo "$output"; false; }
  [ "$(slot_field slow state)" = "verified" ] || { echo "$output"; false; }
  run node "$(L)" apply --all --venture fx-real $FX_FLAGS
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at probe: exit 2 absent on real"* ]] || { echo "$output"; false; }
}

@test "launch-cli: a walk over a green board applies nothing and counts the skipped slots" {
  walk_fx
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  walk_set fx-sandbox $EARLY rowless=verified orphan=verified
  run node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"walk complete: 0 applied, 1 skipped"* ]] || { echo "$output"; false; }
  # F5: every slot passed over gets its own line, nothing is announced as applying, and the summary closes the walk.
  [[ "$output" == *"· ["*"] probe: verified -- passed over"* ]] || { echo "$output"; false; }
  [[ "$output" == *"· ["*"] rowless: verified -- passed over"* ]] || { echo "$output"; false; }
  [[ "$output" != *"applying"* ]] || { echo "$output"; false; }
  [[ "$output" == *"walk summary: "*" verified · 0 applied · 1 skipped · stopped at none"* ]] || { echo "$output"; false; }
}

@test "launch-cli: apply refuses --again with a walk, a SLOT with a walk, and --next with --all" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run node "$(L)" apply --all --again --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] && [[ "$output" == *"--again takes one SLOT"* ]] || { echo "$output"; false; }
  run node "$(L)" apply probe --next --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] && [[ "$output" == *"apply takes a SLOT or --next/--all, not both"* ]] || { echo "$output"; false; }
  run node "$(L)" apply --next --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 2 ] && [[ "$output" == *"apply takes --next or --all, not both"* ]] || { echo "$output"; false; }
  [ "$(slot_field probe state)" = "pending" ]
}

@test "launch-cli: apply --all stops with exit 4 at a slot whose provider is still building (REQ-18)" {
  run node "$(L)" new --venture fx-sandbox $FX_FLAGS
  run env FAKE_PENDING="build: deployment dpl_x is BUILDING" node "$(L)" apply --all --venture fx-sandbox $FX_FLAGS
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  [[ "$output" == *"stopped at probe: exit 4 probe: pending (PENDING(build: deployment dpl_x is BUILDING))"* ]] || { echo "$output"; false; }
  [ "$(slot_field probe state)" = "pending" ]
}

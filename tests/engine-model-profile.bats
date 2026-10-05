#!/usr/bin/env bats
# model-policy v2, Phase 00 (REQ-01..03; ADR-1800, ADR-1801, ADR-1802) -- provider profiles.
#
# A generic-api pin may name a PROFILE from the owner store: the gateway URL, the key and the model id together. These
# tests observe what the GATEWAY received, through a recording listener the probe runs beside arc-run, because every
# claim here is about which key and which model reached a provider -- and a receipt is written by the code under test,
# so a suite that only read receipts would be asking the accused to testify (engine-model-seam.bats, same doctrine).
#
# Every ambient ARC_LLM_* value and ARC_DRIVER_MODEL is set to a DECOY in each run, so "the profile's values arrived"
# cannot be satisfied by the shell happening to hold the right ones.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup_file() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  export PF_ROOT="$BATS_FILE_TMPDIR/pf"
  _arc_runtime_grant_root "$PF_ROOT" "$ARC_ROOT"
}

setup() { export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"; mkdir -p "$ARC_SPINE_ROOT"; }

PROBE() { node "$ARC_ROOT/tests/engine-model-profile-probe.mjs" "$1" "$PF_ROOT" "$BATS_TEST_TMPDIR/scratch"; }
READ()  { node "$ARC_ROOT/tests/fixtures/engine/read-receipt.mjs" "$ARC_SPINE_ROOT" "$@"; }
VAL()   { printf '%s\n' "$output" | grep -m1 "^$1=" | cut -d= -f2-; }

# ---------------------------------------------------------------------------
# REQ-03: load faults
# ---------------------------------------------------------------------------

@test "profile: the load refuses each inert or malformed profile, and the controls load" {
  run PROBE faults
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN"* ]] || { echo "the probe did not finish: $output"; false; }
  for k in BAD_GRAMMAR UNREACHABLE WRONG_DRIVER BARE NOT_STRING; do
    [ "$(VAL "$k")" -ge 1 ] || { echo "$k loaded with no fault: $output"; false; }
  done
  [[ "$(VAL UNREACHABLE_MSG)" == *"never reaches"* ]] || { echo "$output"; false; }
  [[ "$(VAL WRONG_DRIVER_MSG)" == *"generic-api"* ]] || { echo "$output"; false; }
  [ "$(VAL FALLBACK_OK)" = "0" ] || { echo "a profile reachable through the fallback was refused: $output"; false; }
  [ "$(VAL PIN_OK)" = "0" ] || { echo "a generic-api profile pin was refused: $output"; false; }
  [ "$(VAL REAL_PARSED)" = "1" ] || { echo "$output"; false; }
  [ "$(VAL REAL_FAULTS)" = "0" ] || { echo "the real engine/router.yaml no longer loads: $output"; false; }
}

# ---------------------------------------------------------------------------
# REQ-01: the tier pin reaches the gateway with the profile's key and model
# ---------------------------------------------------------------------------

@test "profile: a tier pin sends the profile key and model to the profile gateway, not the decoys" {
  run PROBE tier-pin
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL REQUESTS)" = "1" ] || { echo "the gateway saw no request (or a retry): $output"; false; }
  [ "$(VAL REQ0_PATH)" = "/v1/chat/completions" ] || { echo "$output"; false; }
  [ "$(VAL REQ0_BEARER)" = "KEY_FX" ] || { echo "the gateway got the wrong key: $output"; false; }
  [ "$(VAL REQ0_MODEL)" = "vendor/model-fx" ] || { echo "the gateway got the wrong model: $output"; false; }
}

@test "profile: the receipt says profile, names the model, the profile and the gateway host" {
  run PROBE tier-pin
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  port="$(VAL PORT)"
  [ "$(READ payload model_source)" = "profile" ] || { echo "source=$(READ payload model_source)"; false; }
  [ "$(READ seat)" = "vendor/model-fx" ] || { echo "seat=$(READ seat)"; false; }
  [ "$(READ payload profile)" = "fx" ] || { echo "profile=$(READ payload profile)"; false; }
  [ "$(READ payload gateway_host)" = "127.0.0.1:$port" ] || { echo "host=$(READ payload gateway_host)"; false; }
}

@test "profile: the key is in no output and no receipt" {
  run PROBE tier-pin
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  # Positive first: the run reached the gateway, so silence below is not a run that never happened.
  [ "$(VAL REQ0_BEARER)" = "KEY_FX" ] || { echo "$output"; false; }
  [ "$(VAL KEY_IN_OUTPUT)" = "0" ] || { echo "the key appeared in arc-run output"; false; }
  [ "$(VAL KEY_IN_SPINE)" = "0" ] || { echo "the key appeared on the spine"; false; }
}

# ---------------------------------------------------------------------------
# REQ-02: a class profile, and the hop
# ---------------------------------------------------------------------------

@test "profile: a class profile beats the tier pin" {
  run PROBE class-override
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL REQ0_BEARER)" = "KEY_FY" ] || { echo "$output"; false; }
  [ "$(VAL REQ0_MODEL)" = "vendor/model-fy" ] || { echo "$output"; false; }
  [ "$(READ payload profile)" = "fy" ] || { echo "profile=$(READ payload profile)"; false; }
}

@test "profile: claude-code runs the tier pin first, and the generic-api hop runs the class profile" {
  run PROBE hop
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [[ "$(VAL CLI_RAN)" == *"sonnet"* ]] || { echo "attempt 1 did not run claude-code on the tier pin: $output"; false; }
  [ "$(VAL REQUESTS)" = "1" ] || { echo "the hop never reached the gateway: $output"; false; }
  [ "$(VAL REQ0_BEARER)" = "KEY_FY" ] || { echo "$output"; false; }
  [ "$(VAL REQ0_MODEL)" = "vendor/model-fy" ] || { echo "$output"; false; }
  [ "$(READ payload model_source)" = "profile" ] || { echo "source=$(READ payload model_source)"; false; }
}

# ---------------------------------------------------------------------------
# REQ-03: refusals before any driver starts, never an ambient fall-back
# ---------------------------------------------------------------------------

@test "profile: a profile the store lacks refuses before claude-code starts, with no receipt" {
  run PROBE gone
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL EXIT)" = "2" ] || { echo "expected exit 2: $output"; false; }
  [[ "$output" == *"profile \`gone\`"* ]] || { echo "the refusal does not name the profile: $output"; false; }
  [[ "$output" == *"models.json"* ]] || { echo "the refusal does not name the store: $output"; false; }
  [ "$(VAL CLI_RAN)" = "no" ] || { echo "claude-code started before the refusal: $output"; false; }
  [ "$(VAL REQUESTS)" = "0" ] || { echo "$output"; false; }
  [ "$(READ payload model)" = "NO-RECEIPT" ] || { echo "a receipt was written despite the refusal"; false; }
}

@test "profile: with no store at all it refuses, and the ambient endpoint is never used" {
  run PROBE no-store
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL EXIT)" = "2" ] || { echo "expected exit 2: $output"; false; }
  # The ambient endpoint in this case IS the listener, so a fall-back would have been recorded.
  [ "$(VAL REQUESTS)" = "0" ] || { echo "the run fell back to the ambient environment: $output"; false; }
  [[ "$output" == *"no ambient ARC_LLM_"* ]] || { echo "$output"; false; }
}

@test "profile: a store inside the run root is refused" {
  run PROBE store-in-root
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL EXIT)" = "2" ] || { echo "expected exit 2: $output"; false; }
  [[ "$output" == *"inside the repo"* ]] || { echo "$output"; false; }
  [ "$(VAL REQUESTS)" = "0" ] || { echo "$output"; false; }
}

@test "profile: a store record with remote plain http is refused" {
  run PROBE remote-http
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL EXIT)" = "2" ] || { echo "expected exit 2: $output"; false; }
  [[ "$output" == *"plain http"* ]] || { echo "$output"; false; }
}

@test "profile: a profile is matched without case, and the receipt carries the stored name" {
  run PROBE case-fold
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL REQ0_BEARER)" = "KEY_FX" ] || { echo "$output"; false; }
  [ "$(READ payload profile)" = "fx" ] || { echo "profile=$(READ payload profile)"; false; }
}

# ---------------------------------------------------------------------------
# The named driver is unchanged, and the preview tells the truth
# ---------------------------------------------------------------------------

@test "profile: a NAMED driver ignores profiles and runs on the ambient key as before" {
  run PROBE named-driver
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL REQUESTS)" = "1" ] || { echo "$output"; false; }
  [ "$(VAL REQ0_BEARER)" = "DECOY" ] || { echo "a named driver picked up a profile: $output"; false; }
  [ "$(VAL REQ0_MODEL)" = "vendor/trial-model" ] || { echo "$output"; false; }
  [ "$(READ payload model_source)" = "trial" ] || { echo "source=$(READ payload model_source)"; false; }
}

@test "profile: --dry-run names the profile and the gateway host" {
  run PROBE dry-run
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL EXIT)" = "0" ] || { echo "$output"; false; }
  [[ "$output" == *"source: profile, profile fx @ 127.0.0.1:$(VAL PORT)"* ]] || { echo "$output"; false; }
  [ "$(VAL REQUESTS)" = "0" ] || { echo "a dry run reached the gateway: $output"; false; }
}

@test "profile: --dry-run with the profile missing says it would refuse, with the refusal exit" {
  # attack d63004e B3: the preview is where a caller learns the profile is not on this machine.
  run PROBE dry-run-missing
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL EXIT)" = "2" ] || { echo "$output"; false; }
  [[ "$output" == *"would REFUSE"*"profile"*"fx"*"not usable on this machine"* ]] || { echo "$output"; false; }
}

@test "profile: a corrupt store refuses without printing any of its content" {
  # attack d63004e B1: the store holds keys, and stderr reaches transcripts and CI logs.
  run PROBE corrupt-store
  [[ "$output" == *"RAN"* ]] || { echo "$output"; false; }
  [ "$(VAL EXIT)" = "2" ] || { echo "$output"; false; }
  [[ "$output" == *"store could not be used"* ]] || { echo "$output"; false; }
  [ "$(VAL KEY_IN_OUTPUT)" = "0" ] || { echo "the store's key was printed"; false; }
  [ "$(VAL REQUESTS)" = "0" ] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# REQ-04 (Phase 01): the model-policy room
# ---------------------------------------------------------------------------

@test "profile: the model-policy room serves and draws profile, model and host, never the key" {
  run node "$ARC_ROOT/tests/engine-model-profile-room.mjs"
  [[ "$output" == *"RAN "*" checks, 0 failed"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------

@test "suite: all 17 tests are REGISTERED and none is skipped" {
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "17" ] || { echo "expected 17 REGISTERED, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but registered $registered"; false; }
  run grep -c "^[[:space:]]*skip" "$BATS_TEST_FILENAME"
  [ "$output" = "0" ] || { echo "a test in this file is skipped"; false; }
}

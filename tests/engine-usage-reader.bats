#!/usr/bin/env bats
# engine-usage-reader.bats -- the usage-report reader in drivers/hermes.mjs, EXECUTED.
#
# WHY THIS FILE EXISTS AT ALL. `hermes --usage-file PATH` is vendor-documented and writes nothing
# at the pinned digest (ADR-0221; the no-op itself is pinned by tests/engine-usage-flag-probe.mjs).
# So the reader would otherwise ship as a branch nothing had ever run -- a comment claiming a
# mechanism works, with a green suite that never reached it. That is the vacuous pass this repo
# keeps paying for, three times in Cycle 6 alone. These tests make the branch execute.
#
# WHAT IS SUBSTITUTED AND WHAT IS NOT. Only the docker binary, via ARC_HERMES_DOCKER pointed at
# tests/fixtures/engine/hermes/fake-docker.mjs. Everything above it is the real path: the real
# argv the driver builds, the real spawn, the real capture, the real usage read, the real
# MODEL_RE check, the real sidecar write. ARC_DRIVER_FAKE is deliberately NOT used -- it
# short-circuits common.mjs before produce() runs, which would prove nothing about any of this.
#
# THE FIXTURE TAKES THE PATH FROM THE DRIVER'S OWN ARGV rather than recomputing it. A fixture that
# derives its own idea of where the report goes proves the fixture and the test agree; it does not
# prove the driver asked for the right file.

load test_helper

setup() {
  DRIVER="$BATS_TEST_DIRNAME/../.claude/scripts/engine/drivers/hermes.mjs"
  FAKE="$BATS_TEST_DIRNAME/fixtures/engine/hermes/fake-docker.mjs"
  WORK="$(mktemp -d)"
  mkdir -p "$WORK/data"
  COST="$WORK/cost.json"
  export ARC_HERMES_DOCKER="$FAKE"
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$WORK/data"
  export ARC_DRIVER_COST_FILE="$COST"
  # An operator override would suppress the flag entirely (the driver cannot map a host path into
  # the container), so it is explicitly cleared -- an ambient value would silently skip every
  # assertion below while the suite stayed green.
  export ARC_HERMES_USAGE_FILE=""
}

teardown() {
  rm -rf "$WORK"
}

run_driver() {
  export ARC_HERMES_FAKE_CASE="$1"
  run node "$DRIVER" run demo '{"q":1}' min=5
}

@test "REQ-03: a usage report carrying a clean model id fills the seat and the tokens are measured" {
  run_driver usage-report
  [ "$status" -eq 0 ]
  # THE RUN RAN. Asserted before anything is asserted about what it printed: a driver that died
  # early also writes no sidecar, and "no bad value appeared" is satisfied by a crash.
  [[ "$output" == *'"ok":true'* ]]

  [ -f "$COST" ]
  run cat "$COST"
  [[ "$output" == *'"model":"llama3.1:8b"'* ]]
  [[ "$output" == *'"tokens_in":1234'* ]]
  [[ "$output" == *'"tokens_out":567'* ]]
  [[ "$output" == *'"source":"measured"'* ]]
  [[ "$output" == *'"runtime":"hermes@sha256:'* ]]
}

@test "REQ-05: the report's ESTIMATED cost never reaches a cost field" {
  run_driver usage-report
  [ "$status" -eq 0 ]
  [ -f "$COST" ]
  run cat "$COST"
  # The fixture puts `estimated_cost_usd: 0.0123` in every report precisely so this can fail.
  # REQ-05 says cost is provider-reported or absent, and a runtime's own estimate is neither.
  [[ "$output" != *"0.0123"* ]]
  [[ "$output" != *"estimated"* ]]
  [[ "$output" != *'"inr"'* ]]
}

@test "ADR-0221: a model id the spine grammar refuses is DROPPED, loudly, and the run still succeeds" {
  run_driver usage-report-bad-model
  # A seat value that would quarantine costs one field; a quarantined receipt costs the whole
  # receipt. This lane has already paid the second price once.
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  [ -f "$COST" ]
  run cat "$COST"
  [[ "$output" != *"sha256:deadbeef"* ]]
  [[ "$output" != *'"model":'* ]]
  # Tokens survive the rejected model: two facts, two keys, and one being unusable does not
  # discard the other.
  [[ "$output" == *'"tokens_in":1234'* ]]
}

@test "ADR-0221: the bad model id is reported on stderr rather than dropped in silence" {
  export ARC_HERMES_FAKE_CASE=usage-report-bad-model
  run bash -c "node '$DRIVER' run demo '{\"q\":1}' min=5 2>&1 1>/dev/null"
  [[ "$output" == *"model id the spine grammar refuses"* ]]
}

@test "ADR-0221: an empty model and an absent model are both handled, and neither invents a seat" {
  run_driver usage-report-no-model
  [ "$status" -eq 0 ]
  run cat "$COST"
  [[ "$output" != *'"model":'* ]]
  [[ "$output" == *'"tokens_in":1234'* ]]

  # Absent is a DIFFERENT INPUT from empty. A reader that only checks truthiness cannot tell them
  # apart, and "missing" vs "present but empty" is this cycle's recorded guard-that-cannot-fail.
  run_driver usage-report-tokens-only
  [ "$status" -eq 0 ]
  run cat "$COST"
  [[ "$output" != *'"model":'* ]]
  [[ "$output" == *'"tokens_out":567'* ]]
}

@test "ADR-0221 negative control: no usage report means no sidecar, and the run does not fail" {
  # This is the state the REAL runtime is in today. If this test ever fails, the fail-safe that
  # keeps hermes runs working while the vendor flag is a no-op has broken.
  run_driver clean
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  [ ! -f "$COST" ]
}

@test "ADR-0221: the report is deleted after it is read, so run N+1 cannot inherit run N's figures" {
  run_driver usage-report
  [ "$status" -eq 0 ]
  run bash -c "ls '$WORK/data' | grep -c usage || true"
  [ "$output" = "0" ]
}

@test "ADR-0221: the vendor no-op probe runs, and its SKIP is loud rather than a silent pass" {
  # THIS IS THE TRIPWIRE, AND IT IS WIRED HERE BECAUSE AN UNCALLED PROBE IS NOT A TRIPWIRE.
  # engine-usage-flag-probe.mjs asserts that `hermes --usage-file` still writes nothing. On a CI
  # runner with no Docker and no image it SKIPs -- deliberately, and saying why -- so this test
  # asserts only that the probe reached a verdict and printed one. On a machine that HAS the image
  # (the dogfood box, where the hire actually runs) it runs for real and goes red the day the
  # vendor implements the flag, which is good news and is documented as such in ADR-0221.
  #
  # The probe is given no fake docker: pointing it at the stand-in would make it assert the
  # fixture's behaviour instead of the vendor's, which is the exact substitution that made
  # bench-steel-probe.mjs outlive its own conclusion.
  ARC_HERMES_DOCKER= ARC_HERMES_IMAGE= run node "$BATS_TEST_DIRNAME/engine-usage-flag-probe.mjs"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIP engine-usage-flag-probe -- "* || "$output" == *"ok 2 - --usage-file wrote nothing"* ]]
}

@test "ADR-0221: the driver actually passes --usage-file inside the mount, or the fixture refuses" {
  # The fixture exits 65/66/67 when the flag is missing, the mount is missing, or the requested
  # path lies outside the mount. So a driver that stopped passing the flag turns this red rather
  # than quietly reverting to no-cost-ever -- which is indistinguishable from today's real runtime.
  run_driver usage-report
  [ "$status" -eq 0 ]
  [ -f "$COST" ]
}

#!/usr/bin/env bats
# engine-hermes-egress.bats -- Phase 06 fixture 7: the runtime's way out carries an allowlist.
#
# WHAT IS ASSERTED HERE AND WHAT IS NOT. These tests assert the ARGV the driver builds, using the
# fake-docker argv recorder. They do NOT prove that traffic is actually confined -- that was
# measured against real containers and is written up in
# `initiatives/engine/evidence/phase-06/fixtures-1-4-6-7-confinement.md`:
#
#   proxy (internal + bridge) -> https://example.com          200
#   client (internal only)    -> https://example.com          BLOCKED
#   client via proxy          -> allowlisted openrouter.ai    200
#   client via proxy          -> example.com                  DENY, logged
#
# The split is deliberate. A CI runner has no Docker and no image, so a suite that tried to prove
# confinement here would SKIP on every leg and be a green tick nobody earned -- the defect this
# cycle already shipped once in engine-usage-reader.bats. What CI can prove is that the driver asks
# for the confinement, every time, and stops asking loudly if someone deletes the code.

bats_require_minimum_version 1.5.0

load test_helper

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  DRIVER="$ARC_ROOT/.claude/scripts/engine/drivers/hermes.mjs"
  WORK="$BATS_TEST_TMPDIR/w"
  mkdir -p "$WORK/data"
  ARGV="$WORK/argv.jsonl"
  export ARC_HERMES_DOCKER="$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"
  export ARC_HERMES_FAKE_ARGV_FILE="$ARGV"
  export ARC_HERMES_FAKE_CASE=clean
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$WORK/data"
  export ARC_DRIVER_COST_FILE="$WORK/cost.json"
  export ARC_HERMES_USAGE_FILE=""
  export ARC_HERMES_NETWORK=""
  export ARC_HERMES_PROXY=""
}

run_driver() {
  run --separate-stderr node "$DRIVER" run demo '{"q":1}' min=5
}

@test "fixture 7: with a network configured the driver joins it, every run" {
  export ARC_HERMES_NETWORK=arc-egress
  run_driver
  [ "$status" -eq 0 ]
  # ASSERT IT RAN before asserting what it asked for -- a driver that died early also records no argv.
  [[ "$output" == *'"ok":true'* ]]
  run cat "$ARGV"
  [[ "$output" == *'"--network","arc-egress"'* ]]
}

@test "fixture 7: with a proxy configured the driver hands it to the container in both spellings" {
  export ARC_HERMES_NETWORK=arc-egress
  export ARC_HERMES_PROXY=http://arc-eproxy:3128
  run_driver
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  run cat "$ARGV"
  # Both cases, because curl and requests read the lowercase pair and some SDKs read the uppercase.
  # A single spelling is a guard that passes for whichever client happens to be used first.
  [[ "$output" == *'"HTTPS_PROXY=http://arc-eproxy:3128"'* ]]
  [[ "$output" == *'"https_proxy=http://arc-eproxy:3128"'* ]]
  [[ "$output" == *'"NO_PROXY=localhost,127.0.0.1"'* ]]
}

@test "fixture 7 NEGATIVE CONTROL: with nothing configured the driver asks for no network at all" {
  # The check is not simply always-on, AND this pins the honest weakness: unconfigured means
  # UNCONFINED. It is asserted rather than left implicit so that nobody reads the two tests above
  # as "egress is confined" when the variables are unset.
  run_driver
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  run cat "$ARGV"
  [[ "$output" != *"--network"* ]]
  [[ "$output" != *"HTTPS_PROXY"* ]]
}

@test "fixture 7: a proxy without a network is NOT silently honoured" {
  # A proxy variable alone would put the container on default networking with a proxy it can simply
  # ignore -- unrestricted egress wearing the appearance of a control. The network is what removes
  # the route; the proxy is only what replaces it.
  export ARC_HERMES_PROXY=http://arc-eproxy:3128
  run_driver
  [ "$status" -eq 0 ]
  run cat "$ARGV"
  [[ "$output" != *"HTTPS_PROXY"* ]]
}

@test "fixture 7: the image is still the LAST argument before the runtime's own flags" {
  # The egress flags are inserted before IMAGE. If they landed after it, docker would pass them to
  # the runtime as arguments instead of applying them -- the container would start unconfined and
  # the runtime would choke on an unknown flag, or worse, not choke.
  export ARC_HERMES_NETWORK=arc-egress
  run_driver
  [ "$status" -eq 0 ]
  run node -e '
    const fs = require("fs");
    const argv = JSON.parse(fs.readFileSync(process.argv[1], "utf8").trim().split("\n").pop());
    const img = argv.findIndex((a) => a.startsWith("nousresearch/"));
    if (img < 0) { console.log("NO IMAGE IN ARGV"); process.exit(1); }
    // Every DOCKER flag must sit before the image; everything after it belongs to the runtime.
    const dockerFlags = ["--network", "-v", "--rm", "--name", "-e"];
    const misplaced = dockerFlags.filter((f) => {
      const i = argv.indexOf(f);
      return i >= 0 && i > img;
    });
    // And what follows the image must be the runtime own flags, never a docker one.
    const after = argv.slice(img + 1);
    console.log(JSON.stringify({ misplaced, firstAfterImage: after[0] || null }));
    process.exit(misplaced.length === 0 ? 0 : 1);
  ' "$ARGV"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"misplaced":[]'* ]]
  # `--usage-file` is the runtime's flag and is expected first; `-z` follows it. Either is fine,
  # a docker flag is not.
  [[ "$output" == *'"firstAfterImage":"--usage-file"'* || "$output" == *'"firstAfterImage":"-z"'* ]]
}

@test "suite: all 6 tests in this file are REGISTERED" {
  run grep -c "^@test" "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$output" = "6" ]
}

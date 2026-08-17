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
#
# REWRITTEN 2026-08-17 AFTER TWO ADVERSARIAL SURFACES ATTACKED IT. The previous version of this file
# PINNED THE BUG AS CORRECT: its test "a proxy without a network is NOT silently honoured" asserted
# `status -eq 0`, which is precisely the silent-honouring it names. Four more of its assertions
# could not fail. Each fix below says which.
#
# EVERY RUN GOES THROUGH `drivers/hermes.sh`, the entry point ADR-0203 actually specifies, and not
# `node hermes.mjs`. Both new suites called Node directly, so the wrapper -- where an adversarial
# pass then PROVED a CDPATH defect that breaks every dispatch -- was a path no test exercised.

bats_require_minimum_version 1.5.0

load test_helper

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  DRIVER="$ARC_ROOT/.claude/scripts/engine/drivers/hermes.sh"
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
  run --separate-stderr bash "$DRIVER" run demo '{"q":1}' min=5
}

# THE ARGV FILE IS ASSERTED NON-EMPTY BEFORE IT IS READ. Four sites used `run cat "$ARGV"` with the
# exit status unchecked, and two of those tests asserted only `!=` -- which a `cat: No such file`
# error string satisfies perfectly. Misspell the recorder env var and the whole file went green.
# engine-hermes-contract.bats already did this correctly; this suite dropped it. Twin-fix miss.
read_argv() {
  [ -s "$ARGV" ] || { echo "the fixture recorded no invocation at all"; false; }
  run cat "$ARGV"
  [ "$status" -eq 0 ]
}

@test "fixture 7: with a network configured the driver joins it, every run" {
  export ARC_HERMES_NETWORK=arc-egress
  run_driver
  [ "$status" -eq 0 ]
  # ASSERT IT RAN before asserting what it asked for -- a driver that died early also records no argv.
  [[ "$output" == *'"ok":true'* ]]
  read_argv
  [[ "$output" == *'"--network","arc-egress"'* ]]
}

@test "fixture 7: a proxy reaches the container in ALL SIX spellings, not three" {
  export ARC_HERMES_NETWORK=arc-egress
  export ARC_HERMES_PROXY=http://arc-eproxy:3128
  run_driver
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  read_argv
  # The old test asserted three of the seven rows, so deleting HTTP_PROXY, http_proxy and no_proxy
  # was a green mutant -- and its own comment said why that is wrong ("a single spelling is a guard
  # that passes for whichever client happens to be used first"), applying verbatim to itself.
  [[ "$output" == *'"HTTPS_PROXY=http://arc-eproxy:3128"'* ]]
  [[ "$output" == *'"https_proxy=http://arc-eproxy:3128"'* ]]
  [[ "$output" == *'"HTTP_PROXY=http://arc-eproxy:3128"'* ]]
  [[ "$output" == *'"http_proxy=http://arc-eproxy:3128"'* ]]
  [[ "$output" == *'"NO_PROXY=localhost,127.0.0.1"'* ]]
  [[ "$output" == *'"no_proxy=localhost,127.0.0.1"'* ]]
}

@test "fixture 7 NEGATIVE CONTROL: unconfigured means UNCONFINED, and the transcript SAYS so" {
  # The check is not simply always-on, AND this pins the honest weakness: unconfigured means
  # UNCONFINED. It is asserted rather than left implicit so that nobody reads the tests above as
  # "egress is confined" when the variables are unset.
  #
  # The stderr assertion is new. An adversarial pass found that NO artifact anywhere recorded which
  # egress mode ran -- the version string was byte-identical for a confined and an unconfined
  # dispatch -- so "an unconfined dispatch is visible rather than assumed" was false when written.
  run_driver
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  [[ "$stderr" == *"egress mode UNCONFINED"* ]]
  read_argv
  [[ "$output" != *"--network"* ]]
  [[ "$output" != *"HTTPS_PROXY"* ]]
}

@test "fixture 7: a proxy without a network is REFUSED, not silently dropped" {
  # A proxy variable alone puts the container on default networking with a proxy it can simply
  # ignore -- unrestricted egress wearing the appearance of a control.
  #
  # THIS TEST USED TO ASSERT `status -eq 0`. It was titled "is NOT silently honoured" and it pinned
  # the silent honouring: the driver dropped the proxy, ran unconfined, exited 0, and said nothing
  # on any stream, while .env.example promised "the driver refuses that combination". Both
  # adversarial surfaces proved it independently.
  export ARC_HERMES_PROXY=http://arc-eproxy:3128
  run_driver
  [ "$status" -ne 0 ]
  [[ "$stderr" == *"ARC_HERMES_PROXY is set but ARC_HERMES_NETWORK is not"* ]]
}

@test "fixture 7: --network host is REFUSED -- it removes the confinement it appears to configure" {
  # PROVED by both attackers: `host` was accepted verbatim and handed the container the HOST network
  # namespace -- unrestricted egress plus every host-local service -- while every line of code, test
  # and evidence said "confined". It is the value most likely to be typed while debugging.
  export ARC_HERMES_NETWORK=host
  run_driver
  [ "$status" -ne 0 ]
  [[ "$stderr" == *"reserved docker network mode"* ]]
}

@test "fixture 7: every reserved network mode is refused, not just the one that was reported" {
  # A fix applied only to the reported value is this lane's most-repeated defect. `none`, `bridge`,
  # `default` and `container:NAME` are the same class as `host`, and a case-different spelling must
  # not walk past the check.
  for mode in none bridge default HOST Bridge "container:victim"; do
    export ARC_HERMES_NETWORK="$mode"
    run_driver
    [ "$status" -ne 0 ] || { echo "ARC_HERMES_NETWORK=$mode was ACCEPTED"; false; }
  done
}

@test "fixture 7: the image is still the LAST argument before the runtime's own flags" {
  # The egress flags are inserted before IMAGE. If they landed after it, docker would pass them to
  # the runtime as arguments instead of applying them -- the container would start unconfined and
  # the runtime would choke on an unknown flag, or worse, not choke.
  export ARC_HERMES_NETWORK=arc-egress
  run_driver
  [ "$status" -eq 0 ]
  [ -s "$ARGV" ] || { echo "the fixture recorded no invocation at all"; false; }
  # FIXED: the probe used `indexOf`, which returns only the FIRST occurrence -- so a flag appended
  # AFTER the image was invisible whenever the same flag also appeared legally before it, and an
  # ABSENT flag (indexOf -1) was scored as "not misplaced". Presence is now asserted separately
  # from position, and position uses the LAST occurrence.
  run node "$ARC_ROOT/tests/fixtures/engine/hermes/argv-order-probe.mjs" "$ARGV"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"misplaced":[]'* ]]
  [[ "$output" == *'"absent":[]'* ]]
  [[ "$output" == *'"firstAfterImage":"--usage-file"'* || "$output" == *'"firstAfterImage":"-z"'* ]]
  [[ "$output" == "ARGV-ORDER-PROBE-DONE"* || "$output" == *"ARGV-ORDER-PROBE-DONE"* ]]
}

@test "fixture 7: a network-configured run carries NO dangerous docker flag" {
  # The dangerous-flag guard lived only in engine-hermes-contract.bats, whose helper never sets
  # ARC_HERMES_NETWORK -- so a mutant adding `--privileged` inside the egress branch was green on
  # every test in the repo. The guard has to run on the branch that could carry it.
  export ARC_HERMES_NETWORK=arc-egress
  export ARC_HERMES_PROXY=http://arc-eproxy:3128
  run_driver
  [ "$status" -eq 0 ]
  read_argv
  [[ "$output" != *"privileged"* ]]
  [[ "$output" != *"--cap-add"* ]]
  [[ "$output" != *"--pid"* ]]
  [[ "$output" != *'"-v","/:'* ]]
  [[ "$output" != *"--security-opt"* ]]
}

@test "fixture 7: the pinned config hash MOVES when the egress mode moves" {
  # ADR-0209's pin has to answer "what confinement was in force", and it could not: the preimage
  # named a policy FILE nobody sets and omitted the network and proxy entirely, so a confined and an
  # unconfined dispatch produced byte-identical version strings. A pin that cannot distinguish the
  # two security postures is a pin that checks itself.
  run --separate-stderr bash "$DRIVER" version
  [ "$status" -eq 0 ]
  unconfined="$output"
  [ -n "$unconfined" ]
  export ARC_HERMES_NETWORK=arc-egress
  export ARC_HERMES_PROXY=http://arc-eproxy:3128
  run --separate-stderr bash "$DRIVER" version
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  [ "$output" != "$unconfined" ] || { echo "the version string did not move: $output"; false; }
}

@test "suite: every test in this file is REGISTERED, not merely declared" {
  # FIXED after an attacker defeated the first version, which counted `^@test` lines in the SOURCE.
  # bats silently DROPS a @test whose name carries a non-ASCII character, and the source line
  # survives the drop -- so the number never moved and the guard stayed green while a test did not
  # run. That is the precise defect this guard exists to catch. `bats --count` reports what bats
  # actually REGISTERED, which is the only number that answers the question.
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "10" ] || { echo "expected 10 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}

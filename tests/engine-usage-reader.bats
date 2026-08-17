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

bats_require_minimum_version 1.5.0

load test_helper

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  DRIVER="$ARC_ROOT/.claude/scripts/engine/drivers/hermes.mjs"
  FAKE="$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"
  # $BATS_TEST_TMPDIR, not `mktemp -d`. bats creates and reaps it, and an UNCHECKED `mktemp -d`
  # that fails leaves WORK="" -- so `mkdir -p "$WORK/data"` becomes `mkdir -p /data`, which Git
  # Bash happily creates inside the MSYS root, hands to the driver as ARC_HERMES_DATA, and then
  # `rm -rf ""` never cleans.
  WORK="$BATS_TEST_TMPDIR/w"
  mkdir -p "$WORK/data"
  COST="$WORK/cost.json"
  export ARC_HERMES_DOCKER="$FAKE"
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$WORK/data"
  export ARC_DRIVER_COST_FILE="$COST"
  # An operator override suppresses the flag entirely, so it is explicitly cleared here -- an
  # ambient value would skip every assertion below while the suite stayed green. The operator
  # branch is NOT left untested: it has its own test at the bottom of this file, because the
  # `if (!USAGE_FILE)` guard is the only thing standing between rmSync and a file arc does not own,
  # and a mutant deleting that guard used to pass every test in this suite.
  export ARC_HERMES_USAGE_FILE=""
  # `demo` is deliberately NOT a name any processes/*.process.yaml uses: the shared policy gate
  # returns early for an unknown process, so these tests measure the DRIVER and not the policy
  # library. Asserted rather than assumed, because the day a demo.process.yaml lands all of these
  # tests silently change meaning at once -- ambient-repo-state dependence, the shard-luck shape.
  [ ! -f "$ARC_ROOT/processes/demo.process.yaml" ]
}

run_driver() {
  export ARC_HERMES_FAKE_CASE="$1"
  # THE SIDECAR IS CLEARED BEFORE EVERY RUN. Two cases in this suite produce byte-identical
  # sidecars, so a run that wrote NO sidecar would be scored against the previous run's file and
  # pass. `cat "$COST"` must only ever read what this invocation wrote.
  rm -f "$COST"
  run --separate-stderr node "$DRIVER" run demo '{"q":1}' min=5
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
  # NO `bash -c` HERE, AND THAT IS THE POINT. The first version of this test was
  #   run bash -c "node '$DRIVER' run demo '{\"q\":1}' min=5 2>&1 1>/dev/null"
  # which interpolates the CHECKOUT PATH into a string a second shell then re-lexes. An
  # adversarial pass proved both halves on this box: one apostrophe in the path gives
  # `unexpected EOF while looking for matching '`, and TWO apostrophes rebalance the quoting so the
  # span between them is unquoted and the inner shell EXECUTES it -- `$(id -un)` ran. That is this
  # lane's already-fixed `bash -c` defect class recurring verbatim, in the file written to say it
  # must not. `run --separate-stderr` gets the same split with no second shell and no string.
  export ARC_HERMES_FAKE_CASE=usage-report-bad-model
  run --separate-stderr node "$DRIVER" run demo '{"q":1}' min=5
  # ASSERT IT RAN BEFORE ASSERTING WHAT IT PRINTED. The old version checked only for a substring,
  # so `throw new Error("x")` placed immediately after the stderr write left it green while the
  # driver exited 1 and wrote no sidecar.
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  [[ "$stderr" == *"model id the spine grammar refuses"* ]]
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

@test "ADR-0221: the vendor tripwire probe reaches a verdict, and CANNOT be skipped by this suite's own setup" {
  # THIS TEST WAS DEAD ON ARRIVAL AND AN ADVERSARIAL PASS PROVED IT.
  #
  # `setup()` exports ARC_HERMES_DATA="$WORK/data" -- an empty scratch dir. That export was still
  # live when this test ran the probe, and the probe's third gate is "does the volume have a
  # config.yaml". It never does. So the probe cleared its Docker and image gates and then skipped
  # ANYWAY, on every machine including the dogfood box, and the old assertion
  # (`== *"SKIP ..."* || == *"ok 2 ..."*`) was satisfied by that skip. Permanently green,
  # permanently measuring nothing.
  #
  # That is `bench-steel-probe.mjs` repeating INSIDE the file written to explain why it must not.
  # The root cause is the same one three of this pass's findings share: the surface that proves the
  # rule was built on a different shape from the surface that ships.
  #
  # Fixed by pointing the probe at the volume the real hire uses. ARC_HERMES_PROBE_DATA is a
  # SEPARATE variable from ARC_HERMES_DATA on purpose -- this suite sets the latter to a scratch
  # dir for the fake-docker tests, and inheriting it is exactly how the tripwire died.
  if [ -n "${ARC_HERMES_PROBE_DATA:-}" ]; then
    ARC_HERMES_DOCKER= ARC_HERMES_IMAGE= ARC_HERMES_DATA="$ARC_HERMES_PROBE_DATA" \
      run node "$ARC_ROOT/tests/engine-usage-flag-probe.mjs"
    [ "$status" -eq 0 ]
    # A real verdict, not a skip. If this line fails on the dogfood box, read ADR-0221 before
    # touching the test: a report appearing is the trigger for re-deciding clause 4.
    [[ "$output" == *"ok 2 - --usage-file wrote nothing"* ]]
  else
    # No configured volume on this machine (every CI leg). The probe must DECLINE, and it must
    # decline for the volume reason -- not silently, and not for one of this suite's own env vars.
    ARC_HERMES_DOCKER= ARC_HERMES_IMAGE= ARC_HERMES_DATA= \
      run node "$ARC_ROOT/tests/engine-usage-flag-probe.mjs"
    [ "$status" -eq 0 ]
    [[ "$output" == *"SKIP engine-usage-flag-probe -- "* ]]
    # The declared reason must be a real gate, never "it worked by accident".
    [[ "$output" == *"Docker daemon is not reachable"* \
       || "$output" == *"pinned image is not present"* \
       || "$output" == *"ARC_HERMES_DATA is unset"* ]]
  fi
}

@test "ADR-0221: the operator ARC_HERMES_USAGE_FILE branch does NOT delete the operator's file" {
  # THE NEGATIVE CONTROL FOR THE ONLY GUARD THAT PROTECTS SOMEONE ELSE'S DATA. Every other test in
  # this file clears ARC_HERMES_USAGE_FILE, so `if (!USAGE_FILE)` in the reader's finally -- the one
  # line between rmSync and a path arc does not own -- had no coverage at all, and a mutant deleting
  # it passed all nine tests.
  export ARC_HERMES_USAGE_FILE="$WORK/operator-owned.json"
  printf '%s\n' '{"prompt_tokens":11,"completion_tokens":22,"model":"llama3.1:8b"}' > "$ARC_HERMES_USAGE_FILE"
  run_driver clean
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  [ -f "$ARC_HERMES_USAGE_FILE" ]
}

@test "ADR-0221: a STALE operator usage file is not re-reported as this run's measurement" {
  # The other half, and the defect the comment above the reader used to deny. In operator mode the
  # driver passes no --usage-file (it cannot map a host path into the container), so nothing
  # rewrites that file and nothing deletes it -- so every run of every process re-read the same
  # report and stamped its tokens `measured` and its model into the MP-F seat. A model that did not
  # run, on a run that measured nothing, forever. Closed by recency, not by ownership.
  export ARC_HERMES_USAGE_FILE="$WORK/stale.json"
  printf '%s\n' '{"prompt_tokens":99,"completion_tokens":98,"model":"stale-model"}' > "$ARC_HERMES_USAGE_FILE"
  # Backdate it well before this run starts.
  touch -d "2020-01-01" "$ARC_HERMES_USAGE_FILE" 2>/dev/null || touch -t 202001010000 "$ARC_HERMES_USAGE_FILE"
  run_driver clean
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  [ ! -f "$COST" ]
}

@test "ADR-0221: a non-string model is refused AND says so, which is what makes it different from absent" {
  # The old empty-vs-absent test asserted an IDENTICAL outcome for both inputs, under a name that
  # claimed to prove they were told apart -- a pass condition that was only an absence, wearing a
  # discrimination test's title. This is the input where the distinction is observable: a
  # structured model must be dropped LOUDLY, so a runtime that starts emitting one does not
  # silently stop filling the seat.
  export ARC_HERMES_FAKE_CASE=usage-report-object-model
  rm -f "$COST"
  run --separate-stderr node "$DRIVER" run demo '{"q":1}' min=5
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  [[ "$stderr" == *"non-string model"* ]]
  run cat "$COST"
  [[ "$output" != *'"model":'* ]]
  [[ "$output" == *'"tokens_in":1234'* ]]
}

@test "ADR-0221: an empty token figure is DROPPED, never fabricated as zero" {
  # Number("") === 0 and Number.isFinite(0) is true, so the first reader turned a report carrying
  # `"prompt_tokens": ""` into {"tokens_in":0,"source":"measured"} on an append-only receipt --
  # which arc-bench then sums and derives a per-token rate from. Absent and present-but-empty are
  # different inputs; a fabricated measurement is the one thing MP-F exists to refuse.
  export ARC_HERMES_FAKE_CASE=usage-report-empty-tokens
  rm -f "$COST"
  run --separate-stderr node "$DRIVER" run demo '{"q":1}' min=5
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  run cat "$COST"
  [[ "$output" != *'"tokens_in":0'* ]]
  [[ "$output" != *'"tokens_in"'* ]]
  # The other figure survives: one unusable field does not discard the other.
  [[ "$output" == *'"tokens_out":567'* ]]
}

@test "suite: all 14 tests in this file are REGISTERED" {
  # REQUIRED OF A SUITE THAT IS THE PROOF OF A RULE (.claude/rules/testing.md). bats silently DROPS
  # a @test whose name contains a non-ASCII character -- five such tests in Cycle 7 were never
  # registered, never ran and never failed, and the only signal was the count falling on CI. A
  # suite running fewer tests than it declares is indistinguishable from a suite that passes.
  # FIXED 2026-08-17 after an adversarial pass defeated the previous version, which counted
  # `^@test ` lines in the SOURCE -- the DECLARED count. bats silently DROPS a @test whose name
  # carries a non-ASCII character, and the source line survives the drop, so the number never
  # moved and the guard stayed green while a test did not run. `bats --count` reports what bats
  # actually REGISTERED. Assert both and that they agree: the pair catches a drop (registered
  # falls) and a silent removal (declared falls).
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "14" ] || { echo "expected 14 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}

@test "ADR-0221: the driver actually passes --usage-file inside the mount, or the fixture refuses" {
  # The fixture exits 65/66/67 when the flag is missing, the mount is missing, or the requested
  # path lies outside the mount. So a driver that stopped passing the flag turns this red rather
  # than quietly reverting to no-cost-ever -- which is indistinguishable from today's real runtime.
  run_driver usage-report
  [ "$status" -eq 0 ]
  [ -f "$COST" ]
}

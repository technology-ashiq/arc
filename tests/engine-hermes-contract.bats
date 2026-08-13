#!/usr/bin/env bats
# Phase 05, REQ-01 -- drivers/hermes behaves like every other engine driver, and its output
# parser survives the shapes a real container actually produces.
#
# WHAT MAKES THIS SUITE NON-VACUOUS. The red corpus is delivered as BYTES ON A CHILD PROCESS
# STDOUT, by substituting only the docker binary (ARC_HERMES_DOCKER). Everything above that is
# the real path: the real argv contract, the real spawn, the real capture, the real ANSI strip,
# the real backwards line scan, the real exit mapping. ARC_DRIVER_FAKE would have been easier
# and would have proved nothing -- it returns inside common.mjs before produce() is ever called,
# which is the defect bench pinned as a canary and engine is not going to re-earn.
#
# Every probe asserts it RAN before asserting what it printed, and every fixture is asserted
# non-empty where emptiness is not the point of the fixture.
bats_require_minimum_version 1.5.0
load 'test_helper'

DRIVER() { echo "$ARC_ROOT/.claude/scripts/engine/drivers/hermes.sh"; }
FAKE()   { echo "$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"; }
PROBE()  { echo "$ARC_ROOT/tests/engine-hermes-probe.mjs"; }

# A real digest-pinned reference. The digest is the one Phase 04 actually pulled and verified,
# so a reader can tell at a glance that the pin shape under test is the pin shape in the lock.
PINNED="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"

# A process name with no processes/<name>.process.yaml on purpose: the shared policy gate returns
# early for an unknown process, so these tests measure the DRIVER and not the policy library.
PROC="hermes-contract-probe"

# Run the driver against one fake case. Stdout and stderr are kept apart because the contract is
# specifically that the ANSWER is on stdout and diagnostics are on stderr; merging them would let
# a driver that printed its answer to stderr pass.
drive() {
  local kase="$1"; shift
  run --separate-stderr env \
    ARC_HERMES_DOCKER="$(FAKE)" \
    ARC_HERMES_FAKE_CASE="$kase" \
    ARC_HERMES_IMAGE="$PINNED" \
    ARC_HERMES_DATA="$BATS_TEST_TMPDIR" \
    "$@" \
    bash "$(DRIVER)" run "$PROC" '{}' ''
}

# ---------------------------------------------------------------------------------------------
# The contract
# ---------------------------------------------------------------------------------------------

@test "hermes: the measured shape -- boot output then the answer -- yields the answer on stdout" {
  drive clean
  [ "$status" -eq 0 ] || { echo "status=$status out=[$output] err=[$stderr]"; false; }
  # The ANSWER only. If boot output reached stdout the driver has handed arc-run un-parseable
  # bytes, which is the whole failure this shim exists to prevent.
  [ "$output" = '{"ok":true,"runtime":"hermes"}' ] || { echo "stdout was [$output]"; false; }
}

@test "hermes: three-code exit map -- a runtime that exits non-zero is a DRIVER failure, exit 1" {
  drive nonzero
  [ "$status" -eq 1 ] || { echo "status=$status err=[$stderr]"; false; }
  [[ "$stderr" == *"exited 3"* ]] || { echo "the runtime exit code is not reported: [$stderr]"; false; }
  [ -z "$output" ] || { echo "a failed run still wrote to stdout: [$output]"; false; }
}

@test "hermes: empty stdout is a runtime failure, and says so rather than saying not-JSON" {
  drive empty
  [ "$status" -eq 1 ] || { echo "status=$status"; false; }
  # The two are different operator problems. Reporting them identically costs a debugging session.
  [[ "$stderr" == *"no output on stdout"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: whitespace-only stdout is empty, not a parse failure" {
  drive whitespace
  [ "$status" -eq 1 ] || { echo "status=$status"; false; }
  [[ "$stderr" == *"no output on stdout"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: junk bytes produce a named parse failure, never a silent empty answer" {
  drive junk
  [ "$status" -eq 1 ] || { echo "status=$status out=[$output]"; false; }
  [[ "$stderr" == *"no line of the runtime output parsed"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: truncated JSON fails rather than half-parsing" {
  drive truncated
  [ "$status" -eq 1 ] || { echo "status=$status out=[$output]"; false; }
  [[ "$stderr" == *"no line of the runtime output parsed"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: an ANSI-wrapped answer is extracted, not read as junk" {
  drive ansi
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [ "$output" = '{"ok":true,"runtime":"hermes"}' ] || { echo "stdout was [$output]"; false; }
}

@test "hermes: an ANSI flood is stripped and the answer still arrives" {
  drive ansi-flood
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [ "$output" = '{"ok":true,"runtime":"hermes"}' ] || { echo "stdout was [$output]"; false; }
}

@test "hermes: CRLF line endings do not hide the answer" {
  drive crlf
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [ "$output" = '{"ok":true,"runtime":"hermes"}' ] || { echo "stdout was [$output]"; false; }
}

@test "hermes: a bare scalar after the answer is boot noise, and the OBJECT is returned" {
  # JSON.parse accepts 0. A naive does-it-parse reader returns the boot counter as the answer,
  # and the run goes green having reported nothing at all.
  drive scalar-last
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [ "$output" = '{"ok":true,"runtime":"hermes"}' ] || { echo "stdout was [$output]"; false; }
}

@test "hermes: a warning printed after the answer does not take a last-line reader off the end" {
  drive warning-after
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [ "$output" = '{"ok":true,"runtime":"hermes"}' ] || { echo "stdout was [$output]"; false; }
}

@test "hermes: injection-shaped CONTENT is passed through intact and NOT judged by the driver" {
  # Validating the document against the process schema is arc-run's job. A driver that
  # pre-judges reports a process fault as a driver fault, and a driver that silently rewrites
  # the answer destroys the evidence of an attack rather than surfacing it.
  drive injection
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [[ "$output" == *"IGNORE ALL PREVIOUS INSTRUCTIONS"* ]] \
    || { echo "the driver altered the document: [$output]"; false; }
}

@test "hermes: KNOWN LIMIT -- a JSON-shaped log line after the answer wins, and that is pinned" {
  # Backwards-scanning cannot distinguish a structured log from an answer. This is asserted
  # rather than assumed so that the day the runtime starts emitting JSON logs after its answer,
  # this test goes red and the limit is rediscovered by CI instead of by a wrong draft.
  drive json-log-after
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [[ "$output" == *"skill cache is stale"* ]] \
    || { echo "the known limit no longer holds -- re-derive it before changing this test: [$output]"; false; }
}

@test "hermes: with two candidate answers the LAST one wins, deterministically" {
  drive two-answers
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [[ "$output" == *"second"* ]] || { echo "stdout was [$output]"; false; }
  [[ "$output" != *"first"* ]] || { echo "both answers came through: [$output]"; false; }
}

@test "hermes: output larger than any single read is handled, not truncated" {
  drive huge
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [ "$output" = '{"ok":true,"runtime":"hermes"}' ] || { echo "stdout was [$output]"; false; }
}

@test "hermes: past the buffer ceiling it REFUSES by name -- and the branch is proven to run" {
  # The ceiling is lowered for this one case so the refusal branch actually executes. Trusting
  # that it works because it looks right is the vacuous pass; the point of the fixture is that
  # the same bytes pass under the real ceiling (test above) and are refused under a small one.
  drive huge ARC_HERMES_MAX_BUFFER=4096
  [ "$status" -eq 1 ] || { echo "status=$status out=[$output]"; false; }
  [[ "$stderr" == *"refusing to parse a truncated stream"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

# ---------------------------------------------------------------------------------------------
# The clock belongs to the RUN
# ---------------------------------------------------------------------------------------------

@test "hermes: a runtime that writes an answer and never exits is BUDGET, exit 2, never driver" {
  # The rejected candidate in ADR-0208 did exactly this. Classifying it as a driver fault is
  # what made the fallback chain spend the budget again, per driver, and made the receipt read
  # reason: driver for a run that was over time.
  local deadline=$(( $(date +%s) * 1000 + 6000 ))
  drive hang ARC_DRIVER_DEADLINE_EPOCH_MS="$deadline"
  [ "$status" -eq 2 ] || { echo "status=$status err=[$stderr]"; false; }
  [[ "$stderr" == *"time remaining for this run"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: a deadline already spent declines BEFORE starting the runtime" {
  # Launching a container that will be killed spends real time and real money to reach the same
  # answer. The fake case is `clean`, which would exit 0 if it were ever started -- so a status
  # of 2 here proves the runtime was NOT started rather than that it failed.
  local past=$(( $(date +%s) * 1000 - 60000 ))
  drive clean ARC_DRIVER_DEADLINE_EPOCH_MS="$past"
  [ "$status" -eq 2 ] || { echo "status=$status out=[$output] err=[$stderr]"; false; }
  [[ "$stderr" == *"not enough to start the runtime"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: NO deadline in the environment means no deadline, not a zero one" {
  # An unbounded run must not be declined by a driver reading an absent value as 0. This is the
  # negative control for the two tests above: without it, a shim that declined everything would
  # pass both of them.
  drive clean
  [ "$status" -eq 0 ] || { echo "an unbounded run was declined: status=$status err=[$stderr]"; false; }
}

@test "hermes: the budget string is NOT used as a clock -- a large min does not extend a spent deadline" {
  # budget.min is the run's ORIGINAL allowance. A shim reading it as its own timeout hands every
  # driver in the fallback chain a full budget again. Here the deadline is already past while the
  # budget says 99 minutes: the deadline must win.
  local past=$(( $(date +%s) * 1000 - 60000 ))
  run --separate-stderr env \
    ARC_HERMES_DOCKER="$(FAKE)" ARC_HERMES_FAKE_CASE=clean \
    ARC_HERMES_IMAGE="$PINNED" ARC_HERMES_DATA="$BATS_TEST_TMPDIR" \
    ARC_DRIVER_DEADLINE_EPOCH_MS="$past" \
    bash "$(DRIVER)" run "$PROC" '{}' 'min=99'
  [ "$status" -eq 2 ] || { echo "the budget string overrode the run deadline: status=$status"; false; }
}

# ---------------------------------------------------------------------------------------------
# The pin, and the version
# ---------------------------------------------------------------------------------------------

@test "hermes: an image that is not pinned by digest is REFUSED" {
  run --separate-stderr env \
    ARC_HERMES_DOCKER="$(FAKE)" ARC_HERMES_FAKE_CASE=clean \
    ARC_HERMES_IMAGE="nousresearch/hermes-agent:latest" \
    ARC_HERMES_DATA="$BATS_TEST_TMPDIR" \
    bash "$(DRIVER)" run "$PROC" '{}' ''
  [ "$status" -eq 1 ] || { echo "an unpinned tag was accepted: status=$status"; false; }
  [[ "$stderr" == *"pinned by digest"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: an unset image is a named setup failure, never a silent no-op" {
  run --separate-stderr env -u ARC_HERMES_IMAGE \
    ARC_HERMES_DOCKER="$(FAKE)" ARC_HERMES_FAKE_CASE=clean \
    ARC_HERMES_DATA="$BATS_TEST_TMPDIR" \
    bash "$(DRIVER)" run "$PROC" '{}' ''
  [ "$status" -eq 1 ] || { echo "status=$status"; false; }
  [[ "$stderr" == *"ARC_HERMES_IMAGE is not set"* ]] || { echo "wrong reason: [$stderr]"; false; }
}

@test "hermes: the version verb reports the pinned runtime AND the config hash" {
  run --separate-stderr env ARC_HERMES_IMAGE="$PINNED" bash "$(DRIVER)" version
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  [[ "$output" == hermes@sha256:*+cfg.* ]] || { echo "version shape is wrong: [$output]"; false; }
}

@test "hermes: the config hash MOVES when the config file moves" {
  # A version pinned to the driver source would sit still while the answers changed underneath
  # it, which is a constant wearing a version label.
  local cfg="$BATS_TEST_TMPDIR/config.yaml"
  echo "model: { default: a }" > "$cfg"
  run env ARC_HERMES_IMAGE="$PINNED" ARC_HERMES_CONFIG="$cfg" bash "$(DRIVER)" version
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local first="$output"
  echo "model: { default: b }" > "$cfg"
  run env ARC_HERMES_IMAGE="$PINNED" ARC_HERMES_CONFIG="$cfg" bash "$(DRIVER)" version
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$first" != "$output" ] || { echo "the config hash did not move: $first"; false; }
}

@test "hermes: a MISSING config file hashes differently from an UNCONFIGURED one" {
  # Those two states mean opposite things about whether anyone decided anything, and a preimage
  # that drops an absent component makes them identical.
  run env ARC_HERMES_IMAGE="$PINNED" bash "$(DRIVER)" version
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local unconfigured="$output"
  run env ARC_HERMES_IMAGE="$PINNED" ARC_HERMES_CONFIG="$BATS_TEST_TMPDIR/does-not-exist.yaml" bash "$(DRIVER)" version
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$unconfigured" != "$output" ] || { echo "absent and missing hash the same: $unconfigured"; false; }
}

@test "hermes: arc-run routes --driver hermes" {
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" --process "$PROC" --driver hermes --dry-run
  # The process does not exist, so this must NOT be the unknown-driver error. Anything else is
  # arc-run getting far enough to look for the process, which is what routing means here.
  [[ "$output" != *"unknown driver"* ]] || { echo "hermes is not registered: $output"; false; }
}

# ---------------------------------------------------------------------------------------------
# The type-tagged encoder behind the config hash
# ---------------------------------------------------------------------------------------------

@test "encoder: every unrepresentable value is REFUSED, none is coerced" {
  run node "$(PROBE)" refusals
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALL_REFUSED"* ]] || { echo "the probe did not reach its end, or something was accepted: $output"; false; }
}

@test "encoder: none of the pairs JSON.stringify collides on collide here" {
  run node "$(PROBE)" collisions
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NO_COLLISIONS"* ]] || { echo "$output"; false; }
}

@test "encoder: key ORDER does not move the hash and key CONTENT does" {
  run node "$(PROBE)" ordering
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ORDER_STABLE_CONTENT_MOVES"* ]] || { echo "$output"; false; }
}

@test "encoder: NEGATIVE CONTROL -- the same harness reports a collision when one exists" {
  # A check that cannot fail is not a check. This proves the comparison above can go red.
  run node "$(PROBE)" negative-control
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CONTROL_DISCRIMINATES"* ]] || { echo "$output"; false; }
}

@test "encoder: the encoding is visibly type-tagged and length-prefixed" {
  run node "$(PROBE)" shape
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SHAPE_PRINTED"* ]] || { echo "the probe did not reach its end: $output"; false; }
  [[ "$output" == *"o:"* ]] || { echo "no object tag in the encoding: $output"; false; }
  [[ "$output" == *"s:1:x"* ]] || { echo "no length-prefixed string in the encoding: $output"; false; }
}

# ---------------------------------------------------------------------------------------------
# The fixture harness itself
# ---------------------------------------------------------------------------------------------

@test "the fake docker REFUSES an unknown case instead of printing nothing" {
  # A typo in a case name would otherwise arrive at the parser as an empty-stdout fixture and
  # pass the wrong test for the wrong reason. This is the negative control for every drive()
  # call in this file.
  run env ARC_HERMES_FAKE_CASE=not-a-real-case bash "$(FAKE)"
  [ "$status" -eq 64 ] || { echo "an unknown case did not fail loudly: status=$status"; false; }
}

@test "this file registers every test it declares" {
  # bats silently DROPS a @test whose name carries a non-ASCII character: five such tests once
  # vanished from a green file and the only signal was the count falling on CI.
  local n
  n="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$n" -eq 33 ] || { echo "declared $n tests, expected 33 - a test was added or silently dropped"; false; }
}

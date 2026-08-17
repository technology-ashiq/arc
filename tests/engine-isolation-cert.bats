#!/usr/bin/env bats
# Phase 06, REQ-02 -- the twelve-fixture Isolation Certification Suite.
#
# THIS FILE IS THE REGRESSION ARM. It runs keyless on CI against the fake docker stand-in and the
# mock driver, and it is therefore labelled `regression` by cert-label.mjs and can never be
# labelled `certification` — that requires the real runtime, human-started, with receipts, and
# the label is DERIVED from facts only such a run produces rather than written by anyone.
#
# EVERY FIXTURE REPORTS ITS OWN STATE, INCLUDING THE ONES THAT CANNOT BE PROVEN HERE. A fixture
# that needs a live capped credential, or netns, or a real container, is recorded UNPROVABLE-HERE
# by an assertion that the enforcement map says so — never skipped in silence. The spec is
# explicit that an unprovable boundary is a no, and a suite that quietly omits five of twelve
# rows reads exactly like a suite that passed twelve.
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN()    { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }
DRIVER() { echo "$ARC_ROOT/.claude/scripts/engine/drivers/hermes.sh"; }
FAKE()   { echo "$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"; }
MAP()    { echo "$ARC_ROOT/initiatives/engine/evidence/phase-04/fixture-enforcement-map.md"; }

PINNED="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
PROC="commit-msg-draft"

# ---------------------------------------------------------------------------------------------
# 1 — a repo write from the runtime workspace is blocked
# ---------------------------------------------------------------------------------------------

@test "cert 1: the arc repo is not mounted into the runtime at all" {
  # The strongest available form of "a repo write is blocked" is that the repo is not reachable.
  # Asserted on the actual command line, because the previous version of this suite asserted
  # nothing about the invocation and eight mutants of it survived — including one that mounted
  # host root.
  local argvf="$BATS_TEST_TMPDIR/argv.jsonl"
  # THE TEMPLATE IS CREATED, and until 2026-08-17 it was not -- in this test or in three others.
  # An adversarial pass found that a missing ARC_HERMES_DATA made the driver SKIP the private-copy
  # block and mount the template path directly, so every one of these certificate runs exercised the
  # UNCONFINED mode. The certificate was issued against the state it certifies against. The driver
  # now refuses a missing template outright, which is what makes this mkdir load-bearing rather than
  # cosmetic.
  mkdir -p "$BATS_TEST_TMPDIR/data"
  run --separate-stderr env \
    ARC_HERMES_DOCKER="$(FAKE)" ARC_HERMES_FAKE_CASE=clean \
    ARC_HERMES_IMAGE="$PINNED" ARC_HERMES_DATA="$BATS_TEST_TMPDIR/data" \
    ARC_HERMES_FAKE_ARGV_FILE="$argvf" \
    bash "$(DRIVER)" run "$PROC" '{}' ''
  [ "$status" -eq 0 ] || { echo "status=$status err=[$stderr]"; false; }
  local a; a="$(cat "$argvf")"
  # Exactly one -v, and it is the data dir. A second mount is how the repo gets in.
  local mounts; mounts="$(grep -o '"-v"' <<< "$a" | wc -l | tr -d ' ')"
  [ "$mounts" -eq 1 ] || { echo "expected exactly one volume mount, found $mounts: $a"; false; }
  [[ "$a" == *"/opt/data"* ]] || { echo "the one mount is not the data volume: $a"; false; }
  [[ "$a" != *"$ARC_ROOT:"* ]] || { echo "THE ARC REPO IS MOUNTED INTO THE RUNTIME: $a"; false; }
}

@test "cert 1b: the repo is byte-identical after a run" {
  # The negative half. A mount could exist that this suite did not think to look for, so the
  # property is also checked from the outside: nothing under the repo changed.
  # Compared as TEXT, not through md5sum: md5sum is GNU-only and macOS ships `md5` with different
  # output, so hashing here would fail one leg of the matrix for a reason that has nothing to do
  # with the property being tested. There is no reason to hash a value that is already small.
  mkdir -p "$BATS_TEST_TMPDIR/data2"        # see cert 1 -- a missing template used to mean unconfined
  local before; before="$(cd "$ARC_ROOT" && git status --porcelain | sort)"
  run --separate-stderr env \
    ARC_HERMES_DOCKER="$(FAKE)" ARC_HERMES_FAKE_CASE=clean \
    ARC_HERMES_IMAGE="$PINNED" ARC_HERMES_DATA="$BATS_TEST_TMPDIR/data2" \
    bash "$(DRIVER)" run "$PROC" '{}' ''
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  local after; after="$(cd "$ARC_ROOT" && git status --porcelain | sort)"
  [ "$before" = "$after" ] || { echo "the repo changed across a runtime invocation"; false; }
}

# ---------------------------------------------------------------------------------------------
# 2 and 3 — the data boundary. Proven in tests/engine-data-boundary.bats; asserted here as
# PRESENT so this suite cannot report twelve rows while one of them lives nowhere.
# ---------------------------------------------------------------------------------------------

@test "cert 2+3: the data-boundary fixtures exist and assert an arc-run exit 5" {
  local f="$ARC_ROOT/tests/engine-data-boundary.bats"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  grep -q 'status" -eq 5' "$f" || { echo "the boundary suite does not assert exit 5"; false; }
  grep -q "hosted: cloud" "$f" || { echo "fixture 3 (the routing arm) is not asserted"; false; }
}

# ---------------------------------------------------------------------------------------------
# 5 — a planted fake key is absent from every artifact
# ---------------------------------------------------------------------------------------------

@test "cert 5: a planted key in the INPUT is caught before anything is sent to a driver" {
  # The send path, not the return path. All four originally-scanned classes were on the return
  # path, so the one direction that actually exfiltrates had no scan at all.
  run node "$(RUN)" --process "$PROC" --driver mock \
    --input '{"k":"sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'
  [ "$status" -ne 0 ] || { echo "a planted key rode the input into a driver: $output"; false; }
  [[ "$output" == *"secret"* || "$output" == *"redact"* || "$output" == *"scan"* ]] \
    || { echo "the refusal does not name the scan: $output"; false; }
}

@test "cert 5b: NEGATIVE CONTROL -- the same run without the key is not stopped by the scan" {
  # Without this, a scanner that refused every input would pass the test above.
  local empty="$BATS_TEST_TMPDIR/no-rec"; mkdir -p "$empty"
  run env ARC_MOCK_DIR="$empty" node "$(RUN)" --process "$PROC" --driver mock --input '{"k":"ordinary text"}'
  [[ "$output" != *"secret"* ]] || { echo "a clean input was reported as carrying a secret: $output"; false; }
}

# ---------------------------------------------------------------------------------------------
# 11 — a wall-clock overrun stops at the budget line
# ---------------------------------------------------------------------------------------------

@test "cert 11: a runtime that never exits is stopped at the budget line, as BUDGET" {
  mkdir -p "$BATS_TEST_TMPDIR/d11"          # see cert 1 -- a missing template used to mean unconfined
  local deadline=$(( $(date +%s) * 1000 + 6000 ))
  run --separate-stderr env \
    ARC_HERMES_DOCKER="$(FAKE)" ARC_HERMES_FAKE_CASE=hang \
    ARC_HERMES_IMAGE="$PINNED" ARC_HERMES_DATA="$BATS_TEST_TMPDIR/d11" \
    ARC_DRIVER_DEADLINE_EPOCH_MS="$deadline" \
    bash "$(DRIVER)" run "$PROC" '{}' ''
  [ "$status" -eq 2 ] || { echo "expected BUDGET_DECLINED (2), got $status: $stderr"; false; }
  [[ "$stderr" != *"driver"* || "$stderr" == *"time remaining"* ]] \
    || { echo "an over-time run was reported as a driver fault: $stderr"; false; }
}

# ---------------------------------------------------------------------------------------------
# 12 — an unpinned runtime is refused by a pin-required class
# ---------------------------------------------------------------------------------------------

@test "cert 12: an image pinned by TAG rather than digest is refused" {
  # A tag can be repushed. Phase 04 measured :latest moving to a different build on the same day
  # the pinned digest stood still, so a tag proves nothing about which runtime answered.
  #
  # The template exists so this test fails for its OWN reason. With it missing, the run would refuse
  # on the workspace check and the assertion below would pass on the wrong refusal -- a green test
  # measuring a different rule, which is the near-miss shape this suite exists to catch.
  mkdir -p "$BATS_TEST_TMPDIR/d12-created"
  run --separate-stderr env \
    ARC_HERMES_DOCKER="$(FAKE)" ARC_HERMES_FAKE_CASE=clean \
    ARC_HERMES_IMAGE="nousresearch/hermes-agent:v2026.8.3" \
    ARC_HERMES_DATA="$BATS_TEST_TMPDIR/d12-created" \
    bash "$(DRIVER)" run "$PROC" '{}' ''
  [ "$status" -eq 1 ] || { echo "an unpinned tag was accepted: $status"; false; }
  [[ "$stderr" == *"pinned by digest"* ]] || { echo "wrong reason: $stderr"; false; }
}

# ---------------------------------------------------------------------------------------------
# The label, and the rows that cannot be proven here
# ---------------------------------------------------------------------------------------------

@test "cert: this arm is labelled REGRESSION and is structurally incapable of certifying" {
  # The whole point of the label: a keyless CI run against a stand-in must never be able to
  # produce a certification, whatever else is true of it.
  run node "$ARC_ROOT/tests/engine-cert-label-probe.mjs" mock
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REGRESSION"* ]] || { echo "$output"; false; }
}

@test "cert: every one of the twelve rows has a NAMED enforcement layer" {
  # Counted, never eyeballed. A map that quietly drops a row reads identically to a complete one.
  local f; f="$(MAP)"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  local rows; rows="$(grep -cE '^\| [0-9]+ \|' "$f")"
  [ "$rows" -eq 12 ] || { echo "expected 12 fixture rows, found $rows"; false; }
}

@test "cert: the rows that cannot be proven in THIS arm are named, not silently omitted" {
  # Fixtures 4 and 10 need a live capped credential; 6 and 7 need a real container and real
  # egress control; 8 needs two consecutive real runs. Every one is recorded in the map with the
  # dependency stated. An unprovable boundary is a no, and it has to be visible to be a no.
  local f; f="$(MAP)"
  grep -q "PARTIAL" "$f" || { echo "the partial row (fixture 7) is not flagged"; false; }
  grep -qE "Needs the key|needs the capped key|Needs the key" "$f" \
    || { echo "the credential dependency for fixtures 4 and 10 is not recorded"; false; }
}

@test "this file registers every test it declares" {
  # FIXED 2026-08-17 after an adversarial pass defeated the previous version, which counted
  # `^@test ` lines in the SOURCE -- the DECLARED count. bats silently DROPS a @test whose name
  # carries a non-ASCII character, and the source line survives the drop, so the number never
  # moved and the guard stayed green while a test did not run. `bats --count` reports what bats
  # actually REGISTERED. Assert both and that they agree: the pair catches a drop (registered
  # falls) and a silent removal (declared falls).
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "11" ] || { echo "expected 11 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}

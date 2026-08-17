#!/usr/bin/env bats
# Phase 04, REQ-00 -- the runtime was proven runnable on a real machine before anything was
# built on it. The previous engine cycle closed with its central claim unproven because
# nothing runnable was installed and no credential existed, and that was discovered at
# Phase 03 rather than Phase 00. These tests assert the ARTIFACT of that proof.
#
# Red-first: every @test here failed with "no such file" before the smoke run happened.
#
# What this file does NOT claim. It is not a certification -- that is Phase 06, twelve
# fixtures against the real runtime with receipts. It asserts that a live headless
# invocation happened, returned parseable output, and exited on its own.
bats_require_minimum_version 1.5.0
load 'test_helper'

EV() { echo "$ARC_ROOT/initiatives/engine/evidence/phase-04"; }

@test "phase-04 smoke evidence parses as JSON" {
  local f="$(EV)/smoke-run.json"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  # Non-empty first. An empty file is a silent pass generator and looks identical to a
  # clean run -- the fixture-builder rule from .claude/rules/testing.md.
  [ -s "$f" ] || { echo "empty: $f"; false; }
  run node -e '
    const fs = require("node:fs");
    const o = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (o.ok !== true) { console.log("ok is not true"); process.exit(1); }
    if (o.runtime !== "hermes") { console.log("runtime is " + o.runtime); process.exit(1); }
    console.log("PARSED_OK");
  ' "$f"
  # Assert it RAN before asserting what it printed.
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PARSED_OK"* ]] || { echo "the probe did not reach its end: $output"; false; }
}

@test "the raw stdout is captured and does NOT parse, which is the finding" {
  # This is the divergence the smoke run exists to have found: the vendor documents -z as
  # putting nothing but the answer on stdout, and that is true of the AGENT and false of
  # the CONTAINER. Boot output shares the stream on every run, warm ones included.
  #
  # Asserting the NEGATIVE alone would be satisfied by a crash, so it is paired with a
  # positive: the same bytes must yield a valid object from their LAST line.
  local f="$(EV)/smoke-stdout.txt"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  [ -s "$f" ] || { echo "empty: $f"; false; }
  run node -e '
    const fs = require("node:fs");
    const s = fs.readFileSync(process.argv[1], "utf8");
    let whole = "parsed";
    try { JSON.parse(s); } catch { whole = "refused"; }
    if (whole === "parsed") { console.log("stdout parsed whole - the finding no longer holds"); process.exit(1); }
    const last = s.trim().split(/\r?\n/).pop();
    const o = JSON.parse(last);
    if (o.runtime !== "hermes") { console.log("last line is not the answer"); process.exit(1); }
    console.log("WHOLE_REFUSED_LAST_LINE_PARSED");
  ' "$f"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"WHOLE_REFUSED_LAST_LINE_PARSED"* ]] || { echo "$output"; false; }
}

@test "the smoke result records the exit code and the STOP evaluation" {
  # A STOP that is never written down because it never fired is indistinguishable from a
  # STOP nobody checked.
  local f="$(EV)/smoke-result.md"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  [ -s "$f" ] || { echo "empty: $f"; false; }
  grep -q "STOP evaluated:" "$f" || { echo "no STOP evaluation line"; false; }
  grep -qE "exit code" "$f" || { echo "no exit code recorded"; false; }
}

@test "the install method records a digest pin and not a host installer" {
  local f="$(EV)/install-method.md"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  [ -s "$f" ] || { echo "empty: $f"; false; }
  grep -q "sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e" "$f" \
    || { echo "the pinned digest is not recorded"; false; }
  # Paired positive and negative: the digest is present AND the disclaimed channel is named.
  grep -q "install.ps1" "$f" || { echo "the rejected install channel is not named"; false; }
}

@test "every fixture in the certification suite has a named enforcement layer" {
  local f="$(EV)/fixture-enforcement-map.md"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  [ -s "$f" ] || { echo "empty: $f"; false; }
  # Twelve fixture rows, each naming exactly one layer. Counted, never eyeballed.
  local rows
  rows="$(grep -cE '^\| [0-9]+ \|' "$f")"
  [ "$rows" -eq 12 ] || { echo "expected 12 fixture rows, found $rows"; false; }
  grep -q "PARTIAL" "$f" || { echo "the partial fixture is not flagged"; false; }
}

# A suite that IS the proof of a rule asserts its own count. bats silently DROPS a @test
# whose name carries a non-ASCII character -- five such tests once vanished from a green
# file and the only signal was the count falling on CI.
@test "this file registers every test it declares" {
  # FIXED 2026-08-17 after an adversarial pass defeated the previous version, which counted
  # `^@test ` lines in the SOURCE -- the DECLARED count. bats silently DROPS a @test whose name
  # carries a non-ASCII character, and the source line survives the drop, so the number never
  # moved and the guard stayed green while a test did not run. `bats --count` reports what bats
  # actually REGISTERED. Assert both and that they agree: the pair catches a drop (registered
  # falls) and a silent removal (declared falls).
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "6" ] || { echo "expected 6 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}

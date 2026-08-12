#!/usr/bin/env bats
# legal Phase 00 -- the steel thread: a facts file becomes pages, deterministically.
#
# Every assertion reads the run sidecar (_run.json), never the console prose. A lint checked
# through its formatting is a lint that breaks when someone rewords a message.
bats_require_minimum_version 1.5.0
load 'test_helper'

CLI() { echo "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs"; }

teardown() { _arc_legal_teardown; }

@test "legal render: a fixture facts file renders the whole page set" {
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" ls-pages "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  [ "$output" = "about.mdx contact.mdx pricing.mdx privacy.mdx refund-cancellation.mdx shipping-delivery.mdx terms.mdx" ]
}

@test "legal render: the sidecar records the engine, the set and the facts hash" {
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  local json="$BATS_TEST_TMPDIR/out/_run.json"

  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$json" engine_version
  [ "$status" -eq 0 ]
  [ -n "$output" ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$json" facts_sha256
  [ "$status" -eq 0 ]
  [ "${#output}" -eq 64 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$json" preimage_version
  [ "$status" -eq 0 ]
  [ "$output" = "arc-legal-canon/1" ]
}

@test "legal render: a clean fixture produces zero FAIL findings in every group" {
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$BATS_TEST_TMPDIR/out/_run.json" any FAIL
  [ "$status" -eq 0 ]
  [ "$output" = "0" ]
}

@test "legal render: every payment_model branch selects its own refund clause" {
  # Positive AND negative on each cell: asserting only that the wrong clause is ABSENT would
  # be satisfied by a page that rendered nothing at all.
  #
  # A colon-joined pair rather than an associative array on purpose -- macOS runners ship bash
  # 3.2, where `local -A` is a syntax error, and the failures that matter on this repo have
  # been exactly this kind (BSD-vs-GNU, path, locale) and exactly this invisible on the box
  # that wrote the code.
  for pair in "fixture-gateway-gst:REFUND.WINDOW" "fixture-mor-gst:REFUND.MOR" "fixture-none-gst:REFUND.OFFLINE"; do
    v="${pair%%:*}"
    want="${pair##*:}"
    run node "$(CLI)" render --venture "$v" --out "$BATS_TEST_TMPDIR/out-$v"
    [ "$status" -eq 0 ]
    run node "$ARC_ROOT/tests/legal-probe.mjs" clauses "$BATS_TEST_TMPDIR/out-$v/_run.json" refund-cancellation
    [ "$status" -eq 0 ]
    [[ "$output" == *"$want"* ]]
    for other in REFUND.WINDOW REFUND.MOR REFUND.OFFLINE; do
      if [ "$other" != "$want" ]; then
        [[ "$output" != *"$other"* ]]
      fi
    done
  done
}

@test "legal render: the gst branch selects its own invoice clause both ways" {
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/yes"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" clauses "$BATS_TEST_TMPDIR/yes/_run.json" refund-cancellation
  [[ "$output" == *"REFUND.GST_INVOICE"* ]]
  [[ "$output" != *"REFUND.NO_GST"* ]]

  run node "$(CLI)" render --venture "fixture-gateway-nogst" --out "$BATS_TEST_TMPDIR/no"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" clauses "$BATS_TEST_TMPDIR/no/_run.json" refund-cancellation
  [[ "$output" == *"REFUND.NO_GST"* ]]
  [[ "$output" != *"REFUND.GST_INVOICE"* ]]
}

@test "legal render: a venture holding no third-party records omits the processor clauses" {
  run node "$(CLI)" render --venture "fixture-none-nogst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" clauses "$BATS_TEST_TMPDIR/out/_run.json" privacy
  [ "$status" -eq 0 ]
  # Positive control first: the page really did render its ordinary clauses.
  [[ "$output" == *"PRIVACY.RIGHTS"* ]]
  [[ "$output" != *"PRIVACY.PROCESSOR"* ]]
  [[ "$output" != *"PRIVACY.SUBPROCESSORS"* ]]
}

@test "legal render: an unknown venture exits 3, not 2 and not 0" {
  run node "$(CLI)" render --venture "no-such-venture" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 3 ]
}

@test "legal render: a venture name with a path separator is refused" {
  run node "$(CLI)" render --venture "../../etc" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 3 ]
  [ ! -f "$BATS_TEST_TMPDIR/out/terms.mdx" ]
}

@test "legal render: an equals-joined flag is refused rather than half-supported" {
  run node "$(CLI)" render --venture=fixture-gateway-gst --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 2 ]
}

@test "legal render: a missing required flag exits 2 and prints usage" {
  run node "$(CLI)" render --venture "fixture-gateway-gst"
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: arc-legal render"* ]]
}

@test "legal render: every page in the set has a template, so nothing is reported unauthored" {
  # An absent page and a complete one are the one thing a broken renderer and a healthy one
  # would otherwise agree on, so the renderer names what it skipped. With the set complete,
  # that list must be EMPTY -- and the positive control above (seven files on disk) is what
  # stops this passing on a run that rendered nothing at all.
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/out/_run.json" not_authored
  [ "$status" -eq 0 ]
  [ "$output" = "[]" ]
}

@test "legal render: the transform list is recorded on every page" {
  run node "$(CLI)" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/out/_run.json" pages.0.transforms
  [ "$status" -eq 0 ]
  # A gate that transforms what it measures must declare what the transform destroys
  # (retro-log 2026-07-30). This asserts the declaration exists at all.
  [[ "$output" == *"html-escape-interpolated-values"* ]]
  [[ "$output" == *"nfc-normalise-on-hash"* ]]
}

@test "legal render: a mutant renderer that emits an unpinned clause turns trace-lint red" {
  # The negative control RUNS. A grep for the marker would pass against a lint that reads the
  # template source instead of the rendered bytes, which is precisely the hole being closed.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate "$SANDBOX" unpinned-clause
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ -f "$SANDBOX/out/_run.json" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" trace FAIL
  [ "$status" -eq 0 ]
  [ "$output" -gt 0 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" finding-clauses "$SANDBOX/out/_run.json" trace FAIL
  [[ "$output" == *"GHOST.INJECTED"* ]]
}

@test "legal render: the unmutated sandbox is green, so the mutant test can fail" {
  # Without this, every mutant assertion above could be passing because the SANDBOX is broken
  # rather than because the mutation was caught. A control for the control.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  # Assert it RAN, not merely that it exited 0. Exit 0 is the DEFAULT exitCode, so a
  # module that loaded and never reached main() produces it too -- which is exactly what a
  # symlinked sandbox path did on macOS, silently, while this assertion passed.
  [[ "$output" == *"rendered "*" page(s) for "* ]]
  run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$SANDBOX/out/_run.json" any FAIL
  [ "$output" = "0" ]
}

@test "legal render: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  # Two numbers derived from the same file, compared against each other -- never a pinned
  # literal, which goes red for ADDING a test (arc-memory 2026-08-12).
  [ "$declared" -eq "$output" ]
}

@test "legal render: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}

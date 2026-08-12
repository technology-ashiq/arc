#!/usr/bin/env bats
# legal Phase 00 -- the canonicaliser and byte-reproducibility.
#
# This is the receipt chain's weakest point, and arc has shipped the defect twice: a hash that
# gave 1000 and "1000" one value and then folded NaN to null (arc-evolve 2026-08-04), and a
# preimage format change that made a verifier accuse the owner of TAMPERING (arc-absorb
# 2026-08-09). Every case below is one of those, or one an attacker reaches for first.
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_legal_teardown; }

_canon() { node "$ARC_ROOT/tests/legal-probe.mjs" canon "$1"; }

@test "legal hash: 1000 and the string 1000 do not share a facts hash" {
  run _canon int-vs-string
  [ "$status" -eq 0 ]
  [ "$output" = "differ" ]
}

@test "legal hash: a disabled field and an unset field do not share a hash" {
  run _canon disabled-vs-unset
  [ "$status" -eq 0 ]
  [ "$output" = "differ" ]
}

@test "legal hash: a list and a scalar do not share a hash" {
  run _canon array-vs-string
  [ "$status" -eq 0 ]
  [ "$output" = "differ" ]
}

@test "legal hash: key and value boundaries cannot be shifted into each other" {
  run _canon key-boundary
  [ "$status" -eq 0 ]
  [ "$output" = "differ" ]
}

@test "legal hash: NFC and NFD spellings of one name share a hash" {
  # The positive half of the pair. Normalisation must HAPPEN, not merely be claimed: without
  # it the same operator name typed on two machines produces two receipts for one page.
  run _canon nfc-vs-nfd
  [ "$status" -eq 0 ]
  [ "$output" = "same" ]
}

@test "legal hash: NaN is refused, never coerced" {
  run _canon nan
  [ "$status" -eq 0 ]
  [ "$output" = "refused:NON_FINITE" ]
}

@test "legal hash: positive infinity is refused" {
  run _canon infinity
  [ "$status" -eq 0 ]
  [ "$output" = "refused:NON_FINITE" ]
}

@test "legal hash: negative infinity is refused" {
  run _canon neg-infinity
  [ "$status" -eq 0 ]
  [ "$output" = "refused:NON_FINITE" ]
}

@test "legal hash: a BigInt is refused" {
  run _canon bigint
  [ "$status" -eq 0 ]
  [ "$output" = "refused:BIGINT" ]
}

@test "legal hash: undefined is refused" {
  run _canon undefined
  [ "$status" -eq 0 ]
  [ "$output" = "refused:UNDEFINED" ]
}

@test "legal hash: a fractional number is refused" {
  run _canon float
  [ "$status" -eq 0 ]
  [ "$output" = "refused:NON_INTEGER" ]
}

@test "legal hash: an exotic object is refused rather than stringified" {
  run _canon date-object
  [ "$status" -eq 0 ]
  [ "$output" = "refused:EXOTIC_OBJECT" ]
}

@test "legal hash: a cycle is refused" {
  run _canon cycle
  [ "$status" -eq 0 ]
  [ "$output" = "refused:CYCLE" ]
}

@test "legal hash: a leading-zero number is a named parse error, not 24" {
  # YAML 1.1 reads 030 as octal. A parser that guesses turns a 30-day window into 24 days on a
  # page a customer relies on.
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$BATS_TEST_TMPDIR/octal.yaml" "refund_window_days: 030"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" parse "$BATS_TEST_TMPDIR/octal.yaml"
  [ "$status" -eq 0 ]
  [ "$output" = "refused:LEADING_ZERO" ]
}

@test "legal hash: a plain integer still parses, so the octal rule is not blanket" {
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$BATS_TEST_TMPDIR/plain.yaml" "refund_window_days: 30"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" parse "$BATS_TEST_TMPDIR/plain.yaml"
  [ "$status" -eq 0 ]
  [ "$output" = "ok" ]
}

@test "legal hash: a tab in the indentation is a named parse error" {
  printf 'operator:\n\ttype: entity\n' > "$BATS_TEST_TMPDIR/tabbed.yaml"
  [ -s "$BATS_TEST_TMPDIR/tabbed.yaml" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" parse "$BATS_TEST_TMPDIR/tabbed.yaml"
  [ "$status" -eq 0 ]
  [ "$output" = "refused:TAB_INDENT" ]
}

@test "legal hash: a duplicate key is refused rather than silently last-wins" {
  printf 'refund_window_days: 14\nrefund_window_days: 30\n' > "$BATS_TEST_TMPDIR/dup.yaml"
  [ -s "$BATS_TEST_TMPDIR/dup.yaml" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" parse "$BATS_TEST_TMPDIR/dup.yaml"
  [ "$status" -eq 0 ]
  [ "$output" = "refused:DUPLICATE_KEY" ]
}

@test "legal hash: a flow collection is refused" {
  run node "$ARC_ROOT/tests/legal-probe.mjs" write "$BATS_TEST_TMPDIR/flow.yaml" "purposes: [a, b]"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" parse "$BATS_TEST_TMPDIR/flow.yaml"
  [ "$status" -eq 0 ]
  [ "$output" = "refused:FLOW_COLLECTION" ]
}

@test "legal hash: two renders of identical inputs are byte-identical" {
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/a"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/b"
  [ "$status" -eq 0 ]

  for page in terms privacy refund-cancellation; do
    run node "$ARC_ROOT/tests/legal-probe.mjs" sha "$BATS_TEST_TMPDIR/a/$page.mdx"
    [ "$status" -eq 0 ]
    first="$output"
    run node "$ARC_ROOT/tests/legal-probe.mjs" sha "$BATS_TEST_TMPDIR/b/$page.mdx"
    [ "$status" -eq 0 ]
    [ "$first" = "$output" ]
  done
}

@test "legal hash: the sidecar page hash matches the bytes actually written" {
  # Without this the receipt could attest to a hash of something the renderer never wrote --
  # the whole chain rests on these two being the same bytes.
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "fixture-mor-gst" --out "$BATS_TEST_TMPDIR/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" pagesha "$BATS_TEST_TMPDIR/out/_run.json" terms
  [ "$status" -eq 0 ]
  declared="$output"
  run node "$ARC_ROOT/tests/legal-probe.mjs" sha "$BATS_TEST_TMPDIR/out/terms.mdx"
  [ "$status" -eq 0 ]
  [ "$declared" = "$output" ]
}

@test "legal hash: two different ventures do not share a facts hash" {
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/g"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/g/_run.json" facts_sha256
  [ "$status" -eq 0 ]
  one="$output"
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "fixture-none-nogst" --out "$BATS_TEST_TMPDIR/n"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/n/_run.json" facts_sha256
  [ "$status" -eq 0 ]
  [ "$one" != "$output" ]
}

@test "legal hash: editing one template moves every page in the set" {
  # template_set_sha covers the whole set, so a fix to one page forces re-approval of all of
  # them. That is the intent of ADR-1005, and this is what asserts it.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/before"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" pagesha "$SANDBOX/before/_run.json" privacy
  [ "$status" -eq 0 ]
  before_privacy="$output"

  printf '\n\n' >> "$SANDBOX/products/legal/templates/v1/terms.tmpl.md"
  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/after"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" pagesha "$SANDBOX/after/_run.json" privacy
  [ "$status" -eq 0 ]
  [ "$before_privacy" != "$output" ]
}

@test "legal hash: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal hash: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}

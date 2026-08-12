#!/usr/bin/env bats
# Phase 00 -- the two export parsers and the normalizer (ADR-1015, ADR-1002, ADR-1012, ADR-1003).
#
# The contract tests here assert on a field only ONE format supplies. Retro 2026-08-03 (arc-engine)
# recorded a contract suite that passed all three drivers by exercising one shared helper while
# none of their real per-driver code ran; a suite that only checks the shared row shape would pass
# with either parser swapped in, or with a stub. So: razorpay rows must carry `settlement_id`, MoR
# rows must carry `settlement_batch_id`, and each parser is fed the OTHER rail's file and must fail.
#
# Test names are ASCII-only (bats silently drops non-ASCII @test names).
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN="$ARC_ROOT/tests/ledger-parse-runner.mjs"
RZ="$ARC_ROOT/tests/fixtures/ledger/razorpay"
MO="$ARC_ROOT/tests/fixtures/ledger/mor"

# ---------- happy path ----------

@test "parsers: the razorpay good fixture yields 4 rows summing to its own declared total" {
  run node "$RUN" razorpay "$RZ/01-good-multi-row.csv"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ] || { echo "parser produced no output at all"; false; }
  run node "$ARC_ROOT/tests/ledger-sum-runner.mjs" razorpay "$RZ/01-good-multi-row.csv"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "rows=4 net=352661" ] || { echo "expected rows=4 net=352661, got: $output"; false; }
}

@test "parsers: the mor good fixture yields 3 rows summing to its own declared total" {
  run node "$ARC_ROOT/tests/ledger-sum-runner.mjs" mor "$MO/01-good-multi-row.csv"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "rows=3 net=13029" ] || { echo "expected rows=3 net=13029, got: $output"; false; }
}

@test "parsers: columns are resolved by NAME, since both fixture headers are ordered unlike Appendix C" {
  # If either parser resolved by index it would mis-read every field of these files, and the
  # amount assertions above would not merely differ -- they would be nonsense.
  run node "$RUN" razorpay "$RZ/01-good-multi-row.csv"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"gross":118000'* ]] || { echo "$output"; false; }
  [[ "$output" == *'"tax":18000'* ]]
  [[ "$output" == *'"fees":2000'* ]]
}

@test "parsers: non-round paise survive as exact integers, never a float round-trip" {
  # 590.50 / 90.08 / 11.81 are the values a float would quietly move.
  run node "$RUN" razorpay "$RZ/01-good-multi-row.csv"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"gross":59050'* ]] || { echo "$output"; false; }
  [[ "$output" == *'"tax":9008'* ]]
  [[ "$output" == *'"fees":1181'* ]]
  [[ "$output" == *'"net":48861'* ]]
}

# ---------- the PII law (ADR-1002) ----------

@test "parsers: unrecognized columns are dropped, so no address or free text can reach a payload" {
  # Both good fixtures deliberately carry an email column and a free-text description column.
  local i out
  for i in razorpay mor; do
    if [ "$i" = "razorpay" ]; then out="$(node "$RUN" razorpay "$RZ/01-good-multi-row.csv")"; else out="$(node "$RUN" mor "$MO/01-good-multi-row.csv")"; fi
    [ -n "$out" ] || { echo "$i produced no output"; false; }
    [[ "$out" != *"example.invalid"* ]] || { echo "$i leaked an email address: $out"; false; }
    [[ "$out" != *"customer_email"* ]] || { echo "$i leaked the email column name: $out"; false; }
    [[ "$out" != *"buyer_email"* ]] || { echo "$i leaked the email column name: $out"; false; }
    [[ "$out" != *"LexOS Pro"* ]] || { echo "$i leaked a free-text description: $out"; false; }
  done
}

# ---------- the asymmetry that makes the contract test real ----------

@test "parsers: razorpay rows carry settlement_id and mor rows carry settlement_batch_id" {
  run node "$RUN" razorpay "$RZ/01-good-multi-row.csv"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"settlement_id"'* ]] || { echo "$output"; false; }
  [[ "$output" != *'"settlement_batch_id"'* ]] || { echo "razorpay emitted the mor-only field: $output"; false; }

  run node "$RUN" mor "$MO/01-good-multi-row.csv"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"settlement_batch_id"'* ]] || { echo "$output"; false; }
}

@test "parsers: each parser REFUSES the other rail's file, so neither could stand in for the other" {
  run node "$RUN" razorpay "$MO/01-good-multi-row.csv"
  [ "$status" -eq 1 ] || { echo "razorpay parsed a mor file: $output"; false; }
  run node "$RUN" mor "$RZ/01-good-multi-row.csv"
  [ "$status" -eq 1 ] || { echo "mor parsed a razorpay file: $output"; false; }
}

# ---------- byte-level input ----------

@test "parsers: a BOM plus CRLF endings and no trailing newline parse to the same rows" {
  # This fixture IS its bytes; .gitattributes carries `tests/fixtures/ledger/** -text` so git
  # cannot normalize the CRs away. It already did once, on the commit that created the directory.
  run node "$ARC_ROOT/tests/ledger-sum-runner.mjs" razorpay "$RZ/02-crlf-bom.csv"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == rows=* ]] || { echo "$output"; false; }
  run node "$ARC_ROOT/tests/ledger-sum-runner.mjs" mor "$MO/02-crlf-bom.csv"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "parsers: the CRLF fixture really does carry carriage returns in the checkout" {
  # A negative control on the control. If .gitattributes stops holding, this fails LOUDLY here
  # rather than leaving the test above quietly passing on a file that is no longer what it claims.
  local crs
  crs="$(tr -cd '\r' < "$RZ/02-crlf-bom.csv" | wc -c | tr -d ' ')"
  [ "$crs" -gt 0 ] || { echo "02-crlf-bom.csv has NO carriage returns in this checkout -- git normalized it and the fixture is testing nothing"; false; }
}

# ---------- malformed input is refused, never half-parsed ----------

@test "parsers: every malformed fixture throws and names the row, returning no partial list" {
  local f fails=""
  for f in "$RZ"/0[34567]-*.csv; do
    run node "$RUN" razorpay "$f"
    { [ "$status" -eq 1 ] && [[ "$output" == *"PARSE_ERROR"* ]]; } || fails="$fails|razorpay $(basename "$f") status=$status out=$output"
  done
  for f in "$MO"/0[34567]-*.csv; do
    run node "$RUN" mor "$f"
    { [ "$status" -eq 1 ] && [[ "$output" == *"PARSE_ERROR"* ]]; } || fails="$fails|mor $(basename "$f") status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "parsers: an amount finer than a paise is refused rather than rounded" {
  run node "$RUN" razorpay "$RZ/04-malformed-three-decimals.csv"
  [ "$status" -eq 1 ]
  [[ "$output" == *"PARSE_ERROR"* ]]
}

# ---------- the normalizer owns the timezone conversion ----------

@test "normalizer: a UTC settlement instant becomes the IST instant the spine will store" {
  # mor row 3 settles at 18:45:03 UTC on the 14th, which is 00:15:03 IST on the 15th. At a month
  # boundary this is the difference between two months of P&L, and it is the only place in the
  # lane where a zone conversion happens at all.
  run node "$ARC_ROOT/tests/ledger-normalize-runner.mjs" mor "$MO/01-good-multi-row.csv" lexos
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ]
  [[ "$output" == *"2026-09-15T00:15:03+05:30"* ]] || { echo "expected the IST-converted instant: $output"; false; }
}

@test "normalizer: the ex-tax amount is recovered as gross minus tax, matching Appendix A" {
  run node "$ARC_ROOT/tests/ledger-normalize-runner.mjs" razorpay "$RZ/01-good-multi-row.csv" lexos
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"amount":100000'* ]] || { echo "expected 118000 gross minus 18000 tax: $output"; false; }
}

@test "normalizer: a normalized payload passes the real validator on the real ingest path" {
  # The whole point of the chain: parse a file, normalize a row, and have the spine accept it
  # without a hand-edit. If the normalizer emitted a field the closed schema refuses, this fails.
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"
  export ARC_SPINE_RAND="norm-seed"
  node "$ARC_ROOT/tests/ledger-normalize-runner.mjs" razorpay "$RZ/01-good-multi-row.csv" lexos --payload-only > "$BATS_TEST_TMPDIR/pay.json"
  [ -s "$BATS_TEST_TMPDIR/pay.json" ] || { echo "no payload produced"; false; }
  run bash "$ARC_ROOT/.claude/scripts/hq/arc-event.sh" ingest revenue.received --json "$BATS_TEST_TMPDIR/pay.json" --venture lexos
  [ "$status" -eq 0 ] || { echo "the validator refused a normalized payload: $output"; false; }
}

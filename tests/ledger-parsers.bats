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
  # Each provider is checked against the column ITS OWN fixture actually carries. The first version
  # asserted both `customer_email` and `buyer_email` were absent from both outputs -- but razorpay's
  # fixture has no buyer_email column and mor's has no customer_email column, so half of every
  # iteration was an assertion that could never fail.
  local out
  out="$(node "$RUN" razorpay "$RZ/01-good-multi-row.csv")"
  [ -n "$out" ] || { echo "razorpay produced no output"; false; }
  [[ "$out" != *"example.invalid"* ]] || { echo "razorpay leaked an email address: $out"; false; }
  [[ "$out" != *"customer_email"* ]] || { echo "razorpay leaked its email column name: $out"; false; }
  [[ "$out" != *"LexOS Pro"* ]] || { echo "razorpay leaked a free-text description: $out"; false; }

  out="$(node "$RUN" mor "$MO/01-good-multi-row.csv")"
  [ -n "$out" ] || { echo "mor produced no output"; false; }
  [[ "$out" != *"example.invalid"* ]] || { echo "mor leaked an email address: $out"; false; }
  [[ "$out" != *"buyer_email"* ]] || { echo "mor leaked its email column name: $out"; false; }
  [[ "$out" != *"LexOS Pro"* ]] || { echo "mor leaked a free-text product name: $out"; false; }

  # The columns really are in the fixtures -- otherwise the four assertions above are checking that
  # the parser did not invent data it was never given, which is not the claim being made.
  grep -q 'customer_email' "$RZ/01-good-multi-row.csv" || { echo "razorpay fixture no longer carries customer_email -- the PII assertion above is now vacuous"; false; }
  grep -q 'buyer_email' "$MO/01-good-multi-row.csv" || { echo "mor fixture no longer carries buyer_email -- the PII assertion above is now vacuous"; false; }
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

@test "parsers: a BOM plus CRLF endings and no trailing newline parse to exact pinned rows" {
  # This fixture IS its bytes; .gitattributes carries `tests/fixtures/ledger/** -text` so git
  # cannot normalize the CRs away. It already did once, on the commit that created the directory.
  #
  # The figures are PINNED. An earlier version asserted only `rows=*`, which a header-only file
  # satisfies with `rows=0 net=0` -- so the test named "parse to the same rows" would have passed
  # over a fixture containing no rows at all.
  run node "$ARC_ROOT/tests/ledger-sum-runner.mjs" razorpay "$RZ/02-crlf-bom.csv"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "rows=2 net=62059" ] || { echo "expected rows=2 net=62059, got: $output"; false; }
  run node "$ARC_ROOT/tests/ledger-sum-runner.mjs" mor "$MO/02-crlf-bom.csv"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "rows=2 net=4930" ] || { echo "expected rows=2 net=4930, got: $output"; false; }
}

@test "parsers: BOTH CRLF fixtures really carry carriage returns in the checkout" {
  # A negative control on the control. If .gitattributes stops holding, this fails LOUDLY here
  # rather than leaving the test above quietly passing on a file that is no longer what it claims.
  #
  # Both rails, deliberately: the first version of this control checked razorpay only, which is the
  # twin-fix-not-applied shape CLAUDE.md names -- the mor fixture carries the same 3 CRs and had no
  # control at all.
  local f crs fails=""
  for f in "$RZ/02-crlf-bom.csv" "$MO/02-crlf-bom.csv"; do
    crs="$(tr -cd '\r' < "$f" | wc -c | tr -d ' ')"
    [ "$crs" -gt 0 ] || fails="$fails|$f has NO carriage returns -- git normalized it and the fixture is testing nothing"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

# ---------- malformed input is refused, never half-parsed ----------

@test "parsers: every malformed fixture throws and names the row, returning no partial list" {
  # THE COUNT IS ASSERTED. Without it this loop is green over an EMPTY fixture set: bash passes an
  # unmatched glob through literally, the runner cannot open it, and a status check alone accepts
  # that as "refused". Deleting every malformed fixture used to leave this test passing.
  #
  # And status 1 now means PARSE REJECTION specifically -- the runner exits 2 for a missing file or
  # a missing parser module, so "the implementation is gone" can no longer masquerade as "the input
  # was refused".
  local f fails="" rz=0 mo=0
  for f in "$RZ"/0[345678]-*.csv; do
    [ -f "$f" ] || continue
    rz=$((rz+1))
    run node "$RUN" razorpay "$f"
    { [ "$status" -eq 1 ] && [[ "$output" == *"PARSE_ERROR"* ]]; } || fails="$fails|razorpay $(basename "$f") status=$status out=$output"
  done
  for f in "$MO"/0[345678]-*.csv; do
    [ -f "$f" ] || continue
    mo=$((mo+1))
    run node "$RUN" mor "$f"
    { [ "$status" -eq 1 ] && [[ "$output" == *"PARSE_ERROR"* ]]; } || fails="$fails|mor $(basename "$f") status=$status out=$output"
  done
  [ "$rz" -eq 6 ] || { echo "expected 6 razorpay malformed fixtures, processed $rz"; false; }
  [ "$mo" -eq 6 ] || { echo "expected 6 mor malformed fixtures, processed $mo"; false; }
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "parsers: a missing file and a missing parser are exit 2, never mistakable for a rejection" {
  # The control that makes every `status -eq 1` assertion above mean something.
  run node "$RUN" razorpay "$RZ/does-not-exist.csv"
  [ "$status" -eq 2 ] || { echo "a missing file reported status $status: $output"; false; }
  [[ "$output" == *"READ_ERROR"* ]] || { echo "$output"; false; }
  run node "$RUN" stripe "$RZ/01-good-multi-row.csv"
  [ "$status" -eq 2 ] || { echo "a missing parser module reported status $status: $output"; false; }
  [[ "$output" == *"LOAD_ERROR"* ]] || { echo "$output"; false; }
}

@test "parsers: an amount split by a closing quote is refused, on BOTH rails" {
  # `"1180"00` parsed as 118000 minor units where 1180.00 was written -- a 100x error that leaves
  # net == gross - tax - fees intact, so every other check in the lane passes it. The declared
  # total in each fixture matches the SMUGGLED figures on purpose, so the quote rule is the only
  # thing that can catch it. Found on razorpay by the adversarial pass and pinned on both, because
  # a fix is not applied until it has been made where it was never found.
  run node "$RUN" razorpay "$RZ/08-malformed-quote-split-amount.csv"
  [ "$status" -eq 1 ] || { echo "razorpay accepted a quote-split amount: $output"; false; }
  [[ "$output" == *"closing quote"* ]] || { echo "$output"; false; }
  run node "$RUN" mor "$MO/08-malformed-quote-split-amount.csv"
  [ "$status" -eq 1 ] || { echo "mor accepted a quote-split amount: $output"; false; }
  [[ "$output" == *"closing quote"* ]] || { echo "$output"; false; }
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

@test "this suite registers every test it declares" {
  # bats SILENTLY DROPS a @test whose name carries a non-ASCII character: five tests once vanished
  # from a suite in this repo, never ran, never failed, and the file stayed green -- the only signal
  # was the count falling. So the count is checked.
  #
  # DERIVED on both sides, never pinned to a literal. Retro 2026-08-12 (arc-memory) recorded a suite
  # that pinned its registered count as a literal and went red for the crime of adding a test, while
  # the suite next door derived it. Comparing declared against registered catches a dropped test and
  # stays quiet when the suite legitimately grows.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -gt 0 ] || { echo "no @test lines found -- the count itself is broken"; false; }
  [ "$registered" -eq "$declared" ] \
    || { echo "declared $declared tests but bats registered $registered -- one was dropped, check for a non-ASCII @test name"; false; }
}

#!/usr/bin/env bats
# Phase 00 -- REQ-01 twin-determinism (ADR-1014 / LED-O).
#
# `arc pnl` keeps NO state of its own, so `rm derived -> replay -> identical` on its own tests
# arc-replay's rebuild and carries the pnl render along for the ride. That is why there are TWO
# assertions here, not one:
#
#   ENGINE EQUIVALENCE is the one that actually exercises the render -- the scan engine reads the
#   JSONL day files, the sqlite engine reads derived/state.db, and the same P&L must come out of
#   both. This is where a comparator whose order depends on arrival order would show up.
#
#   REBUILD DETERMINISM is the classic: delete derived state, replay, get the same bytes.
#
# And a NEGATIVE CONTROL ON THE CONTROL: each leg asserts WHICH ENGINE IT ACTUALLY RAN, read from
# arc-pnl's own stderr under ARC_SPINE_DEBUG. Without that, a box with no node:sqlite runs `scan`
# twice, compares a thing to itself, and reports the equivalence gate green -- byte-for-byte the
# same output a working gate produces. The skip below is therefore LOUD and named.
#
# The engine name goes to STDERR and never into the P&L body, on purpose: if it were rendered, the
# two legs would differ by construction and the byte-identity they exist to prove would be
# impossible to state.
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
EVENT="$HQ/arc-event.sh"
PNL="$HQ/arc-pnl.sh"
JUL=1784736000000

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="ledger-seed"
  _tick=0
}
_need_sqlite() {
  node -e 'import("node:sqlite").then(()=>process.exit(0),()=>process.exit(1))' 2>/dev/null \
    || skip "node:sqlite unavailable (Node < 22) -- engine equivalence NOT exercised on this leg"
}
_ing() {
  local json="$1"; shift
  _tick=$((_tick+1))
  printf '%s' "$json" > "$BATS_TEST_TMPDIR/d-$_tick.json"
  ARC_SPINE_NOW=$((JUL + _tick*1000)) bash "$EVENT" ingest revenue.received --json "$BATS_TEST_TMPDIR/d-$_tick.json" "$@"
}

# A corpus with real structure: two ventures, a foreign charge, a refund, an overhead cost.
_corpus() {
  _ing '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:d1","customer_ref":"razorpay:cust_1","plan":"pro","interval":"monthly","gross":118000,"tax":18000,"fees":2000,"net":98000}' --venture lexos
  _ing '{"amount":5000,"currency":"USD","venture":"lexos","provider":"mor","provider_payment_id":"mor:d2","fx":{"rate":"83.20","source":"provider-settlement","date":"2026-07-22"}}' --venture lexos
  _ing '{"amount":20000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:d3","refund_of":"razorpay:d1"}' --venture lexos
  _ing '{"amount":75000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:d4"}'
}

@test "determinism: scan and sqlite render byte-identical P&L, and each leg names the engine it ran" {
  _need_sqlite
  _corpus
  node "$HQ/arc-replay.mjs" --quiet

  ARC_SPINE_DEBUG=1 bash "$PNL" --month 2026-07 --engine scan \
    > "$BATS_TEST_TMPDIR/scan.txt" 2> "$BATS_TEST_TMPDIR/scan.err"
  ARC_SPINE_DEBUG=1 bash "$PNL" --month 2026-07 --engine sqlite \
    > "$BATS_TEST_TMPDIR/sqlite.txt" 2> "$BATS_TEST_TMPDIR/sqlite.err"

  # Assert the legs RAN, and ran DIFFERENT engines, before asserting they agree. Comparing scan
  # to scan is the failure this control exists to make impossible.
  grep -q 'engine=scan'   "$BATS_TEST_TMPDIR/scan.err"   || { echo "scan leg did not report engine=scan: $(cat "$BATS_TEST_TMPDIR/scan.err")"; false; }
  grep -q 'engine=sqlite' "$BATS_TEST_TMPDIR/sqlite.err" || { echo "sqlite leg did not report engine=sqlite: $(cat "$BATS_TEST_TMPDIR/sqlite.err")"; false; }
  [ -s "$BATS_TEST_TMPDIR/scan.txt" ] || { echo "scan leg produced no P&L at all"; false; }

  run diff "$BATS_TEST_TMPDIR/scan.txt" "$BATS_TEST_TMPDIR/sqlite.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "determinism: deleting derived state and replaying reproduces the P&L byte for byte" {
  _corpus
  bash "$PNL" --month 2026-07 > "$BATS_TEST_TMPDIR/before.txt"
  [ -s "$BATS_TEST_TMPDIR/before.txt" ] || { echo "no P&L produced before the rebuild"; false; }

  rm -rf "$SPINE/derived"
  node "$HQ/arc-replay.mjs" --quiet

  bash "$PNL" --month 2026-07 > "$BATS_TEST_TMPDIR/after.txt"
  run diff "$BATS_TEST_TMPDIR/before.txt" "$BATS_TEST_TMPDIR/after.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "determinism: an all-ties corpus still renders in one fixed order through both engines" {
  # Rows sharing every displayed field, ingested in an order deliberately unlike any sorted order.
  # Retro 2026-08-12 (arc-memory): an equivalence gate stayed green at exit 0 with its comparator
  # inverted, because it compared its own printed contract instead of real output. A tie-free
  # corpus cannot catch that; this one can, because only a TOTAL comparator survives it.
  _need_sqlite
  _ing '{"amount":10000,"currency":"INR","venture":"tied","provider":"razorpay","provider_payment_id":"razorpay:z9"}' --venture tied
  _ing '{"amount":10000,"currency":"INR","venture":"tied","provider":"razorpay","provider_payment_id":"razorpay:a1"}' --venture tied
  _ing '{"amount":10000,"currency":"INR","venture":"tied","provider":"razorpay","provider_payment_id":"razorpay:m5"}' --venture tied
  node "$HQ/arc-replay.mjs" --quiet

  bash "$PNL" --month 2026-07 --engine scan   > "$BATS_TEST_TMPDIR/t-scan.txt"
  bash "$PNL" --month 2026-07 --engine sqlite > "$BATS_TEST_TMPDIR/t-sqlite.txt"
  [ -s "$BATS_TEST_TMPDIR/t-scan.txt" ] || { echo "all-ties corpus produced no output"; false; }

  run diff "$BATS_TEST_TMPDIR/t-scan.txt" "$BATS_TEST_TMPDIR/t-sqlite.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  # Re-running the same engine twice must also be stable: an unstable sort can agree across
  # engines by luck on one run and disagree on the next.
  bash "$PNL" --month 2026-07 --engine scan > "$BATS_TEST_TMPDIR/t-scan2.txt"
  run diff "$BATS_TEST_TMPDIR/t-scan.txt" "$BATS_TEST_TMPDIR/t-scan2.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "determinism: the P&L body never carries the engine name" {
  # If it did, the equivalence assertion above would be comparing two strings that differ by
  # construction, and the gate could never pass -- or, worse, would be quietly relaxed until it did.
  _corpus
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  [[ "$output" != *"engine="* ]] || { echo "the engine leaked into stdout: $output"; false; }
}

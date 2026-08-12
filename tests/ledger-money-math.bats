#!/usr/bin/env bats
# Phase 00 -- REQ-01 / REQ-02 / REQ-04: the money math and its edge cases.
#
# Money is integer minor units end to end (ADR-1012). Every assertion below is on exact integers,
# because the whole reason this lane exists is that a P&L is worth nothing the first time a number
# is wrong. Test names are ASCII-only (bats silently drops non-ASCII @test names).
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
PNL="$ARC_ROOT/.claude/scripts/hq/arc-pnl.sh"

# 2026-07-22, 2026-08-22, 2026-09-22 in epoch ms. Distinct months, so MRR transitions are visible.
JUL=1784736000000
AUG=1787414400000
SEP=1790092800000

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="00112233445566778899"
  _tick=0
}
# Each ingest advances the clock by a second so two events in one month get distinct ULIDs; a
# fixed clock plus a fixed rand would mint the same id twice and the second would dedupe away.
_ing() {
  local kind="$1" json="$2" base="$3"; shift 3
  _tick=$((_tick+1))
  printf '%s' "$json" > "$BATS_TEST_TMPDIR/p-$_tick.json"
  ARC_SPINE_NOW=$((base + _tick*1000)) bash "$EVENT" ingest "$kind" --json "$BATS_TEST_TMPDIR/p-$_tick.json" "$@"
}
_lines() { cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }

# ---------- the cross-field invariant (PLAN Appendix A) ----------

@test "money: gross must equal amount plus tax" {
  local bad='{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","gross":999999,"tax":18000,"fees":2000,"net":98000}'
  run _ing revenue.received "$bad" "$JUL"
  [ "$status" -eq 2 ] || { echo "expected reject, got $status: $output"; false; }
  [[ "$output" == *"BAD_LEDGER_MONEY"* ]]
  [ "$(_lines)" = "0" ]
}

@test "money: net must equal gross minus tax minus fees" {
  local bad='{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","gross":118000,"tax":18000,"fees":2000,"net":999999}'
  run _ing revenue.received "$bad" "$JUL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_MONEY"* ]]
  [ "$(_lines)" = "0" ]
}

@test "money: the four components travel together or not at all" {
  local bad='{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","gross":118000,"tax":18000}'
  run _ing revenue.received "$bad" "$JUL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_MONEY"* ]]
  [ "$(_lines)" = "0" ]
}

@test "money: the worked example from PLAN Appendix A is accepted exactly as written" {
  local ok='{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_XXXX","customer_ref":"razorpay:cust_XXXX","plan":"pro","interval":"monthly","gross":118000,"tax":18000,"fees":2000,"net":98000}'
  run _ing revenue.received "$ok" "$JUL"
  [ "$status" -eq 0 ] || { echo "the plan's own normative example was refused: $output"; false; }
  [ "$(_lines)" = "1" ]
}

# ---------- currency honesty (REQ-04, ADR-1003) ----------

@test "money: a non-INR payload without fx is refused, and an INR payload with fx is refused too" {
  local i=0 bad fails=""
  for bad in '{"amount":5000,"currency":"USD","venture":"arc","provider":"mor","provider_payment_id":"mor:pay_0001"}' \
             '{"amount":5000,"currency":"INR","venture":"arc","provider":"mor","provider_payment_id":"mor:pay_0002","fx":{"rate":"83.20","source":"provider-settlement","date":"2026-09-14"}}'; do
    i=$((i+1))
    SPINE="$BATS_TEST_TMPDIR/fx-$i"; mkdir -p "$SPINE"; export ARC_SPINE_ROOT="$SPINE"
    run _ing revenue.received "$bad" "$JUL"
    { [ "$status" -eq 2 ] && [[ "$output" == *"BAD_LEDGER_FX"* ]] && [ "$(_lines)" = "0" ]; } \
      || fails="$fails|[$bad] status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "money: an fx rate given as a float rather than a decimal string is refused" {
  local bad='{"amount":5000,"currency":"USD","venture":"arc","provider":"mor","provider_payment_id":"mor:pay_0001","fx":{"rate":83.2,"source":"provider-settlement","date":"2026-09-14"}}'
  run _ing revenue.received "$bad" "$JUL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_FX"* ]]
  [ "$(_lines)" = "0" ]
}

@test "money: an fx date that is not a real calendar day is refused" {
  local bad='{"amount":5000,"currency":"USD","venture":"arc","provider":"mor","provider_payment_id":"mor:pay_0001","fx":{"rate":"83.20","source":"provider-settlement","date":"2026-02-31"}}'
  run _ing revenue.received "$bad" "$JUL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_FX"* ]]
  [ "$(_lines)" = "0" ]
}

@test "money: a USD charge renders its original currency beside INR, converted at the recorded rate" {
  # 5000 cents at 83.20 = 416000 paise = 4,160.00
  _ing revenue.received '{"amount":5000,"currency":"USD","venture":"arc","provider":"mor","provider_payment_id":"mor:pay_0001","fx":{"rate":"83.20","source":"provider-settlement","date":"2026-07-22"}}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ]
  [[ "$output" == *"4,160.00"* ]] || { echo "expected the converted INR figure: $output"; false; }
  [[ "$output" == *"USD"* ]]
  [[ "$output" == *"83.20"* ]]
}

# ---------- refunds (ADR-1016 / LED-Q) ----------

@test "money: an over-refund raises a needs-you flag and is never netted away" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_A"}' "$JUL"
  _ing revenue.received '{"amount":150000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:ref_A","refund_of":"razorpay:pay_A"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  [[ "$output" == *"OVER_REFUND"* ]] || { echo "over-refund not flagged: $output"; false; }
}

@test "money: a refund naming a charge that is not on the spine is a needs-you, not a silent negative" {
  _ing revenue.received '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:ref_B","refund_of":"razorpay:pay_MISSING"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUND_WITHOUT_CHARGE"* ]] || { echo "$output"; false; }
}

@test "money: a refund in a different currency from its charge is refused comparison, not converted" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"mor","provider_payment_id":"mor:pay_C"}' "$JUL"
  _ing revenue.received '{"amount":500,"currency":"USD","venture":"arc","provider":"mor","provider_payment_id":"mor:ref_C","refund_of":"mor:pay_C","fx":{"rate":"83.20","source":"provider-settlement","date":"2026-07-22"}}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUND_CURRENCY_MISMATCH"* ]] || { echo "$output"; false; }
}

@test "money: an event cannot refund itself" {
  local bad='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_D","refund_of":"razorpay:pay_D"}'
  run _ing revenue.received "$bad" "$JUL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_ID"* ]]
  [ "$(_lines)" = "0" ]
}

# ---------- natural-key duplicates (ADR-1010 / LED-K) ----------

@test "money: the same payment id on two differing events is flagged and BOTH leave the totals" {
  # Content-idem cannot catch this: the payloads genuinely differ, which is the whole point.
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_E"}' "$JUL"
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_E","plan":"pro"}' "$JUL"
  [ "$(_lines)" = "2" ]
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"DUPLICATE_PAYMENT"* ]] || { echo "$output"; false; }
  # Excluded, not netted and not first-wins: no venture section should have been produced at all.
  [[ "$output" != *"cash-in 1,000.00"* ]] || { echo "a duplicate was counted: $output"; false; }
}

# ---------- MRR transitions (REQ-02, ADR-1007) ----------

@test "money: MRR reports new, expansion, contraction and reactivation across months" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:s1","customer_ref":"razorpay:cust_1","plan":"pro","interval":"monthly"}' "$JUL" --venture lexos
  _ing revenue.received '{"amount":200000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:s2","customer_ref":"razorpay:cust_1","plan":"max","interval":"monthly"}' "$AUG" --venture lexos
  run bash "$PNL" --venture lexos
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ]
  [[ "$output" == *"new"* ]]
  [[ "$output" == *"expansion"* ]] || { echo "expected an expansion transition: $output"; false; }
}

@test "money: a plan change is expansion or contraction, never a churn plus a new" {
  # The subscription identity is venture plus customer_ref and deliberately NOT plan: including
  # plan would make every upgrade look like one subscription dying and another being born.
  _ing revenue.received '{"amount":200000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:t1","customer_ref":"razorpay:cust_2","plan":"max","interval":"monthly"}' "$JUL" --venture lexos
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:t2","customer_ref":"razorpay:cust_2","plan":"pro","interval":"monthly"}' "$AUG" --venture lexos
  run bash "$PNL" --venture lexos
  [ "$status" -eq 0 ]
  [[ "$output" == *"contraction"* ]] || { echo "$output"; false; }
  [[ "$output" != *"churn"* ]] || { echo "a plan change was reported as churn: $output"; false; }
}

@test "money: a gap month makes the next charge a reactivation rather than an expansion" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:u1","customer_ref":"razorpay:cust_3","plan":"pro","interval":"monthly"}' "$JUL" --venture lexos
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:u2","customer_ref":"razorpay:cust_3","plan":"pro","interval":"monthly"}' "$SEP" --venture lexos
  run bash "$PNL" --venture lexos
  [ "$status" -eq 0 ]
  [[ "$output" == *"reactivation"* ]] || { echo "$output"; false; }
}

@test "money: an annual plan is normalized to a monthly figure and never added to cash-in" {
  # 1,200,000 paise a year is 100,000 a month; cash-in stays the full 12,000.00 that arrived.
  _ing revenue.received '{"amount":1200000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:v1","customer_ref":"razorpay:cust_4","plan":"pro","interval":"annual"}' "$JUL" --venture lexos
  run bash "$PNL" --venture lexos --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"cash-in 12,000.00"* ]] || { echo "expected the full cash-in: $output"; false; }
  [[ "$output" == *"MRR 1,000.00"* ]] || { echo "expected the normalized MRR: $output"; false; }
}

@test "money: a one_time payment is cash-in with no MRR at all" {
  _ing revenue.received '{"amount":500000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:w1","customer_ref":"razorpay:cust_5","interval":"one_time"}' "$JUL" --venture lexos
  run bash "$PNL" --venture lexos --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"cash-in 5,000.00"* ]]
  [[ "$output" == *"MRR "*"—"* ]] || { echo "a one_time payment produced an MRR: $output"; false; }
}

# ---------- real vs simulated (REQ-01) ----------

@test "money: a simulated event never appears in the real view, and the real view is byte-identical without it" {
  _ing revenue.received  '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:real_1"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  local before="$output"
  _ing revenue.simulated '{"amount":900000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:sim_1"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [ "$output" = "$before" ] || { echo "a simulated event changed the real view"; diff <(echo "$before") <(echo "$output") || true; false; }
  [[ "$output" != *"9,000.00"* ]]
}

@test "money: the simulated view watermarks every line and shows no real revenue" {
  _ing revenue.received  '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:real_2"}' "$JUL"
  _ing revenue.simulated '{"amount":900000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:sim_2"}' "$JUL"
  run bash "$PNL" --month 2026-07 --simulated
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  [[ "$output" == *"9,000.00"* ]]
  [[ "$output" != *"1,000.00"* ]] || { echo "real revenue leaked into the simulated view: $output"; false; }
  # Every non-blank line carries the mark.
  local unmarked
  unmarked="$(printf '%s\n' "$output" | sed '/^$/d' | grep -c -v 'SIMULATED' || true)"
  [ "$unmarked" = "0" ] || { echo "$unmarked line(s) in the simulated view carry no watermark: $output"; false; }
}

# ---------- honest emptiness ----------

@test "money: an empty spine renders honest-empty and never a fabricated zero row" {
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ]
  [[ "$output" == *"no real revenue yet"* ]] || { echo "$output"; false; }
}

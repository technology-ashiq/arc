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
  arc_leave_the_repo || return 1
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
  local ok='{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_QX7fK2mNbT1aZ9","customer_ref":"razorpay:cust_9nQ2rT7bV1xK","plan":"pro","interval":"monthly","gross":118000,"tax":18000,"fees":2000,"net":98000}'
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
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_a010"}' "$JUL"
  _ing revenue.received '{"amount":150000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:ref_a010","refund_of":"razorpay:pay_a010"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  [[ "$output" == *"OVER_REFUND"* ]] || { echo "over-refund not flagged: $output"; false; }
}

@test "money: a refund naming a charge that is not on the spine is a needs-you, not a silent negative" {
  _ing revenue.received '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:ref_b010","refund_of":"razorpay:pay_miss01"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUND_WITHOUT_CHARGE"* ]] || { echo "$output"; false; }
}

@test "money: a refund in a different currency from its charge is refused comparison, not converted" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"mor","provider_payment_id":"mor:pay_c003"}' "$JUL"
  _ing revenue.received '{"amount":500,"currency":"USD","venture":"arc","provider":"mor","provider_payment_id":"mor:ref_c003","refund_of":"mor:pay_c003","fx":{"rate":"83.20","source":"provider-settlement","date":"2026-07-22"}}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUND_CURRENCY_MISMATCH"* ]] || { echo "$output"; false; }
}

@test "money: an event cannot refund itself" {
  local bad='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_d010","refund_of":"razorpay:pay_d010"}'
  run _ing revenue.received "$bad" "$JUL"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_ID"* ]]
  [ "$(_lines)" = "0" ]
}

# ---------- natural-key duplicates (ADR-1010 / LED-K) ----------

@test "money: the same payment id on two differing events is flagged and BOTH leave the totals" {
  # Content-idem cannot catch this: the payloads genuinely differ, which is the whole point.
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_e010"}' "$JUL"
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_e010","plan":"pro"}' "$JUL"
  [ "$(_lines)" = "2" ]
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"DUPLICATE_PAYMENT"* ]] || { echo "$output"; false; }
  # Excluded, not netted and not first-wins: no venture section should have been produced at all.
  [[ "$output" != *"cash-in 1,000.00"* ]] || { echo "a duplicate was counted: $output"; false; }
}

# ---------- MRR transitions (REQ-02, ADR-1007) ----------

@test "money: MRR reports new, expansion, contraction and reactivation across months" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_s001","customer_ref":"razorpay:cust_c001","plan":"pro","interval":"monthly"}' "$JUL" --venture lexos
  _ing revenue.received '{"amount":200000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_s002","customer_ref":"razorpay:cust_c001","plan":"max","interval":"monthly"}' "$AUG" --venture lexos
  run bash "$PNL" --venture lexos
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ]
  [[ "$output" == *"new"* ]]
  [[ "$output" == *"expansion"* ]] || { echo "expected an expansion transition: $output"; false; }
}

@test "money: a plan change is expansion or contraction, never a churn plus a new" {
  # The subscription identity is venture plus customer_ref and deliberately NOT plan: including
  # plan would make every upgrade look like one subscription dying and another being born.
  _ing revenue.received '{"amount":200000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_t001","customer_ref":"razorpay:cust_c002","plan":"max","interval":"monthly"}' "$JUL" --venture lexos
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_t002","customer_ref":"razorpay:cust_c002","plan":"pro","interval":"monthly"}' "$AUG" --venture lexos
  run bash "$PNL" --venture lexos
  [ "$status" -eq 0 ]
  [[ "$output" == *"contraction"* ]] || { echo "$output"; false; }
  [[ "$output" != *"churn"* ]] || { echo "a plan change was reported as churn: $output"; false; }
}

@test "money: a gap month makes the next charge a reactivation rather than an expansion" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_u001","customer_ref":"razorpay:cust_c003","plan":"pro","interval":"monthly"}' "$JUL" --venture lexos
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_u002","customer_ref":"razorpay:cust_c003","plan":"pro","interval":"monthly"}' "$SEP" --venture lexos
  run bash "$PNL" --venture lexos
  [ "$status" -eq 0 ]
  [[ "$output" == *"reactivation"* ]] || { echo "$output"; false; }
}

@test "money: an annual plan is normalized to a monthly figure and never added to cash-in" {
  # 1,200,000 paise a year is 100,000 a month; cash-in stays the full 12,000.00 that arrived.
  _ing revenue.received '{"amount":1200000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_v001","customer_ref":"razorpay:cust_c004","plan":"pro","interval":"annual"}' "$JUL" --venture lexos
  run bash "$PNL" --venture lexos --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"cash-in 12,000.00"* ]] || { echo "expected the full cash-in: $output"; false; }
  [[ "$output" == *"MRR 1,000.00"* ]] || { echo "expected the normalized MRR: $output"; false; }
}

@test "money: a one_time payment is cash-in with no MRR at all" {
  _ing revenue.received '{"amount":500000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_w001","customer_ref":"razorpay:cust_c005","interval":"one_time"}' "$JUL" --venture lexos
  run bash "$PNL" --venture lexos --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"cash-in 5,000.00"* ]]
  # The exact cell, not "an em dash somewhere later in the render": the loose glob was satisfied by
  # any em dash anywhere in the output, so it would keep passing if the MRR cell stopped being one.
  [[ "$output" == *"cash-in 5,000.00   MRR —"* ]] || { echo "a one_time payment produced an MRR: $output"; false; }
}

# ---------- real vs simulated (REQ-01) ----------

@test "money: a simulated event never appears in the real view, and the real view is byte-identical without it" {
  _ing revenue.received  '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_real01"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  local before="$output"
  _ing revenue.simulated '{"amount":900000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:sim_s001"}' "$JUL"
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [ "$output" = "$before" ] || { echo "a simulated event changed the real view"; diff <(echo "$before") <(echo "$output") || true; false; }
  [[ "$output" != *"9,000.00"* ]]
}

@test "money: the simulated view watermarks every line and shows no real revenue" {
  _ing revenue.received  '{"amount":100000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_real02"}' "$JUL"
  _ing revenue.simulated '{"amount":900000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:sim_s002"}' "$JUL"
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

# ---------- the derivation holes the Phase-00 adversarial pass drove through ----------

@test "money: a USD subscription reports MRR in rupees, not in its own minor units" {
  # MRR was computed in the charge native currency and rendered as rupees, so a 50 dollar a month
  # subscription showed as "MRR 50.00" -- understated by the exchange rate, roughly 83x.
  _ing revenue.received '{"amount":5000,"currency":"USD","venture":"alpha","provider":"mor","provider_payment_id":"mor:txn_a0001","customer_ref":"mor:cust_a0001","plan":"pro","interval":"monthly","fx":{"rate":"83.20","source":"provider-settlement","date":"2026-07-22"}}' "$JUL" --venture alpha
  run bash "$PNL" --month 2026-07 --venture alpha
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"MRR 4,160.00"* ]] || { echo "expected the converted MRR: $output"; false; }
  [[ "$output" != *"MRR 50.00"* ]] || { echo "MRR is still in native minor units: $output"; false; }
}

@test "money: the all-time view does not count a lapsed subscription as current MRR" {
  # Without --month the coverage check was short-circuited, so every subscription that ever existed
  # counted as current: one charge in January still reported full MRR in August.
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"stale","provider":"razorpay","provider_payment_id":"razorpay:pay_j0001","customer_ref":"razorpay:cust_j0001","plan":"pro","interval":"monthly"}' "$JUL" --venture stale
  _ing revenue.received '{"amount":200000,"currency":"INR","venture":"fresh","provider":"razorpay","provider_payment_id":"razorpay:pay_g0001","customer_ref":"razorpay:cust_g0001","plan":"pro","interval":"monthly"}' "$SEP" --venture fresh
  run bash "$PNL"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ]
  [[ "$output" == *"MRR 2,000.00"* ]] || { echo "the live subscription lost its MRR: $output"; false; }
  [[ "$output" != *"MRR 1,000.00"* ]] || { echo "a lapsed subscription is still counted: $output"; false; }
}

@test "money: a refund declaring a different venture from its charge moves neither P and L" {
  # It was booked against whatever venture the refund itself declared, so one venture went negative
  # and another kept showing the charge unrefunded -- two wrong ledgers whose company total nets to
  # zero, which is exactly how it stays invisible.
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"gamma","provider":"razorpay","provider_payment_id":"razorpay:pay_g0002"}' "$JUL" --venture gamma
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"delta","provider":"razorpay","provider_payment_id":"razorpay:ref_g0002","refund_of":"razorpay:pay_g0002"}' "$JUL" --venture delta
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUND_VENTURE_MISMATCH"* ]] || { echo "$output"; false; }
  [[ "$output" == *"cash-in 1,000.00"* ]] || { echo "the charge should stand untouched: $output"; false; }
  [[ "$output" != *"-1,000.00"* ]] || { echo "the refund was applied to the wrong venture: $output"; false; }
}

@test "money: a refund recorded before its charge is flagged, not booked as negative revenue" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"eps","provider":"razorpay","provider_payment_id":"razorpay:ref_e0001","refund_of":"razorpay:pay_e0001"}' "$JUL" --venture eps
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"eps","provider":"razorpay","provider_payment_id":"razorpay:pay_e0001"}' "$AUG" --venture eps
  run bash "$PNL"
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUND_BEFORE_CHARGE"* ]] || { echo "$output"; false; }
}

@test "money: --venture does not conjure another venture out of a cost event" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"kappa","provider":"razorpay","provider_payment_id":"razorpay:pay_k0001"}' "$JUL" --venture kappa
  _ing cost.incurred '{"amount":50000,"currency":"INR","source":"declared"}' "$JUL" --venture lambda
  run bash "$PNL" --month 2026-07 --venture kappa
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"kappa"* ]]
  [[ "$output" != *"lambda"* ]] || { echo "a venture nobody asked for was rendered: $output"; false; }
}

@test "money: --venture does not report needs-you flags belonging to another venture" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"omicron","provider":"razorpay","provider_payment_id":"razorpay:pay_o0001"}' "$JUL" --venture omicron
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"omicron","provider":"razorpay","provider_payment_id":"razorpay:pay_o0001","plan":"pro"}' "$JUL" --venture omicron
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"xi","provider":"razorpay","provider_payment_id":"razorpay:pay_x0001"}' "$JUL" --venture xi
  run bash "$PNL" --month 2026-07 --venture xi
  [ "$status" -eq 0 ]
  [[ "$output" != *"DUPLICATE_PAYMENT"* ]] || { echo "xi was told about a duplicate in omicron: $output"; false; }
}

@test "money: a cost in an unpinned currency is excluded with a flag and the render survives" {
  # One such event used to abort the whole command. The spine is append-only, so the operator could
  # not delete it: the P and L stayed unreadable until someone shipped a code change.
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"nu","provider":"razorpay","provider_payment_id":"razorpay:pay_n0001"}' "$JUL" --venture nu
  _ing cost.incurred '{"amount":50000,"currency":"JPY","source":"declared"}' "$JUL" --venture nu
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ] || { echo "one unpinned-currency cost bricked the entire render: $output"; false; }
  [[ "$output" == *"cash-in 1,000.00"* ]] || { echo "the revenue vanished with it: $output"; false; }
  [[ "$output" == *"UNSUPPORTED_COST_CURRENCY"* ]] || { echo "$output"; false; }
}

@test "money: a duplicate is EXCLUDED, not merely flagged while both are counted" {
  # Mutant-resistant. The earlier version asserted only that "cash-in 1,000.00" was absent, which a
  # mutant that flags duplicates and keeps counting them satisfies just as well -- it renders
  # cash-in 2,000.00 instead. Neither total may appear.
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"dup","provider":"razorpay","provider_payment_id":"razorpay:pay_p0001"}' "$JUL" --venture dup
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"dup","provider":"razorpay","provider_payment_id":"razorpay:pay_p0001","plan":"pro"}' "$JUL" --venture dup
  run bash "$PNL" --month 2026-07
  [ "$status" -eq 0 ]
  [[ "$output" == *"DUPLICATE_PAYMENT"* ]] || { echo "$output"; false; }
  [[ "$output" != *"cash-in 2,000.00"* ]] || { echo "both duplicates were counted: $output"; false; }
  [[ "$output" != *"cash-in 1,000.00"* ]] || { echo "one duplicate was kept, which is correct only by luck: $output"; false; }
}

@test "money: a fully refunded subscription stops counting toward MRR" {
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"rho","provider":"razorpay","provider_payment_id":"razorpay:pay_r0001","customer_ref":"razorpay:cust_r0001","plan":"pro","interval":"monthly"}' "$JUL" --venture rho
  _ing revenue.received '{"amount":100000,"currency":"INR","venture":"rho","provider":"razorpay","provider_payment_id":"razorpay:ref_r0001","refund_of":"razorpay:pay_r0001"}' "$JUL" --venture rho
  run bash "$PNL" --month 2026-07 --venture rho
  [ "$status" -eq 0 ]
  [[ "$output" != *"MRR 1,000.00"* ]] || { echo "a fully refunded charge still reports MRR: $output"; false; }
}

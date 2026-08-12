#!/usr/bin/env bats
# Phase 00 -- ADR-1002 / LED-C: the revenue payload contract, PII-free by construction.
#
# This suite guards the ONE control in the ledger lane that no later phase can repair. The spine is
# append-only, its closed days are immutable, and redact.mjs is secrets-only -- so a customer email
# that reaches a revenue payload is on the record permanently. There is no "fix it later" here.
#
# It drives the REAL ingest path (arc-event ingest, which is strict mode and returns a real exit
# code), never a stub and never the library in isolation, because the guarantee being tested is
# "no path onto the spine bypasses this" and only the real path can demonstrate that.
#
# Test names are ASCII-only on purpose: bats SILENTLY DROPS a @test whose name carries a non-ASCII
# character (retro 2026-08-04, arc-evolve) -- five tests once vanished and the file stayed green.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
VALID='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001"}'

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"
  export ARC_SPINE_RAND="00112233445566778899"
}
_fresh() { SPINE="$BATS_TEST_TMPDIR/spine-$1"; mkdir -p "$SPINE"; export ARC_SPINE_ROOT="$SPINE"; }
_lines() { cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }
_pay()   { printf '%s' "$2" > "$BATS_TEST_TMPDIR/$1.json"; printf '%s' "$BATS_TEST_TMPDIR/$1.json"; }

# ---------- the control itself ----------

@test "ledger: a conforming revenue payload is accepted, exactly one event" {
  run bash "$EVENT" ingest revenue.received --json "$(_pay ok "$VALID")"
  [ "$status" -eq 0 ] || { echo "expected accept, got $status: $output"; false; }
  [ -n "$output" ] || { echo "no output at all -- the command did not run"; false; }
  [ "$(_lines)" = "1" ]
}

@test "ledger: an email-shaped customer_ref is refused" {
  local bad='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_ref":"ashiq@example.com"}'
  run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
  [ "$status" -eq 2 ] || { echo "expected reject, got $status: $output"; false; }
  [[ "$output" == *"BAD_LEDGER_ID"* ]]
  [ "$(_lines)" = "0" ]
}

@test "ledger: phone-shaped and name-shaped customer_refs are refused by the same grammar" {
  local i=0 bad fails=""
  for bad in '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_ref":"9876543210"}' \
             '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_ref":"Ashiq Ahmed"}' \
             '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_ref":"+91 98765 43210"}'; do
    i=$((i+1)); _fresh "ref-$i"
    run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
    { [ "$status" -eq 2 ] && [[ "$output" == *"BAD_LEDGER_ID"* ]] && [ "$(_lines)" = "0" ]; } \
      || fails="$fails|[$bad] status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "ledger: an unknown payload field is refused whatever it contains (closed schema)" {
  local i=0 bad fails=""
  for bad in '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_email":"a@b.com"}' \
             '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","note":"paid by Ashiq Ahmed"}' \
             '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","source":"manual"}'; do
    i=$((i+1)); _fresh "unk-$i"
    run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
    { [ "$status" -eq 2 ] && [[ "$output" == *"UNKNOWN_LEDGER_FIELD"* ]] && [ "$(_lines)" = "0" ]; } \
      || fails="$fails|[$bad] status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "ledger: a free-text note is refused even though it names no field the denylist would know" {
  # The point of a CLOSED schema rather than a denylist: this field is not called anything
  # PII-ish, and it carries a person's name. A denylist of bad field names would pass it.
  local bad='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","memo":"Ashiq Ahmed, 9876543210"}'
  run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
  [ "$status" -eq 2 ]
  [[ "$output" == *"UNKNOWN_LEDGER_FIELD"* ]]
  [ "$(_lines)" = "0" ]
}

@test "ledger: each required field is individually required" {
  local i=0 bad fails=""
  for bad in '{"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001"}' \
             '{"amount":50000,"venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001"}' \
             '{"amount":50000,"currency":"INR","provider":"razorpay","provider_payment_id":"razorpay:pay_0001"}' \
             '{"amount":50000,"currency":"INR","venture":"arc","provider_payment_id":"razorpay:pay_0001"}' \
             '{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay"}'; do
    i=$((i+1)); _fresh "req-$i"
    run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
    { [ "$status" -eq 2 ] && [ "$(_lines)" = "0" ]; } || fails="$fails|[$bad] status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "ledger: a customer_ref namespaced to a different provider is refused" {
  local bad='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_ref":"stripe:cus_0001"}'
  run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_ID"* ]]
  [ "$(_lines)" = "0" ]
}

@test "ledger: a bare hex digest customer_ref is refused (sha256 of an email is dictionary-attackable)" {
  local bad='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_ref":"razorpay:5d41402abc4b2a76b9719d911017c592"}'
  run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_ID"* ]]
  [ "$(_lines)" = "0" ]
}

@test "ledger: a payload venture disagreeing with the event venture is refused" {
  local bad='{"amount":50000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_0001"}'
  run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")" --venture arc
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_VENTURE"* ]]
  [ "$(_lines)" = "0" ]
}

@test "ledger: revenue.simulated is held to the identical contract" {
  local bad='{"amount":50000,"currency":"INR","venture":"arc","provider":"razorpay","provider_payment_id":"razorpay:pay_0001","customer_ref":"a@b.com"}'
  run bash "$EVENT" ingest revenue.simulated --json "$(_pay p "$bad")"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_LEDGER_ID"* ]]
  [ "$(_lines)" = "0" ]
}

@test "ledger: the contract does NOT leak onto other kinds" {
  # A closed schema on revenue must not turn into a closed schema on everything: note.logged has
  # always carried free-form payloads and four other suites depend on that.
  run bash "$EVENT" emit note.logged --payload '{"note":"anything at all","extra":1}' --strict
  [ "$status" -eq 0 ] || { echo "ledger validation leaked onto note.logged: $output"; false; }
  [ "$(_lines)" = "1" ]
}

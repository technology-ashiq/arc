#!/usr/bin/env bats
# Phase 02 — REQ-03: money reaches the spine exactly once, and is validated.
#
# The `ingest` path (Phase 0) already derives a content-based idem and dedupes, including
# across days. What REQ-03 ADDS is per-kind payload validation for money: a `revenue.received`
# (or `revenue.simulated`) must carry a valid `amount` (positive integer, minor units) and
# `currency` (ISO-4217, 3 uppercase). Today the validator checks the payload only as "an
# object" (validate.mjs:144), so a garbage-amount revenue is accepted — the reject cases below
# are the RED. The dedupe cases characterise the Phase-0 idem mechanism (green from the start).
#
# Amount is an INTEGER in minor units on purpose: floats don't add up (0.1+0.2 != 0.3), and
# money that is summed in the brief must be exact.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
VALID='{"amount":50000,"currency":"INR","source":"manual"}'

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"          # 2026-07-22, the corpus day
  export ARC_SPINE_RAND="00112233445566778899"
}
_fresh() { SPINE="$BATS_TEST_TMPDIR/spine-$1"; mkdir -p "$SPINE"; export ARC_SPINE_ROOT="$SPINE"; }
_lines() { cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }
_pay()   { printf '%s' "$2" > "$BATS_TEST_TMPDIR/$1.json"; printf '%s' "$BATS_TEST_TMPDIR/$1.json"; }

# ---------- happy path + dedupe (characterises the Phase-0 mechanism) ----------

@test "revenue.received: a valid manual payload is accepted, exactly one event" {
  run bash "$EVENT" ingest revenue.received --json "$(_pay valid "$VALID")"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_lines)" = "1" ]
  run cat "$SPINE/events/"*.jsonl
  [[ "$output" == *'"kind":"revenue.received"'* ]]
}

@test "revenue.received: the same payload twice, SAME day, dedupes to ONE (strict refuses #2)" {
  local f; f="$(_pay v "$VALID")"
  run bash "$EVENT" ingest revenue.received --json "$f"; [ "$status" -eq 0 ]
  run bash "$EVENT" ingest revenue.received --json "$f"
  [ "$status" -eq 2 ]
  [[ "$output" == *"DUP_IDEM"* ]]
  [ "$(_lines)" = "1" ]
}

@test "revenue.received: the same payload ACROSS DAYS still dedupes to ONE (REQ-03 core)" {
  local f; f="$(_pay v "$VALID")"
  run bash "$EVENT" ingest revenue.received --json "$f"; [ "$status" -eq 0 ]
  # a later day, identical payload -> content-derived idem is unchanged -> refused
  ARC_SPINE_NOW="1784822400000" run bash "$EVENT" ingest revenue.received --json "$f"
  [ "$status" -eq 2 ]
  [[ "$output" == *"DUP_IDEM"* ]]
  [ "$(_lines)" = "1" ]
}

@test "revenue.simulated: valid payload accepted as a SEPARATE kind (never P&L truth)" {
  run bash "$EVENT" ingest revenue.simulated --json "$(_pay sim "$VALID")"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run cat "$SPINE/events/"*.jsonl
  [[ "$output" == *'"kind":"revenue.simulated"'* ]]
}

# ---------- amount validation (REQ-03: the RED) ----------

@test "revenue.received: a MISSING amount is refused, nothing written" {
  _fresh no-amount
  run bash "$EVENT" ingest revenue.received --json "$(_pay p '{"currency":"INR"}')"
  [ "$status" -eq 2 ] || { echo "expected reject, got $status: $output"; false; }
  [[ "$output" == *"AMOUNT"* ]]
  [ "$(_lines)" = "0" ]
}

@test "revenue.received: zero / negative / float / string / oversize amounts are all refused" {
  local i=0 bad fails=""
  for bad in '{"amount":0,"currency":"INR"}' \
             '{"amount":-5,"currency":"INR"}' \
             '{"amount":1.5,"currency":"INR"}' \
             '{"amount":"50000","currency":"INR"}' \
             '{"amount":1000000000000000,"currency":"INR"}'; do
    i=$((i+1)); _fresh "amt-$i"
    run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
    { [ "$status" -eq 2 ] && [[ "$output" == *"AMOUNT"* ]] && [ "$(_lines)" = "0" ]; } \
      || fails="$fails|[$bad] status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

# ---------- currency validation (REQ-03: the RED) ----------

@test "revenue.received: missing / lowercase / wrong-length / non-string currency all refused" {
  local i=0 bad fails=""
  for bad in '{"amount":50000}' \
             '{"amount":50000,"currency":"inr"}' \
             '{"amount":50000,"currency":"US"}' \
             '{"amount":50000,"currency":"RUPEE"}' \
             '{"amount":50000,"currency":840}'; do
    i=$((i+1)); _fresh "cur-$i"
    run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
    { [ "$status" -eq 2 ] && [[ "$output" == *"CURRENCY"* ]] && [ "$(_lines)" = "0" ]; } \
      || fails="$fails|[$bad] status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

# ---------- adversarial pass: pinned hole (parser-class non-negotiable) ----------

@test "revenue.received: a fractional amount that resolves to an integer is refused (pinned hole)" {
  # Found by the REQ-03 adversarial pass: 999999999999.99995 IEEE-rounds to 1000000000000 and
  # was SEALED as a value the caller never sent. Fixed at the number-token scanner (canonical.mjs)
  # so it also covers redundant non-canonical integer forms (100.0, 1e3) for every numeric field.
  local i=0 bad fails=""
  for bad in '{"amount":999999999999.99995,"currency":"INR"}' \
             '{"amount":500000000000.00003,"currency":"INR"}' \
             '{"amount":100.0,"currency":"INR"}' \
             '{"amount":1e3,"currency":"INR"}'; do
    i=$((i+1)); _fresh "prec-$i"
    run bash "$EVENT" ingest revenue.received --json "$(_pay p "$bad")"
    { [ "$status" -eq 2 ] && [ "$(_lines)" = "0" ]; } || fails="$fails|[$bad] status=$status out=$output"
  done
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

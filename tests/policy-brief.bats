#!/usr/bin/env bats
# Phase 02 -- the brief and the inbox render the four authority receipts (ADR-0508).
#
# THIS SUITE EXISTS BECAUSE THE CHAIN HAD A MISSING LINK NOBODY WALKED. The vocabulary was
# extended 40 -> 44, the payload validators were written, the promotion module built the events,
# and every test drove those modules DIRECTLY. Not one drove the sanctioned emitter -- and
# `arc-event` had no idem branch for the new kinds, so it derived `sha256(contentPre|ms)` while
# `validateEvent` re-derived `policyIdem` and refused the mismatch. All four kinds REJECTED and
# quarantined. A vocabulary nothing can write to is a vocabulary in name only.
#
# So the emitter test here reads the receipt back OFF THE SPINE rather than trusting an exit
# code, which is what phase-02-spec's verification plan asked for.
#
# The second half is the render. `arc-brief` mapped kinds to groups with `if (group) push`, so a
# kind it did not know was skipped in silence -- four new kinds, four silent omissions, and a
# brief that reads exactly like a quiet day. The catch-all group is the fix and the mutation
# test below is its proof: an untested safety net is a decoration.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
BRIEF="$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs"
INBOX="$ARC_ROOT/.claude/scripts/hq/arc-inbox.mjs"

H=0000000000000000000000000000000000000000000000000000000000000000
U=01JQ8XZ9K0ABCDEFGH00000009

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"          # 2026-07-22
  export ARC_SPINE_RAND="00112233445566778899"
}

_emit()  { bash "$EVENT" emit "$@" --strict; }
_brief() { node "$BRIEF" --date 2026-07-22 "$@"; }

_reserved() { _emit spend.reserved --payload "{\"action_kind\":\"process:payer\",\"amount\":40,\"correlation\":\"r\",\"currency\":\"INR\",\"idempotency_key\":\"k1\",\"policy_hash\":\"$H\",\"window\":\"daily\"}"; }
_released() { _emit spend.released --payload "{\"correlation\":\"r\",\"policy_hash\":\"$H\",\"reason\":\"declined\",\"released_on\":\"provider_attested_no_charge\",\"reservation_ref\":\"$U\"}"; }
_raised()   { _emit policy.level.changed --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r\",\"decision_ref\":\"$U\",\"from_level\":\"L1\",\"policy_hash\":\"$H\",\"to_level\":\"L2\",\"trial_ledger_ref\":\"docs/trial-ledger.md#t\"}"; }
_dropped()  { _emit policy.demoted --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r\",\"from_level\":\"L2\",\"incident_ref\":\"$U\",\"policy_hash\":\"$H\",\"to_level\":\"L1\"}"; }

_all_four() { _reserved >/dev/null; _released >/dev/null; _raised >/dev/null; _dropped >/dev/null; }

@test "THE MISSING LINK -- the sanctioned emitter can write all four authority kinds" {
  run _all_four
  [ "$status" -eq 0 ] || { echo "the emitter refused an ADR-0508 kind: $output"; false; }
  # READ IT BACK OFF THE SPINE. An emitter exiting 0 while every receipt it wrote was
  # quarantined is the exact shape .claude/rules/testing.md warns about, and it is how this
  # defect stayed invisible for a whole phase.
  local day="$SPINE/events/2026-07-22.jsonl"
  [ -f "$day" ] || { echo "no day file was written at all"; ls -R "$SPINE"; false; }
  local n; n=$(grep -c '"kind":"' "$day")
  [ "$n" -eq 4 ] || { echo "expected 4 sealed receipts, found $n"; cat "$day"; false; }
  [ ! -s "$SPINE/events/_quarantine/2026-07-22.jsonl" ] || {
    echo "a receipt was quarantined:"; cat "$SPINE/events/_quarantine/2026-07-22.jsonl"; false; }
}

@test "a caller supplied idem is REFUSED on a policy kind" {
  # Anti-preclaim, the same rule the leads and experiment kinds keep. The emit path otherwise
  # honours --idem, so an attacker who can emit could claim a real receipt's stable key with a
  # decoy payload; the genuine receipt then collides on DUP_IDEM and is silently lost. A
  # demotion that vanishes is a cap that never drops.
  run _emit policy.demoted --idem "$H" --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r\",\"from_level\":\"L2\",\"incident_ref\":\"$U\",\"policy_hash\":\"$H\",\"to_level\":\"L1\"}"
  [ "$status" -ne 0 ] || { echo "a supplied idem was accepted on a policy kind: $output"; false; }
  [[ "$output" == *"--idem is refused"* ]] || { echo "wrong refusal: $output"; false; }
}

@test "a malformed policy payload reports its FIELD error, not a hashing stack trace" {
  # safePolicyIdem returns null rather than throwing, so validateEvent gets to speak first.
  run _emit policy.demoted --payload '{"action_kind":"session:interactive"}'
  [ "$status" -ne 0 ]
  [[ "$output" != *"at policyIdem"* ]] || { echo "a stack trace leaked instead of a field error: $output"; false; }
  [[ "$output" == *"BAD_POLICY"* ]] || { echo "expected a payload rejection: $output"; false; }
}

@test "every kind THIS LANE added is grouped by the brief" {
  # DERIVED from POLICY_KINDS, never typed (ADR-0107) -- so a fifth authority kind fails here on
  # the day it is added rather than disappearing from the brief.
  #
  # Scoped to this lane's four ON PURPOSE. The group table is 22 kinds behind the full closed
  # vocabulary -- every develop.*, slice.*, experiment.* and leads-pipeline receipt has been
  # silently dropped by this file since those lanes shipped. Asserting the WHOLE vocabulary here
  # would put a red test on other lanes' desks for a grouping decision that is theirs to make,
  # which is the cross-lane friction ADR-0107's derive-never-type rule exists to avoid. The
  # catch-all makes their kinds visible; naming their group is their call.
  cd "$ARC_ROOT"
  run node --input-type=module -e "
    const fs = await import('node:fs');
    const { POLICY_KINDS } = await import('./.claude/scripts/hq/lib/validate-policy.mjs');
    const src = fs.readFileSync('.claude/scripts/hq/arc-brief.mjs', 'utf8');
    const start = src.indexOf('const GROUPS = [');
    const end = src.indexOf('];', start);
    if (start < 0 || end < 0) throw new Error('no GROUPS table in arc-brief.mjs');
    const table = src.slice(start, end);
    const missing = POLICY_KINDS.filter(k => !table.includes(JSON.stringify(k)));
    console.log(missing.length ? 'UNGROUPED:' + missing.join(',') : 'all-' + POLICY_KINDS.length + '-grouped');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "all-4-grouped" ] || { echo "$output"; false; }
}

@test "the brief puts each authority receipt in its own group" {
  _all_four
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"needs-you (1)"*     ]] || { echo "$output"; false; }
  [[ "$output" == *"money (2)"*         ]] || { echo "$output"; false; }
  [[ "$output" == *"progress (1)"*      ]] || { echo "$output"; false; }
  # And nothing fell through to the catch-all.
  [[ "$output" != *"ungrouped"*         ]] || { echo "a known kind landed in ungrouped: $output"; false; }
}

@test "a demotion says WHICH grant was lost, not just that one was" {
  # The incident it cites is already on the needs-you list. What the incident cannot say is the
  # pair and the direction, which is the only part that tells a human what they can no longer do.
  _dropped
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"policy.demoted  session:interactive/write  L2 -> L1"* ]] || { echo "$output"; false; }
}

@test "a promotion receipt carries the same pair and direction under progress" {
  _raised
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"policy.level.changed  session:interactive/write  L1 -> L2"* ]] || { echo "$output"; false; }
}

@test "a reservation renders as money in major.minor from minor units" {
  _reserved
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"spend.reserved  INR 0.40"* ]] || { echo "$output"; false; }
}

@test "a release names WHO decided nothing was charged" {
  # `policy` and `provider_attested_no_charge` are different claims and the second rests on a
  # provider's word -- the money model's one unverifiable delegation. An auditor has to be able
  # to tell them apart without a second query.
  _released
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"spend.released  released_on=provider_attested_no_charge"* ]] || { echo "$output"; false; }
}

@test "MUTATION -- a kind the brief does not know lands in ungrouped, never on the floor" {
  # The catch-all's only proof. Delete one kind from the group table of a COPY and the event must
  # still appear, under a heading that says the brief is behind the vocabulary. Before the
  # catch-all existed this mutation produced a brief with no money section at all -- and no error.
  _reserved >/dev/null
  local d; d="$BATS_TEST_TMPDIR/copy"
  mkdir -p "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  # A plain substitution: no address range, no empty regex, portable on BSD and GNU alike.
  sed 's/"spend.reserved", //' "$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs" > "$d/.claude/scripts/hq/arc-brief.mjs"
  # THE MUTATION ASSERTS ITSELF. A sed that quietly matched nothing would leave this test
  # measuring the unmutated file and passing for no reason -- which is the entire lesson of the
  # CI run that produced this suite.
  # `cmd && { fail; }` would ALSO fail the test when cmd exits 1, because bats runs test bodies
  # under set -e and the compound's status is grep's. Negate, then use ||.
  ! grep -q '"spend.reserved"' "$d/.claude/scripts/hq/arc-brief.mjs" || {
    echo "the mutation did not apply -- this test would measure nothing"; false; }

  run node "$d/.claude/scripts/hq/arc-brief.mjs" --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ungrouped (1)"*   ]] || { echo "an unknown kind was dropped: $output"; false; }
  [[ "$output" == *"spend.reserved"*  ]] || { echo "the event itself vanished: $output"; false; }
  [[ "$output" == *"no group assigned in arc-brief.mjs"* ]] || { echo "the heading does not say where to fix it: $output"; false; }
}

@test "the inbox prints the authority delta and its citation for a promotion" {
  _emit approval.requested --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r-t\",\"from_level\":\"L1\",\"gate\":\"policy\",\"policy_hash\":\"$H\",\"subject\":\"policy.promotion\",\"to_level\":\"L2\",\"trial_ledger_ref\":\"docs/trial-ledger.md#t9\",\"what\":\"raise session write to execute\"}" >/dev/null
  run node "$INBOX" inbox
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"raise session write to execute"* ]] || { echo "$output"; false; }
  [[ "$output" == *"policy  session:interactive/write  L1 -> L2"* ]] || { echo "no authority delta: $output"; false; }
  [[ "$output" == *"evidence docs/trial-ledger.md#t9"* ]] || { echo "no citation: $output"; false; }
}

@test "an ordinary approval gets no policy line -- the detail is not decoration" {
  # The positive control's opposite. If every approval grew a policy line, the line would carry
  # no information at all.
  _emit approval.requested --payload '{"what":"deploy prod","gate":"ship"}' >/dev/null
  run node "$INBOX" inbox
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"deploy prod"* ]] || { echo "$output"; false; }
  [[ "$output" != *"evidence "* ]] || { echo "a non-promotion grew a policy line: $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 13 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 13 -- a @test was silently dropped"
    false
  }
}

#!/usr/bin/env bats
# Phase 03 — REQ-06: approvals become receipts, decided through the reader-only inbox.
#
# `arc inbox` lists OPEN approvals (an approval.requested whose id no decision.recorded points
# at) via the spine reader ONLY. `arc approve/reject <ULID> --reason R` records exactly one
# decision.recorded through arc-event (the one writer) — no approval state is stored anywhere
# but the spine. The refusal path is intrinsic to a correct decider, so it lands with the happy
# path: unknown id, wrong kind, already-decided (even under a DIFFERENT reason), bad args, and a
# concurrent double-decide must all end in a non-zero exit and NEVER a second decision.recorded.
#
# assertDecision (validate.mjs) is the core seal: a malformed decision emitted DIRECTLY through
# arc-event --strict is refused before it can be sealed onto the append-only spine (REQ-02).
#
# RED before arc-inbox.mjs exists and before assertDecision is wired.
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
EVENT="$HQ/arc-event.sh"
INBOX="$HQ/arc-inbox.mjs"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"          # 2026-07-22
  export ARC_SPINE_RAND="00112233445566778899"
}
_fresh() { SPINE="$BATS_TEST_TMPDIR/spine-$1"; mkdir -p "$SPINE"; export ARC_SPINE_ROOT="$SPINE"; }
# Emit an approval.requested (strict for a clean failure in tests); echo its sealed ULID.
_request() { bash "$EVENT" emit approval.requested --payload "$1" --strict | tr -d '\r'; }
# Count decision.recorded events on the spine's day files (never the _quarantine subdir).
_decisions() { grep -ho '"kind":"decision.recorded"' "$SPINE"/events/*.jsonl 2>/dev/null | wc -l | tr -d ' '; }

# ---------- happy path (W1) ----------

@test "inbox: a request is listed OPEN, approve records exactly one decision, then it's gone" {
  local id; id="$(_request '{"what":"deploy prod","gate":"kickoff"}')"
  [ -n "$id" ] || { echo "no id from emit"; false; }

  run node "$INBOX" inbox
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"$id"* ]] || { echo "expected $id listed OPEN: $output"; false; }

  run node "$INBOX" approve "$id" --reason "looks good"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_decisions)" = "1" ] || { echo "expected exactly one decision"; cat "$SPINE"/events/*.jsonl; false; }

  run cat "$SPINE/events/"*.jsonl
  [[ "$output" == *'"kind":"decision.recorded"'* ]]
  [[ "$output" == *'"verdict":"approve"'* ]]
  [[ "$output" == *"\"decides\":\"$id\""* ]]

  run node "$INBOX" inbox
  [ "$status" -eq 0 ]
  [[ "$output" != *"$id"* ]] || { echo "still open after approve: $output"; false; }
}

@test "inbox: reject records a decision with verdict reject and closes the item" {
  local id; id="$(_request '{"what":"ship risky","gate":"phase-done"}')"
  run node "$INBOX" reject "$id" --reason "not yet"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_decisions)" = "1" ]
  run cat "$SPINE/events/"*.jsonl
  [[ "$output" == *'"verdict":"reject"'* ]]
  run node "$INBOX" inbox
  [[ "$output" != *"$id"* ]]
}

@test "inbox: only OPEN approvals are listed; a decided one drops out, others stay" {
  local a b
  a="$(_request '{"what":"alpha","gate":"kickoff"}')"
  b="$(_request '{"what":"bravo","gate":"phase-done"}')"
  run node "$INBOX" approve "$a" --reason ok
  [ "$status" -eq 0 ]
  run node "$INBOX" inbox
  [ "$status" -eq 0 ]
  [[ "$output" != *"$a"* ]]        # decided -> hidden
  [[ "$output" == *"$b"* ]]        # still open
}

# ---------- refusal path (W2) ----------

@test "inbox: approving an unknown ULID is refused, nothing written (UNKNOWN_APPROVAL)" {
  _fresh unknown
  run node "$INBOX" approve 01JQ8XZ9K0NEVERSEENNNNNNNN --reason x
  [ "$status" -ne 0 ]
  [[ "$output" == *"UNKNOWN_APPROVAL"* ]]
  [ "$(_decisions)" = "0" ]
}

@test "inbox: approving the ULID of a NON-approval event is refused (WRONG_KIND)" {
  local id; id="$(bash "$EVENT" emit note.logged --payload '{"n":1}' --strict | tr -d '\r')"
  run node "$INBOX" approve "$id" --reason x
  [ "$status" -ne 0 ]
  [[ "$output" == *"WRONG_KIND"* ]]
  [ "$(_decisions)" = "0" ]
}

@test "inbox: a second decision on the same id is refused even with a DIFFERENT reason (count stays 1)" {
  local id; id="$(_request '{"what":"once"}')"
  run node "$INBOX" approve "$id" --reason "first"
  [ "$status" -eq 0 ]
  run node "$INBOX" approve "$id" --reason "a totally different reason"
  [ "$status" -ne 0 ]
  [[ "$output" == *"ALREADY_DECIDED"* ]]
  [ "$(_decisions)" = "1" ]
}

@test "inbox: once approved, a reject is refused (no flip, count stays 1)" {
  local id; id="$(_request '{"what":"twice"}')"
  run node "$INBOX" approve "$id" --reason "yes"
  [ "$status" -eq 0 ]
  run node "$INBOX" reject "$id" --reason "no"
  [ "$status" -ne 0 ]
  [[ "$output" == *"ALREADY_DECIDED"* ]]
  [ "$(_decisions)" = "1" ]
}

@test "inbox: an empty reason, a missing reason, and a non-ULID id are rejected before any write (BAD_ARGS)" {
  local id; id="$(_request '{"what":"args"}')"
  run node "$INBOX" approve "$id" --reason ""
  [ "$status" -ne 0 ]; [[ "$output" == *"BAD_ARGS"* ]]
  run node "$INBOX" approve "$id"
  [ "$status" -ne 0 ]; [[ "$output" == *"BAD_ARGS"* ]]
  run node "$INBOX" approve "not-a-ulid" --reason x
  [ "$status" -ne 0 ]; [[ "$output" == *"BAD_ARGS"* ]]
  [ "$(_decisions)" = "0" ]
}

@test "inbox: two concurrent approves of the same id (different reasons) yield exactly one decision" {
  local id; id="$(_request '{"what":"race"}')"
  node "$INBOX" approve "$id" --reason "left"  >/dev/null 2>&1 &
  node "$INBOX" approve "$id" --reason "right" >/dev/null 2>&1 &
  wait
  [ "$(_decisions)" = "1" ] || { echo "race produced $(_decisions) decisions"; cat "$SPINE"/events/*.jsonl; false; }
}

# ---------- core seal: assertDecision refuses a malformed decision at the writer (REQ-02) ----------

@test "decision.recorded: the core validator refuses a malformed decision in strict mode (assertDecision)" {
  local id; id="$(_request '{"what":"core"}')"
  local before; before="$(_decisions)"

  # verdict outside approve|reject, and case-varied must NOT normalize
  run bash "$EVENT" emit decision.recorded --payload "{\"decides\":\"$id\",\"verdict\":\"maybe\",\"reason\":\"x\"}" --strict
  [ "$status" -eq 2 ]; [[ "$output" == *"VERDICT"* ]]
  run bash "$EVENT" emit decision.recorded --payload "{\"decides\":\"$id\",\"verdict\":\"Approve\",\"reason\":\"x\"}" --strict
  [ "$status" -eq 2 ]; [[ "$output" == *"VERDICT"* ]]

  # decides is not a ULID
  run bash "$EVENT" emit decision.recorded --payload '{"decides":"nope","verdict":"approve","reason":"x"}' --strict
  [ "$status" -eq 2 ]; [[ "$output" == *"DECISION"* ]]

  # empty reason
  run bash "$EVENT" emit decision.recorded --payload "{\"decides\":\"$id\",\"verdict\":\"approve\",\"reason\":\"\"}" --strict
  [ "$status" -eq 2 ]; [[ "$output" == *"REASON"* ]]

  # unknown key -> the shape is closed
  run bash "$EVENT" emit decision.recorded --payload "{\"decides\":\"$id\",\"verdict\":\"approve\",\"reason\":\"x\",\"extra\":1}" --strict
  [ "$status" -eq 2 ]; [[ "$output" == *"DECISION"* ]]

  [ "$(_decisions)" = "$before" ]     # nothing sealed
}

# ---------- state is derived, never truth (W3 — REQ-04 x REQ-06) ----------

@test "inbox+brief reproduce byte-identically after a derived wipe + replay, and the re-decide stays blocked" {
  local a b
  a="$(_request '{"what":"alpha","gate":"kickoff"}')"
  b="$(_request '{"what":"bravo","gate":"phase-done"}')"
  run node "$INBOX" approve "$a" --reason "done"
  [ "$status" -eq 0 ]

  node "$INBOX" inbox > "$BATS_TEST_TMPDIR/inbox-before.txt" 2>/dev/null
  node "$HQ/arc-brief.mjs" --date 2026-07-22 > "$BATS_TEST_TMPDIR/brief-before.txt"

  rm -rf "$SPINE/derived"
  [ ! -d "$SPINE/derived" ]
  node "$HQ/arc-replay.mjs" --quiet

  node "$INBOX" inbox > "$BATS_TEST_TMPDIR/inbox-after.txt" 2>/dev/null
  node "$HQ/arc-brief.mjs" --date 2026-07-22 > "$BATS_TEST_TMPDIR/brief-after.txt"

  run diff "$BATS_TEST_TMPDIR/inbox-before.txt" "$BATS_TEST_TMPDIR/inbox-after.txt"
  [ "$status" -eq 0 ] || { echo "inbox drifted across replay:"; echo "$output"; false; }
  run diff "$BATS_TEST_TMPDIR/brief-before.txt" "$BATS_TEST_TMPDIR/brief-after.txt"
  [ "$status" -eq 0 ] || { echo "brief drifted across replay:"; echo "$output"; false; }

  # the fold survived the wipe: a still decided (hidden), b still open
  run node "$INBOX" inbox
  [[ "$output" != *"$a"* ]]
  [[ "$output" == *"$b"* ]]

  # and a re-decide of a is still refused after the wipe (read-check over the reader)
  run node "$INBOX" approve "$a" --reason "again"
  [ "$status" -ne 0 ]; [[ "$output" == *"ALREADY_DECIDED"* ]]
  [ "$(_decisions)" = "1" ]
}

@test "the rebuilt idem index still refuses a duplicate decision after a derived wipe (DUP_IDEM backstop)" {
  local a; a="$(_request '{"what":"idem"}')"
  run node "$INBOX" approve "$a" --reason "yes"
  [ "$status" -eq 0 ]

  rm -rf "$SPINE/derived"
  node "$HQ/arc-replay.mjs" --quiet

  # the SAME (kind|decides) idem arc-inbox uses -- computed independently in bash. The rebuilt
  # index must carry the sealed decision's idem, so a direct re-emit collides even though the
  # derived state was wiped between the two decisions.
  local idem; idem="$(printf 'decision.recorded|%s' "$a" | _arc_sha256)"
  run bash "$EVENT" emit decision.recorded --payload "{\"decides\":\"$a\",\"verdict\":\"approve\",\"reason\":\"dup\"}" --idem "$idem" --strict
  [ "$status" -eq 2 ] || { echo "expected DUP_IDEM reject: $output"; false; }
  [[ "$output" == *"DUP_IDEM"* ]]
  [ "$(_decisions)" = "1" ]
}

@test "approving writes no approval state outside the spine (only events/ and derived/)" {
  local a; a="$(_request '{"what":"nostate"}')"
  run node "$INBOX" approve "$a" --reason ok
  [ "$status" -eq 0 ]
  run bash -c "ls -1 '$SPINE' | sort | tr '\n' ' '"
  [ "$output" = "derived events " ] || { echo "unexpected spine layout: $output"; false; }
}

# ---------- adversarial pass (W7): holes found + fixed + pinned in BOTH modes ----------
# The mandatory construct-a-breaking-input pass over the decision path (council v2/v3 discipline)
# found two real holes; both are fixed at the validator core and pinned here strict + hook.

@test "adversarial: an idem pre-claiming another approval's key with a DECOY decides is refused (strict); the target stays decidable" {
  local A; A="$(_request '{"what":"pre-claim-target"}')"
  local decoy="01JQ8XZ9K0NEVERSEENNNNNNNN"          # a valid ULID that is NOT the target
  local idemA; idemA="$(printf 'decision.recorded|%s' "$A" | _arc_sha256)"
  # attacker keys the idem to A but names the decoy -> idem/decides desync (the two-key attack)
  run bash "$EVENT" emit decision.recorded --idem "$idemA" --payload "{\"decides\":\"$decoy\",\"verdict\":\"approve\",\"reason\":\"forged\"}" --strict
  [ "$status" -eq 2 ] || { echo "pre-claim not refused: $output"; false; }
  [[ "$output" == *"DECISION"* ]]
  [ "$(_decisions)" = "0" ]
  # A's decision-key slot was never taken -> the legit decision still lands
  run node "$INBOX" approve "$A" --reason "legit"
  [ "$status" -eq 0 ] || { echo "target no longer decidable: $output"; false; }
  [ "$(_decisions)" = "1" ]
}

@test "adversarial: the idem pre-claim in HOOK mode never blocks and seals nothing" {
  local A; A="$(_request '{"what":"pre-claim-hook"}')"
  local decoy="01JQ8XZ9K0NEVERSEENNNNNNNN"
  local idemA; idemA="$(printf 'decision.recorded|%s' "$A" | _arc_sha256)"
  run bash "$EVENT" emit decision.recorded --idem "$idemA" --payload "{\"decides\":\"$decoy\",\"verdict\":\"approve\",\"reason\":\"forged\"}"
  [ "$status" -eq 0 ]                  # hook mode: a bad input never blocks a session
  [ "$(_decisions)" = "0" ]            # ...and never seals
  run node "$INBOX" approve "$A" --reason "legit"
  [ "$status" -eq 0 ]; [ "$(_decisions)" = "1" ]
}

@test "adversarial: a C1 control char (CSI U+009B / NEL U+0085) in a decision reason is refused (strict), nothing sealed" {
  local A; A="$(_request '{"what":"c1-strict"}')"
  local idemA; idemA="$(printf 'decision.recorded|%s' "$A" | _arc_sha256)"
  # build the C1 char at runtime (no raw control byte or \\u in the test source)
  local pay; pay="$(node -e 'process.stdout.write(JSON.stringify({decides:process.argv[1],verdict:"approve",reason:"ok"+String.fromCharCode(0x9b)+"2K"}))' "$A")"
  run bash "$EVENT" emit decision.recorded --idem "$idemA" --payload "$pay" --strict
  [ "$status" -eq 2 ] || { echo "CSI reason not refused: $output"; false; }
  [[ "$output" == *"REASON"* ]]
  local nel; nel="$(node -e 'process.stdout.write(JSON.stringify({decides:process.argv[1],verdict:"approve",reason:"a"+String.fromCharCode(0x85)+"b"}))' "$A")"
  run bash "$EVENT" emit decision.recorded --idem "$idemA" --payload "$nel" --strict
  [ "$status" -eq 2 ]; [[ "$output" == *"REASON"* ]]
  [ "$(_decisions)" = "0" ]
}

@test "adversarial: a C1 control char in a decision reason in HOOK mode never blocks and seals nothing" {
  local A; A="$(_request '{"what":"c1-hook"}')"
  local idemA; idemA="$(printf 'decision.recorded|%s' "$A" | _arc_sha256)"
  local pay; pay="$(node -e 'process.stdout.write(JSON.stringify({decides:process.argv[1],verdict:"approve",reason:"ok"+String.fromCharCode(0x9b)}))' "$A")"
  run bash "$EVENT" emit decision.recorded --idem "$idemA" --payload "$pay"
  [ "$status" -eq 0 ]
  [ "$(_decisions)" = "0" ]
}

@test "adversarial guard: a normal international reason (accents, check mark) is still accepted (no over-rejection)" {
  local A; A="$(_request '{"what":"intl"}')"
  local idemA; idemA="$(printf 'decision.recorded|%s' "$A" | _arc_sha256)"
  local pay; pay="$(node -e 'process.stdout.write(JSON.stringify({decides:process.argv[1],verdict:"approve",reason:"café ✓ ok"}))' "$A")"
  run bash "$EVENT" emit decision.recorded --idem "$idemA" --payload "$pay" --strict
  [ "$status" -eq 0 ] || { echo "normal unicode reason wrongly refused: $output"; false; }
  [ "$(_decisions)" = "1" ]
}

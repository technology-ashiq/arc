#!/usr/bin/env bats
# Phase 00 ckpt B -- the reader (ADR-0030), arc's only public API.
#
# The cursor tests are the ones that matter. `--since` is POSITIONAL: it means "everything
# after the line carrying this id". Two emitters in the same millisecond produce ULIDs with
# no defined order between them, so a reader that string-sorts silently skips events -- a
# confirmed finding of the Phase-0 adversarial pass, and the reason REQ-09's acceptance
# names append order explicitly.
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
EVENT="$HQ/arc-event.sh"
SPINE_CLI="$HQ/spine.mjs"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"
  export ARC_SPINE_RAND="reader-seed"
}

# Append an event with an explicit id, so append order and ULID order can be made to disagree.
_emit_with_id() {
  local id="$1" idem="$2" kind="${3:-note.logged}" venture="${4:-arc}"
  node -e '
    const fs=require("fs");
    fs.writeFileSync(process.argv[6], JSON.stringify({
      id: process.argv[1], v: 1, ts: "2026-07-22T10:00:00+05:30", idem: process.argv[2],
      actor: "arc-event", process: "reader-test@1.0.0", model: null, venture: process.argv[4],
      run_id: "r-reader", kind: process.argv[3], payload: {}, outcome: "ok",
      cost: null, evidence: null, supersedes: null,
    }, null, 2) + "\n");
  ' "$id" "$idem" "$kind" "$venture" x "$BATS_TEST_TMPDIR/ev.json"
  bash "$EVENT" emit --event-file "$BATS_TEST_TMPDIR/ev.json" --strict >/dev/null
}

@test "reader returns events in append order" {
  bash "$EVENT" emit note.logged --payload '{"n":1}' --strict >/dev/null
  bash "$EVENT" emit commit.done --payload '{"n":2}' --strict >/dev/null
  run node "$SPINE_CLI" read
  [ "$status" -eq 0 ]
  [ "$(echo "$output" | wc -l | tr -d ' ')" = "2" ]
  [[ "$(echo "$output" | head -1)" == *"note.logged"* ]]
  [[ "$(echo "$output" | tail -1)" == *"commit.done"* ]]
}

@test "--kind and --venture filter without disturbing order" {
  _emit_with_id "01JQ8XZ9K0AAAAAAAAAAAAAAA1" "$(printf 'a%.0s' $(seq 64))" note.logged arc
  _emit_with_id "01JQ8XZ9K0AAAAAAAAAAAAAAA2" "$(printf 'b%.0s' $(seq 64))" commit.done venturemind
  _emit_with_id "01JQ8XZ9K0AAAAAAAAAAAAAAA3" "$(printf 'c%.0s' $(seq 64))" note.logged venturemind

  run node "$SPINE_CLI" read --kind note.logged
  [ "$(echo "$output" | wc -l | tr -d ' ')" = "2" ]

  run node "$SPINE_CLI" read --venture venturemind
  [ "$(echo "$output" | wc -l | tr -d ' ')" = "2" ]

  run node "$SPINE_CLI" read --kind note.logged --venture venturemind
  [ "$(echo "$output" | wc -l | tr -d ' ')" = "1" ]
  [[ "$output" == *"01JQ8XZ9K0AAAAAAAAAAAAAAA3"* ]]
}

@test "--since resolves by APPEND ORDER, not ULID string comparison" {
  # Appended first, but its id sorts LAST. A string-comparison cursor would return nothing
  # here; the correct answer is the two events that were written after it.
  _emit_with_id "01JQ8XZ9K0ZZZZZZZZZZZZZZZZ" "$(printf 'd%.0s' $(seq 64))"
  _emit_with_id "01JQ8XZ9K0AAAAAAAAAAAAAAAA" "$(printf 'e%.0s' $(seq 64))"
  _emit_with_id "01JQ8XZ9K0BBBBBBBBBBBBBBBB" "$(printf 'f%.0s' $(seq 64))"

  run node "$SPINE_CLI" read --since "01JQ8XZ9K0ZZZZZZZZZZZZZZZZ"
  [ "$status" -eq 0 ]
  [ "$(echo "$output" | wc -l | tr -d ' ')" = "2" ]
  [[ "$output" == *"01JQ8XZ9K0AAAAAAAAAAAAAAAA"* ]]
  [[ "$output" == *"01JQ8XZ9K0BBBBBBBBBBBBBBBB"* ]]
}

@test "same-millisecond burst: catch-up from a cursor loses nothing" {
  # Every event shares one ts, and the ids are deliberately out of lexical order.
  _emit_with_id "01JQ8XZ9K0MMMMMMMMMMMMMMMM" "$(printf '1%.0s' $(seq 64))"
  _emit_with_id "01JQ8XZ9K0CCCCCCCCCCCCCCCC" "$(printf '2%.0s' $(seq 64))"
  _emit_with_id "01JQ8XZ9K0YYYYYYYYYYYYYYYY" "$(printf '3%.0s' $(seq 64))"
  _emit_with_id "01JQ8XZ9K0DDDDDDDDDDDDDDDD" "$(printf '4%.0s' $(seq 64))"

  # A consumer that stored the first id must receive exactly the other three.
  run node "$SPINE_CLI" read --since "01JQ8XZ9K0MMMMMMMMMMMMMMMM"
  [ "$(echo "$output" | wc -l | tr -d ' ')" = "3" ]

  # And catching up one at a time must walk the whole stream without skipping or repeating.
  run node -e '
    const { execFileSync } = require("child_process");
    const cli = process.argv[1];
    let cursor = null, seen = 0;
    for (let i = 0; i < 10; i++) {
      const args = ["read", "--limit", "1"];
      if (cursor) args.push("--since", cursor);
      const out = execFileSync("node", [cli, ...args], { encoding: "utf8" }).trim();
      if (!out) break;
      cursor = JSON.parse(out).id;
      seen++;
    }
    if (seen !== 4) { console.log("walked "+seen+" events, expected 4"); process.exit(1); }
  ' "$SPINE_CLI"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "an unknown cursor is an error, not an empty result" {
  bash "$EVENT" emit note.logged --payload '{"n":1}' --strict >/dev/null
  run node "$SPINE_CLI" read --since "01JQ8XZ9K0NEVERSEENNNNNNNN"
  [ "$status" -eq 2 ]
  [[ "$output" == *"CURSOR_NOT_FOUND"* ]]
}

@test "a malformed cursor is refused before any reading happens" {
  run node "$SPINE_CLI" read --since "not-a-ulid"
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_CURSOR"* ]]
}

@test "spine cursor prints the newest event's id" {
  bash "$EVENT" emit note.logged --payload '{"n":1}' --strict >/dev/null
  bash "$EVENT" emit commit.done --payload '{"n":2}' --strict >/dev/null
  run node "$SPINE_CLI" cursor
  [ "$status" -eq 0 ]
  last="$(tail -1 "$SPINE/events/2026-07-22.jsonl" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).id))')"
  [ "$output" = "$last" ]
}

@test "a torn line is reported, never silently swallowed" {
  bash "$EVENT" emit note.logged --payload '{"n":1}' --strict >/dev/null
  printf 'half a line\n' >> "$SPINE/events/2026-07-22.jsonl"
  run node "$SPINE_CLI" read
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARN"* ]]
  [[ "$output" == *"unparseable"* ]]
}

@test "REQ-09: brief carries no direct spine file access in its CODE" {
  # The grep-lint of ADR-0030 in miniature: the consumer must not know where events live.
  # Comments are excluded deliberately -- a lint that cannot tell code from prose teaches
  # people to write worse comments, which is how the portability gate already tripped this
  # cycle. Phase 3's real grep-lint inherits this rule.
  run bash -c "grep -nE 'events/|state\.db|\.jsonl' '$HQ/arc-brief.mjs' | grep -vE ':[[:space:]]*(//|\*)'"
  [ "$status" -ne 0 ] || { echo "arc-brief.mjs reaches past the reader:"; echo "$output"; false; }
}

#!/usr/bin/env bats
# Phase 02 section F: the _pending/ spool -- drain and visibility (REQ-04).
#
# THE GAP THIS CLOSES, stated precisely. Before this section a hook-mode lock timeout fell
# into arc-event.mjs's catch-all and landed in events/_quarantine/ -- the same folder as a
# malformed payload. "Your event was invalid" and "the machine was busy" are different facts
# about different things, and one bucket for both meant a perfectly good sealed receipt was
# filed with the rejects.
#
# HOW THE TIMEOUT IS PRODUCED, since a raced timeout is a flaky test. The lock is taken by the
# fixture itself and simply never released for the duration of the emit, so the 2000ms hook
# timeout is reached by construction and not by luck.
#
# One deliberate substitution from the spec's wording, stated rather than hidden: the spec
# says the fixture "keeps its mtime fresh so it never goes stale". This file raises
# ARC_SPINE_LOCK_STALE_MS instead. Both guarantee the same property -- the stale-breaker
# cannot fire mid-test -- but a background toucher is a second process racing the one under
# test, and on the windows leg that is exactly the kind of thing that fails once a fortnight.
# The env door is deterministic and cannot lose the race, because there is no race.
#
# ASCII-only @test names (the 2026-07-30 em-dash incident, which recurred in Phase 01).
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
BRIEF="$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs"
SPINE="$ARC_ROOT/.claude/scripts/hq/spine.mjs"
STATUS="$ARC_ROOT/.claude/scripts/core/arc-status.sh"

setup() {
  ROOTD="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ROOTD/events"
  export ARC_SPINE_ROOT="$ROOTD"
  # No stale-break during the run: see the header. 2000ms hook timeout against a 10-minute
  # stale threshold means the breaker is not part of what is being measured.
  export ARC_SPINE_LOCK_STALE_MS=600000
  # A frozen clock and frozen randomness make the emitter a pure function of its input, which
  # is what lets the drain fixture compare BYTES against a same-input direct emit.
  export ARC_SPINE_NOW="1785000000000"
  export ARC_SPINE_RAND="00112233445566778899"
  DAY="$(printf '%s' "$(node -e 'process.stdout.write(new Date(1785000000000+19800000).toISOString().slice(0,10))')")"
}

_hold_lock()    { printf 'someone-else:0000000000000000\n' > "$ROOTD/events/.lock"; }
_release_lock() { rm -f "$ROOTD/events/.lock"; }

_pending_files()    { ls "$ROOTD/events/_pending" 2>/dev/null | grep -c '\.json$' || true; }
_quarantine_lines() { cat "$ROOTD"/events/_quarantine/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }
_day_lines()        { cat "$ROOTD"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }

# One hook-mode emit that is guaranteed to time out, because the caller holds the lock.
_emit_hook() {
  run bash "$EVENT" emit note.logged --payload "{\"n\":$1}" --run-id r-spool
}

# ---------- the spool ----------

@test "spool: a hook-mode lock timeout writes the receipt to _pending, not _quarantine" {
  _hold_lock
  _emit_hook 1

  # A hook never blocks a session, whatever went wrong.
  [ "$status" -eq 0 ]
  # Its own file, one per event.
  [ "$(_pending_files)" -eq 1 ]
  # And specifically NOT with the malformed inputs -- this is the whole point of the section.
  [ "$(_quarantine_lines)" -eq 0 ]
  # stderr says which event and why, so the fact is not merely recorded but visible.
  [[ "$output" == *"SPOOL"* ]]
  [[ "$output" == *"_pending/"* ]]
  [[ "$output" == *"lock"* ]]
  # The day file is untouched: a spooled event is not on the spine yet.
  [ ! -e "$ROOTD/events/$DAY.jsonl" ]
}

@test "spool: a malformed payload still quarantines, so the two buckets stay separate" {
  # The separation only means something if the OTHER path is unchanged. An unknown kind is
  # refused before the lock is ever reached, so it must never appear in the spool.
  run bash "$EVENT" emit not.a.real.kind --payload '{}' --run-id r-spool
  [ "$status" -eq 0 ]
  [ "$(_pending_files)" -eq 0 ]
  [ "$(_quarantine_lines)" -eq 1 ]
}

@test "spool: strict mode does NOT spool, it still exits 2" {
  # Strict reports the truth to CI and ingest. A caller told exit 2 must not discover its
  # event on the spine later -- that would make the exit code a lie.
  _hold_lock
  run bash "$EVENT" emit note.logged --strict --payload '{"n":9}' --run-id r-spool
  [ "$status" -eq 2 ]
  [ "$(_pending_files)" -eq 0 ]
}

# ---------- the drain ----------

@test "drain: the next lock appends the spooled event byte-identically to a direct emit" {
  _hold_lock
  _emit_hook 1
  [ "$(_pending_files)" -eq 1 ]

  _release_lock
  run bash "$EVENT" emit note.logged --payload '{"n":2}' --run-id r-spool
  [ "$status" -eq 0 ]

  # Drained, and said so.
  [[ "$output" == *"drained 1"* ]]
  [ "$(_pending_files)" -eq 0 ]
  [ "$(_day_lines)" -eq 2 ]

  # THE BYTE COMPARISON. A second, independent spine emits the same input directly with the
  # same frozen clock and randomness. If the drain re-serialized instead of re-appending the
  # sealed line, these would differ in field order, in sha, or in both.
  direct="$BATS_TEST_TMPDIR/direct"
  mkdir -p "$direct"
  ARC_SPINE_ROOT="$direct" bash "$EVENT" emit note.logged --payload '{"n":1}' --run-id r-spool >/dev/null 2>&1
  # Plain files rather than process substitution: `<(...)` is a bashism this suite has no
  # reason to depend on, and the windows leg is the one that would find out.
  head -n 1 "$ROOTD/events/$DAY.jsonl"  > "$BATS_TEST_TMPDIR/drained.line"
  head -n 1 "$direct/events/$DAY.jsonl" > "$BATS_TEST_TMPDIR/direct.line"
  run diff "$BATS_TEST_TMPDIR/drained.line" "$BATS_TEST_TMPDIR/direct.line"
  [ "$status" -eq 0 ] || { echo "drained line differs from a direct emit:"; echo "$output"; false; }

  # The index is the thing that makes a redelivery a duplicate rather than a second receipt.
  [ "$(sed '/^$/d' "$ROOTD/derived/idem.index" | wc -l | tr -d ' ')" -eq 2 ]
}

@test "drain: a late arrival keeps the day file in APPEND order, not ULID order" {
  # The spine's order is the order lines were written (spine.mjs: append order, never ULID
  # string order -- two emitters in one millisecond have no defined ULID order between them).
  # A drained event is older than the emit that drained it, and it must NOT be sorted back
  # into place: it appears where it was appended.
  _hold_lock
  _emit_hook 1
  _release_lock
  bash "$EVENT" emit note.logged --payload '{"n":2}' --run-id r-spool >/dev/null 2>&1

  run node -e '
    const fs = require("node:fs");
    const lines = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean);
    process.stdout.write(lines.map((l) => JSON.parse(l).payload.n).join(","));
  ' "$ROOTD/events/$DAY.jsonl"
  [ "$status" -eq 0 ]
  # The spooled event drains FIRST -- it arrived first, and the drain runs before the caller's
  # own append inside the same lock.
  [ "$output" = "1,2" ]
}

# ---------- idempotency ----------

@test "drain: draining the same event twice appends it once" {
  _hold_lock
  _emit_hook 1
  # Keep a copy of the spool file. Restoring it after a successful drain reproduces exactly
  # the crash window the append-then-unlink order leaves open: the event is on the spine AND
  # still in the spool. Converging from there to "appended once" is what makes the drain
  # exactly-once instead of at-least-once.
  cp "$ROOTD/events/_pending/"*.json "$BATS_TEST_TMPDIR/replay.json"

  _release_lock
  bash "$EVENT" emit note.logged --payload '{"n":2}' --run-id r-spool >/dev/null 2>&1
  [ "$(_day_lines)" -eq 2 ]
  before_index="$(sed '/^$/d' "$ROOTD/derived/idem.index" | wc -l | tr -d ' ')"

  # Put it back, as a crash between the append and the unlink would have.
  mkdir -p "$ROOTD/events/_pending"
  cp "$BATS_TEST_TMPDIR/replay.json" "$ROOTD/events/_pending/replay.json"

  run bash "$EVENT" emit note.logged --payload '{"n":3}' --run-id r-spool
  [ "$status" -eq 0 ]
  [[ "$output" == *"already on the spine"* ]]

  # Three events total: the drained one, and the two that did the draining. NOT four.
  [ "$(_day_lines)" -eq 3 ]
  [ "$(_pending_files)" -eq 0 ]
  # And the index gained exactly one entry, for the n=3 emit -- not a second one for the
  # replayed event.
  [ "$(sed '/^$/d' "$ROOTD/derived/idem.index" | wc -l | tr -d ' ')" -eq $((before_index + 1)) ]
}

@test "drain: an unreadable spool file is quarantined, never retried forever" {
  # A half-written or corrupted spool file can never be appended. Left in place it would be
  # re-read on every future emit for the life of the repo, so it goes to the folder that
  # exists for things that cannot go on the spine -- visibly, not silently.
  mkdir -p "$ROOTD/events/_pending"
  printf '{"not":"a sealed event"\n' > "$ROOTD/events/_pending/broken.json"

  run bash "$EVENT" emit note.logged --payload '{"n":1}' --run-id r-spool
  [ "$status" -eq 0 ]
  [[ "$output" == *"SPOOL_UNREADABLE"* ]] || [[ "$output" == *"could not be drained"* ]]
  [ "$(_pending_files)" -eq 0 ]
  [ "$(_quarantine_lines)" -ge 1 ]
  # The caller's own event still landed. One bad spool file must not take a good receipt down.
  [ "$(_day_lines)" -eq 1 ]
}

# ---------- visibility ----------

@test "visibility: status and brief both print exactly K pending" {
  _hold_lock
  _emit_hook 1
  _emit_hook 2
  _emit_hook 3
  [ "$(_pending_files)" -eq 3 ]

  run bash "$STATUS" "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"3 event(s) pending"* ]] || { echo "status did not report 3:"; echo "$output"; false; }

  run node "$BRIEF" --date "$DAY"
  [ "$status" -eq 0 ]
  [[ "$output" == *"3 event(s) pending"* ]] || { echo "brief did not report 3:"; echo "$output"; false; }
}

@test "visibility: at zero pending the line is ABSENT from both, not a zero" {
  # Asserted explicitly, because "surfaced" quietly becoming "a line on every brief forever"
  # is how a signal turns into noise nobody reads.
  [ "$(_pending_files)" -eq 0 ]

  run bash "$STATUS" "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" != *"pending"* ]] || { echo "status printed a pending line at K=0:"; echo "$output"; false; }

  run node "$BRIEF" --date "$DAY"
  [ "$status" -eq 0 ]
  [[ "$output" != *"pending"* ]] || { echo "brief printed a pending line at K=0:"; echo "$output"; false; }
}

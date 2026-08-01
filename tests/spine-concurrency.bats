#!/usr/bin/env bats
# Phase 02 section E: the spine's zero-interleaving contract under real concurrency
# (REQ-04, and the first real test of assumption A3).
#
# Built as CONTROL + SUBJECT, because a concurrency test that never contended is a green
# tick that proves nothing. The control makes two plain writers fight over one file with no
# lock between them; it MUST corrupt. If it comes out clean, this leg did not achieve real
# concurrency, the subject's pass carries no information about locking, and the control
# failing to corrupt therefore FAILS the test rather than passing quietly.
#
# On what actually tears, since "bigger than PIPE_BUF" is not the whole story. One write()
# to a regular file opened O_APPEND is serialised by the inode lock on Linux, so a single
# 9 KB write may well survive intact. What tears is one logical line SPLIT ACROSS SEVERAL
# write() calls: bash's printf goes through stdio, which flushes in buffer-sized chunks, so
# a 512 KB line becomes on the order of a hundred writes and another writer can land between
# any two of them. That is why the control writes far more than the 8 KB floor.
#
# ASCII-only @test names, deliberately: on 2026-07-30 and again in Phase 01 an em dash in a
# test name made bats declare tests it never ran, and the run still went green.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
VERIFY="$ARC_ROOT/tests/fixtures/spine/concurrency-verify.mjs"

# The spec's numbers: 8 emitters, 25 events each, 200 events through one lock. EXPECTED is
# derived rather than written down, so the three cannot drift apart.
EMITTERS=8
PER_EMITTER=25
EXPECTED=$((EMITTERS * PER_EMITTER))

# The control's numbers. 12 writers so contention is wide, 512 KB so each line is split
# across enough write() calls that at least one interleaving is close to certain.
CONTROL_WRITERS=12
CONTROL_WIDTH=524288
CONTROL_ALPHA="ABCDEFGHIJKL"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  IDS="$BATS_TEST_TMPDIR/ids"
  mkdir -p "$SPINE" "$IDS"
  export ARC_SPINE_ROOT="$SPINE"
  # No stale-break may fire during the run. At the 5s default a descheduled holder would let
  # the breaker hand the lock on, and this would silently stop being a test of the lock and
  # become a test of the stale-breaker instead. Every critical section here is milliseconds.
  export ARC_SPINE_LOCK_STALE_MS=600000
  # The strict-mode acquire timeout is NOT settable from here: arc-event.mjs passes its own
  # STRICT_LOCK_TIMEOUT_MS (15000) explicitly, which overrides ARC_SPINE_LOCK_TIMEOUT_MS. At
  # 8 waiters and a millisecond-scale section that is three orders of magnitude of headroom,
  # so nothing in this file may legitimately time out -- a LOCK_TIMEOUT here is a real fault.
}

# One emitter: PER_EMITTER strict emits, each with a payload no other emitter can produce.
#
# The payload has to be unique. idem is sha256(actor|venture|kind|run_id|outcome|payload|ms),
# so two emitters firing an identical payload inside the same millisecond would collide and
# the second would be refused DUP_IDEM -- a test failure caused by the test, not by the lock.
_emit_worker() {
  _w="$1"
  _j=1
  while [ "$_j" -le "$PER_EMITTER" ]; do
    if bash "$EVENT" emit note.logged --strict \
         --run-id r-conc \
         --payload "{\"w\":$_w,\"j\":$_j}" \
         >> "$IDS/ids-$_w" 2>> "$IDS/err-$_w"
    then
      echo ok >> "$IDS/rc-$_w"
    else
      echo "fail w=$_w j=$_j" >> "$IDS/rc-$_w"
    fi
    _j=$((_j + 1))
  done
}

# ---------- the control ----------

@test "control: concurrent unlocked appends of a 512 KB line DO tear a plain file" {
  target="$BATS_TEST_TMPDIR/control.txt"
  src="$BATS_TEST_TMPDIR/control-src"
  mkdir -p "$src"
  : > "$target"

  # Sources are built BEFORE any writer starts, so the fill cost is not what the writers are
  # racing on -- they contend on the append itself.
  w=1
  while [ "$w" -le "$CONTROL_WRITERS" ]; do
    ch="${CONTROL_ALPHA:$((w - 1)):1}"
    printf "%*s" "$CONTROL_WIDTH" "" | tr " " "$ch" > "$src/$w"
    w=$((w + 1))
  done

  # 3>&- closes bats' status descriptor in each child: a background job holding it open
  # makes bats wait forever for a test that already finished.
  w=1
  while [ "$w" -le "$CONTROL_WRITERS" ]; do
    ( line="$(cat "$src/$w")"; printf "%s\n" "$line" >> "$target" ) >/dev/null 2>&1 3>&- &
    w=$((w + 1))
  done
  wait

  run node "$VERIFY" --control "$target" --writers "$CONTROL_WRITERS" --width "$CONTROL_WIDTH"
  [ "$status" -eq 0 ]
  case "$output" in
    TORN*) ;;
    *)
      echo "The control did NOT corrupt: $output"
      echo "That is not good news. $CONTROL_WRITERS writers appending ${CONTROL_WIDTH}-byte"
      echo "lines with no lock produced a clean file, which means this leg never actually"
      echo "ran them concurrently. The subject test below therefore proves nothing about"
      echo "the spine lock on this OS, so this fixture fails rather than passing quietly."
      false
      ;;
  esac
}

# ---------- the subject ----------

@test "subject: 8 concurrent emitters put 200 events on the spine with zero interleaving" {
  w=1
  while [ "$w" -le "$EMITTERS" ]; do
    ( _emit_worker "$w" ) >/dev/null 2>&1 3>&- &
    w=$((w + 1))
  done
  wait

  # Every emit must have succeeded. In strict mode a refusal is exit 2, and a refused event
  # would make the count assertions below pass against a smaller, wrong expectation.
  failed="$(cat "$IDS"/rc-* 2>/dev/null | grep -c "^fail" || true)"
  if [ "$failed" != "0" ]; then
    echo "$failed of $EXPECTED strict emits were refused:"
    cat "$IDS"/rc-* 2>/dev/null | grep "^fail" || true
    echo "--- emitter stderr ---"
    cat "$IDS"/err-* 2>/dev/null || true
    false
  fi

  run node "$VERIFY" --spine "$SPINE" --ids "$IDS" --expect "$EXPECTED"
  echo "$output"
  [ "$status" -eq 0 ]

  # Every failure path in the emitter quarantines before it exits, so an empty quarantine is
  # the independent witness that the run had no refusals at all -- including any the rc files
  # would miss if a worker died before writing its own line. Asserted on THIS run rather than
  # in a test of its own: a second @test gets a fresh tmpdir, so it would mean paying for 200
  # more process spawns on the leg where spawning is the entire cost.
  count=0
  if [ -d "$SPINE/events/_quarantine" ]; then
    count="$(cat "$SPINE"/events/_quarantine/*.jsonl 2>/dev/null | sed "/^$/d" | wc -l | tr -d " ")"
  fi
  if [ "$count" != "0" ]; then
    echo "$count quarantined record(s) from a run that should have had none:"
    cat "$SPINE"/events/_quarantine/*.jsonl 2>/dev/null || true
    false
  fi
}

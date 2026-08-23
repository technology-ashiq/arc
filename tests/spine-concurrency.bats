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
# HOW THE CONTROL TEARS, and the THREE designs that did not work. This matters because a
# control is only an instrument for one question -- "did these writers actually overlap on
# this leg?" -- and every earlier design answered a different question by accident.
#
#   1. ">8 KB, over PIPE_BUF, so the append is not atomic" (the spec's original wording).
#      Wrong mechanism: one write() to a regular file opened O_APPEND is serialised by the
#      inode lock on Linux, so a 9 KB write lands whole however many writers there are.
#   2. "512 KB, so stdio splits it into ~100 write() calls." Correct on Linux and macOS, and
#      it came out CLEAN on windows-git-bash (arc-ci 30696565045, shard 11/12). Two reasons,
#      neither of them a spine defect: a Windows append write is serialised by the OS, and
#      MSYS fork is slow enough that 12 writers spawned in a loop can finish one at a time.
#      A control that depends on how an OS buffers is measuring the OS, not the harness.
#   3. Two separate appends behind a barrier, with no gap between them. Right idea, and it
#      passed six legs across two PRs -- then came out CLEAN on ubuntu-18 (arc-ci
#      30698758154). It was never reliable, only lucky: writers leave the barrier up to one
#      POLL INTERVAL apart, and a record that takes microseconds to write closes long before
#      the next writer wakes. The barrier was serialising the writers it existed to release.
#      A control that fails one run in several is not a gate, it is a coin.
#
# What ships depends on nothing platform-specific and nothing lucky: each writer appends ONE
# logical record as TWO SEPARATE appends and holds it open across a deliberate gap an order
# of magnitude longer than the barrier's release spread. Any writer genuinely running at the
# same time lands inside somebody else's record, on every OS. CLEAN now means one thing only:
# these processes really did take turns.
#
# ASCII-only @test names, deliberately: on 2026-07-30 and again in Phase 01 an em dash in a
# test name made bats declare tests it never ran, and the run still went green.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
VERIFY="$ARC_ROOT/tests/fixtures/spine/concurrency-verify.mjs"
HOLDER="$ARC_ROOT/tests/fixtures/spine/slow-holder.mjs"

# The spec's numbers: 8 emitters, 25 events each, 200 events through one lock. EXPECTED is
# derived rather than written down, so the three cannot drift apart.
EMITTERS=8
PER_EMITTER=25
EXPECTED=$((EMITTERS * PER_EMITTER))

# The control's numbers. 12 writers so contention is wide; each writes its record as two
# 8 KB halves, so a whole record still clears the spec's 8 KB floor and the split that makes
# interleaving detectable is explicit rather than left to a buffer size.
CONTROL_WRITERS=12
CONTROL_HALF=8192
CONTROL_WIDTH=$((CONTROL_HALF * 2))
CONTROL_ALPHA="ABCDEFGHIJKL"
# How often a parked writer looks for the go file, and how long it then holds its record
# open between the two appends. The GAP must be well clear of the POLL: writers leave the
# barrier up to one poll interval apart, so a record that closes faster than that can be
# finished by the first writer out before the second has even woken. See the comment at the
# gap itself -- getting this wrong is what made the first version flaky rather than wrong.
CONTROL_POLL=0.02
CONTROL_GAP=0.4

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
  #
  # OBSERVED ONCE, AND NOT REPRODUCED (2026-08-24, face lane). One of 200 strict emits was
  # refused with LOCK_TIMEOUT on `windows-latest, shard 6/12` -- `fail w=3 j=23`. The same
  # commit's siblings passed it, the run before and the run after passed it, and the change
  # under test could not reach the spine lock at all. The headroom argument above assumes the
  # HOLDER gets scheduled; on a Windows runner carrying twelve shards that is an assumption
  # about the machine, not about the code.
  #
  # Recorded rather than acted on, and the assertion is deliberately UNCHANGED: one
  # non-reproducing event is not enough to loosen a lock test, and a timeout here is still the
  # right thing to go red on. What this note buys the next reader is the difference between
  # "first time" and "again" -- if it recurs, it is the lock, and the headroom sentence above
  # is the claim to re-examine first.
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

@test "control: 12 unlocked writers appending one record in two halves DO tear a file" {
  target="$BATS_TEST_TMPDIR/control.txt"
  ready="$BATS_TEST_TMPDIR/control-ready"
  go="$BATS_TEST_TMPDIR/control-go"
  mkdir -p "$ready"
  : > "$target"

  # 3>&- closes bats' status descriptor in each child: a background job holding it open makes
  # bats wait forever for a test that already finished.
  w=1
  while [ "$w" -le "$CONTROL_WRITERS" ]; do
    (
      ch="${CONTROL_ALPHA:$((w - 1)):1}"
      half="$(printf "%*s" "$CONTROL_HALF" "" | tr " " "$ch")"
      # Fill cost is paid BEFORE signalling ready, so what the writers race on is the append
      # and nothing else.
      : > "$ready/$w"
      while [ ! -f "$go" ]; do sleep "$CONTROL_POLL"; done
      printf "%s" "$half" >> "$target"
      # THE GAP IS LOAD-BEARING, and leaving it out is what made this control flaky.
      # Writers leave the barrier up to CONTROL_POLL apart, because that is how often they
      # look for the go file. Two appends of a few microseconds inside that window means the
      # first writer out can finish its whole record before the second one has even woken --
      # so the barrier SERIALIZES the writers instead of releasing them, and the file comes
      # out clean on a machine that is perfectly capable of interleaving. Holding each record
      # open for an order of magnitude longer than the release spread means any writer that
      # is genuinely running at the same time lands inside somebody else's record.
      sleep "$CONTROL_GAP"
      printf "%s\n" "$half" >> "$target"
    ) >/dev/null 2>&1 3>&- &
    w=$((w + 1))
  done

  # Release only once every writer is parked at the barrier. A fixed sleep would be a guess,
  # and on the leg where fork is slowest the guess would be wrong in the direction that makes
  # the control pass for the wrong reason.
  waited=0
  while [ "$(ls "$ready" | wc -l | tr -d " ")" -lt "$CONTROL_WRITERS" ]; do
    sleep 0.1
    waited=$((waited + 1))
    if [ "$waited" -gt 600 ]; then
      echo "only $(ls "$ready" | wc -l) of $CONTROL_WRITERS writers reached the barrier in 60s"
      false
    fi
  done
  : > "$go"
  wait

  run node "$VERIFY" --control "$target" --writers "$CONTROL_WRITERS" --width "$CONTROL_WIDTH"
  [ "$status" -eq 0 ]
  case "$output" in
    TORN*) ;;
    *)
      echo "The control did NOT corrupt: $output"
      echo "That is not good news. $CONTROL_WRITERS writers were released together and each"
      echo "appended one record as TWO separate appends with no lock between them. For the"
      echo "file to come out clean, no writer's second append can have been overtaken by any"
      echo "other writer -- i.e. they took turns, and this leg did not run them concurrently."
      echo "The subject test therefore proves nothing about the spine lock here, so this"
      echo "fixture fails rather than passing quietly."
      false
      ;;
  esac
}

# ---------- the lock's own contract ----------

@test "lock: a waiter does NOT break the lock of a holder that is alive and still working" {
  # FOUND BY THE ADVERSARIAL PASS, at production defaults, not by reading the code.
  #
  # The stale threshold was a bare LOCK_STALE_MS (5000) while a strict caller waits
  # STRICT_LOCK_TIMEOUT_MS (15000). A strict waiter therefore outlived the threshold by ten
  # seconds and deleted the lock of a holder that was mid-write; the token is re-read once at
  # acquire and never again during fn(), so the victim kept writing. Two writers in one
  # critical section put DUPLICATE receipts on an append-only spine, both processes exiting 0
  # and neither saying anything.
  #
  # The threshold is now max(stale, this caller's own timeout): you may only call a lock
  # abandoned once it has outlasted your own patience. A crashed holder is still recovered,
  # by the next caller, whose wait starts when the lock is already older than any timeout.
  #
  # No timing env door is set here on purpose -- the bug lived in the PRODUCTION values, and a
  # fixture that tunes them tests a configuration nobody ships.
  unset ARC_SPINE_LOCK_STALE_MS

  ( node "$HOLDER" 8000 > "$BATS_TEST_TMPDIR/holder.out" 2>&1 ) 3>&- &
  _holder_pid=$!
  sleep 1                     # let the holder take the lock before the waiter starts

  # A strict emit: 15s of patience against a 5s stale threshold is exactly the inversion.
  run bash "$EVENT" emit note.logged --strict --payload '{"who":"waiter"}' --run-id r-lock
  [ "$status" -eq 0 ] || { echo "the waiter did not land its event: $output"; false; }
  wait "$_holder_pid"

  verdict="$(cat "$BATS_TEST_TMPDIR/holder.out")"
  [ "$verdict" = "HOLDER_KEPT_LOCK" ] || {
    echo "The holder was alive and inside its critical section, and its lock was taken away."
    echo "holder said: $verdict"
    echo "That is two writers in one critical section, which is how duplicate receipts reach"
    echo "an append-only spine with both processes reporting success."
    false
  }
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

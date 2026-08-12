#!/usr/bin/env bats
# Phase 00 -- the job SCRIPTS and the arc-run job-stub guard. Neither was executed by any test
# on any leg until this file existed, which is why four real defects survived a green CI run:
# every close-day failure was counted as a sealed day, a directory passed as a script entry,
# the guard was bypassed by any non-boolean spelling, and the brief was written non-atomically.
#
# ARC_SPINE_ROOT is set in setup because both scripts call spineRoot(), which hard-refuses
# inside a linked git worktree. Without it these tests would pass vacuously for anyone running
# from a worktree -- the scripts would never start.
bats_require_minimum_version 1.5.0
load 'test_helper'

ROLL="$ARC_ROOT/.claude/scripts/hq/jobs/day-close-roll.mjs"
JOBS="$ARC_ROOT/.claude/scripts/hq/arc-jobs.mjs"
EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
RUN="$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE/events"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="00112233445566778899"
}

# Emit one real event into a named past day, so the day file exists and is sealable.
_seed_day() {
  local day="$1"
  ARC_SPINE_NOW="$(node -e "process.stdout.write(String(Date.parse('${day}T10:00:00+05:30')))")" \
    bash "$EVENT" emit note.logged --payload "{\"seed\":\"$day\"}" --strict >/dev/null
  [ -s "$SPINE/events/$day.jsonl" ] || { echo "seed builder produced no day file for $day"; false; }
}

@test "day-close-roll: seals an unsealed past day and says so" {
  _seed_day 2026-08-01
  run node "$ROLL"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "sealed=1 " || { echo "$output"; false; }
  [ -f "$SPINE/events/2026-08-01.closed" ] || { echo "no close marker on disk"; false; }
}

@test "day-close-roll: seals several slept-through days oldest first" {
  _seed_day 2026-08-01
  _seed_day 2026-08-02
  _seed_day 2026-08-03
  run node "$ROLL"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "sealed=3 " || { echo "$output"; false; }
  # Oldest first is load-bearing: a later day sealed while an earlier one is still open claims
  # an immutability window for a day whose predecessor can still be appended to.
  local order
  order="$(node -e "
const fs=require('fs');
const days=['2026-08-01','2026-08-02','2026-08-03'];
const t=days.map(d=>fs.statSync(process.env.ARC_SPINE_ROOT+'/events/'+d+'.closed').mtimeMs);
process.stdout.write(String(t[0]<=t[1] && t[1]<=t[2]));")"
  [ "$order" = "true" ] || { echo "close markers were not written oldest first"; false; }
}

@test "day-close-roll: a second run is idempotent and reports already sealed" {
  _seed_day 2026-08-01
  run node "$ROLL"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$ROLL"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "sealed=0 already_sealed=1" || { echo "$output"; false; }
}

@test "day-close-roll: a close-day FAILURE lands in failed, never in sealed" {
  # THE NEGATIVE CONTROL FOR --strict. arc-event runs in hook mode by default and exits 0 on
  # every failure, so without --strict this job counted a failed close as a sealed day and
  # reported sealed=1 failed=0. Reverting --strict turns this test red, which is its whole job.
  #
  # The failure is forced by making the day file a DIRECTORY: listDays still lists it, the close
  # marker never appears, and close-day cannot hash it.
  mkdir -p "$SPINE/events/2026-08-01.jsonl"
  run node "$ROLL"
  [ "$status" -eq 1 ] || { echo "wanted exit 1, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "sealed=0 " || { echo "a failure was counted as a sealed day:"; echo "$output"; false; }
  echo "$output" | grep -q "failed=1" || { echo "$output"; false; }
  [ ! -f "$SPINE/events/2026-08-01.closed" ] || { echo "close marker exists for a day that did not seal"; false; }
}

@test "day-close-roll: never seals today, whose events are not complete" {
  # Emitting at the real now writes TODAY's day file; the roll must leave it open.
  bash "$EVENT" emit note.logged --payload '{"seed":"today"}' --strict >/dev/null
  run node "$ROLL"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "sealed=0 " || { echo "the roll sealed today:"; echo "$output"; false; }
}

@test "arc-run: refuses a job stub before selecting a driver" {
  run node "$RUN" --process day-close-roll --driver auto
  [ "$status" -ne 0 ] || { echo "arc-run RAN a job stub:"; echo "$output"; false; }
  echo "$output" | grep -q "scheduled-job stub" || { echo "refused for the wrong reason:"; echo "$output"; false; }
}

@test "arc-run: refuses the other job stub too" {
  run node "$RUN" --process brief-materialize --driver auto
  [ "$status" -ne 0 ] || { echo "arc-run RAN a job stub:"; echo "$output"; false; }
  echo "$output" | grep -q "scheduled-job stub" || { echo "$output"; false; }
}

@test "arc-run: a real process does NOT hit the job-stub refusal" {
  # The positive half of the negative control. Without this, a guard that refused EVERYTHING
  # would pass both tests above -- and a runner that refuses every process is not a guard.
  #
  # `--driver no-such-driver` is deliberate: the guard sits immediately after the parse and
  # BEFORE driver selection, so an unknown driver proves the process got past the guard while
  # stopping the run before any driver is invoked. Pointing this at `--driver auto` would spend
  # real money on every CI leg, every run.
  run node "$RUN" --process kickoff-plan --driver no-such-driver
  [ "$status" -ne 0 ] || { echo "an unknown driver should not succeed"; echo "$output"; false; }
  ! echo "$output" | grep -q "scheduled-job stub" || {
    echo "a real process was refused as a job stub:"; echo "$output"; false; }
}

@test "jobs: every job entry named in hq.jobs.yaml exists and is a regular file" {
  # Cheap, and it catches the rename that jobs-lint would only catch on the leg that runs it.
  run node -e "
const fs=require('fs'), path=require('path');
const text=fs.readFileSync(path.join(process.argv[1],'hq.jobs.yaml'),'utf8');
const entries=[...text.matchAll(/^\s*entry:\s*(\S+)/gm)].map(m=>m[1]);
if(entries.length===0){console.error('no entries found in hq.jobs.yaml');process.exit(1);}
for(const e of entries){
  const p=path.join(process.argv[1],e);
  if(!fs.existsSync(p)||!fs.statSync(p).isFile()){console.error('missing or not a file: '+e);process.exit(1);}
}
process.stdout.write('ENTRIES-OK '+entries.length);
" "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "ENTRIES-OK 2" || { echo "$output"; false; }
}

@test "arc-jobs: a run leaves a receipt carrying the slot it claims" {
  _seed_day 2026-08-01
  run node "$JOBS" run day-close-roll
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The receipt is the deliverable, so assert it is ON THE SPINE rather than trusting exit 0.
  run grep -h '"kind":"run.completed"' "$SPINE/events/"*.jsonl
  [ "$status" -eq 0 ] || { echo "no run.completed on the spine"; false; }
  echo "$output" | grep -q '"job":"day-close-roll"' || { echo "$output"; false; }
  # The idem is hashed to the spine's wire format, so the human-readable slot lives in the
  # payload. Without it a receipt names a hash nobody can invert.
  echo "$output" | grep -q '"idem_preimage":"day-close-roll@' || { echo "$output"; false; }
}

@test "arc-jobs: a double fire at the same slot is prevented, not merely noticed" {
  _seed_day 2026-08-01
  run node "$JOBS" run day-close-roll
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$JOBS" run day-close-roll
  [ "$status" -eq 0 ] || { echo "second fire should exit 0, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "already has a receipt" || { echo "$output"; false; }
  # EXACTLY ONE receipt. Asserting the message alone would pass even if the job re-executed and
  # its duplicate were quarantined -- which is a different, weaker guarantee.
  local n
  n="$(grep -ho '"kind":"run.completed"' "$SPINE/events/"*.jsonl | wc -l | tr -d ' ')"
  [ "$n" -eq 1 ] || { echo "expected exactly 1 run.completed, found $n"; false; }
}

@test "arc-jobs: a scheduled fire is distinguishable from an attended one by actor" {
  # This is what makes REQ-06's zero-manual-starts a spine QUERY rather than a diary claim.
  _seed_day 2026-08-01
  run node "$JOBS" run day-close-roll --scheduled
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run grep -h '"kind":"run.completed"' "$SPINE/events/"*.jsonl
  [ "$status" -eq 0 ] || { echo "no receipt"; false; }
  echo "$output" | grep -q '"actor":"scheduler:day-close-roll"' || { echo "$output"; false; }
}

@test "arc-jobs: refuses to run anything from an illegal schedule" {
  # The runner enforces the SAME rule set as the committer. Otherwise the validator is advice.
  run node "$JOBS" run no-such-job
  [ "$status" -eq 2 ] || { echo "wanted exit 2, got $status"; echo "$output"; false; }
}

@test "jobs-run: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || {
    echo "bats registered $output tests but the file declares $declared"; false; }
}

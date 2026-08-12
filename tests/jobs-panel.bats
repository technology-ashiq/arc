#!/usr/bin/env bats
# Phase 01 -- REQ-03: the brief shows which jobs have gone quiet.
#
# THIS IS THE ONE DETECTOR THAT CANNOT BE EVENT-DRIVEN. A job that dies emits nothing, so there
# is no receipt to read and no kind to subscribe to -- the panel is a READER-SIDE DERIVATION of
# what should have happened against what did. Every test here is really asking the same question:
# does silence become visible, and does it stay quiet when it should.
#
# Determinism is asserted rather than assumed. `--date D` is a REPLAY: the same spine and the
# same date must produce byte-identical output forever, on every leg. `Date.now()` is absent from
# the derivation, and the replay test is what would catch it coming back.
bats_require_minimum_version 1.5.0
load 'test_helper'

JOBS="$ARC_ROOT/.claude/scripts/hq/arc-jobs.mjs"
BRIEF="$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs"
EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE/events"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="00112233445566778899"
}

# Put one real event on a named past day, so the spine has a witness window to reason over.
_seed() {
  local day="$1"
  ARC_SPINE_NOW="$(node -e "process.stdout.write(String(Date.parse('${day}T10:00:00+05:30')))")" \
    bash "$EVENT" emit note.logged --payload "{\"s\":\"$day\"}" --strict >/dev/null
  [ -s "$SPINE/events/$day.jsonl" ] || { echo "seed produced no day file for $day"; false; }
}

# Record a run for a job at a given slot, the way arc-jobs would.
_seed_run() {
  local job="$1" day="$2" slot="$3"
  ARC_SPINE_NOW="$(node -e "process.stdout.write(String(Date.parse('${day}T${slot}:00+05:30')))")" \
    bash "$EVENT" emit run.completed \
      --payload "{\"job\":\"$job\",\"scheduled_for\":\"${day}T${slot}:00+05:30\",\"outcome\":\"ok\"}" \
      --actor "scheduler:$job" --strict >/dev/null
}

@test "panel: a spine with only one day does not accuse a job of anything" {
  # The window is what makes a never-run judgement honest. One day of spine has seen one slot,
  # which is not evidence of a dead job -- and this is also what keeps a lane adding a job from
  # disturbing every other lane's pinned brief output.
  _seed 2026-07-22
  run node "$JOBS" panel --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "never-run" || { echo "$output"; false; }
  ! echo "$output" | grep -q "OVERDUE" || { echo "one day of spine must not read as overdue:"; echo "$output"; false; }
  ! echo "$output" | grep -q "needs-you" || { echo "$output"; false; }
}

@test "panel: a job silent across a long window IS overdue and says how many slots" {
  _seed 2026-08-01
  _seed 2026-08-10
  run node "$JOBS" panel --date 2026-08-12
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # daily@00:15 over 2026-08-01..2026-08-12 inclusive = 12 slots. Asserting the NUMBER, because a
  # panel that said "overdue" without counting could be right by accident.
  echo "$output" | grep -q "day-close-roll .*OVERDUE (12 missed)" || { echo "$output"; false; }
  # weekdays@06:00 over the same window skips two weekends = 8 slots.
  echo "$output" | grep -q "brief-materialize .*OVERDUE (8 missed)" || { echo "$output"; false; }
  echo "$output" | grep -q "needs-you (2)" || { echo "$output"; false; }
}

@test "panel: a recent run clears the overdue state" {
  # The negative control for the test above: without it, a panel hardcoded to shout would pass.
  _seed 2026-08-01
  _seed_run day-close-roll 2026-08-12 00:15
  run node "$JOBS" panel --date 2026-08-12
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  ! echo "$output" | grep -q "day-close-roll .*OVERDUE" || { echo "a job that just ran is not overdue:"; echo "$output"; false; }
  echo "$output" | grep -q "day-close-roll .*last 2026-08-12" || { echo "$output"; false; }
}

@test "panel: an attended run counts, not only a scheduled one" {
  # The panel matches on payload.job, never on actor. A job has two legitimate actors -- the
  # scheduler and a human -- and matching on actor would make every manual run invisible and
  # every catch-up look like a miss.
  _seed 2026-08-01
  ARC_SPINE_NOW="$(node -e "process.stdout.write(String(Date.parse('2026-08-12T00:15:00+05:30')))")" \
    bash "$EVENT" emit run.completed \
      --payload '{"job":"day-close-roll","scheduled_for":"2026-08-12T00:15:00+05:30","outcome":"ok"}' \
      --actor session --strict >/dev/null
  run node "$JOBS" panel --date 2026-08-12
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  ! echo "$output" | grep -q "day-close-roll .*OVERDUE" || { echo "$output"; false; }
}

@test "panel: --date is a REPLAY and cannot see past the day it renders" {
  _seed 2026-08-01
  _seed_run day-close-roll 2026-08-12 00:15
  # Rendering an EARLIER day must not see the later run. Without this cut, `--date` would be a
  # label on a live status read rather than a replay, and the golden would drift every day.
  run node "$JOBS" panel --date 2026-08-05
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "day-close-roll .*last never" || { echo "the replay saw the future:"; echo "$output"; false; }
}

@test "panel: the same spine and date render byte-identically twice" {
  _seed 2026-08-01
  _seed 2026-08-10
  run node "$JOBS" panel --date 2026-08-12
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local first="$output"
  run node "$JOBS" panel --date 2026-08-12
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "$first" ] || { echo "=== drift (first < / second >) ==="; diff <(printf '%s\n' "$first") <(printf '%s\n' "$output"); false; }
}

@test "panel: a disabled job renders as disabled and is never counted overdue" {
  # SCH-F, and pre-mortem row 5: a deliberate off is not a silent death. Conflating them is how a
  # needs-you group teaches people to ignore it.
  _seed 2026-08-01
  _seed 2026-08-10
  local tmp="$BATS_TEST_TMPDIR/hq.jobs.yaml"
  sed 's|^    enabled: true|    enabled: false|' "$ARC_ROOT/hq.jobs.yaml" > "$tmp"
  [ -s "$tmp" ] || { echo "empty fixture"; false; }
  grep -q "enabled: false" "$tmp" || { echo "fixture did not disable anything"; false; }
  # The CLI reads the COMMITTED schedule, so the derivation is driven directly with the fixture
  # injected. Through a harness file rather than `node -e`: building a file:// URL from a shell
  # variable hands Node a POSIX path on Git Bash, which it refuses as not absolute -- it failed
  # locally and would have failed the Windows leg for the same reason.
  run node "$ARC_ROOT/tests/fixtures/jobs/panel-harness.mjs" "$BATS_TEST_TMPDIR" 2026-08-12 2026-08-01
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE 2" || { echo "harness never finished:"; echo "$output"; false; }
  ! echo "$output" | grep -q "overdue=true" || { echo "a disabled job was counted overdue:"; echo "$output"; false; }
  echo "$output" | grep -q "NEEDSYOU:0" || { echo "$output"; false; }
  [ "$(printf '%s\n' "$output" | grep -c 'state=disabled')" -eq 2 ] || { echo "$output"; false; }
}

@test "brief: an overdue job appears in needs-you, derived from silence" {
  _seed 2026-08-01
  _seed 2026-08-10
  run node "$BRIEF" --date 2026-08-12
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "needs-you" || { echo "$output"; false; }
  echo "$output" | grep -q "has never run" || { echo "$output"; false; }
}

@test "brief: a healthy schedule adds NOTHING to the brief" {
  # The reason another lane's pinned brief output is safe: a schedule with nothing to say is
  # silent. If this breaks, spine-brief.bats breaks with it and the cause will not be obvious.
  _seed 2026-07-22
  run node "$BRIEF" --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  ! echo "$output" | grep -q "scheduled slots missed" || { echo "a healthy schedule wrote into the brief:"; echo "$output"; false; }
}

@test "catchup: runs what is due and is idempotent on a second call" {
  _seed 2026-08-01
  run node "$JOBS" catchup
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "ran=2" || { echo "$output"; false; }
  # Second call: both slots are already receipted, so nothing re-executes.
  run node "$JOBS" catchup
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "ran=0 up_to_date=2" || { echo "$output"; false; }
}

@test "list --next shows the coming slots and skips the weekend for a weekdays job" {
  run node "$JOBS" list --next 3
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "brief-materialize" || { echo "$output"; false; }
  # Three slots printed per enabled job.
  local n; n="$(printf '%s\n' "$output" | grep -c '^  20')"
  [ "$n" -eq 6 ] || { echo "expected 6 slot lines (2 jobs x 3), got $n"; echo "$output"; false; }
}

@test "nudge: the SessionStart fragment may read and print, and may never RUN a job" {
  # SCH-H's hard line, enforced rather than described. A SessionStart hook that executes work is
  # a daemon: it fires on a trigger nobody scheduled, at a moment nobody chose. The whole module
  # exists to keep arc daemon-free, so the nudge advertising it must not be what breaks it.
  local f="$ARC_ROOT/.claude/hooks/SessionStart.d/60-jobs.sh"
  [ -f "$f" ] || f="$ARC_ROOT/docs/owner-paste-sessionstart-jobs-nudge.sh"
  [ -f "$f" ] || { echo "neither the installed nudge nor its paste artifact exists"; false; }
  # It must call the derivation...
  grep -q "arc-jobs.mjs\" panel\|\$JOBS\" panel" "$f" || { echo "the nudge does not call panel"; false; }
  # ...and must not call either executing verb. Checked on the ACTION, not on a mention: the
  # comment block deliberately names `catchup` while explaining why it must not be invoked, so a
  # bare substring grep would fail on its own documentation.
  ! grep -qE '^[^#]*node .*(arc-jobs\.mjs|\$JOBS)" (run|catchup)' "$f" \
    || { echo "the nudge EXECUTES a job -- that is a daemon:"; grep -nE '^[^#]*(run|catchup)' "$f"; false; }
}

@test "jobs-panel: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || { echo "bats registered $output, file declares $declared"; false; }
}

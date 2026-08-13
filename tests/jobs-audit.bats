#!/usr/bin/env bats
# Phase 03 -- the proving week's INSTRUMENT, tested before the week has any data in it.
#
# WHY THAT ORDERING IS THE POINT. A measurement built after seeing the results can be tuned into
# one that flatters them without anyone intending it: a threshold nudged, a category widened, an
# awkward slot reclassified as expected. The phase spec names the rabbit hole outright ("grading
# the week on vibes"). Writing the instrument and its fixtures blind is the strongest available
# answer -- there is no data yet to tune against, and these assertions are what stop it being
# quietly adjusted later.
#
# It already paid for itself: the fixtures below found the audit cutting its window on
# `ts.slice(0, 10)` while slots live in IST, so a receipt rendered in UTC fell outside the window
# and its slot read as MISSED. The instrument would have reported a failure that never happened,
# on the first slot of every window, and there would have been no way to tell it from a real one.
bats_require_minimum_version 1.5.0
load 'test_helper'

H="$ARC_ROOT/tests/fixtures/jobs/audit-harness.mjs"
JOBS="$ARC_ROOT/.claude/scripts/hq/arc-jobs.mjs"

# 2026-08-13T10:00:00+05:30, as a LITERAL rather than a computed one.
#
# The obvious spelling would embed a one-line node program that parses the ISO string, and that
# is banned here: a program embedded in a shell string carries no apostrophes, and an ISO date
# handed to a parser needs quoting. This repo has shipped that bug four times, twice inside the
# comment explaining the previous fix -- so this comment carries neither an apostrophe nor a
# backtick either. A constant needs no program at all.
#
# It is pinned rather than read from the wall clock because the CLI computes "today" in its own
# process: a run spanning IST midnight would see two different days, the guard under test would
# not fire, and the failure would look like a bug in the code rather than in the clock.
PINNED_NOW=1786595400000

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE/events"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="00112233445566778899"
}

_case() {
  run node "$H" "$1"
  [ "$status" -eq 0 ] || { echo "harness exited $status"; echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished:"; echo "$output"; false; }
}

# A NEGATIVE assertion, written as an `if` on purpose. The tempting one-liner
# `echo "$out" | grep -q X && { echo; false; }` returns 1 in BOTH directions under errexit -- once
# because the block ran, once because grep found nothing -- so it fails the test precisely when
# the code is correct. Same helper, and same reasoning, as tests/jobs-register.bats.
_refute() {
  if echo "$output" | grep -q -F -- "$1"; then
    echo "unwanted in output: $1"
    echo "$output"
    false
  fi
}

@test "_refute: the helper this file relies on can actually fail" {
  output="MISSED:2026-08-08T06:00:00+05:30"
  run _refute "2026-08-08"
  [ "$status" -ne 0 ] || { echo "_refute passed on a string that IS present"; false; }
  output="MISSED:none"
  run _refute "2026-08-08"
  [ "$status" -eq 0 ] || { echo "_refute failed on a string that is absent"; false; }
}

@test "audit: a perfect week is clean, and every expected slot is accounted for" {
  # The control every negative case below depends on. If a clean week did not come back clean,
  # nothing else in this file would mean anything.
  _case perfect-week
  echo "$output" | grep -q '^EXPECTED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "the first slot of the window went missing:"; echo "$output"; false; }
  echo "$output" | grep -q '^MANUAL:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^SPEND:0$' || { echo "$output"; false; }
}

@test "audit: a slot with nothing against it is an UNEXPLAINED gap, and it is named" {
  _case one-missed
  echo "$output" | grep -q '^MISSED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q -F '2026-08-06T00:15:00+05:30' || { echo "the gap was counted but not named:"; echo "$output"; false; }
}

@test "audit: an incident naming the slot is an EXPLAINED absence, not a miss" {
  # The phase spec asks for "a run.completed or an explained absence". A wrapper that refused the
  # run and said so has not gone silent, and counting it as silence would send someone looking for
  # a dead scheduler instead of reading the incident.
  _case explained-by-incident
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^EXPLAINED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q '"policy-declined":1' || { echo "$output"; false; }
}

@test "audit: a skip note naming the slot is an explained absence too" {
  _case explained-by-note
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^EXPLAINED:1$' || { echo "$output"; false; }
}

@test "audit: a run that FAILED is not a missed slot" {
  # Two different repairs: "the scheduler never fired" and "the work failed". Collapsing them
  # sends every investigation to the wrong half of the system.
  _case failed-run-is-not-a-gap
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^FAILED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:6$' || { echo "$output"; false; }
}

@test "audit: a manual start is counted BY ACTOR, and does not hide in the completed count" {
  # REQ-06 is zero manual starts. The only field separating a scheduled fire from an attended one
  # is the actor, so matching on anything else would make the claim unfalsifiable -- and the run
  # still counts as completed, because it did complete. Both facts, separately.
  _case manual-start
  echo "$output" | grep -q '^MANUAL:1$' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'WHO:["session"]' || { echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "a manual run was also counted as a miss:"; echo "$output"; false; }
}

@test "audit: a receipt rendered in UTC still lands in its IST window" {
  # THE DEFECT THESE FIXTURES FOUND, pinned BEHAVIOURALLY.
  #
  # The window was cut on `ts.slice(0, 10)` while slots live in IST, so a 00:15 IST receipt carries
  # a UTC date of the PREVIOUS day, fell out of the window, and its slot read as MISSED -- a
  # failure that never happened, on the first slot of every window.
  #
  # The first version of this test was a GREP for `ts.slice(0, 10)`, and it was broken in both
  # readings: it matched the file's own explanatory comment saying never to use that construct, so
  # it failed on correct source. A structural check that can be satisfied by a respelling, and
  # fooled by a comment, is not a check. This drives the actual data instead.
  _case utc-receipt
  echo "$output" | grep -q '^MISSED:0$' || { echo "a UTC-rendered receipt fell out of its IST window:"; echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^UNDATED:0$' || { echo "$output"; false; }
}

@test "audit: events outside the window are excluded on BOTH sides" {
  # Without this, a mutant that drops the `to` bound -- or the cut entirely -- survives the whole
  # suite, because no other fixture places a single event outside the range.
  _case outside-window
  echo "$output" | grep -q '^EXPECTED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "events outside the window were counted:"; echo "$output"; false; }
  echo "$output" | grep -q -F 'EXTRA:[]' || { echo "an out-of-window run was filed as an extra:"; echo "$output"; false; }
}

@test "audit: a hand-written explanation does NOT explain anything" {
  # A COMPLETELY DEAD SCHEDULER, explained away by hand: seven skip notes with a session actor and
  # no runs at all used to grade CLEAN. That would also let the fire-drill's required true positive
  # be erased by anyone able to write to the spine, which is the one thing this instrument must not
  # allow. An explanation must come from `scheduler:<job>` itself.
  _case hand-written-explanation
  echo "$output" | grep -q '^MISSED:7$' || { echo "hand-written notes explained a dead scheduler:"; echo "$output"; false; }
  echo "$output" | grep -q '^EXPLAINED:0$' || { echo "$output"; false; }
}

@test "audit: a week where every run CRASHED is not a clean week" {
  # Failed runs used to be filed under `explainedGaps` -- a name that reads as health -- and
  # appeared in no verdict rule at all, so seven consecutive crashes graded CLEAN. The scheduler
  # firing correctly is only half of what the proving week proves.
  _case all-crashed
  echo "$output" | grep -q '^FAILED_SLOTS:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^INCIDENTS:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^EXPLAINED:0$' || { echo "a crash was filed as an explained absence:"; echo "$output"; false; }
}

@test "audit: the outcome is read the same way the panel reads it" {
  # The panel reads `e.outcome ?? e.payload.outcome`; the audit read only the envelope. Two
  # instruments over one spine reaching opposite conclusions about the same receipt is the
  # "validate one read, compare another" defect, recurring across the two modules that must agree.
  _case outcome-in-payload-only
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "a payload-only outcome was not read:"; echo "$output"; false; }
  echo "$output" | grep -q '^FAILED:0$' || { echo "$output"; false; }
  # And an outcome that is neither ok nor fail gets its own bucket rather than being folded into
  # either -- folding it into failed invents a fact, into completed hides one.
  echo "$output" | grep -q '^WEIRD_UNKNOWN:7$' || { echo "$output"; false; }
}

@test "audit: a receipt with no readable slot is FLAGGED, never silently dropped" {
  # It used to vanish from every category with no flag, so a slot that WAS served read as missed.
  # Both facts are reported now: the slot is silent, and a run is unaccounted for.
  _case bad-scheduled-for
  echo "$output" | grep -q '^UNPLACED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:1$' || { echo "$output"; false; }
}

@test "audit: two spellings of the same instant are the same slot" {
  # `...T00:15:00+05:30` and `...T00:15:00.000+05:30` are one moment and two strings. A string
  # match put ONE real run into unexplainedGaps AND unscheduledRuns at once -- two categories the
  # design calls mutually exclusive.
  _case dotted-slot-spelling
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^EXTRA:0$' || { echo "one run was reported in two categories:"; echo "$output"; false; }
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "$output"; false; }
}

@test "audit: the same events in ANY order derive identically" {
  # The `replay` case compares two calls with the SAME ordering, so it could not see this -- nor
  # could it have seen a Date.now() reintroduction, since two adjacent calls land in one
  # millisecond. Reversing the input is the test that actually asks the question.
  _case order-independence
  echo "$output" | grep -q '^IDENTICAL:true$' || { echo "the pack depends on event order:"; echo "$output"; false; }
}

@test "audit: a numeric job name still matches its own receipts" {
  # `String(job.name)` was applied on one side only, so 7 never equalled "7" and a job that ran
  # perfectly produced a full window of phantom gaps.
  _case numeric-job-name
  echo "$output" | grep -q '^COMPLETED:7$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
}

@test "audit: a schedule naming one job twice is REFUSED, not scored" {
  # Two rows with one name doubled every total -- expected 14, completed 14 -- while still reading
  # perfectly clean.
  _case duplicate-job-name
  echo "$output" | grep -q '^REFUSED:' || { echo "a duplicated job name was scored:"; echo "$output"; false; }
}

@test "audit: money does not cancel out, and an unreadable cost is not a zero" {
  # Signed summing let +1000 and -1000 net to a clean 0 while a thousand rupees had moved, and
  # every invalid value coerced quietly to no contribution -- a coerced invalid read reported as a
  # successful zero.
  _case spend-cancels
  echo "$output" | grep -q '^SPEND:1000$' || { echo "spend cancelled out:"; echo "$output"; false; }
  echo "$output" | grep -q '^BAD_COSTS:3$' || { echo "invalid costs were coerced to zero:"; echo "$output"; false; }
}

@test "audit: an unbelievable started_at is counted, not turned into drift" {
  # Date.parse("12345") succeeds as the YEAR 12345 and yields a finite, plausible-shaped, wholly
  # wrong drift with no bound at all.
  _case drift-absurd
  echo "$output" | grep -q '^DRIFT_UNPARSED:1$' || { echo "$output"; false; }
  echo "$output" | grep -q '^DRIFT_P50:0$' || { echo "an absurd timestamp reached the median:"; echo "$output"; false; }
}

@test "audit: a note for ANOTHER job does not explain this one" {
  # The suite had no two-job fixture at all, so this question was never asked of the code.
  _case cross-job-note
  echo "$output" | grep -q '^MISSED:1$' || { echo "another job's note explained this gap:"; echo "$output"; false; }
  echo "$output" | grep -q '^EXPLAINED:0$' || { echo "$output"; false; }
}

@test "audit: a 400-day needs-you walk completes instead of calling itself truncated" {
  # `guard++ < 400` leaves guard === 400 after a CORRECTLY completed walk, so the guard against
  # silent truncation was firing on a complete one.
  _case long-window
  echo "$output" | grep -q '^WALKED:true$' || { echo "$output"; false; }
}

@test "audit: a weekdays job expects NOTHING on the weekend" {
  # Five slots in a Mon-Sun week, not seven. The constant-interval version of this arithmetic made
  # every healthy weekdays job overdue every Monday.
  _case weekend
  echo "$output" | grep -q '^EXPECTED:5$' || { echo "$output"; false; }
  _refute "2026-08-08"
  _refute "2026-08-09"
}

@test "audit: a disabled job expects nothing and misses nothing" {
  _case disabled
  echo "$output" | grep -q '^EXPECTED:0$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
}

@test "audit: a run at a slot nobody scheduled is REPORTED, not dropped" {
  # A catch-up lands here legitimately -- and so would a task firing on a schedule nobody wrote.
  # Dropping the category would hide the second inside the first.
  _case unscheduled-run
  echo "$output" | grep -q -F '2026-08-05T13:00:00+05:30' || { echo "$output"; false; }
  echo "$output" | grep -q '^MISSED:0$' || { echo "$output"; false; }
}

@test "audit: drift p50 takes the LOWER middle, never a mean" {
  # Drift is measured against a wall clock in whole milliseconds. Averaging two middles invents a
  # value no run actually had, and every figure in this pack has to point at a real receipt.
  _case drift
  echo "$output" | grep -q '^DRIFT_P50:5000$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MEDIAN_EVEN:10$' || { echo "the even case averaged instead of taking the lower:"; echo "$output"; false; }
  echo "$output" | grep -q '^MEDIAN_ODD:20$' || { echo "$output"; false; }
  echo "$output" | grep -q '^MEDIAN_EMPTY:null$' || { echo "an empty list produced a number:"; echo "$output"; false; }
}

@test "audit: money spent by a job that must not spend is counted, not ignored" {
  # Spend-carrying kinds are unschedulable by jobs-lint on top of policy's own money law, so any
  # figure here is a finding rather than a number.
  _case spend
  echo "$output" | grep -q '^SPEND:12$' || { echo "$output"; false; }
}

@test "audit: an UNDECLARED incident class is counted separately, never folded away" {
  # A new failure mode landing silently in a pack that reads "0 incidents" is the metric telling
  # the opposite of the truth.
  _case unknown-incident-class
  echo "$output" | grep -q -F '"something-nobody-declared":1' || { echo "$output"; false; }
  echo "$output" | grep -q '"policy-declined":0' || { echo "it was folded into a declared bucket:"; echo "$output"; false; }
}

@test "audit: the same events and window derive byte-identically twice" {
  # The pack has to be re-checkable by anyone later. Date.now() is absent from the derivation
  # rather than merely discouraged, and this is what would catch it coming back.
  _case replay
  echo "$output" | grep -q '^IDENTICAL:true$' || { echo "$output"; false; }
}

@test "audit: a backwards or malformed window is REFUSED, never folded into an empty pack" {
  # An empty pack reads as a clean week. Every bad bound has to raise rather than return nothing.
  _case bad-window
  [ "$(printf '%s\n' "$output" | grep -c '^REFUSED:')" -eq 3 ] || { echo "$output"; false; }
  _refute "ACCEPTED:"
}

@test "audit: the slot string it builds is the slot string a receipt carries" {
  # THE GAP AUDIT IS A STRING MATCH. Render UTC here and every served slot reads as an unexplained
  # gap while every run reads as unscheduled -- a total inversion that still looks like a report.
  _case iso-slot-matches-receipt
  echo "$output" | grep -q '^MATCH:true$' || { echo "$output"; false; }
  echo "$output" | grep -q -F 'BUILT:"2026-08-03T00:15:00+05:30"' || { echo "$output"; false; }
}

@test "audit: the needs-you history reconstructs the days the panel WOULD have nagged" {
  # The fire-drill's shape: a job that ran, then went silent because its OS task was removed while
  # the yaml still said enabled. There is no receipt to count -- the panel's lines are derived --
  # so the history is rebuilt by replaying the pure derivation once per day of the window.
  _case needs-you-history
  echo "$output" | grep -q -F '"2026-08-07"' || { echo "the silence never surfaced:"; echo "$output"; false; }
  echo "$output" | grep -q '"missed":3' || { echo "$output"; false; }
}

@test "audit: a healthy week writes NOTHING into the needs-you history" {
  # The negative control for the test above. A function that reported every day would satisfy it.
  _case needs-you-quiet
  echo "$output" | grep -q -F 'DAYS:[]' || { echo "a clean week produced nags:"; echo "$output"; false; }
}

@test "audit: the history refuses to run without the panel derivation injected" {
  # It reasons ABOUT the renderer; it does not import one. A silent fallback would let the audit
  # and the brief disagree about the same day while both looked correct.
  _case needs-you-needs-panel
  echo "$output" | grep -q '^REFUSED:' || { echo "$output"; false; }
}

@test "audit CLI: a window ending today is refused, because the day is not over" {
  # A day still in progress has slots that have not arrived, and the derivation cannot tell "has
  # not come" from "did not happen" -- it would count every slot later today as MISSED. That is
  # this lane's recurring failure shape pointed at its own instrument.
  #
  # `ARC_SPINE_NOW` is PINNED rather than read from the wall clock, and not for tidiness: the
  # first version computed "today" in its own node process and the CLI computed it again in a
  # second one, so a run spanning IST midnight would see two different days, the guard would not
  # fire, and the test would fail with nothing wrong. A test that flakes once a day is a test
  # people learn to re-run.
  export ARC_SPINE_NOW="$PINNED_NOW"
  run node "$JOBS" audit --from 2026-08-13 --to 2026-08-13
  [ "$status" -eq 2 ] || { echo "wanted exit 2 for an unfinished day, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "has not finished" || { echo "$output"; false; }
  # And --partial is the declared way to ask for it anyway, so the guard is a default, not a wall.
  run node "$JOBS" audit --from 2026-08-13 --to 2026-08-13 --partial
  [ "$status" -eq 1 ] || { echo "--partial did not measure the day: $status"; echo "$output"; false; }
  echo "$output" | grep -q "metric pack" || { echo "$output"; false; }
  # An overridden calendar must SAY SO. A disarmed guard that is silent is worse than no guard.
  echo "$output" | grep -q "ARC_SPINE_NOW is set" || { echo "the faked today was not disclosed:"; echo "$output"; false; }
}

@test "audit CLI: the DEFAULT window is a real seven days ending yesterday" {
  # The command the operator will actually type at the end of the proving week is `arc-jobs audit`
  # with no flags -- and nothing tested it. Every other CLI test passes an explicit window, so the
  # yesterday derivation, the default `from`, and the ACCEPT side of the guard boundary were all
  # uncovered: moving the guard by one day would refuse the bare command forever and stay green.
  export ARC_SPINE_NOW="$PINNED_NOW"
  run node "$JOBS" audit
  [ "$status" -eq 1 ] || { echo "the bare command should have measured and found gaps, got $status"; echo "$output"; false; }
  echo "$output" | grep -q -F "jobs audit 2026-08-06..2026-08-12" \
    || { echo "the default window is not the seven days ending yesterday:"; echo "$output"; false; }
}

@test "audit CLI: it prints the pre-declared pack and states a verdict, not just numbers" {
  # A pack that only prints figures leaves the reading of them to whoever wants a particular
  # answer, which is the failure the pre-declaration exists to stop.
  #
  # The window is deliberately NOT `to` minus six days: with a seven-day window the explicit
  # --from is byte-identical to the derived default, so a mutation dropping --from entirely would
  # survive. Nine days makes the two differ, and the header is asserted.
  run node "$JOBS" audit --from 2026-08-01 --to 2026-08-09
  [ "$status" -eq 1 ] || { echo "an empty spine over a full window should not be clean: $status"; echo "$output"; false; }
  echo "$output" | grep -q -F "jobs audit 2026-08-01..2026-08-09" \
    || { echo "the window audited is not the window asked for:"; echo "$output"; false; }
  for line in "metric pack" "drift p50" "manual starts (target 0)" "incidents" "spend (expected 0)" "needs-you days"; do
    echo "$output" | grep -q -F "$line" || { echo "the pack is missing: $line"; echo "$output"; false; }
  done
  echo "$output" | grep -q "NOT CLEAN" || { echo "missed slots did not produce a verdict:"; echo "$output"; false; }
}

@test "audit CLI: --json carries the verdict and exits with it" {
  # The machine-readable surface used to omit the verdict entirely and exit 0 on a dirty pack, so
  # a consumer had to re-implement the four rules -- and would implement three. One computation,
  # both renderings, one exit code.
  run node "$JOBS" audit --from 2026-08-01 --to 2026-08-09 --json
  [ "$status" -eq 1 ] || { echo "--json exited $status on a dirty pack"; echo "$output"; false; }
  echo "$output" | grep -q -F '"clean": false' || { echo "$output"; false; }
  echo "$output" | grep -q "unexplained gap" || { echo "the failure list is missing from the json:"; echo "$output"; false; }
}

@test "audit CLI: a flag that was typed and not understood is an ERROR, never a default" {
  # Every one of these used to fall through to the DEFAULT window and print a confident verdict
  # about a week nobody asked for. `.claude/rules/lanes.md` rules the shape out in writing: an
  # empty value silently eats the next flag, and last-wins on a repeated flag is the never-guess
  # failure. A malformed argument must not read as a measured week.
  run node "$JOBS" audit --to=2026-08-09
  [ "$status" -eq 2 ] || { echo "--to=D was accepted: $status"; echo "$output"; false; }
  run node "$JOBS" audit --from 2026-08-01 --to
  [ "$status" -eq 2 ] || { echo "a trailing --to was accepted: $status"; echo "$output"; false; }
  run node "$JOBS" audit --to ""
  [ "$status" -eq 2 ] || { echo "an empty --to was accepted: $status"; echo "$output"; false; }
  run node "$JOBS" audit --from 2026-08-01 --from 2026-01-01 --to 2026-08-09
  [ "$status" -eq 2 ] || { echo "a repeated --from was accepted: $status"; echo "$output"; false; }
  run node "$JOBS" audit 2026-08-01 2026-08-09
  [ "$status" -eq 2 ] || { echo "positional dates were accepted: $status"; echo "$output"; false; }
}

@test "audit CLI: a day that is not on the calendar is refused, not rolled forward" {
  # 2026-02-30 matches YYYY-MM-DD and `slotMs` silently resolves it to 2026-03-02, so expected
  # slots would be computed for one day while events were filtered by the string of another --
  # phantom MISSED slots and a NOT CLEAN verdict for a week that ran perfectly. That is "validate
  # one read, compare another", which this lane has now paid for four times.
  for bad in 2026-02-30 2026-04-31 2026-08-32 garbage 2026-8-9; do
    run node "$JOBS" audit --to "$bad"
    [ "$status" -eq 2 ] || { echo "--to $bad was accepted (exit $status):"; echo "$output"; false; }
    echo "$output" | grep -q "not a real calendar day" || { echo "--to $bad was refused for the wrong reason:"; echo "$output"; false; }
  done
}

@test "audit CLI: exit 1 means NOT CLEAN and nothing else" {
  # Exit 1 is what a wrapper grading the proving week will branch on, so an operational failure
  # arriving as 1 would be the instrument inventing the result it exists to measure. `--from`
  # after `--to` is a refusal, not a dirty week.
  run node "$JOBS" audit --from 2026-08-09 --to 2026-08-03
  [ "$status" -eq 2 ] || { echo "a backwards window exited $status, not 2"; echo "$output"; false; }
  _refute "metric pack"
}

@test "jobs-audit: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || { echo "bats registered $output, file declares $declared"; false; }
}

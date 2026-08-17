#!/usr/bin/env bats
# Phase 00 slice 06 -- the fixture-repo harness (M3 / M11).
#
# `commit-msg-draft` declares `inputs: []`, so its real input is AMBIENT GIT STATE. Five fixtures
# sharing the input `{}` would be five samples of ONE case -- that is the K dimension, not five
# cases. What has to vary is the repository the driver sees, which is what this harness builds.
#
# The checks live in tests/bench-harness-probe.mjs, not inline: they need apostrophes and `$` in
# git porcelain strings, and CLAUDE.md forbids those in a shell-embedded program.
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/bench-harness-probe.mjs"; }

setup() {
  # M7. Honoured on PRESENCE, not truthiness (spine-io.mjs:41), so an empty value still redirects
  # rather than silently falling through to the repo spine.
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

# ---------------------------------------------------------------------------
# slice 09 -- the steel thread.
#
# The probe spawns two full bench runs, and each run shells out to arc-run five times, so running
# it once per @test would put ten minutes into a Windows shard for one file. It runs ONCE in
# setup_file and every test reads the cached output -- which also means each test asserts on the
# SAME run rather than on its own, so a flaky ordering cannot make two tests disagree.
# ---------------------------------------------------------------------------

setup_file() {
  export BATS_STEEL_OUT="$BATS_FILE_TMPDIR/steel.out"
  export ARC_SPINE_ROOT="$BATS_FILE_TMPDIR/file-spine"
  # Status captured to its own file: a probe piped anywhere reports the exit code of the LAST
  # stage, and a masked red suite is worse than no suite (.claude/rules/testing.md).
  # set +e around it, deliberately. bats runs setup_file under errexit, so a probe that exits
  # non-zero ABORTS setup_file before the status line is ever written -- the whole file then fails
  # with a shell trace instead of the assertion that was supposed to report it. The status is
  # captured and asserted; nothing is swallowed.
  set +e
  node "$ARC_ROOT/tests/bench-steel-probe.mjs" > "$BATS_STEEL_OUT" 2>&1
  echo "$?" > "$BATS_FILE_TMPDIR/steel.status"
  set -e
}

STEEL() { cat "$BATS_FILE_TMPDIR/steel.out"; }
STEEL_STATUS() { cat "$BATS_FILE_TMPDIR/steel.status"; }

@test "the steel thread probe passes every check" {
  # PRINT THE PROBE ON FAILURE. The tests read a cached file, so without this a red probe on CI
  # shows only a failed comparison and none of the reason -- the diagnosis then costs a whole
  # extra cycle, which is exactly what happened on 2026-08-13.
  [ "$(STEEL_STATUS)" -eq 0 ] || { STEEL; false; }
  [[ "$(STEEL)" == *"all checks held"* ]]
}

@test "the steel probe is not vacuous: it reports its own check count" {
  [ "$(STEEL_STATUS)" -eq 0 ]
  local oks
  oks="$(STEEL | grep -c '^ok ')"
  # EXACT, and it took an adversarial pass to make it so. The first version of this line was a
  # floor with slack "for the receipt-guarded checks", and the slack was both wrong and useless:
  # every guarded check sits behind `if (mine.length === 1)` and is PRECEDED by a check that fails
  # in the same scenario, so on any probe that exits 0 all of them ran -- while the slack was wide
  # enough that six of the eight sections could have vanished entirely and still cleared the
  # floor. A floor whose stated purpose is catching a silently dropped section, that cannot catch
  # a silently dropped section, is worse than no floor: it reads as a guard.
  # 70 measured 2026-08-17 (51 before sections 7 and 8).
  [ "$oks" -eq 70 ]
}

@test "the receipt is verified present in events and absent from quarantine" {
  # THE assertion the slice hangs on. Exit 0 from a fire-and-forget writer is not evidence that
  # anything was written -- retro-log 2026-08-02, an emitter reported success while every receipt
  # it produced sat quarantined.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok exactly ONE run.completed was emitted by bench"* ]]
  [[ "$(STEEL)" == *"ok nothing was quarantined on the happy path"* ]]
  [[ "$(STEEL)" == *"ok a quarantined id is found in a NESTED quarantine dir and is not a landing"* ]]
}

@test "a run never claims a model it did not apply" {
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok the receipt records the model REQUESTED"* ]]
  [[ "$(STEEL)" == *"ok and records that NO model was applied"* ]]
}

@test "the model and workspace seam is used through its FLAGS, not the environment" {
  # ADR-0220. The checks these replaced asserted that arc-run overwrites ARC_ROOT and
  # ARC_DRIVER_MODEL, and their comment promised they would fail loudly the day a seam arrived.
  # The seam arrived and they did NOT fail: it came as flags while ambient inheritance stayed
  # closed on purpose, so both assertions stayed true while the conclusion they defended -- that
  # bench cannot vary the model -- became false. A tripwire aimed at the mechanism that did not
  # change cannot see the one that did.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok a materialized fixture repo IS accepted as --work-root"* ]]
  [[ "$(STEEL)" == *"ok and the fixture repo still holds the posed, unstaged change afterwards"* ]]
  [[ "$(STEEL)" == *"ok a --work-root pointing INTO arc is refused, not silently accepted"* ]]
  [[ "$(STEEL)" == *"ok --trial-model is refused on mock, naming the recording set instead"* ]]
}

@test "ambient model inheritance stays closed, and a request is never read as an application" {
  # The env checks survive, narrowed to what they actually prove: ARC_DRIVER_MODEL and ARC_ROOT
  # are still ignored, which is the ADR-0069 b1 hole staying shut rather than a missing seam.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok ambient ARC_ROOT is still ignored -- inheritance stays closed (ADR-0069 b1)"* ]]
  [[ "$(STEEL)" == *"ok with a non-model-capable driver, nothing is applied and the receipt says so"* ]]
  [[ "$(STEEL)" == *"ok and bench records the model as REQUESTED, never as applied"* ]]
  [[ "$(STEEL)" == *"ok so no model_id is written for a model that never ran"* ]]
}

@test "a model-capable driver is reported capable, and one that cannot is not" {
  # THE POSITIVE CONTROL, and the whole reason this test exists. Every model-seam check above
  # drives mock, whose correct answer is "nothing applied" -- so the suite could prove a
  # NON-capable driver applies nothing and could not prove a capable one applies anything.
  # For two days driverTakesModel answered "not capable" for every driver on earth, bench dropped
  # the model on every run, and the whole file stayed green because every assertion it owned
  # expected NONE. This is the assertion that goes red the moment that answer flips.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok a model-capable driver is REPORTED as capable"* ]]
  [[ "$(STEEL)" == *"ok and a driver that cannot carry a model is reported as not capable"* ]]
}

@test "an unrecognised capability answer throws instead of reporting not capable" {
  # A probe whose failure mode is `return false` answers a question nobody asked, in the
  # direction that silently weakens the run. arc-run spends exit 2 on every operator error it
  # has, so a bare status check cannot tell "this driver cannot carry a model" from "you called
  # me wrong". Both arms now require the sentence arc-run prints for that exact decision.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok an unrecognised probe answer THROWS rather than answering the question it was not asked"* ]]
  [[ "$(STEEL)" == *"ok and the thrown message quotes what arc-run actually said, so the cause is readable"* ]]
  [[ "$(STEEL)" == *"ok a tree whose processes are ALL job stubs has nothing to probe with, and says so"* ]]
  [[ "$(STEEL)" == *"ok and probing it throws rather than reporting the driver not capable"* ]]
}

@test "every truthy spelling of job_stub is a stub and only false is runnable" {
  # Keyed on PRESENCE, never on equality: the frozen YAML subset parses yes, on, True and
  # quoted true as STRINGS and 1 as a number, so an equality check lets all of them walk past.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok every truthy spelling of job_stub is a stub, and only false is runnable"* ]]
}

@test "bench and arc-run agree on what a job stub is, for every process in the tree" {
  # isJobStub is a SECOND COPY of arc-run's rule, and this repo has been burned by copies that
  # drift. It is pinned rather than trusted: the verdicts are compared per process, so a
  # divergence is a red suite here and not a wrong number in a scorecard months from now.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok bench's job-stub verdict matches arc-run's for EVERY process in the tree"* ]]
}

@test "a run with no benchable task class does not report itself ok" {
  # `partial` was set only inside the fixture loop, so a tree with nothing to bench reached none
  # of its arms: zero rows, exit 0, outcome ok on the receipt -- a run certifying that nothing is
  # wrong having measured nothing. One job_stub line added to commit-msg-draft by another lane
  # empties that list, and processes/ is a company organ every live lane edits.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok a run with no benchable task class does NOT report outcome ok"* ]]
  [[ "$(STEEL)" == *"ok and it SAYS what happened rather than printing an empty report"* ]]
  [[ "$(STEEL)" == *"ok and the stub it skipped is named in the report, not silently dropped"* ]]
}

@test "the probe is given the real model id, not a placeholder" {
  # arc-run validates --trial-model against its id grammar BEFORE the capability check, so a
  # probe sent a fixed placeholder validated the placeholder while bench used the operator's id
  # for every invocation -- validate one read, compare another. The cost was not cosmetic: a
  # rejected id dies on every attempt AFTER admission control reserved the group, and a
  # reservation is released only by a measured spend.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok a model id arc-run would REJECT is caught by the probe, before any group is reserved"* ]]
  [[ "$(STEEL)" == *"ok an EMPTY processes directory says so, and is not blamed on stubs"* ]]
}

@test "job stubs are not benched, and the report names the ones it skipped" {
  # processes/ is a company organ every live lane edits. The scheduler lane added two job stubs,
  # which bench then listed forever as NO PROPOSAL 0 of 5 -- a permanent row for something that
  # is not a candidate for anything, and the file that broke the capability probe. They are gone
  # from the report, and their absence is STATED: a coverage report that quietly got shorter
  # reads exactly like one whose scope quietly shrank.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok no job stub is offered as a benchable task class"* ]]
  [[ "$(STEEL)" == *"ok the report NAMES the stubs it did not bench"* ]]
}

@test "a failing attempt is reported, not rounded up to a pass" {
  # The negative control. A runner whose only exercised path is the happy one has an unmeasured
  # half, and a suite that only ever sees green cannot tell green from unconditional.
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok a run with no usable recordings exits 1, not 0"* ]]
  [[ "$(STEEL)" == *"ok with nothing scored the assertion rate is ABSENT, never 100 percent"* ]]
  [[ "$(STEEL)" == *"ok a failed run still emits its receipt, with outcome fail"* ]]
  [[ "$(STEEL)" == *"ok the driver reason reached the receipt intact, path separators and all"* ]]
}

@test "the closed flag set is enforced and an ignored flag is refused instead" {
  [ "$(STEEL_STATUS)" -eq 0 ]
  [[ "$(STEEL)" == *"ok an unknown driver is exit 2 and names the installed set"* ]]
  # A budget dimension nothing reads is not a bound: `rupees=1` parses and enforces nothing.
  [[ "$(STEEL)" == *'ok parseArgs refuses "--driver mock --budget rupees=1"'* ]]
  # `--propose` alone is refused for a SHARPER reason since Phase 02: there is no proposal
  # without an incumbent, because every gate past the first is a comparison against it.
  [[ "$(STEEL)" == *'ok parseArgs refuses "--driver mock --budget inr=1 --propose"'* ]]
  [[ "$(STEEL)" == *"ok --champion alone is now the drift guard, not a refusal"* ]]
}

@test "the fixture-repo harness probe passes every check" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  # A positive end marker, so a crash part-way cannot read as a pass.
  [[ "$output" == *"all checks held"* ]]
}

@test "the harness probe is not vacuous: it reports its own check count" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  local oks
  oks="$(printf '%s\n' "$output" | grep -c '^ok ')"
  [ "$oks" -ge 12 ]
}

@test "the overlaid change is UNSTAGED, because staging is the process own job" {
  # THE property this harness exists to guarantee. commit-msg-draft holds `git.op: add:*` and
  # `commit:*` -- its whole job is "stage related changes and write a conventional commit". A
  # pre-staged index would do that work for it and leave the model nothing to decide, which is
  # the fixture-that-measures-nothing failure this phase exists to avoid.
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok the change is UNSTAGED, not staged"* ]]
}

@test "the base tree is a real commit, so git diff has something to compare against" {
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok the base is committed, exactly once"* ]]
}

@test "a refused materialization leaks no temp repo" {
  # A harness that only cleans up on success fills the runner disk exactly when something is
  # already going wrong.
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok a refused materialization leaks no temp repo"* ]]
}

@test "a work tree can express a DELETION, and it lands unstaged" {
  # Slice 07's delete-and-add fixture is the one case where a draft built only from ADDED lines
  # describes half the change. Copying cannot remove a file, so work/ marks one with a
  # `<path>.arc-deleted` tombstone that the harness honours.
  run node "$(PROBE)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok the tombstoned file is gone from the work tree"* ]]
  [[ "$output" == *"ok the deletion is visible and unstaged"* ]]
}

@test "this file registers the number of tests it declares" {
  # retro-log 2026-08-04: bats SILENTLY DROPS a @test whose name carries a non-ASCII character.
  [ "${#BATS_TEST_NAMES[@]}" -eq 22 ]
}

#!/usr/bin/env bats
# Phase 00 -- develop steel thread: the lifecycle runs end-to-end, offline, lane-native.
# Red-first (kickoff v4 [verify-red]): every @test here fails before .claude/scripts/develop/
# exists, and the FIRST failure must be the missing module -- not a missing fixture, not a
# bats syntax error. That is what makes the red mean something.
bats_require_minimum_version 1.5.0
load 'test_helper'

DEV_MJS() { echo "$ARC_ROOT/.claude/scripts/develop/develop.mjs"; }
FX()      { echo "$ARC_ROOT/tests/fixtures/develop/$1"; }

# Every mode takes --lane and --root on every call; neither is remembered between
# invocations, because `status` must reconstruct cold (phase-00-spec.md).
_dev() {
  local root="$1"; shift
  run node "$(DEV_MJS)" "$@" --lane develop --root "$root"
}

# A fresh copy of a fixture, so a test that writes never mutates the committed tree.
_scratch() {
  local src dst
  src="$(FX "$1")"
  dst="$(mktemp -d)/tree"
  cp -R "$src" "$dst"
  echo "$dst"
}

# ---------------------------------------------------------------------------
# REQ-01 -- start writes a Build Brief and a slice ledger
# ---------------------------------------------------------------------------

@test "start writes a brief and a slice ledger for the fake phase" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" start 0
  [ "$status" -eq 0 ]
  [ -f "$t/initiatives/develop/phases/phase-00-tasks.md" ]
}

@test "the brief carries every derived header field" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" start 0
  local brief="$t/initiatives/develop/phases/phase-00-tasks.md"
  grep -q '^spec-hash: sha256:[0-9a-f]\{64\}$' "$brief"
  grep -q '^lane: develop$'                    "$brief"
  grep -q '^reqs: REQ-01, REQ-02$'             "$brief"
  # every ADR cited in the spec, deduped and sorted -- run the grep, do not curate
  grep -q '^adrs: 0063, 0065$'                 "$brief"
  # first bold span of each PLAN ## No-gos bullet, trailing punctuation stripped
  grep -q '^no-gos: Real network calls, A second lane, Anything Phase 01 owns$' "$brief"
}

# The blast radius is a FILTER, never a transformation: survivors are emitted verbatim,
# never collapsed to a parent directory. The fixture spec cites one existing file, one
# not-yet-existing file under a known directory, and one path with no ancestor at all.
@test "blast radius keeps known and about-to-exist paths verbatim, drops the rest" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" start 0
  local brief="$t/initiatives/develop/phases/phase-00-tasks.md"
  grep -q '^blast-radius: initiatives/develop/PLAN\.md, initiatives/develop/phases/phase-00-tasks\.md$' "$brief"
  grep -q '^blast-radius-dropped: 1$' "$brief"
}

@test "start writes 5 slice blocks, each with proof, tier and kind" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" start 0
  local brief="$t/initiatives/develop/phases/phase-00-tasks.md"
  [ "$(grep -c '^#### slice: ' "$brief")" -eq 5 ]
  [ "$(grep -c '^proof: '      "$brief")" -eq 5 ]
  [ "$(grep -c '^tier: '       "$brief")" -eq 5 ]
  [ "$(grep -c '^kind: '       "$brief")" -eq 5 ]
}

@test "start exits non-zero and writes nothing when the phase spec is absent" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" start 7
  [ "$status" -ne 0 ]
  [ ! -f "$t/initiatives/develop/phases/phase-07-tasks.md" ]
  # Assert the REASON, not just the exit code. Without this line the test passed before a
  # line of develop.mjs existed -- node's own "Cannot find module" is also non-zero and also
  # writes no file. A control that has never been seen to fail is a coin, not a gate
  # (retro-log 2026-08-02).
  [[ "$output" == *"phase-07-spec.md"* ]]
}

@test "start refuses to clobber a ledger holding proven slices" {
  local t; t="$(_scratch fake-phase-midway)"
  local brief="$t/initiatives/develop/phases/phase-00-tasks.md"
  local before; before="$(cat "$brief")"
  _dev "$t" start 0
  [ "$status" -ne 0 ]
  [ "$(cat "$brief")" = "$before" ]
}

# ---------------------------------------------------------------------------
# REQ-02 -- the lane contract, and root-mode byte-identity
# ---------------------------------------------------------------------------

@test "unknown lane exits 4, lists known lanes, and creates nothing" {
  local t; t="$(_scratch fake-phase)"
  run node "$(DEV_MJS)" status --lane nope --root "$t"
  [ "$status" -eq 4 ]
  [[ "$output" == *"Known lanes:"* ]]
  [ ! -d "$t/initiatives/nope" ]
}

@test "a duplicate --lane flag is an operator error, not last-wins" {
  local t; t="$(_scratch fake-phase)"
  run node "$(DEV_MJS)" status --lane develop --lane other --root "$t"
  [ "$status" -eq 5 ]
}

@test "a Windows reserved device name is rejected on every leg" {
  local t; t="$(_scratch fake-phase)"
  run node "$(DEV_MJS)" status --lane CON --root "$t"
  [ "$status" -eq 5 ]
}

@test "root-mode prints no lane line and matches its golden byte for byte" {
  local t; t="$(_scratch root-mode)"
  run node "$(DEV_MJS)" status --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" != *"Selected lane:"* ]]
  [ "$output" = "$(cat "$(FX root-mode-golden.txt)")" ]
}

# ---------------------------------------------------------------------------
# REQ-03 -- status reconstructs cold, from committed files only
# ---------------------------------------------------------------------------

@test "status on a fresh ledger prints slice 0/5, never 1/5" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" start 0
  _dev "$t" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"develop · develop · phase 00 · slice 0/5"* ]]
}

@test "status on the midway fixture counts proven slices, not position" {
  local t; t="$(_scratch fake-phase-midway)"
  _dev "$t" status
  [ "$status" -eq 0 ]
  [[ "$output" == *"slice 2/5"* ]]
  [[ "$output" == *"03"* ]]
}

# ---------------------------------------------------------------------------
# REQ-04 -- receipts, and surviving a spine that cannot be written
# ---------------------------------------------------------------------------

@test "start emits develop.started carrying the lane in its payload" {
  local t spine; t="$(_scratch fake-phase)"; spine="$(mktemp -d)"
  run env ARC_SPINE_ROOT="$spine" node "$(DEV_MJS)" start 0 --lane develop --root "$t"
  [ "$status" -eq 0 ]
  grep -rq '"kind":"develop.started"' "$spine/events"
  grep -rq '"lane":"develop"'         "$spine/events"
}

# Portable across all 3 legs: point the spine root at a regular FILE. The write then fails
# identically on ubuntu, macos and windows -- no chmod, no permission-model differences.
@test "a spine write failure never changes the command's exit code" {
  local t blocked; t="$(_scratch fake-phase)"; blocked="$(mktemp)"
  run env ARC_SPINE_ROOT="$blocked" node "$(DEV_MJS)" start 0 --lane develop --root "$t"
  [ "$status" -eq 0 ]
  [ -f "$t/initiatives/develop/phases/phase-00-tasks.md" ]
}

@test "status names an expected receipt kind that never landed" {
  local t spine; t="$(_scratch fake-phase-midway)"; spine="$(mktemp -d)"
  run env ARC_SPINE_ROOT="$spine" node "$(DEV_MJS)" status --lane develop --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" == *"develop.started"* ]]
  [[ "$output" == *"missing"* ]]
}

# ---------------------------------------------------------------------------
# next -- the advance step, and the only mode that emits slice.done
# ---------------------------------------------------------------------------

@test "next hands out the first unproven slice" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" start 0
  _dev "$t" next
  [ "$status" -eq 0 ]
  [[ "$output" == *"01"* ]]
}

@test "next emits slice.done for a slice the session finished, and never runs git" {
  local t spine; t="$(_scratch fake-phase-midway)"; spine="$(mktemp -d)"
  run env ARC_SPINE_ROOT="$spine" node "$(DEV_MJS)" next --lane develop --root "$t"
  [ "$status" -eq 0 ]
  grep -rq '"kind":"slice.done"' "$spine/events"
}

@test "next reports completion once every slice is proven" {
  local t; t="$(_scratch fake-phase-done)"
  _dev "$t" next
  [ "$status" -eq 0 ]
  [[ "$output" == *"all slices proven"* ]]
}

# ---------------------------------------------------------------------------
# handoff / checkpoint
# ---------------------------------------------------------------------------

@test "handoff emits handoff.ready" {
  local t spine; t="$(_scratch fake-phase-done)"; spine="$(mktemp -d)"
  run env ARC_SPINE_ROOT="$spine" node "$(DEV_MJS)" handoff 0 --lane develop --root "$t"
  [ "$status" -eq 0 ]
  grep -rq '"kind":"handoff.ready"' "$spine/events"
}

@test "checkpoint is an honest stub in this phase" {
  local t; t="$(_scratch fake-phase)"
  _dev "$t" checkpoint
  [ "$status" -eq 0 ]
  [[ "$output" == *"no checks wired yet"* ]]
}

# ---------------------------------------------------------------------------
# Phase 02 -- prediction calibration at handoff (REQ-08)
# ---------------------------------------------------------------------------

@test "handoff REFUSES while any prediction is unscored, and prints the template" {
  local t; t="$(_scratch fake-phase-done)"
  _dev "$t" handoff 0
  [ "$status" -ne 0 ]
  [[ "$output" == *"predictions are not scored"* ]]
  [[ "$output" == *"### Prediction scores"* ]]
  [[ "$output" == *"hit|miss|unforeseen"* ]]
}

@test "handoff accepts a scored ledger and tallies the verdicts" {
  local t; t="$(_scratch fake-phase-done)"
  {
    echo ""
    echo "### Prediction scores"
    echo ""
    echo "likely-failure-mode: hit — the parser broke exactly there"
    echo "likely-regression-site: miss — it was elsewhere"
    echo "riskiest-file: hit — as predicted"
    echo "expected-blockers: unforeseen — a closed vocabulary nobody knew about"
    echo "expected-proof-failures: hit — the Windows leg, as called"
  } >> "$t/initiatives/develop/phases/phase-00-tasks.md"
  _dev "$t" handoff 0
  [ "$status" -eq 0 ]
  [[ "$output" == *"3 hit · 1 miss · 1 unforeseen"* ]]
}

@test "an invalid verdict word is refused, not counted" {
  local t; t="$(_scratch fake-phase-done)"
  {
    echo ""
    echo "### Prediction scores"
    echo ""
    echo "likely-failure-mode: probably-ish — sort of right"
    echo "likely-regression-site: hit — x"
    echo "riskiest-file: hit — x"
    echo "expected-blockers: hit — x"
    echo "expected-proof-failures: hit — x"
  } >> "$t/initiatives/develop/phases/phase-00-tasks.md"
  _dev "$t" handoff 0
  [ "$status" -ne 0 ]
  [[ "$output" == *"not scored"* ]]
}

@test "handoff emits no self-declared number anywhere in its output" {
  local t; t="$(_scratch fake-phase-done)"
  {
    echo ""
    echo "### Prediction scores"
    echo ""
    for f in likely-failure-mode likely-regression-site riskiest-file expected-blockers expected-proof-failures; do
      echo "$f: hit — settled by the ledger"
    done
  } >> "$t/initiatives/develop/phases/phase-00-tasks.md"
  _dev "$t" handoff 0
  [ "$status" -eq 0 ]
  # The governing rule: confidence is earned from scored outcomes, never asserted.
  [[ "$output" != *"confidence"* ]]
  [[ "$output" != *"%"* ]]
}

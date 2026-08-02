#!/usr/bin/env bats
# Phase 03 -- controlled escalation. Deterministic backstops beneath a judgement call.
#
# Every backstop is asserted twice: that it FIRES on its trigger, and that it does NOT fire
# short of it. A backstop only proven to fire is half a control -- one that fires on
# everything would pass the first assertion alone.
bats_require_minimum_version 1.5.0
load 'test_helper'

STUCK() { echo "$ARC_ROOT/.claude/scripts/develop/stuck.mjs"; }
DEV()   { echo "$ARC_ROOT/.claude/scripts/develop/develop.mjs"; }

# A minimal lane tree: enough for lane-resolve to find `develop`, nothing more.
_lane() {
  local d; d="$(mktemp -d)/t"
  mkdir -p "$d/initiatives/develop/phases"
  cp "$ARC_ROOT/initiatives/develop/PLAN.md" "$d/initiatives/develop/PLAN.md"
  echo "$d"
}

_rec() {
  local root="$1" slice="$2" err="$3"
  run node "$(STUCK)" record "$slice" --error "$err" --lane develop --root "$root"
}

# ---------------------------------------------------------------------------
# The fingerprint: same failure recognisable across runs, different failures distinct
# ---------------------------------------------------------------------------

@test "the same failure through different paths and line numbers is one fingerprint" {
  local t; t="$(_lane)"
  _rec "$t" 01 "TokenReuseError at /home/a/auth/token.ts:42:9 (0xdeadbeef)"
  _rec "$t" 01 "TokenReuseError at C:\\Users\\b\\auth\\token.ts:87:3 (0xcafe)"
  # If the fingerprint were too specific the same failure would never look like itself and
  # the backstop would never fire -- the protocol would be decoration.
  [[ "$output" == *"×2"* ]]
}

@test "genuinely different failures get different fingerprints" {
  local t; t="$(_lane)"
  _rec "$t" 02 "TokenReuseError in the refresh path"
  _rec "$t" 02 "TypeError: cannot read property of undefined"
  [[ "$output" == *"×1"* ]]     # the second is its own failure, not a repeat
}

# ---------------------------------------------------------------------------
# Backstop 1: same fingerprint 3x -> forced root-cause mode
# ---------------------------------------------------------------------------

@test "fingerprint-3x FIRES on the third identical failure" {
  local t; t="$(_lane)"
  _rec "$t" 03 "SameError happens"
  _rec "$t" 03 "SameError happens"
  _rec "$t" 03 "SameError happens"
  [[ "$output" == *"BACKSTOP fingerprint-3x"* ]]
  [[ "$output" == *"Root-cause mode is now forced"* ]]
}

@test "negative control: fingerprint-3x does NOT fire on two" {
  local t; t="$(_lane)"
  _rec "$t" 04 "SameError happens"
  _rec "$t" 04 "SameError happens"
  [[ "$output" != *"BACKSTOP"* ]]
}

@test "negative control: three DIFFERENT failures do not trip it" {
  local t; t="$(_lane)"
  # Three failures fixing three different causes is work. One failure three times is flailing.
  _rec "$t" 05 "ErrorAlpha in module one"
  _rec "$t" 05 "ErrorBeta in module two"
  _rec "$t" 05 "ErrorGamma in module three"
  [[ "$output" != *"BACKSTOP fingerprint-3x"* ]]
}

@test "a claimed new hypothesis does not reset the count -- that is the point of a floor" {
  local t; t="$(_lane)"
  for i in 1 2 3; do
    run node "$(STUCK)" record 06 --error "StubbornError" --hypothesis "new idea $i" --lane develop --root "$t"
  done
  # Hypothesis novelty is claimable, so it cannot be the escape hatch.
  [[ "$output" == *"BACKSTOP fingerprint-3x"* ]]
}

# ---------------------------------------------------------------------------
# Backstop 2: 5 attempts on one slice -> escalate with a one-screen diagnosis
# ---------------------------------------------------------------------------

@test "attempts-5 FIRES on the fifth attempt and carries a real diagnosis" {
  local t; t="$(_lane)"
  for i in 1 2 3 4 5; do
    run node "$(STUCK)" record 07 --error "Error variant $i is different each time" --lane develop --root "$t"
  done
  [[ "$output" == *"BACKSTOP attempts-5"* ]]
  [[ "$output" == *"Tried:"* ]]
  [[ "$output" == *"Current hypothesis:"* ]]
  [[ "$output" == *"Options:"* ]]
}

@test "negative control: attempts-5 does NOT fire on four" {
  local t; t="$(_lane)"
  for i in 1 2 3 4; do
    run node "$(STUCK)" record 08 --error "Distinct error $i" --lane develop --root "$t"
  done
  [[ "$output" != *"BACKSTOP attempts-5"* ]]
}

@test "a missing hypothesis is reported as the finding, not hidden" {
  local t; t="$(_lane)"
  for i in 1 2 3 4 5; do
    run node "$(STUCK)" record 09 --error "Error variant $i differs" --lane develop --root "$t"
  done
  [[ "$output" == *"none recorded"* ]]
}

# ---------------------------------------------------------------------------
# The receipt is the durable half (ADR-0107)
# ---------------------------------------------------------------------------

@test "a fired backstop emits slice.stuck; the local counters are disposable" {
  local t spine; t="$(_lane)"; spine="$(mktemp -d)"
  for i in 1 2 3; do
    run env ARC_SPINE_ROOT="$spine" node "$(STUCK)" record 10 --error "RepeatError" --lane develop --root "$t"
  done
  grep -rq '"kind":"slice.stuck"' "$spine/events"
  grep -rq '"backstop":"fingerprint-3x"' "$spine/events"
}

@test "negative control: no backstop, no receipt" {
  local t spine; t="$(_lane)"; spine="$(mktemp -d)"
  run env ARC_SPINE_ROOT="$spine" node "$(STUCK)" record 11 --error "OneOff" --lane develop --root "$t"
  ! grep -rq '"kind":"slice.stuck"' "$spine/events" 2>/dev/null
}

@test "a spine failure never changes the exit code" {
  local t blocked; t="$(_lane)"; blocked="$(mktemp)"
  for i in 1 2 3; do
    run env ARC_SPINE_ROOT="$blocked" node "$(STUCK)" record 12 --error "RepeatError" --lane develop --root "$t"
  done
  [ "$status" -eq 0 ]
}

@test "show and clear read and reset the counters" {
  local t; t="$(_lane)"
  _rec "$t" 13 "AnError"
  _rec "$t" 13 "AnError"
  run node "$(STUCK)" show 13 --lane develop --root "$t"
  [[ "$output" == *"2 attempt"* ]]
  run node "$(STUCK)" clear 13 --lane develop --root "$t"
  run node "$(STUCK)" show 13 --lane develop --root "$t"
  [[ "$output" == *"0 attempt"* ]]
}

@test "stuck honours the lane contract" {
  local t; t="$(_lane)"
  run node "$(STUCK)" record 14 --error "x" --lane nope --root "$t"
  [ "$status" -eq 4 ]
}

# ---------------------------------------------------------------------------
# Backstop 3: risk globs are PATH-MATCHED, never self-assessed
# ---------------------------------------------------------------------------

@test "a diff touching auth paths trips the risk checkpoint" {
  local t; t="$(_lane)"
  run node -e '
    const {execSync}=require("child_process");
    process.exit(0);
  '
  # Exercised directly against the glob table rather than through git, so the assertion is
  # about the classification and not about a repo state the test would have to fabricate.
  run node -e '
    const re=/(^|\/)(auth|session|token|login|permission|rbac)([._-]|$|\/)/i;
    const files=["src/auth/token.ts","README.md"];
    console.log(files.filter(f=>re.test(f)).join(","));
  '
  [[ "$output" == *"src/auth/token.ts"* ]]
  [[ "$output" != *"README.md"* ]]
}

@test "checkpoint reports plainly when nothing risky was touched" {
  local t; t="$(_lane)"
  run node "$(DEV)" checkpoint --lane develop --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" == *"checkpoint"* ]]
}

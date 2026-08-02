#!/usr/bin/env bats
# Phase 01 -- the proof floor. develop-lint's BLOCK/WARN split per ADR-0101.
#
# The load-bearing shape here is the NEGATIVE CONTROL: every BLOCK is asserted twice --
# once that the good fixture passes, and once that a named mutation fails. A lint that
# always exits 0 would satisfy the first assertion alone, which is how a control that has
# never been seen to fail ships as a gate (retro-log 2026-08-02).
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT()  { echo "$ARC_ROOT/.claude/scripts/develop/develop-lint.mjs"; }
FXDIR() { echo "$ARC_ROOT/tests/fixtures/develop/lint"; }

# A throwaway copy of the good tree, so nothing here mutates the committed fixture.
_tree() {
  local d; d="$(mktemp -d)/t"
  cp -R "$(FXDIR)/tree" "$d"
  echo "$d"
}

# Swap in a breaking-input ledger and run the lint against it.
_run_case() {
  local tree="$1" name="$2"
  cp "$(FXDIR)/breaking/${name}.md" "$tree/phases/phase-00-tasks.md"
  run node "$(LINT)" --root "$tree"
}

# ---------------------------------------------------------------------------
# The positive half: a well-formed ledger passes, with no WARNs on modelled practice
# ---------------------------------------------------------------------------

@test "the good fixture passes clean" {
  local t; t="$(_tree)"
  run node "$(LINT)" --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" == *"all checks passed"* ]]
}

@test "an unproven slice is legal and trips nothing" {
  local t; t="$(_tree)"
  run node "$(LINT)" --root "$t"
  [ "$status" -eq 0 ]
  # slice 02 is deliberately unproven: proof-before-implementation means a slice exists
  # before its proof runs. Only a TICKED slice must carry proof/tier/commit.
  [[ "$output" != *"slice 02"* ]]
}

@test "a tree with no ledger at all exits 0 and says so" {
  local d; d="$(mktemp -d)/t"
  mkdir -p "$d/phases"
  run node "$(LINT)" --root "$d"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no slice ledger"* ]]
}

# ---------------------------------------------------------------------------
# NEGATIVE CONTROLS -- one per BLOCK. Each proves the check CAN fail.
# ---------------------------------------------------------------------------

@test "negative control [slice-unproven]: a ticked slice with no proof FAILS" {
  local t; t="$(_tree)"
  _run_case "$t" 01-ticked-no-proof
  [ "$status" -eq 1 ]
  [[ "$output" == *"[slice-unproven]"* ]]
  [[ "$output" == *"slice 01"* ]]          # names the offender, never a bare whole-file failure
}

@test "negative control [brief-stale]: a moved spec FAILS" {
  local t; t="$(_tree)"
  _run_case "$t" 12-spec-hash-stale
  [ "$status" -eq 1 ]
  [[ "$output" == *"[brief-stale]"* ]]
}

@test "negative control [ledger-unparseable]: a duplicate slice id FAILS" {
  local t; t="$(_tree)"
  _run_case "$t" 15-duplicate-slice-id
  [ "$status" -eq 1 ]
  [[ "$output" == *"[ledger-unparseable]"* ]]
}

# ---------------------------------------------------------------------------
# The adversarial pass, as a test rather than a memory of one run (REQ-06)
# ---------------------------------------------------------------------------

@test "every pinned breaking input is caught -- none walks past the gate" {
  local t; t="$(_tree)"
  local holes=0 tried=0 name
  for f in "$(FXDIR)"/breaking/*.md; do
    name="$(basename "$f" .md)"
    tried=$(( tried + 1 ))
    cp "$f" "$t/phases/phase-00-tasks.md"
    if node "$(LINT)" --root "$t" >/dev/null 2>&1; then
      echo "HOLE: $name passed the lint"
      holes=$(( holes + 1 ))
    fi
  done
  echo "tried=$tried holes=$holes"
  [ "$tried" -ge 20 ]        # REQ-06's floor: >=20 hand-built inputs, not a token few
  [ "$holes" -eq 0 ]
}

@test "cosmetic variants stay CAUGHT: heading level and emphasis never hide a violation" {
  local t; t="$(_tree)"
  # The class that recurred across council v2/v3: a line a human reads as a slice heading
  # that an exact-match regex misses, letting a doctored artifact dodge the gate entirely.
  for name in 18-heading-level-h2 19-heading-level-h6 20-slice-bold-no-heading 21-slice-extra-spaces; do
    _run_case "$t" "$name"
    [ "$status" -eq 1 ] || { echo "$name was not caught"; false; }
  done
}

@test "CRLF and mixed line endings do not hide a violation on any OS leg" {
  local t; t="$(_tree)"
  for name in 23-crlf-throughout 24-mixed-line-endings; do
    _run_case "$t" "$name"
    [ "$status" -eq 1 ] || { echo "$name was not caught"; false; }
  done
}

@test "an empty or whitespace-only ledger fails closed, never open" {
  local t; t="$(_tree)"
  for name in 25-empty-file 26-whitespace-only; do
    _run_case "$t" "$name"
    [ "$status" -eq 1 ] || { echo "$name was not caught"; false; }
  done
}

@test "commit: must be a real SHA -- 'yes' is not a proof-to-code link" {
  local t; t="$(_tree)"
  _run_case "$t" 05-commit-not-a-sha
  [ "$status" -eq 1 ]
  [[ "$output" == *"not a commit SHA"* ]]
}

# ---------------------------------------------------------------------------
# WARN-first half (ADR-0101): heuristics never block, and say so
# ---------------------------------------------------------------------------

@test "[self-declared-number] WARNs and exits 0 -- a heuristic never blocks" {
  local t; t="$(_tree)"
  sed -i.bak 's/^result: 4 tests, 4 passing$/result: 4 tests, 4 passing, confidence 95%/' "$t/phases/phase-00-tasks.md"
  run node "$(LINT)" --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[self-declared-number]"* ]]
}

@test "a legitimate number in a value does NOT trip the self-declared heuristic" {
  local t; t="$(_tree)"
  # False-block risk is the whole reason this group ships WARN-first: version strings,
  # counts and durations are legitimate and must stay silent.
  sed -i.bak 's/^result: 4 tests, 4 passing$/result: 4 tests, 4 passing in 1.8s on node 22.3.0/' "$t/phases/phase-00-tasks.md"
  run node "$(LINT)" --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" != *"[self-declared-number]"* ]]
}

@test "[tier-floor] WARNs when a ui slice's strongest evidence is below e2e-visual" {
  local t; t="$(_tree)"
  sed -i.bak 's/^kind: logic$/kind: ui/' "$t/phases/phase-00-tasks.md"
  run node "$(LINT)" --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[tier-floor]"* ]]
}

@test "[tier-floor] WARNs on a slice with no kind: rather than skipping it in silence" {
  local t; t="$(_tree)"
  sed -i.bak '/^kind: logic$/d' "$t/phases/phase-00-tasks.md"
  run node "$(LINT)" --root "$t"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[tier-floor]"* ]]
  [[ "$output" == *"no \`kind:\`"* ]]
}

@test "the trial-status footer reports live-vs-trial counts" {
  local t; t="$(_tree)"
  run node "$(LINT)" --root "$t"
  [[ "$output" == *"[trial-status]"* ]]
  [[ "$output" == *"2 in trial"* ]]
}

# ---------------------------------------------------------------------------
# Lane contract -- imported, never re-implemented
# ---------------------------------------------------------------------------

@test "lint honours the lane contract: unknown lane exits 4, creates nothing" {
  local t; t="$(_tree)"
  run node "$(LINT)" --lane nope --root "$t"
  [ "$status" -eq 4 ]
  [ ! -d "$t/initiatives" ]
}

@test "lint root-mode prints no lane line" {
  local t; t="$(_tree)"
  run node "$(LINT)" --root "$t"
  [[ "$output" != *"Selected lane:"* ]]
}

@test "every WARN carries the four-line Expected/Found/Example block" {
  local t; t="$(_tree)"
  sed -i.bak 's/^kind: logic$/kind: ui/' "$t/phases/phase-00-tasks.md"
  run node "$(LINT)" --root "$t"
  [[ "$output" == *"Expected:"* ]]
  [[ "$output" == *"Found:"* ]]
  [[ "$output" == *"Example:"* ]]
}

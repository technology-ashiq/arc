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
BREAK() { echo "$ARC_ROOT/tests/fixtures/develop/breaking"; }

# A throwaway copy of the good tree, so nothing here mutates the committed fixture.
_tree() {
  local d; d="$(mktemp -d)/t"
  cp -R "$(FXDIR)/tree" "$d"
  echo "$d"
}

# Swap in a breaking-input ledger and run the lint against it.
_run_case() {
  local tree="$1" name="$2"
  cp "$(BREAK)/${name}.md" "$tree/phases/phase-00-tasks.md"
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
  for f in "$(BREAK)"/*.md; do
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

# ---------------------------------------------------------------------------
# Round 2 -- the holes an UNANCHORED pass found that the author could not.
#
# Round 1's 26 fixtures all attacked one direction: a slice the parser SEES holding bad
# data. Every hole below attacks the other: a slice or field the parser NEVER SEES, so
# "ticked" never becomes true and every check on it is skipped in silence. 26 of 26 caught
# was a true result about a blind spot, which is why the author cannot be the attacker.
# ---------------------------------------------------------------------------

@test "a slice the parser cannot see is a parse error, never a pass" {
  local t; t="$(_tree)"
  # The flagship forgery: rename two section headings and the parser stayed inside
  # non-negotiables -- where key: value lines are discarded -- for the rest of the file.
  # A four-slice ledger claiming `proof: it works` / `commit: yes` parsed to ZERO slices,
  # ZERO errors, and the gate reported "all checks passed".
  _run_case "$t" 27-unknown-heading-swallows-slices
  [ "$status" -eq 1 ]
}

@test "a slice heading with a title after the id is still a slice heading" {
  local t; t="$(_tree)"
  # `#### slice: 01 — token bridge` is the most natural way a human writes this, and one
  # added character used to dump the whole block's fields into the brief with no error.
  for name in 28-slice-heading-title-suffix 29-slice-heading-trailing-dot 30-slice-heading-bullet-form; do
    _run_case "$t" "$name"
    [ "$status" -eq 1 ] || { echo "$name walked past"; false; }
  done
}

@test "a line that reads as a slice heading but has no valid id fails closed" {
  local t; t="$(_tree)"
  _run_case "$t" 31-slice-id-not-grammar
  [ "$status" -eq 1 ]
  [[ "$output" == *"reads as a slice heading"* ]]
}

@test "invisible and confusable characters cannot hide a key or a heading" {
  local t; t="$(_tree)"
  for name in 32-zero-width-before-heading 33-zero-width-before-result 34-nbsp-before-commit 35-homoglyph-result-key; do
    _run_case "$t" "$name"
    [ "$status" -eq 1 ] || { echo "$name walked past"; false; }
  done
}

@test "emphasis, case and blockquote markers on the TICK keys change nothing" {
  local t; t="$(_tree)"
  # Flipping PROOF:/TIER: tightens the gate; flipping Result:/Commit: unticks the slice and
  # skips every check. That asymmetry is why the round-1 case-flip fixture missed this.
  for name in 36-emphasised-tick-keys 37-case-flipped-tick-keys 38-blockquote-fields; do
    _run_case "$t" "$name"
    [ "$status" -eq 1 ] || { echo "$name walked past"; false; }
  done
}

@test "a heading inside the sanctioned proof fence does not close the slice" {
  local t; t="$(_tree)"
  # ADR-0100 puts multi-line proof output in a fence, so the documented way to record
  # evidence was also the way to make a slice stop being checked.
  _run_case "$t" 39-fence-heading-closes-slice
  [ "$status" -eq 1 ]
}

@test "placeholder-shaped proofs are not proofs, whatever shape they take" {
  local t; t="$(_tree)"
  # The old check was a denylist of 8 strings. The en dash was not in it while the em dash
  # was, and the writer itself emits an em dash -- so `proof: –` read as a real value.
  for name in 40-proof-en-dash 41-proof-bracket-tbd 42-proof-parens-none 44-proof-ellipsis; do
    _run_case "$t" "$name"
    [ "$status" -eq 1 ] || { echo "$name walked past"; false; }
  done
}

@test "a proof must name a tier or a command -- 'it works' is not evidence" {
  local t; t="$(_tree)"
  _run_case "$t" 43-proof-vacuous
  [ "$status" -eq 1 ]
  [[ "$output" == *"neither an evidence tier nor a command"* ]]
}

@test "a brief pinned to a different phase than its filename FAILS" {
  local t; t="$(_tree)"
  # The hash matched -- it was just the hash of a different phase. A reviewer read a brief
  # for phase 01 while the gate had verified phase 00.
  _run_case "$t" 45-brief-names-other-phase
  [ "$status" -eq 1 ]
  [[ "$output" == *"[brief-stale]"* ]]
}

@test "a ledger-shaped file the lint does not read is reported, not ignored" {
  local t; t="$(_tree)"
  # A case-sensitive filename filter skipped phase-00-tasks.MD on Windows and macOS, and
  # the lint then printed "no slice ledger yet" and exited 0 over a full ledger.
  mv "$t/phases/phase-00-tasks.md" "$t/phases/phase-00-tasks.MD"
  run node "$(LINT)" --root "$t"
  [[ "$output" != *"no slice ledger yet"* ]]
}

@test "no false block: a legitimate constructor: field is not a repeated key" {
  local t; t="$(_tree)"
  # `{}` carries Object.prototype's names, so `key in obj` reported them as already seen.
  # A BLOCK firing on a clean ledger is ADR-0101's own revisit trigger.
  sed -i.bak 's/^sources: phase-00-spec.md$/sources: phase-00-spec.md\nconstructor: refactored the token constructor/' "$t/phases/phase-00-tasks.md"
  run node "$(LINT)" --root "$t"
  [ "$status" -eq 0 ]
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
  # The number is DERIVED from the TRIAL set, not pinned. It was pinned at 2, and adding a
  # third trial gate turned this red with nothing broken — the same defect the retro-log
  # records on 2026-08-02: a test that asserts one snapshot value measures the calendar.
  local expected
  expected="$(node -e '
    const src = require("node:fs").readFileSync(process.argv[1], "utf8");
    const m = src.match(/const TRIAL = new Set\(\[([^\]]*)\]\)/);
    if (!m) { console.error("TRIAL set not found"); process.exit(1); }
    console.log(m[1].split(",").filter((s) => s.trim()).length);
  ' "$(LINT)")"
  [ -n "$expected" ]
  local t; t="$(_tree)"
  run node "$(LINT)" --root "$t"
  [[ "$output" == *"[trial-status]"* ]]
  [[ "$output" == *"$expected in trial"* ]] || { echo "expected $expected in trial:"; echo "$output"; false; }
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

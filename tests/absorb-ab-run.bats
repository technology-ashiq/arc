#!/usr/bin/env bats
# absorb Cycle 10 Phase 04 -- ab-run.mjs, the deterministic half of REQ-03's A/B.
#
# The metrics and the pass condition are FIXED in initiatives/absorb/evidence/planoff/PHASE04-T01/
# PROTOCOL.md, committed before this script existed. This suite asserts the harness computes THOSE and
# refuses to be satisfied by a harness that computes nothing.
#
# Counts are DERIVED from the committed fixtures wherever a later fixture would legitimately change
# them -- the class that has bitten this lane twice ("a count assertion a later change falsifies").
# What is pinned is the INVARIANTS: nothing lost, the claimed class fully removed, the unclaimed class
# untouched and reported separately.
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN=".claude/scripts/absorb/ab-run.mjs"
FX="tests/fixtures/absorb/finding-verification"

_run_json() { cd "$ARC_ROOT" && node "$RUN" --fixtures "$FX" --json; }
_j() { node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(eval(process.argv[2])))' "$1" "$2"; }

setup() {
  OUT="$BATS_TEST_TMPDIR/out.json"
  ( cd "$ARC_ROOT" && node "$RUN" --fixtures "$FX" --json ) > "$OUT"
}

@test "ab-run: reads every committed fixture and every candidate in them" {
  local want_fx want_c
  want_fx="$(find "$ARC_ROOT/$FX" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  want_c="$(node -e '
    const fs=require("fs"),p=require("path");const d=process.argv[1];let n=0;
    for(const e of fs.readdirSync(d)){const f=p.join(d,e,"candidates.json");
      if(fs.existsSync(f)){const j=JSON.parse(fs.readFileSync(f,"utf8"));n+=(Array.isArray(j)?j:j.candidates).length;}}
    process.stdout.write(String(n))' "$ARC_ROOT/$FX")"
  [ "$want_fx" -ge 3 ]
  [ "$(_j "$OUT" 'j.rows.length')" = "$want_c" ]
  [ "$(_j "$OUT" 'j.metrics.total')" = "$want_c" ]
  # truth split is derived, not pinned: adding a fixture must not turn this red.
  [ "$(_j "$OUT" 'j.metrics.true_total + j.metrics.false_total')" = "$want_c" ]
}

# THE INTEGRITY GATE. Every candidate lands in exactly one of two sections, so this is 0 "by
# construction" -- which is what every lost finding was before it was lost. Asserted, not assumed.
@test "ab-run: true-lost is zero -- nothing vanishes between the two rules" {
  [ "$(_j "$OUT" 'j.metrics.true_lost')" = "0" ]
  local main app total
  main="$(_j "$OUT" 'j.rows.filter(r=>r.newDest==="main").length')"
  app="$(_j "$OUT" 'j.rows.filter(r=>r.newDest==="appendix").length')"
  total="$(_j "$OUT" 'j.rows.length')"
  [ "$((main + app))" -eq "$total" ]
}

@test "ab-run: the claimed class is fully removed, which is the primary metric" {
  [ "$(_j "$OUT" 'j.metrics.new_unresolvable_false_in_main')" = "0" ]
  [ "$(_j "$OUT" 'j.metrics.reduction > 0')" = "true" ]
}

# The unclaimed class must be COUNTED AND EXCLUDED, not quietly folded in. A harness that scored these
# against NEW would report a technique failing at something it explicitly does not claim.
@test "ab-run: the unclaimed class is reported and excluded from the verdict" {
  [ "$(_j "$OUT" 'j.metrics.supported_false_in_main > 0')" = "true" ]
  # ...and those candidates are in the MAIN report under NEW, i.e. genuinely not caught.
  [ "$(_j "$OUT" 'j.rows.filter(r=>r.truth!=="true"&&r.matches&&r.newDest==="main").length')" \
    = "$(_j "$OUT" 'j.metrics.supported_false_in_main')" ]
}

@test "ab-run: the verdict is NEW-WINS on the pre-committed condition" {
  [ "$(_j "$OUT" 'j.verdict')" = "NEW-WINS" ]
}

# THE NUMBER THE PROTOCOL DID NOT NAME, asserted so it cannot be dropped from the output later. It
# points AGAINST the verdict, which is exactly why it has a test: a future edit that tidied it away
# would leave a result reading better than it is.
@test "ab-run: the composition block is present and reports the precision delta" {
  [ "$(_j "$OUT" 'typeof j.metrics.composition')" = "object" ]
  [ "$(_j "$OUT" 'j.metrics.composition.precision_delta_pts !== null')" = "true" ]
  [ "$(_j "$OUT" 'j.metrics.composition.removed_true > j.metrics.composition.removed_false')" = "true" ]
}

@test "ab-run: human output prints the composition ABOVE the verdict line" {
  run bash -c "cd '$ARC_ROOT' && node '$RUN' --fixtures '$FX'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"composition: NOT part of the pass condition"* ]]
  local comp verd
  comp="$(printf '%s\n' "$output" | grep -n 'main report OLD' | cut -d: -f1)"
  verd="$(printf '%s\n' "$output" | grep -n 'VERDICT' | cut -d: -f1)"
  [ -n "$comp" ] && [ -n "$verd" ] && [ "$comp" -lt "$verd" ]
}

# ---- controls: a harness that computes nothing must fail these -------------------------------------

# A fixture whose own quote matches nothing in its own subject invalidates every number. Fatal, and
# with its OWN exit code so a broken fixture is never confused with a usage error.
@test "ab-run: a fixture whose quote matches nothing is FATAL, exit 3 (control)" {
  local d="$BATS_TEST_TMPDIR/bad/01-x"
  mkdir -p "$d/subject"
  printf 'line one\nline two\n' > "$d/subject/f.txt"
  printf '[{"id":"F1","claim":"c","cite":"subject/f.txt:1","quote":"NOT IN THE FILE","truth":"true","quotable":true,"why":"broken"}]\n' > "$d/candidates.json"
  run node "$ARC_ROOT/$RUN" --fixtures "$BATS_TEST_TMPDIR/bad"
  [ "$status" -eq 3 ]
  [[ "$output" == *"BROKEN FIXTURE"* ]]
}

# ...and a near-miss must NOT be called broken: an exact quote at the wrong line is the reviewer-error
# bucket the protocol fixed, not a transcription error. Without this the check above would be
# indistinguishable from one that rejects every mismatch.
@test "ab-run: an exact quote at the WRONG line is a near-miss, not a broken fixture (control)" {
  local d="$BATS_TEST_TMPDIR/near/01-x"
  mkdir -p "$d/subject"
  printf 'line one\nline two\nline three\n' > "$d/subject/f.txt"
  printf '[{"id":"F1","claim":"c","cite":"subject/f.txt:1","quote":"line three","truth":"true","quotable":true,"why":"cite off by two"},
           {"id":"F2","claim":"d","cite":"subject/f.txt:2","quote":"line two","truth":"false","quotable":true,"why":"exact"}]\n' > "$d/candidates.json"
  run node "$ARC_ROOT/$RUN" --fixtures "$BATS_TEST_TMPDIR/near" --json
  [ "$status" -eq 0 ]
  printf '%s' "$output" > "$BATS_TEST_TMPDIR/near.json"
  [ "$(_j "$BATS_TEST_TMPDIR/near.json" 'j.rows.find(r=>r.id==="F1").nearMiss')" = "true" ]
  [ "$(_j "$BATS_TEST_TMPDIR/near.json" 'j.rows.find(r=>r.id==="F2").nearMiss')" = "false" ]
}

# BELOW-BAR must be reachable, or the verdict has one value and proves nothing. A fixture where every
# false finding quotes exactly gives NEW nothing to remove -- reduction 0, and per ADR-0049 that is a
# failure to clear a bar, not a tie.
@test "ab-run: a fixture NEW cannot improve returns BELOW-BAR, not a tie (control)" {
  local d="$BATS_TEST_TMPDIR/flat/01-x"
  mkdir -p "$d/subject"
  printf 'alpha\nbeta\n' > "$d/subject/f.txt"
  printf '[{"id":"F1","claim":"c","cite":"subject/f.txt:1","quote":"alpha","truth":"false","quotable":true,"why":"quotes exactly, still false"},
           {"id":"F2","claim":"d","cite":"subject/f.txt:2","quote":"beta","truth":"true","quotable":true,"why":"true and exact"}]\n' > "$d/candidates.json"
  run node "$ARC_ROOT/$RUN" --fixtures "$BATS_TEST_TMPDIR/flat" --json
  [ "$status" -eq 0 ]
  printf '%s' "$output" > "$BATS_TEST_TMPDIR/flat.json"
  [ "$(_j "$BATS_TEST_TMPDIR/flat.json" 'j.metrics.reduction')" = "0" ]
  [ "$(_j "$BATS_TEST_TMPDIR/flat.json" 'j.verdict')" = "BELOW-BAR" ]
}

# A cite past end of file must NOT resolve. Without this, a citation to line 9999 could read as an
# empty string and byte-match a null quote.
@test "ab-run: a cite past end of file does not resolve (control)" {
  local d="$BATS_TEST_TMPDIR/eof/01-x"
  mkdir -p "$d/subject"
  printf 'only line\n' > "$d/subject/f.txt"
  printf '[{"id":"F1","claim":"c","cite":"subject/f.txt:9999","quote":null,"truth":"false","quotable":false,"why":"past EOF"}]\n' > "$d/candidates.json"
  run node "$ARC_ROOT/$RUN" --fixtures "$BATS_TEST_TMPDIR/eof" --json
  [ "$status" -eq 0 ]
  printf '%s' "$output" > "$BATS_TEST_TMPDIR/eof.json"
  [ "$(_j "$BATS_TEST_TMPDIR/eof.json" 'j.rows[0].resolves')" = "false" ]
  [ "$(_j "$BATS_TEST_TMPDIR/eof.json" 'j.rows[0].newDest')" = "appendix" ]
}

# candidates.json is DATA. A cite that escapes the fixture must not be read, or a fixture could quote
# an arbitrary file on the machine into a results table.
@test "ab-run: a traversing cite is refused, never read (control)" {
  local d="$BATS_TEST_TMPDIR/trav/01-x"
  mkdir -p "$d/subject"
  printf 'inside\n' > "$d/subject/f.txt"
  printf 'SECRET-OUTSIDE\n' > "$BATS_TEST_TMPDIR/trav/outside.txt"
  printf '[{"id":"F1","claim":"c","cite":"../outside.txt:1","quote":"SECRET-OUTSIDE","truth":"false","quotable":true,"why":"escapes"}]\n' > "$d/candidates.json"
  run node "$ARC_ROOT/$RUN" --fixtures "$BATS_TEST_TMPDIR/trav" --json
  # The quote matches nowhere reachable, so it is refused as a broken fixture rather than resolved.
  [ "$status" -eq 3 ]
  [[ "$output" != *"SECRET-OUTSIDE"* ]] || { echo "the harness READ an out-of-fixture file"; false; }
}

# ---- --render: the artifacts the owner judges ------------------------------------------------------

@test "ab-run --render: neither report leaks the ground truth" {
  for mode in OLD NEW; do
    run bash -c "cd '$ARC_ROOT' && node '$RUN' --fixtures '$FX' --render $mode"
    [ "$status" -eq 0 ]
    [[ "$output" != *'"truth"'* ]]
    [[ "$output" != *"quotable"* ]]
    [[ "$output" != *'"why"'* ]]
  done
}

@test "ab-run --render OLD: every candidate appears and no appendix exists" {
  run bash -c "cd '$ARC_ROOT' && node '$RUN' --fixtures '$FX' --render OLD"
  [ "$status" -eq 0 ]
  [[ "$output" != *"Appendix"* ]]
  [[ "$output" != *"quote:"* ]]   # OLD does not require one, so it must not display one
}

@test "ab-run --render NEW: carries an appendix, its count, and a reason per entry" {
  run bash -c "cd '$ARC_ROOT' && node '$RUN' --fixtures '$FX' --render NEW"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Appendix -- unverified:"* ]]
  [[ "$output" == *"entries"* ]]
  [[ "$output" == *"unverified because:"* ]]
  [[ "$output" == *"none of these is a tracked issue"* ]]
  [[ "$output" == *"quote:"* ]]
}

# The rendered counts must agree with the metrics, or the owner judges two reports that do not
# correspond to the numbers in RESULTS.md.
@test "ab-run --render NEW: the appendix count matches the computed routing" {
  local want got
  want="$(_j "$OUT" 'j.rows.filter(r=>r.newDest==="appendix").length')"
  got="$(cd "$ARC_ROOT" && node "$RUN" --fixtures "$FX" --render NEW | sed -n 's/^Appendix -- unverified: \([0-9]*\) entries\.$/\1/p' | head -1)"
  [ -n "$got" ]
  [ "$want" = "$got" ]
}

@test "ab-run: bad usage exits 2 and an unknown flag is named" {
  run node "$ARC_ROOT/$RUN"
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage"* ]]
  run node "$ARC_ROOT/$RUN" --fixtures "$ARC_ROOT/$FX" --nonsense
  [ "$status" -eq 2 ]
  [[ "$output" == *"nonsense"* ]]
  run node "$ARC_ROOT/$RUN" --fixtures "$ARC_ROOT/$FX" --render SIDEWAYS
  [ "$status" -eq 2 ]
  [[ "$output" == *"OLD or NEW"* ]]
}

# A suite that IS the proof of a rule asserts its own count. bats silently DROPS a @test whose name
# carries a non-ASCII character -- five tests once vanished behind a green file, visible only as a
# shrinking CI count (.claude/rules/testing.md).
@test "absorb-ab-run suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 18 ] || { echo "registered $registered tests, expected 18"; false; }
}

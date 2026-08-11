#!/usr/bin/env bats
# Phase 02, REQ-06 -- recall quality is a number CI can fail on (ADR-0706).
#
# THE NEGATIVE CONTROL COMES FIRST, and it is the reason this file exists. A gate nobody has seen
# go red is a gate nobody has tested: the phase spec requires it "demonstrated failing once before
# being trusted". Every red path below is driven by a real planted defect, not by asserting that
# an error message exists.
#
# The gate reads exactly three things -- the golden TSV, the index, and the alias file -- so a
# corrupted-fixture tree is assembled from the REAL index plus a doctored TSV. That keeps the
# ranking real (the repo's own 278-record corpus) while the graded expectations are ours to break.
#
# @test names are ASCII-only: bats silently DROPS a test whose name carries a non-ASCII character.
bats_require_minimum_version 1.5.0
load 'test_helper'

MEM="$ARC_ROOT/.claude/scripts/memory/memory-index.mjs"
RECALL="$ARC_ROOT/.claude/scripts/memory/arc-recall.mjs"
GOLDEN="$ARC_ROOT/.claude/scripts/memory/golden-check.mjs"
TSV="tests/fixtures/memory/golden-queries.tsv"
OBSERVE=".claude/state/memory/surfaced-cited.jsonl"

# A tree the gate can read: the REAL index (so ranking is real) plus our own copy of the golden
# TSV, which each test is free to doctor.
_gate_tree() {
  run node "$MEM" --root "$ARC_ROOT" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local t="$BATS_TEST_TMPDIR/gt"
  mkdir -p "$t/.claude/state/memory" "$t/tests/fixtures/memory" "$t/docs/memory"
  cp "$ARC_ROOT/.claude/state/memory/index.json" "$t/.claude/state/memory/index.json"
  cp "$ARC_ROOT/$TSV" "$t/$TSV"
  [ -f "$ARC_ROOT/docs/memory/aliases.md" ] && cp "$ARC_ROOT/docs/memory/aliases.md" "$t/docs/memory/aliases.md"
  # A fixture builder asserts its own fixture. An empty index or a truncated TSV would make every
  # "gate failed" test below pass for the wrong reason.
  [ -s "$t/.claude/state/memory/index.json" ] || return 1
  [ "$(grep -cv '^#' "$t/$TSV")" -eq 12 ] || return 1
  echo "$t"
}

@test "golden gate: NEGATIVE CONTROL -- one planted miss turns the gate red" {
  # The gate is demonstrated FAILING before it is trusted. G01 asks about the closed event
  # vocabulary; replacing its query with a token the corpus does not contain makes exactly one
  # row miss, and 11/12 must be a build failure.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  # Sanity: it is GREEN before the plant, or the red below proves nothing.
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"GATE PASSED"* ]]
  # ...now plant the miss.
  node -e "
    const fs=require('node:fs'); const p=process.argv[1];
    const out=fs.readFileSync(p,'utf8').split('\n').map((l)=>{
      if (!l.startsWith('G01\t')) return l;
      const c=l.split('\t'); c[1]='zzzqqq unmatchable token'; return c.join('\t');
    }).join('\n');
    fs.writeFileSync(p,out);" "$t/$TSV"
  grep -q "zzzqqq unmatchable token" "$t/$TSV" || { echo "the plant did not land in the fixture"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 1 ] || { echo "expected exit 1, got $status"; echo "$output"; false; }
  [[ "$output" == *"GATE FAILED"* ]]
  [[ "$output" == *"1 of 12 golden queries do not hit"* ]]
}

@test "golden gate: a module that only EQUALS grep is red, isolated from the miss condition" {
  # ADR-0706's second red, and it means something different from the first: 12/12 is a perfect
  # score and still a failure if grep already found them, because then the module was not needed.
  # Isolated by moving the recorded baseline rather than by breaking a query, so this test cannot
  # pass on the miss condition instead.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  sed -i 's/^# @baseline-grep-top3\t5$/# @baseline-grep-top3\t12/' "$t/$TSV"
  grep -qP '^# @baseline-grep-top3\t12$' "$t/$TSV" || grep -q '@baseline-grep-top3	12' "$t/$TSV" || { echo "the baseline edit did not land"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 1 ] || { echo "expected exit 1, got $status"; echo "$output"; false; }
  [[ "$output" == *"did not BEAT grep"* ]]
  # ...and NOT for the other reason: all twelve still hit.
  [[ "$output" != *"golden queries do not hit"* ]]
}

@test "golden gate: green on the live corpus, with the comparison table beside the verdict" {
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"12/12 anchors resolve"* ]]
  [[ "$output" == *"12/12 queries hit an expected id in the top 3"* ]]
  # The comparison table: both numbers labelled, the delta derived rather than retyped.
  [[ "$output" == *"grep baseline"* ]]
  [[ "$output" == *"arc-recall (js)"* ]]
  [[ "$output" == *"delta"* ]]
  [[ "$output" == *"GATE PASSED"* ]]
  [[ "$output" == *"beating the grep baseline of 5 by 7"* ]]
}

@test "golden gate: all THREE embeddings conditions are printed with their live values" {
  # ADR-0706 settled the embeddings trigger as three conditions TOGETHER. Printing one of them,
  # or printing a verdict with no values, is how a settled number decays back into folklore.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"needs ALL THREE"* ]]
  [[ "$output" == *"top-3 precision < 10/12"* ]]
  [[ "$output" == *"alias-iteration fixes"* ]]
  [[ "$output" == *"corpus >= 2x the recorded size"* ]]
  [[ "$output" == *"NOT discussable"* ]]
  # Live values, not just labels: the alias table is empty today and the bar is twice 278.
  [[ "$output" == *"(live 12/12)"* ]]
  [[ "$output" == *"recorded 278, bar 556"* ]]
}

@test "golden gate: --rank without --gate still only reports, and never fails the build" {
  # The reporting surface Phase 01 shipped must keep its contract: turning --rank itself into a
  # gate would have made every phase-01 caller start failing without being asked.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  node -e "
    const fs=require('node:fs'); const p=process.argv[1];
    const out=fs.readFileSync(p,'utf8').split('\n').map((l)=>{
      if (!l.startsWith('G01\t')) return l;
      const c=l.split('\t'); c[1]='zzzqqq unmatchable token'; return c.join('\t');
    }).join('\n');
    fs.writeFileSync(p,out);" "$t/$TSV"
  run node "$GOLDEN" --root "$t" --rank
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"11/12 queries hit an expected id in the top 3"* ]]
  [[ "$output" != *"GATE"* ]]
}

@test "golden gate: the bar lives in the fixture, and a missing or broken one is refused" {
  # A gate that silently defaults its own bar is grading nothing.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  cp "$t/$TSV" "$t/keep.tsv"
  # missing
  grep -v '@baseline-grep-top3' "$t/keep.tsv" > "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"declares no @baseline-grep-top3"* ]]
  # non-numeric
  sed 's/^# @baseline-grep-top3\t5$/# @baseline-grep-top3\tfive/' "$t/keep.tsv" > "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"not a non-negative integer"* ]]
  # declared twice -- an operator error, never last-wins
  { cat "$t/keep.tsv"; printf '# @baseline-grep-top3\t9\n'; } > "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"twice"* ]]
  # an unknown directive is a typo in a real one, not a comment to ignore
  { cat "$t/keep.tsv"; printf '# @baseline-grep-top4\t5\n'; } > "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"which is not one of"* ]]
  # ...and the untouched fixture is still green, so the four reds above are the directives and
  # not the copying.
  cp "$t/keep.tsv" "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "golden gate: a ranked recall records one surfaced row, and cannot be broken by it" {
  # ADR-0706: observational, best effort. The row is written...
  tree="$BATS_TEST_TMPDIR/obs"
  cp -r "$ARC_ROOT/tests/fixtures/memory/organs-good" "$tree"
  run node "$MEM" --root "$tree" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$RECALL" --root "$tree" "unanchored heading regex prose"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$tree/$OBSERVE" ] || { echo "no observational row was written"; false; }
  run node -e "
    const fs=require('node:fs');
    const lines=fs.readFileSync(process.argv[1],'utf8').trim().split('\n');
    if (lines.length!==1) throw new Error('expected 1 row, got '+lines.length);
    const r=JSON.parse(lines[0]);
    if (r.surface!=='arc-recall') throw new Error('surface '+r.surface);
    if (r.cited!==null) throw new Error('cited must start null, got '+JSON.stringify(r.cited));
    if (!Array.isArray(r.surfaced) || r.surfaced.length===0) throw new Error('surfaced empty');
    console.log('OBSERVE OK '+r.surfaced.length);" "$tree/$OBSERVE"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"OBSERVE OK"* ]]
  # ...and when it CANNOT be written, recall still answers. A file where the directory belongs
  # makes mkdir fail on every OS, without relying on chmod semantics that differ on windows.
  tree2="$BATS_TEST_TMPDIR/obs2"
  cp -r "$ARC_ROOT/tests/fixtures/memory/organs-good" "$tree2"
  run node "$MEM" --root "$tree2" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  rm -rf "$tree2/.claude/state/memory"
  printf 'not a directory\n' > "$tree2/.claude/state/memory"
  run node "$RECALL" --root "$tree2" "unanchored heading regex prose"
  [ "$status" -eq 0 ] || { echo "an unwritable observational log broke recall"; echo "$output"; false; }
  [[ "$output" == *"docs/retro-log.md:"* ]]
}

@test "golden gate: no gate path reads the observational log" {
  # ADR-0706 disqualifies this log from ever gating or promoting anything. That is a property of
  # the code, so it is checked against the code rather than trusted to the ADR.
  # POSITIVE CONTROL FIRST: prove the grep is reading a file that exists and mentions the gate.
  run grep -c -- "--gate" "$GOLDEN"
  [ "$status" -eq 0 ] || { echo "the gate flag is absent from golden-check.mjs"; false; }
  [ "$output" -gt 0 ]
  run grep -nE "surfaced-cited|observe\.mjs|recordSurfaced" "$GOLDEN"
  [ "$status" -ne 0 ] || { echo "golden-check reads the observational log: $output"; false; }
}

@test "golden gate: bats registers every test this file declares" {
  # MEASURED, not asserted: bats silently DROPS a @test whose name carries a non-ASCII character.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 7 ]
}

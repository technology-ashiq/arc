#!/usr/bin/env bats
# Phase 02, REQ-05 -- contradicting rules meet a human, not a merge bot (ADR-0705).
#
# The check is LEXICAL and it SURFACES. Every test here asserts one of the two halves of that
# sentence: that the rule (>= 2 shared tags AND jaccard >= T) really is an AND and not a decorated
# OR, and that a hit changes nothing on disk.
#
# The fixture log is built per-test in $BATS_TEST_TMPDIR rather than planted in
# tests/fixtures/memory/organs-good/: memory-index.bats asserts EXACT parse counts against that
# tree, so a row added there would be a silent red in another suite.
#
# @test names are ASCII-only: bats silently DROPS a test whose name carries a non-ASCII character.
bats_require_minimum_version 1.5.0
load 'test_helper'

CHECK="$ARC_ROOT/.claude/scripts/memory/conflict-check.mjs"
RETRO_CMD="$ARC_ROOT/.claude/commands/arc-retro.md"

# The candidate row every test compares against:
#   prevention "always quote the flag value" -> tokens {always,quote,the,flag,value}, 5
#   tags       shell,quoting,lanes
#
# Row A  near-duplicate      2 shared tags, jaccard 5/7   = 0.714  -> FIRES
# Row B  same tags, unlike   2 shared tags, jaccard 1/11  = 0.091  -> misses on OVERLAP
# Row C  identical text      1 shared tag,  jaccard 5/5   = 1.000  -> misses on TAGS
_log() {
  local d="$BATS_TEST_TMPDIR/tree/docs"
  mkdir -p "$d"
  cat > "$d/retro-log.md" <<'EOF'
# Retro log -- fixture

> Format: `YYYY-MM-DD | project | pattern | prevention | tags`
2026-02-01 | fixture | an unquoted flag value ate the next flag | always quote the flag value in scripts | shell,quoting
2026-02-02 | fixture | a stale constant survived a merge | run the migration on a merged tree | shell,quoting
2026-02-03 | fixture | the same words under a different tag set | always quote the flag value | shell,ci
EOF
  # A fixture builder asserts its own fixture is non-empty. An empty log is a silent pass
  # generator: every "no near-duplicate found" test below would pass against nothing at all.
  [ -s "$d/retro-log.md" ] || return 1
  [ "$(grep -c '^2026-' "$d/retro-log.md")" -eq 3 ] || return 1
  echo "$BATS_TEST_TMPDIR/tree"
}

# Its own tree, so the counts the tests above assert against are untouched. Every tag in `_log`
# and in every --tags argument is already lowercase, so `normalizeTags` was asserted by NOTHING:
# replacing its body with `String(t)` left all ten tests green. It is not inert -- a row recorded
# `Shell, QUOTING` against a candidate typed `shell,quoting,lanes` fires today and would miss
# under that mutant (2026-08-12, decision-logic row 9).
_log_mixed_case() {
  local d="$BATS_TEST_TMPDIR/case/docs"
  mkdir -p "$d"
  cat > "$d/retro-log.md" <<'EOF'
# Retro log -- fixture

> Format: `YYYY-MM-DD | project | pattern | prevention | tags`
2026-03-01 | fixture | the same lesson recorded under differently-cased tags | always quote the flag value | Shell,QUOTING
EOF
  [ -s "$d/retro-log.md" ] || return 1
  [ "$(grep -c '^2026-' "$d/retro-log.md")" -eq 1 ] || return 1
  grep -q 'Shell,QUOTING' "$d/retro-log.md" || return 1
  echo "$BATS_TEST_TMPDIR/case"
}

@test "conflict-check: the checker is present at its contracted path" {
  [ -f "$CHECK" ]
}

@test "conflict-check: CI and ci are one tag, so a differently-cased recording still collides" {
  # The function's own docstring, finally asserted. Text overlap is 1.00 here, so the ONLY thing
  # that can stop this pair firing is tag normalization -- which makes this test go red the moment
  # normalizeTags stops normalizing.
  tree="$(_log_mixed_case)"
  [ -n "$tree" ] || { echo "the mixed-case fixture was not built"; false; }
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,quoting,lanes"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 1 of 1 near-duplicate(s)"* ]]
  # Both halves reported, and the shared tags printed in their NORMALIZED form.
  [[ "$output" == *"shared tags: shell, quoting"* ]]
  [[ "$output" == *"jaccard 1.00"* ]]
  # ...and the negative half from the same fixture: one shared tag after normalization is not two,
  # so the AND still has to hold. Without this, "normalize everything to the empty string" passes.
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,ci,lanes"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no near-duplicate found"* ]]
}

@test "conflict-check: a planted near-duplicate surfaces with its citation and both scores" {
  tree="$(_log)"
  [ -n "$tree" ] || { echo "the retro-log fixture was not built"; false; }
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,quoting,lanes"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The citation carries the repo-relative path AND the line -- a bare number is never alone.
  [[ "$output" == *"docs/retro-log.md:4"* ]]
  # VERBATIM: the recorded prevention text, as recorded.
  [[ "$output" == *"always quote the flag value in scripts"* ]]
  # BOTH halves of the rule are reported, so a pair can be told apart from a pair that missed
  # on the other criterion -- a detector printing only its verdict cannot be retuned.
  [[ "$output" == *"jaccard 0.71"* ]]
  [[ "$output" == *"shared tags: shell, quoting"* ]]
  [[ "$output" == *"showing 1 of 1 near-duplicate(s)"* ]]
}

@test "conflict-check: the rule is a real AND, proven from BOTH sides" {
  # This is the test that fails if either half of the condition is deleted. Row B shares the two
  # tags and misses on overlap; row C has identical text and misses on tags. If the check were an
  # OR, or ignored either half, one of these two rows would appear in the single hit above.
  tree="$(_log)"
  [ -n "$tree" ] || { echo "the retro-log fixture was not built"; false; }
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,quoting,lanes"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 1 of 1 near-duplicate(s)"* ]]
  # row B: same two tags, unlike text -- must NOT be shown.
  [[ "$output" != *"run the migration on a merged tree"* ]]
  # row C: identical text, one shared tag -- must NOT be shown.
  [[ "$output" != *"docs/retro-log.md:6"* ]]
  # ...and row C IS reachable when its tag set qualifies, so the two absences above are the rule
  # working rather than the row being unparsed or the fixture being short.
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,ci,lanes"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"docs/retro-log.md:6"* ]]
  [[ "$output" == *"jaccard 1.00"* ]]
}

@test "conflict-check: T is a real boundary, checked just under and just over" {
  # Row A scores 5/7 = 0.7142857. A threshold above it must miss and one below it must fire --
  # measured against the real computed score, not against a value this test asserts into being.
  tree="$(_log)"
  [ -n "$tree" ] || { echo "the retro-log fixture was not built"; false; }
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,quoting,lanes" --threshold 0.71
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 1 of 1 near-duplicate(s)"* ]]
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,quoting,lanes" --threshold 0.72
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no near-duplicate found"* ]]
  # The live threshold is printed on BOTH runs: the retune trigger cannot be measured if nobody
  # can tell which T actually ran.
  [[ "$output" == *"jaccard(prevention tokens) >= 0.72"* ]]
}

@test "conflict-check: a hit resolves nothing and writes nothing" {
  # ADR-0705: shown, never auto-merged, never blocked, never rewritten. A check that blocked would
  # make the author delete the row to get past it, which is how a lesson gets lost.
  tree="$(_log)"
  [ -n "$tree" ] || { echo "the retro-log fixture was not built"; false; }
  before="$(_arc_sha256 < "$tree/docs/retro-log.md")"
  [ -n "$before" ]
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,quoting,lanes"
  # Exit 0 ON A HIT: surfacing is not blocking.
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"near-duplicate(s)"* ]]
  after="$(_arc_sha256 < "$tree/docs/retro-log.md")"
  [ "$before" = "$after" ] || { echo "the log CHANGED: $before -> $after"; false; }
  [[ "$output" == *"never edits it"* ]]
}

@test "conflict-check: it names its metric and its limits rather than saying overlap" {
  # "overlap >= 0.5" with no formula beside it is a number nobody can check, and a lexical check
  # that does not say it is lexical will be read as understanding what it matched.
  tree="$(_log)"
  [ -n "$tree" ] || { echo "the retro-log fixture was not built"; false; }
  run node "$CHECK" --root "$tree" --prevention "nothing here resembles anything recorded" --tags "zeta,eta,theta"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"lexical only, no semantic detection"* ]]
  [[ "$output" == *"jaccard = shared tokens / union of tokens"* ]]
  [[ "$output" == *"scanned 3 recorded row(s)"* ]]
  [[ "$output" == *"no near-duplicate found"* ]]
}

@test "conflict-check: --json carries the rule, the scores and the resolves-nothing contract" {
  tree="$(_log)"
  [ -n "$tree" ] || { echo "the retro-log fixture was not built"; false; }
  run node "$CHECK" --root "$tree" --prevention "always quote the flag value" --tags "shell,quoting,lanes" --json
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | node -e "
    let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
      const j=JSON.parse(s);
      if (j.metric!=='jaccard') throw new Error('metric is '+j.metric);
      if (j.resolves!==false) throw new Error('resolves is '+j.resolves);
      if (j.matched!==1) throw new Error('matched is '+j.matched);
      if (j.scanned!==3) throw new Error('scanned is '+j.scanned);
      if (j.candidates[0].citation!=='docs/retro-log.md:4') throw new Error('citation is '+j.candidates[0].citation);
      if (j.candidates[0].sharedTags.length!==2) throw new Error('sharedTags '+j.candidates[0].sharedTags);
      console.log('JSON OK');
    });"
}

@test "conflict-check: the flags refuse what they cannot honour, naming each refusal" {
  tree="$(_log)"
  [ -n "$tree" ] || { echo "the retro-log fixture was not built"; false; }
  run node "$CHECK" --root "$tree" --tags "a,b"; [ "$status" -eq 2 ]
  [[ "$output" == *"--prevention <text> is required"* ]]
  run node "$CHECK" --root "$tree" --prevention "x"; [ "$status" -eq 2 ]
  [[ "$output" == *"--tags <a,b,c> is required"* ]]
  # The three recorded argv shapes: repeated flag, quoted-empty variable, flag-eats-flag.
  run node "$CHECK" --root "$tree" --prevention "x" --prevention "y" --tags "a,b"; [ "$status" -eq 2 ]
  [[ "$output" == *"given twice"* ]]
  run node "$CHECK" --root "$tree" --prevention "" --tags "a,b"; [ "$status" -eq 2 ]
  [[ "$output" == *"named but is empty"* ]]
  run node "$CHECK" --root "$tree" --prevention --json --tags "a,b"; [ "$status" -eq 2 ]
  [[ "$output" == *"which is a flag, not a value"* ]]
  # A silently-defaulted threshold makes the retune trigger unmeasurable.
  run node "$CHECK" --root "$tree" --prevention "x" --tags "a,b" --threshold "0.5abc"; [ "$status" -eq 2 ]
  [[ "$output" == *"is not a number between 0 and 1"* ]]
  run node "$CHECK" --root "$tree" --prevention "x" --tags "a,b" --threshold "2"; [ "$status" -eq 2 ]
  run node "$CHECK" --root "$tree" --prevention "x" --tags "a,b" nonsense; [ "$status" -eq 2 ]
  [[ "$output" == *"unknown argument"* ]]
  # A missing log is usage, not an empty result: "nothing to compare against" must never read as
  # "no near-duplicate found".
  run node "$CHECK" --root "$BATS_TEST_TMPDIR/nowhere" --prevention "x" --tags "a,b"; [ "$status" -eq 2 ]
  [[ "$output" == *"nothing to compare against"* ]]
}

@test "conflict-check: arc-retro calls the check BEFORE the append, and is allowed to" {
  # The rule only exists if the command actually runs it. A checker nobody invokes is a checker
  # that fires on nothing -- and /arc-retro is hand-written, so this is a grep-able contract.
  [ -f "$RETRO_CMD" ]
  run grep -n "conflict-check.mjs" "$RETRO_CMD"
  [ "$status" -eq 0 ] || { echo "arc-retro.md never invokes the check"; false; }
  # It must be permitted, or the step is a suggestion the harness will refuse to run.
  run grep -c "allowed-tools:.*conflict-check.mjs" "$RETRO_CMD"
  [ "$status" -eq 0 ] || { echo "conflict-check.mjs is not in allowed-tools"; false; }
  # ...and it must sit BEFORE step 4, i.e. beside the append it guards, not after the fact.
  local check_line append_line
  check_line="$(grep -n "conflict-check.mjs" "$RETRO_CMD" | tail -1 | cut -d: -f1)"
  append_line="$(grep -n "^4\. " "$RETRO_CMD" | head -1 | cut -d: -f1)"
  [ -n "$check_line" ] && [ -n "$append_line" ]
  [ "$check_line" -lt "$append_line" ] || { echo "the check sits at line $check_line, after step 4 at $append_line"; false; }
}

@test "conflict-check: bats registers every test this file declares" {
  # MEASURED, not asserted: bats silently DROPS a @test whose name carries a non-ASCII character,
  # and bumping a hardcoded literal to restore green hides a suite running one test fewer.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 8 ]
}

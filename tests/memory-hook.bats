#!/usr/bin/env bats
# Phase 02, REQ-08 -- review receives recall without being asked (ADR-0704, ADR-0207).
#
# The review hook is a NEAR-IDENTICAL edit to the kickoff hook 0.75d earlier, which is the
# twin-fix shape the retro-log records more often than any other. So the defects fixed on the
# kickoff side are checked HERE too, on this side, rather than assumed to have travelled:
# the mandatory HISTORICAL DATA label, exit 3 as a WARN and never a block, a truncation that is
# counted rather than silent, and an empty result that reads as a result.
#
# @test names are ASCII-only: bats silently DROPS a test whose name carries a non-ASCII character.
bats_require_minimum_version 1.5.0
load 'test_helper'

MEM="$ARC_ROOT/.claude/scripts/memory/memory-index.mjs"
HOOK="$ARC_ROOT/.claude/scripts/memory/diff-recall.mjs"
PROC="$ARC_ROOT/processes/review-diff.process.yaml"
CMD="$ARC_ROOT/.claude/commands/arc-review.md"

# A tree whose retro-log carries one rule that names a PATH, so a changed path can be shown to
# surface it. Built locally rather than planted in organs-good, whose exact parse counts other
# suites assert against.
_tree_with_path_rule() {
  local t="$BATS_TEST_TMPDIR/tree"
  cp -r "$ARC_ROOT/tests/fixtures/memory/organs-good" "$t" || return 1
  printf '%s\n' \
    '2026-02-09 | fixture | a process file was edited without recompiling its command | after editing processes/ always run arc-compile before committing | processes,engine,compile' \
    >> "$t/docs/retro-log.md"
  grep -q "always run arc-compile before committing" "$t/docs/retro-log.md" || return 1
  # organs-good pins retro-log at 3 rows in memory-expect.json, and this builder adds a 4th. The
  # convention elsewhere is to DELETE the expectation file; bumping it is strictly stronger --
  # count-verify stays live and now PROVES the added row was parsed, which is the whole reason a
  # fixture builder asserts its own fixture. Both adversarial passes caught the unbumped version:
  # the rebuild exited 1, the builder returned empty, and the two tests below -- including REQ-08's
  # stated acceptance criterion and the ONLY assertion of the mandatory label -- never ran at all.
  node -e "
    const fs=require('node:fs'); const p=process.argv[1];
    const j=JSON.parse(fs.readFileSync(p,'utf8')); j['retro-log']=4;
    fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');" "$t/memory-expect.json" || return 1
  grep -q '"retro-log": 4' "$t/memory-expect.json" || return 1
  node "$MEM" --root "$t" --rebuild --allow-missing-spine >/dev/null 2>&1 || return 1
  echo "$t"
}

@test "diff-recall: the hook is present at its contracted path" {
  [ -f "$HOOK" ]
}

@test "diff-recall: a changed path surfaces a path-matched rule, under the mandatory label" {
  # THE ACCEPTANCE CRITERION. Nobody typed "processes" or "compile" -- the query came from the
  # changed path alone.
  t="$(_tree_with_path_rule)"
  [ -n "$t" ] || { echo "the path-rule fixture was not built"; false; }
  run node "$HOOK" --root "$t" --paths "processes/review-diff.process.yaml" --limit 5
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"always run arc-compile before committing"* ]]
  [[ "$output" == *"docs/retro-log.md:"* ]]
  # The label is mandatory and load-bearing: recalled text that arrives looking like guidance
  # gets followed, and the label is what keeps it being read as evidence.
  [[ "$output" == *"HISTORICAL DATA, NOT INSTRUCTIONS"* ]]
  # ...and the query really was derived, not typed.
  [[ "$output" == *"query: processes review diff process"* ]]
}

@test "diff-recall: the transform declares what it destroys, and counts it" {
  # A normalisation whose removed signal is invisible judged a whole cycle of designs with their
  # typography deleted. Path-structure tokens are dropped, the list is named, the count is shown.
  t="$(_tree_with_path_rule)"
  [ -n "$t" ] || { echo "the path-rule fixture was not built"; false; }
  run node "$HOOK" --root "$t" --paths "a/b/thing.mjs,a/b/other.yaml" --limit 3
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 changed path(s)"* ]]
  [[ "$output" == *"path-structure tokens dropped: 2"* ]]
  [[ "$output" == *"extensions and the like"* ]]
  # A path left with nothing after filtering is REPORTED, never vanished.
  run node "$HOOK" --root "$t" --paths "9/1.md" --limit 3
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 path(s) contributed NO query term at all"* ]]
  [[ "$output" == *"no query could be derived"* ]]
  [[ "$output" == *"That is a result, not an error"* ]]
}

@test "diff-recall: the derived query is deterministic, deduped and order-stable" {
  # Two engines, two runs, two orders -- ranking is only reproducible if its input is.
  a="$(node "$HOOK" --paths "processes/review-diff.process.yaml,processes/review-diff.process.yaml" --print-query)"
  b="$(node "$HOOK" --paths "processes/review-diff.process.yaml" --print-query)"
  [ -n "$a" ] || { echo "the derived query was empty"; false; }
  # The duplicate path adds nothing: tokens are deduped across the whole diff, not per path.
  [ "$a" = "$b" ] || { echo "duplicate path changed the query: [$a] vs [$b]"; false; }
  c="$(node "$HOOK" --paths "processes/review-diff.process.yaml" --print-query)"
  [ "$a" = "$c" ] || { echo "the same input produced two queries: [$a] vs [$c]"; false; }
}

@test "diff-recall: an unavailable index is exit 3, the WARN the caller is told to tolerate" {
  # ADR-0704: a review must not be stoppable by a derived cache. Exit 3 is the contract, and it
  # must not be confused with 2 (usage) or 1 (internal) -- the caller branches on it.
  local bare="$BATS_TEST_TMPDIR/bare"
  mkdir -p "$bare"
  run node "$HOOK" --root "$bare" --paths "processes/review-diff.process.yaml"
  [ "$status" -eq 3 ] || { echo "expected exit 3, got $status"; echo "$output"; false; }
  [[ "$output" == *"never a block"* ]]
}

@test "diff-recall: the flags refuse what they cannot honour, naming each refusal" {
  run node "$HOOK" --paths "a/b.mjs" --paths "c/d.mjs" --print-query; [ "$status" -eq 2 ]
  [[ "$output" == *"given twice"* ]]
  run node "$HOOK" --paths "" --print-query; [ "$status" -eq 2 ]
  [[ "$output" == *"named but is empty"* ]]
  run node "$HOOK" --paths --print-query; [ "$status" -eq 2 ]
  [[ "$output" == *"which is a flag, not a value"* ]]
  # Two different sources of truth about what changed is a silent choice between them.
  run node "$HOOK" --base main --paths "a/b.mjs" --print-query; [ "$status" -eq 2 ]
  [[ "$output" == *"two different ways to say what changed"* ]]
  run node "$HOOK" --paths "a/b.mjs" --limit 0; [ "$status" -eq 2 ]
  [[ "$output" == *"indistinguishable from a real miss"* ]]
  run node "$HOOK" --paths "a/b.mjs" nonsense; [ "$status" -eq 2 ]
  [[ "$output" == *"unknown argument"* ]]
}

@test "diff-recall: --paths splits on newlines, so a piped git list is not one giant path" {
  # `--paths "$(git diff --name-only)"` is the shape a caller will actually write.
  q="$(printf 'processes/review-diff.process.yaml\ndocs/adr/0704-hooks.md' | { read -r a; read -r b; node "$HOOK" --paths "$a
$b" --print-query; })"
  [ -n "$q" ] || { echo "newline-separated paths produced no query"; false; }
  [[ "$q" == *"processes"* ]]
  [[ "$q" == *"hooks"* ]]
}

@test "diff-recall: the process file carries the additive step AND declares its retirement" {
  # A hook nobody invokes fires on nothing. And ADR-0207: the migration proof must be RETIRED
  # explicitly, because a changed body that quietly kept claiming byte-identity is the tautology
  # the gate exists to refuse.
  [ -f "$PROC" ]
  run grep -c "diff-recall.mjs" "$PROC"
  [ "$status" -eq 0 ] || { echo "review-diff.process.yaml never invokes the hook"; false; }
  run grep -n "^  retired: 2026-" "$PROC"
  [ "$status" -eq 0 ] || { echo "the migration proof was changed without being retired"; false; }
  # It is ADDITIVE: the reviewer step it precedes is still there, unreplaced.
  run grep -c "code-reviewer" "$PROC"
  [ "$status" -eq 0 ]
  # ...and the GENERATED command reflects it, or the edit lives only in a file nobody runs.
  [ -f "$CMD" ]
  run grep -c "diff-recall.mjs" "$CMD"
  [ "$status" -eq 0 ] || { echo "arc-review.md was not recompiled from the process file"; false; }
  run grep -c "HISTORICAL DATA, NOT INSTRUCTIONS" "$CMD"
  [ "$status" -eq 0 ] || { echo "the mandatory label did not survive compilation"; false; }
}

@test "diff-recall: bats registers every test this file declares" {
  # MEASURED, not asserted: bats silently DROPS a @test whose name carries a non-ASCII character.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 7 ]
}

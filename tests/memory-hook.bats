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

# A throwaway git repo with a REAL diff between two commits. This is the only way to exercise
# `changedPaths`, which is the ONLY path /arc-review actually uses -- the compiled command passes
# `--base`, never `--paths`. Deleting that function's whole body and returning [] once left this
# suite byte-identical, so the git subprocess, the three-dot merge-base form and the working
# directory it runs in were all unexercised.
#
# Identity is set REPO-LOCAL, never through subshell-scoped GIT_AUTHOR_* env: a clean CI runner
# with no global identity fails `git commit` with 128, which is green locally and red on CI.
_git_tree() {
  local t="$BATS_TEST_TMPDIR/gitdiff"
  mkdir -p "$t" || return 1
  git init -q "$t" || return 1
  git -C "$t" config user.email "fixture@arc.test" || return 1
  git -C "$t" config user.name "arc fixture" || return 1
  mkdir -p "$t/docs" || return 1
  printf 'seed\n' > "$t/docs/seed.md"
  git -C "$t" add -A >/dev/null || return 1
  git -C "$t" commit -qm seed >/dev/null || return 1
  git -C "$t" branch -M fixture-base >/dev/null 2>&1 || return 1
  git -C "$t" checkout -qb fixture-work >/dev/null 2>&1 || return 1
  mkdir -p "$t/processes" || return 1
  printf 'name: review-diff\n' > "$t/processes/review-diff.process.yaml"
  git -C "$t" add -A >/dev/null || return 1
  git -C "$t" commit -qm change >/dev/null || return 1
  # A fixture builder asserts its own fixture. An empty diff would make the assertions below pass
  # against a query derived from nothing.
  [ -n "$(git -C "$t" diff --name-only fixture-base...HEAD)" ] || return 1
  echo "$t"
}

@test "diff-recall: the hook is present at its contracted path" {
  [ -f "$HOOK" ]
}

@test "diff-recall: the query comes from GIT, in the tree --root names and not the one we stand in" {
  # No --paths anywhere: this is the code /arc-review runs, and the only test that goes red if the
  # subprocess is deleted.
  t="$(_git_tree)"
  [ -n "$t" ] || { echo "the git fixture was not built"; false; }
  run node "$HOOK" --root "$t" --base fixture-base --print-query
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ] || { echo "the git subprocess produced no query at all"; false; }
  # Derived from the CHANGED PATH, which nobody typed.
  [[ "$output" == *"processes"* ]]
  [[ "$output" == *"review"* ]]
  # ...and read from THAT repo. `execFileSync` used to inherit process.cwd() while the index came
  # from --root, so the diff and the corpus could be two different repositories at exit 0 with
  # nothing said. arc's own tree would put `scripts` and `claude` in this query; the fixture cannot.
  [[ "$output" != *"scripts"* ]]
  [[ "$output" != *"claude"* ]]
}

@test "diff-recall: a base git cannot resolve is exit 3, the WARN, never exit 2" {
  # An environmental condition -- a shallow CI checkout, a master-default repo, a fresh clone with
  # no local main -- arrived as exit 2, "bad usage": an error the review agent is told to FIX, in a
  # step ADR-0704 says must never be able to stop a review.
  t="$(_git_tree)"
  [ -n "$t" ] || { echo "the git fixture was not built"; false; }
  run node "$HOOK" --root "$t" --base does-not-exist-branch
  [ "$status" -eq 3 ] || { echo "expected exit 3, got $status"; echo "$output"; false; }
  [[ "$output" == *"never a block"* ]]
  # ...while a --root that does not exist stays exit 2. A typo must NOT be laundered into the one
  # code the caller is instructed to ignore, or recall goes silent and the review believes it ran.
  run node "$HOOK" --root "$BATS_TEST_TMPDIR/no-such-tree" --paths "processes/review-diff.process.yaml"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status"; echo "$output"; false; }
  [[ "$output" == *"does not exist"* ]]
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
  # SIX, computed rather than guessed: `a` and `b` are single characters and `mjs`/`yaml` are
  # declared noise, twice over across the two paths. The first version of this line asserted 2 and
  # was one of the two tests that never ran, so the wrong arithmetic hid behind a red fixture.
  [[ "$output" == *"path-structure tokens dropped: 6"* ]]
  [[ "$output" == *"-> 2 query term(s)"* ]]
  # THE TOKENS THEMSELVES, with the reason each one went. The previous assertion matched a STATIC
  # preview of PATH_NOISE labelled "extensions and the like" while `dropped` was computed, returned
  # and printed nowhere -- so on docs/adr/0705-....md the operator was told the ADR NUMBER was an
  # extension. A count with no list cannot tell anyone that the identifier they searched for is the
  # thing that got removed.
  [[ "$output" == *"single character: a, b"* ]]
  [[ "$output" == *"declared path noise: mjs, yaml"* ]]
  # ...and a pure number is its own reason, not folded into the extensions.
  run node "$HOOK" --root "$t" --paths "docs/adr/0705-mem-f-conflicts.md" --limit 3
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"pure number: 0705"* ]]
  [[ "$output" == *"declared path noise: md"* ]]
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
  # A value that is not empty but FILTERS to nothing named no path at all, and was answered with
  # "0 changed path(s) ... that is a result, not an error" -- a refusal reported as a measurement.
  run node "$HOOK" --paths ",,,"; [ "$status" -eq 2 ]
  [[ "$output" == *"names no path at all"* ]]
  # --print-query returns before both the --json branch and the search, so these two were ACCEPTED
  # AND INERT -- and --print-query --json printed bare text on stdout at exit 0, which this file's
  # own parseArgs comment calls what the --json contract forbids outright.
  run node "$HOOK" --paths "a/b.mjs" --print-query --json; [ "$status" -eq 2 ]
  [[ "$output" == *"silently done nothing"* ]]
  run node "$HOOK" --paths "a/b.mjs" --print-query --limit 3; [ "$status" -eq 2 ]
  [[ "$output" == *"silently done nothing"* ]]
  # ...and each of them alone is still perfectly legal, or the refusal above is just a broken flag.
  # A path that really derives terms: `a/b.mjs` is two single characters and a declared extension,
  # so it correctly derives NOTHING and would have proven the refusal by proving an empty query.
  run node "$HOOK" --paths "processes/review-diff.process.yaml" --print-query; [ "$status" -eq 0 ]
  [ -n "$output" ] || { echo "--print-query alone produced nothing"; false; }
  run node "$HOOK" --paths "processes/review-diff.process.yaml" --limit 3 --print-query; [ "$status" -eq 2 ]
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

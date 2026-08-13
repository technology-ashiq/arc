#!/usr/bin/env bats
# The embedded-program rule, enforced instead of remembered.
#
# CLAUDE.md: "A program embedded in a shell string carries no apostrophes and no single quotes,
# in code OR in comments -- enforced by a grep check inside the adversarial pass this cycle
# already requires, NEVER BY VIGILANCE, because this rule was written down and then broken three
# times anyway."
#
# It has now been broken five times. Twice the break landed inside the comment explaining a
# previous break. The check that sentence names had never been written, so the rule had exactly
# the enforcement it says does not work. This file is the enforcement.
#
# TWO NETS, because neither alone is enough:
#   bash -n  catches the common case, where the truncated remainder is invalid shell
#   the probe catches the case bash -n cannot see, and checks what FOLLOWS the closing quote
#            rather than only whether the region parses -- because `// this comment doesn` is a
#            valid JavaScript program, and the probe's own first draft passed a broken fixture
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/embedded-program-probe.mjs"; }
BROKEN() { echo "$ARC_ROOT/tests/fixtures/develop/embedded-program"; }

@test "every shell script under .claude/scripts parses as shell" {
  local bad=0 f
  while IFS= read -r -d '' f; do
    if ! bash -n "$f" 2>/dev/null; then
      echo "bash -n rejects: $f"
      bad=$((bad + 1))
    fi
  done < <(find "$ARC_ROOT/.claude/scripts" -name '*.sh' -type f -print0)
  [ "$bad" -eq 0 ] || { echo "$bad script(s) do not parse"; false; }
}

@test "every embedded program in .claude/scripts is whole" {
  run node "$(PROBE)" "$ARC_ROOT/.claude/scripts"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Assert it RAN before asserting what it printed: the marker is emitted only on the success
  # path, after the walk completes.
  [[ "$output" == *"EMBEDDED_PROGRAMS_INTACT"* ]] || { echo "the probe did not reach its end: $output"; false; }
  # And assert it actually FOUND programs. A probe that walked nothing would print zero failures
  # and be indistinguishable from a clean tree -- the vacuous pass this repo keeps paying for.
  [[ "$output" == *"programs="* ]] || { echo "$output"; false; }
  local n
  n="$(echo "$output" | sed -n 's/^programs=//p')"
  [ "$n" -ge 5 ] || { echo "the probe found only $n embedded program(s); it is not looking where it should"; false; }
}

@test "NEGATIVE CONTROL: the probe fails on an apostrophe inside an embedded comment" {
  # Without this the test above is satisfied by a probe that can never say no. The fixture is
  # generated from a code point rather than typed, because the first hand-written attempt left
  # the apostrophe OUT and produced a control that could not exhibit its own defect.
  run node "$(PROBE)" "$(BROKEN)"
  [ "$status" -eq 1 ] || { echo "the probe did not reject the broken fixture: status=$status out=$output"; false; }
  [[ "$output" == *"closed early, mid-word"* ]] || { echo "wrong reason: $output"; false; }
  [[ "$output" != *"EMBEDDED_PROGRAMS_INTACT"* ]] || { echo "the probe claimed the tree was intact AND failed"; false; }
}

@test "NEGATIVE CONTROL: the broken fixture really does carry an apostrophe" {
  # The control needs its own control. A fixture silently rewritten -- by a linter, by a merge,
  # by an editor stripping the character -- would make the test above pass for the wrong reason
  # or fail confusingly, and nothing else in this file would notice.
  local f apos
  f="$(BROKEN)/apostrophe-in-comment.sh"
  [ -f "$f" ] || { echo "missing: $f"; false; }
  [ -s "$f" ] || { echo "empty: $f"; false; }
  # THE APOSTROPHE IS BUILT, NEVER TYPED. Written literally, the escape idiom needed to get one
  # inside a double-quoted string in a @test body defeated bats own preprocessor: it reported
  # `unexpected EOF while looking for matching "` and the whole FILE failed to gather, which took
  # its entire shard down with it -- 2434 declared tests never executed. printf and an octal
  # code point have no such problem, in this file or in any tool that reads it.
  apos="$(printf '\047')"
  run grep -cF "doesn${apos}t" "$f"
  [ "$status" -eq 0 ] || { echo "the fixture no longer carries the apostrophe it exists for"; false; }
}

@test "every bats file in tests/ survives a shell parse, the way gather reads it" {
  # A .bats file that bats cannot GATHER takes its whole shard with it. One unbalanced quote in
  # this very file produced `unexpected EOF while looking for matching "` and the reconcile step
  # reported 2434 declared tests never executed -- the entire shard, silent except for one line.
  # bats itself catches it, but only on CI and only after a full matrix; this catches it here.
  #
  # `@test NAME {` is not valid bash, so each declaration is rewritten to a plain function header
  # before parsing. That is what bats does too, and it is the only transformation applied.
  local bad=0 f
  for f in "$ARC_ROOT"/tests/*.bats; do
    if ! sed 's/^@test .*{$/__t() {/' "$f" | bash -n 2>/dev/null; then
      echo "does not parse as shell: $f"
      bad=$((bad + 1))
    fi
  done
  [ "$bad" -eq 0 ] || { echo "$bad bats file(s) would fail to gather"; false; }
}

@test "this file registers every test it declares" {
  local n
  n="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$n" -eq 6 ] || { echo "declared $n tests, expected 6 - a test was added or silently dropped"; false; }
}

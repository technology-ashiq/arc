#!/usr/bin/env bats
#
# council-lint / council-calibrate -- `## OUTCOME` section detection is line-anchored.
#
# model-policy Cycle 5, Phase 01 (REQ-04). Found by constructing a breaking input, not by
# review: appending a calibration retrofit note to session 001 made council-lint FAIL on a
# file that was correct. The note explains the append-only contract and therefore mentions
# `## OUTCOME` inline, in prose, inside a blockquote -- and the section regex was
# `/##\s*OUTCOME.../gi`, unanchored, so it read that mention as a real heading. The phantom
# section had no RESULT line, so the gate rejected a valid session for documenting the very
# contract it enforces.
#
# Two scripts carried the identical regex. council-calibrate.mjs survived only by accident:
# it reads the LAST section, so a phantom BEFORE the real outcome was skipped -- and a
# phantom AFTER it would have been a hard MALFORMED error. Both are anchored now.
#
# The fix is `(?:^|\n)##` and NOT the `/m` flag. The lookahead `(?=\n##\s|$)` uses `$` as
# end-of-STRING; under /m that silently becomes end-of-LINE and truncates every section at
# its first newline, so RESULT would go missing for a different reason. That exact swap is a
# recurring bug class in this repo (retro-log 2026-07-16, "`$` under /m as end-of-string").
# Test 4 pins it: a multi-line outcome must survive intact.
#
# The real session file is the fixture baseline on purpose -- a hand-written minimal verdict
# could pass for reasons unrelated to anchoring. Test 3 is the negative control: a stated
# control is not a control until something proves it can fail (retro-log 2026-08-02).
#
# Every @test name here is ASCII-only: em-dashed names once made windows shards report
# tests that existed, were counted, and never ran.

bats_require_minimum_version 1.5.0

load 'test_helper'

setup() {
  LINT="$ARC_ROOT/.claude/scripts/council/council-lint.mjs"
  SESSION="$ARC_ROOT/docs/council/sessions/001-ai-writing-assistant-trains-on-user-docs.md"
  WORK="$BATS_TEST_TMPDIR/sessions"
  mkdir -p "$WORK"
}

@test "council-lint: a session that mentions the OUTCOME heading inline still passes" {
  # The shipped session 001 carries a retrofit note quoting `## OUTCOME` in prose.
  # Unanchored, this file fails. Anchored, it passes.
  run node "$LINT" --verdict "$SESSION"
  [ "$status" -eq 0 ]
}

@test "council-lint: an inline OUTCOME mention AFTER the real outcome does not create a section" {
  cp "$SESSION" "$WORK/trailing.md"
  printf '\nA later note referring to `## OUTCOME` in prose, with no RESULT line.\n' >> "$WORK/trailing.md"
  run node "$LINT" --verdict "$WORK/trailing.md"
  [ "$status" -eq 0 ]
}

@test "council-lint: negative control - a real OUTCOME with free-text RESULT is still rejected" {
  # Proves the check can fail. Without this, tests 1 and 2 pass on a gate that accepts anything.
  sed 's/^RESULT: UNRESOLVED$/RESULT: probably fine/' "$SESSION" > "$WORK/freetext.md"
  run node "$LINT" --verdict "$WORK/freetext.md"
  [ "$status" -ne 0 ]
  [[ "$output" == *"RESULT"* ]]
}

@test "council-lint: a multi-line OUTCOME section is not truncated at its first newline" {
  # Guards the /m regression: if the lookahead's end-of-string anchor is retargeted to
  # end-of-line, the section stops before RESULT and this file starts failing.
  cp "$SESSION" "$WORK/multiline.md"
  run node "$LINT" --verdict "$WORK/multiline.md"
  [ "$status" -eq 0 ]
  # The shipped outcome has prose on several lines after RESULT; it must still be seen whole.
  run grep -c '^RESULT: UNRESOLVED$' "$WORK/multiline.md"
  [ "$output" -eq 1 ]
}

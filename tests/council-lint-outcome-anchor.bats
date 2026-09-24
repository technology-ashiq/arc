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


# ADR-1345 (face v2 Phase 06): /arc-council wrote {decision, confidence, session}, which the spine's CLOSED
# council.verdict shape rejects -- no council had ever landed the receipt calibration reads. The payload is now DERIVED
# from the saved verdict by council-lint --payload. RED on the old shape (BAD_COUNCIL), green on every saved session.
@test "council-lint --payload: every saved verdict derives a council.verdict the closed shape accepts, the old one is BAD_COUNCIL" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT/events"
  local n=0 f payload
  for f in "$ARC_ROOT"/docs/council/sessions/*.md; do
    run node "$LINT" --payload "$f" --sessions-dir "$ARC_ROOT/docs/council/sessions"
    [ "$status" -eq 0 ] || { echo "derive $f: $output"; false; }
    payload="$output"
    [[ "$payload" == *'"session_id":"c-'* ]] && [[ "$payload" == *'"call":"'* ]] || { echo "shape $f: $payload"; false; }
    run node "$ARC_ROOT/.claude/scripts/hq/arc-event.mjs" emit council.verdict --payload "$payload" --strict --dry-run
    [ "$status" -eq 0 ] || { echo "validate $f: $output"; false; }
    n=$((n + 1))
  done
  [ "$n" -ge 2 ] || { echo "only $n saved sessions were derived"; false; }
  # NEGATIVE CONTROL: the payload the command used to write is refused by the same validator.
  run node "$ARC_ROOT/.claude/scripts/hq/arc-event.mjs" emit council.verdict --payload '{"decision":"YES","confidence":"Medium","session":"001-x"}' --strict --dry-run
  [ "$status" -ne 0 ] && [[ "$output" == *"BAD_COUNCIL"* ]] || { echo "old shape: $status $output"; false; }
  ! grep -q '"decision":"<YES' "$ARC_ROOT/.claude/commands/arc-council.md"
}

# The seam the command actually crosses: step 9's OWN two lines, run through bash and the .sh wrapper, with the slug
# substituted -- once for a real saved session (the event must land and read back), once for a session that does not
# exist (nothing lands, the step exits non-zero). Attack eaa9168 B1/B12: the derivation passing proves nothing about the
# `$(...)` composition, and an ungated emit ran with an empty payload and exited 0.
@test "council step 9: the command's own lines emit the derived receipt, and a refused derivation emits nothing" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine9"
  mkdir -p "$ARC_SPINE_ROOT/events"
  local step
  step="$(grep -E '^   (payload="\$\(node \.claude/scripts/council/council-lint\.mjs --payload|bash \.claude/scripts/hq/arc-event\.sh emit council\.verdict --payload "\$payload")' "$ARC_ROOT/.claude/commands/arc-council.md" | sed 's/^   //')"
  [ "$(printf '%s\n' "$step" | grep -c .)" -eq 2 ] || { echo "step 9 is not the two gated lines: $step"; false; }
  printf '%s\n' "$step" | sed 's/NNN-slug/001-ai-writing-assistant-trains-on-user-docs/' > "$BATS_TEST_TMPDIR/step9-ok.sh"
  cd "$ARC_ROOT"
  run bash "$BATS_TEST_TMPDIR/step9-ok.sh"
  [ "$status" -eq 0 ] || { echo "step 9 on a real session: $status $output"; false; }
  run grep -rh '"kind":"council.verdict"' "$ARC_SPINE_ROOT/events"
  [[ "$output" == *'"session_id":"c-001-ai-writing-assistant-trains-on-user-docs"'* ]] && [[ "$output" == *'"call":"proceed"'* ]] || { echo "no receipt read back: $output"; false; }
  printf '%s\n' "$step" | sed 's/NNN-slug/no-such-session/' > "$BATS_TEST_TMPDIR/step9-bad.sh"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine9-bad"
  mkdir -p "$ARC_SPINE_ROOT/events"
  run bash "$BATS_TEST_TMPDIR/step9-bad.sh"
  [ "$status" -ne 0 ] && [[ "$output" == *"council.verdict NOT emitted"* ]] || { echo "a refused derivation: $status $output"; false; }
  run grep -rc 'council.verdict' "$ARC_SPINE_ROOT/events"
  [[ "$output" != *":1"* ]] || { echo "a receipt landed for a refused derivation: $output"; false; }
}

@test "council-lint --payload: the call maps YES and CONDITIONAL to proceed, NO and WAIT to hold; a verdict missing its core is refused" {
  local d
  for d in YES CONDITIONAL NO WAIT; do
    sed "s/^DECISION: .*$/DECISION: $d/" "$SESSION" > "$WORK/map-$d.md"
    run grep -c "^DECISION: $d$" "$WORK/map-$d.md"
    [ "$output" -eq 1 ] || { echo "fixture for $d did not take"; false; }
    run node "$LINT" --payload "$WORK/map-$d.md" --sessions-dir "$WORK"
    [ "$status" -eq 0 ] || { echo "$d: $output"; false; }
    case "$d" in
      YES|CONDITIONAL) [[ "$output" == *'"call":"proceed"'* ]] || { echo "$d: $output"; false; } ;;
      *) [[ "$output" == *'"call":"hold"'* ]] || { echo "$d: $output"; false; } ;;
    esac
  done
  grep -v '^DECISION:' "$SESSION" > "$WORK/no-decision.md"
  run node "$LINT" --payload "$WORK/no-decision.md" --sessions-dir "$WORK"
  [ "$status" -eq 1 ] && [[ "$output" == *"DECISION"* ]] || { echo "no decision: $status $output"; false; }
}

@test "council-lint --payload: usage, containment, encoding and date are refused by name, never a fall-through" {
  # Usage: an empty value, the = form, a repeat, and a second mode are exit 2 -- never another mode's exit 0 (B3/B4).
  run node "$LINT" --payload ""
  [ "$status" -eq 2 ] || { echo "empty: $status $output"; false; }
  run node "$LINT" --payload="$SESSION"
  [ "$status" -eq 2 ] || { echo "= form: $status $output"; false; }
  run node "$LINT" --payload "$SESSION" --payload "$SESSION"
  [ "$status" -eq 2 ] || { echo "repeat: $status $output"; false; }
  run node "$LINT" --payload "$SESSION" --verdict "$SESSION"
  [ "$status" -eq 2 ] && [[ "$output" != *'"session_id"'* ]] || { echo "with --verdict: $status $output"; false; }
  # Containment: a well-formed verdict OUTSIDE the sessions directory is not a saved session (B5).
  cp "$SESSION" "$WORK/outside.md"
  run node "$LINT" --payload "$WORK/outside.md" --sessions-dir "$ARC_ROOT/docs/council/sessions"
  [ "$status" -eq 1 ] && [[ "$output" == *"not a saved session"* ]] || { echo "outside: $status $output"; false; }
  # A directory is refused by name, never a stack (B2).
  run node "$LINT" --payload "$WORK" --sessions-dir "$BATS_TEST_TMPDIR"
  [ "$status" -eq 1 ] && [[ "$output" != *"    at "* ]] || { echo "dir: $status $output"; false; }
  # Encoding: a BOM is stripped; invalid UTF-8 is refused (B7).
  { printf '\357\273\277'; cat "$SESSION"; } > "$WORK/bom.md"
  run node "$LINT" --payload "$WORK/bom.md" --sessions-dir "$WORK"
  [ "$status" -eq 0 ] || { echo "bom: $status $output"; false; }
  { cat "$SESSION"; printf 'bad byte \377\n'; } > "$WORK/badutf.md"
  run node "$LINT" --payload "$WORK/badutf.md" --sessions-dir "$WORK"
  [ "$status" -eq 1 ] && [[ "$output" == *"UTF-8"* ]] || { echo "bad utf8: $status $output"; false; }
  # A heading date that is no real day is refused, as --verdict would refuse it (B11).
  sed 's/^\(# arc-council — .*\) ([0-9-]*)$/\1 (2026-02-31)/' "$SESSION" > "$WORK/badday.md"
  run grep -c '(2026-02-31)$' "$WORK/badday.md"
  [ "$output" -eq 1 ] || { echo "the bad-day fixture did not take"; false; }
  run node "$LINT" --payload "$WORK/badday.md" --sessions-dir "$WORK"
  [ "$status" -eq 1 ] && [[ "$output" == *"not a real day"* ]] || { echo "bad day: $status $output"; false; }
}

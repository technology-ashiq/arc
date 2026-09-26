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
  cd "$ARC_ROOT"
  local n=0 f payload
  for f in docs/council/sessions/*.md; do
    run node "$LINT" --payload "$f"
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

# The seam the command actually crosses: step 9's OWN block, run through bash and the .sh wrapper with the slug
# substituted -- for a real saved session (exactly one receipt lands and reads back), for a session that does not
# exist (nothing lands, non-zero), and for an emitter that writes nothing (non-zero, never a silent exit 0). Attacks
# eaa9168 B1/B12 and 1d98650 B8.
@test "council step 9: the command's own block lands exactly one receipt, and a refusal or a silent emitter stops it" {
  local step
  step="$(awk '/^9\. \*\*Leave the receipt/{f=1} f&&/^   ```bash/{g=1;next} g&&/^   ```/{exit} g{sub(/^   /,""); print}' "$ARC_ROOT/.claude/commands/arc-council.md")"
  [ "$(printf '%s\n' "$step" | grep -c .)" -eq 3 ] || { echo "step 9 is not the three gated lines: $step"; false; }
  printf '%s\n' "$step" | sed 's/NNN-slug/001-ai-writing-assistant-trains-on-user-docs/' > "$BATS_TEST_TMPDIR/step9-ok.sh"
  printf '%s\n' "$step" | sed 's/NNN-slug/no-such-session/' > "$BATS_TEST_TMPDIR/step9-bad.sh"
  cd "$ARC_ROOT"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine9"
  mkdir -p "$ARC_SPINE_ROOT/events"
  run bash "$BATS_TEST_TMPDIR/step9-ok.sh"
  [ "$status" -eq 0 ] || { echo "step 9 on a real session: $status $output"; false; }
  run bash -c "cat \"\$ARC_SPINE_ROOT\"/events/*.jsonl | grep -c '\"kind\":\"council.verdict\"'"
  [ "$output" = "1" ] || { echo "expected exactly one council.verdict, got: $output"; false; }
  run bash -c "cat \"\$ARC_SPINE_ROOT\"/events/*.jsonl"
  [[ "$output" == *'"session_id":"c-001-ai-writing-assistant-trains-on-user-docs"'* ]] && [[ "$output" == *'"call":"proceed"'* ]] || { echo "receipt: $output"; false; }
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine9-bad"
  mkdir -p "$ARC_SPINE_ROOT/events"
  run bash "$BATS_TEST_TMPDIR/step9-bad.sh"
  [ "$status" -ne 0 ] && [[ "$output" == *"council.verdict NOT emitted"* ]] || { echo "a refused derivation: $status $output"; false; }
  run bash -c "cat \"\$ARC_SPINE_ROOT\"/events/*.jsonl 2>/dev/null | grep -c council.verdict"
  [ "$output" = "0" ] || { echo "a receipt landed for a refused derivation: $output"; false; }
  # An emitter that writes nothing (its spine is not a directory) exits 0 in hook mode: the step must not.
  printf 'x' > "$BATS_TEST_TMPDIR/not-a-dir"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/not-a-dir"
  run bash "$BATS_TEST_TMPDIR/step9-ok.sh"
  [ "$status" -ne 0 ] && [[ "$output" == *"council.verdict NOT recorded"* ]] || { echo "a silent emitter: $status $output"; false; }
}

# Fixtures live in a fixture REPO passed as the root: the fence is <root>/docs/council/sessions, never a flag (B1).
fixture_repo() {
  FIX="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$FIX/docs/council/sessions"
  FS="$FIX/docs/council/sessions"
}

@test "council-lint --payload: the call maps YES and CONDITIONAL to proceed, NO and WAIT to hold; a verdict missing its core is refused" {
  fixture_repo
  local d
  for d in YES CONDITIONAL NO WAIT; do
    sed "s/^DECISION: .*$/DECISION: $d/" "$SESSION" > "$FS/map-$d.md"
    run grep -c "^DECISION: $d$" "$FS/map-$d.md"
    [ "$output" -eq 1 ] || { echo "fixture for $d did not take"; false; }
    run node "$LINT" "$FIX" --payload "$FS/map-$d.md"
    [ "$status" -eq 0 ] || { echo "$d: $output"; false; }
    case "$d" in
      YES|CONDITIONAL) [[ "$output" == *'"call":"proceed"'* ]] || { echo "$d: $output"; false; } ;;
      *) [[ "$output" == *'"call":"hold"'* ]] || { echo "$d: $output"; false; } ;;
    esac
  done
  grep -v '^DECISION:' "$SESSION" > "$FS/no-decision.md"
  run node "$LINT" "$FIX" --payload "$FS/no-decision.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"0 filled DECISION"* ]] || { echo "no decision: $status $output"; false; }
  { cat "$SESSION"; printf 'DECISION: NO\n'; } > "$FS/two-decisions.md"
  run node "$LINT" "$FIX" --payload "$FS/two-decisions.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"2 filled DECISION"* ]] || { echo "two decisions: $status $output"; false; }
  grep -v '^CONFIDENCE:' "$SESSION" > "$FS/no-confidence.md"
  run node "$LINT" "$FIX" --payload "$FS/no-confidence.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"0 filled CONFIDENCE"* ]] || { echo "no confidence: $status $output"; false; }
  # A value on the NEXT line is an unfilled line, not a call (1d98650 B6).
  sed 's/^DECISION: .*$/DECISION:/' "$SESSION" | awk '{ print } /^DECISION:$/ { print "WAIT" }' > "$FS/split-line.md"
  run node "$LINT" "$FIX" --payload "$FS/split-line.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"0 filled DECISION"* ]] || { echo "split line: $status $output"; false; }
}

@test "council-lint --payload: usage, containment, encoding, size and date are refused by name, never a fall-through" {
  fixture_repo
  # Usage (exit 2, each by its own words): empty value, the = form, a repeat, a second mode, a stray token (B3/B4).
  run node "$LINT" --payload ""
  [ "$status" -eq 2 ] && [[ "$output" == *"needs the saved verdict's path"* ]] || { echo "empty: $status $output"; false; }
  run node "$LINT" --payload="$SESSION"
  [ "$status" -eq 2 ] && [[ "$output" == *"not --payload=FILE"* ]] || { echo "= form: $status $output"; false; }
  run node "$LINT" --payload "$SESSION" --payload "$SESSION"
  [ "$status" -eq 2 ] && [[ "$output" == *"more than once"* ]] || { echo "repeat: $status $output"; false; }
  run node "$LINT" --payload "$SESSION" --brief "$SESSION"
  [ "$status" -eq 2 ] && [[ "$output" == *"takes no other flag"* ]] || { echo "with --brief: $status $output"; false; }
  run node "$LINT" --payload "$SESSION" --sessions-dir "$FS"
  [ "$status" -eq 2 ] && [[ "$output" == *"takes no other flag"* ]] || { echo "a caller-set fence: $status $output"; false; }
  run node "$LINT" "$FIX" junk --payload "$SESSION"
  [ "$status" -eq 2 ] && [[ "$output" == *"one repo root at most"* ]] || { echo "stray: $status $output"; false; }
  # Paths that reach out or hide: UNC, NTFS stream, control character (exit 2, by name).
  run node "$LINT" --payload "//host/share/001-x.md"
  [ "$status" -eq 2 ] && [[ "$output" == *"UNC, device or stream"* ]] || { echo "unc: $status $output"; false; }
  run node "$LINT" --payload "docs/council/sessions/001-x.md:stream"
  [ "$status" -eq 2 ] && [[ "$output" == *"UNC, device or stream"* ]] || { echo "stream: $status $output"; false; }
  run node "$LINT" --payload "$(printf 'docs/x\001.md')"
  [ "$status" -eq 2 ] && [[ "$output" == *"control character"* ]] || { echo "control: $status $output"; false; }
  # Containment: a well-formed verdict outside the repo's sessions directory is not a saved session (B5).
  cp "$SESSION" "$BATS_TEST_TMPDIR/outside.md"
  run node "$LINT" "$FIX" --payload "$BATS_TEST_TMPDIR/outside.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"not a saved session"* ]] || { echo "outside: $status $output"; false; }
  # A directory named like a verdict is refused by name, never a stack (B2).
  mkdir -p "$FS/dir.md"
  run node "$LINT" "$FIX" --payload "$FS/dir.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"not a plain file"* ]] && [[ "$output" != *"    at "* ]] || { echo "dir: $status $output"; false; }
  # Size: one byte past 1 MiB is refused.
  { cat "$SESSION"; head -c 1048577 /dev/zero | tr '\0' 'x'; } > "$FS/huge.md"
  run node "$LINT" "$FIX" --payload "$FS/huge.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"past the 1 MiB"* ]] || { echo "huge: $status $output"; false; }
  # Encoding: a BOM is stripped; invalid UTF-8 is refused (B7).
  { printf '\357\273\277'; cat "$SESSION"; } > "$FS/bom.md"
  run node "$LINT" "$FIX" --payload "$FS/bom.md"
  [ "$status" -eq 0 ] || { echo "bom: $status $output"; false; }
  { cat "$SESSION"; printf 'bad byte \377\n'; } > "$FS/badutf.md"
  run node "$LINT" "$FIX" --payload "$FS/badutf.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"UTF-8"* ]] || { echo "bad utf8: $status $output"; false; }
  # A heading date that is no real day, and a heading with no question in it (B11, B12).
  sed 's/^\(# arc-council — .*\) ([0-9-]*)$/\1 (2026-02-31)/' "$SESSION" > "$FS/badday.md"
  run grep -c '(2026-02-31)$' "$FS/badday.md"
  [ "$output" -eq 1 ] || { echo "the bad-day fixture did not take"; false; }
  run node "$LINT" "$FIX" --payload "$FS/badday.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"not a real day"* ]] || { echo "bad day: $status $output"; false; }
  sed 's/^# arc-council — .* (\([0-9-]*\))$/# arc-council —    (\1)/' "$SESSION" > "$FS/noquestion.md"
  run node "$LINT" "$FIX" --payload "$FS/noquestion.md"
  [ "$status" -eq 1 ] && [[ "$output" == *"no question"* ]] || { echo "no question: $status $output"; false; }
  # Only the lowercase .md the command writes (B13).
  cp "$SESSION" "$FS/upper.MD"
  run node "$LINT" "$FIX" --payload "$FS/upper.MD"
  [ "$status" -eq 1 ] && [[ "$output" == *"lowercase .md"* ]] || { echo "upper ext: $status $output"; false; }
}

@test "council-lint --claim: each number goes to one claim, whatever the slugs, from the working directory by default" {
  local R="$BATS_TEST_TMPDIR/claimroot" S
  S="$R/docs/council/sessions"
  mkdir -p "$S"
  : > "$S/001-a.md"; : > "$S/007-b.md"
  # No root argument: the form the process body prescribes, run from the repo (attack 1be4183 B8).
  run bash -c 'cd "$1" && node "$2" --claim my-question' _ "$R" "$LINT"
  [ "$status" -eq 0 ] && [ "$output" = "docs/council/sessions/008-my-question.md" ] || { echo "first claim: $status $output"; false; }
  [ -f "$S/008-my-question.md" ] || { echo "the claim printed a path it never created"; false; }
  [ -d "$R/.claude/state/council-claims/008" ] || { echo "the number was not taken as a lock"; false; }
  # Six claims at once with SIX DIFFERENT slugs: six different numbers (attack 66a26f0 B2, 1be4183 B3).
  local i
  for i in 1 2 3 4 5 6; do node "$LINT" --claim "q$i" "$R" > "$BATS_TEST_TMPDIR/c$i.out" 2>&1 & done
  wait
  local nums
  nums=$(cat "$BATS_TEST_TMPDIR"/c?.out | sed -n 's#^docs/council/sessions/\([0-9][0-9][0-9]\)-q[1-6]\.md$#\1#p' | sort -u | wc -l | tr -d ' ')
  [ "$nums" = "6" ] || { echo "six claims did not take six numbers: $(cat "$BATS_TEST_TMPDIR"/c?.out)"; false; }
  [ "$(ls "$S" | grep -c -- '-q[1-6]\.md$')" = "6" ] || { echo "six claims did not leave six files: $(ls "$S")"; false; }
  # A claim nothing filled carries no DECISION, so it can never become a receipt.
  run node "$LINT" --payload "$S/008-my-question.md" "$R"
  [ "$status" -eq 1 ] && [[ "$output" == *"0 filled DECISION"* ]] || { echo "a bare claim derived a payload: $status $output"; false; }
  # Usage is refused by name: a slug outside the class, two modes, a stray flag.
  run node "$LINT" --claim "Bad Slug" "$R"
  [ "$status" -eq 2 ] && [[ "$output" == *"needs a slug"* ]] || { echo "bad slug: $status $output"; false; }
  run node "$LINT" --claim x --payload y "$R"
  [ "$status" -eq 2 ] && [[ "$output" == *"separate runs"* ]] || { echo "two modes: $status $output"; false; }
  run node "$LINT" --claim x --verdict y "$R"
  [ "$status" -eq 2 ] && [[ "$output" == *"no other flag"* ]] || { echo "stray flag: $status $output"; false; }
}

@test "council-lint --release gives back an unfilled claim and never a verdict; --payload refuses a verdict carrying a secret" {
  local R="$BATS_TEST_TMPDIR/relroot" S
  S="$R/docs/council/sessions"
  mkdir -p "$S"
  run node "$LINT" --claim failed-run "$R"
  [ "$status" -eq 0 ] && [ -f "$R/$output" ] || { echo "claim: $status $output"; false; }
  local claimed="$output"
  run bash -c 'cd "$1" && node "$2" --release "$3"' _ "$R" "$LINT" "$claimed"
  [ "$status" -eq 0 ] && [[ "$output" == "released $claimed" ]] || { echo "release: $status $output"; false; }
  [ ! -e "$R/$claimed" ] || { echo "release said released and left the file"; false; }
  # A real verdict is never released, however it is asked (1be4183 B4).
  cp "$SESSION" "$S/002-kept.md"
  run node "$LINT" --release docs/council/sessions/002-kept.md "$R"
  [ "$status" -eq 1 ] && [[ "$output" == *"never released"* ]] && [ -f "$S/002-kept.md" ] || { echo "a verdict was released: $status $output"; false; }
  run node "$LINT" --release ../../etc/passwd "$R"
  [ "$status" -eq 2 ] || { echo "release took a path outside the sessions directory: $status $output"; false; }
  # Control first: the unmodified verdict derives. Then the same verdict carrying a key derives nothing (1be4183 B2).
  run node "$LINT" --payload "$S/002-kept.md" "$R"
  [ "$status" -eq 0 ] && [[ "$output" == *'"session_id":"c-002-kept"'* ]] || { echo "control did not derive: $status $output"; false; }
  local key="AKIA""IOSFODNN7EXAMPLF"
  printf '\nA note that quotes %s by mistake.\n' "$key" >> "$S/002-kept.md"
  run node "$LINT" --payload "$S/002-kept.md" "$R"
  [ "$status" -eq 1 ] && [[ "$output" == *"secret rule"* ]] && [[ "$output" != *"$key"* ]] || { echo "a verdict carrying a key derived, or echoed it: $status $output"; false; }
}

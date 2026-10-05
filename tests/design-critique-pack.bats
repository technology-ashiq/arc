#!/usr/bin/env bats
# Phase 03 S2 -- the critic gets the pack, and every viewport (ADR-1405; moved from Phase 01 on
# 2026-09-17). A critique begun with --brief records its brief and viewports; finish then REFUSES a
# BELOW-BAR that cites no screen of that brief's pack, and a declared viewport with no section in the
# artifact cannot PASS. Without the run record, finish judges exactly as before.
# The render loop of `begin --brief` needs a browser and is proved by the Phase 03 live run (S5);
# its argument refusals are held here.
bats_require_minimum_version 1.5.0
load 'test_helper'

TARGET="docs/design/explore/cx/variant-a/index.html"
SLUG="docs--design--explore--cx--variant-a--index-html"
teardown() { _arc_teardown 2>/dev/null || true; }

_crit() { echo "$SANDBOX/.claude/scripts/design/design-critique.sh"; }
_run_file() { echo "$SANDBOX/.claude/state/design/renders/design-critic/$SLUG.run"; }

# A pack for brief bx with one real row, and a run record for two viewports.
_pack_run() {
  _arc_design_sandbox
  mkdir -p docs/design/refpacks/bx .claude/state/design/renders/design-critic
  PACK_SHA="$(printf 'a%.0s' $(seq 1 16))$(printf 'b%.0s' $(seq 1 48))"
  printf '| url | fetched | sha256 | source | adaptable principle | avoid this |\n|---|---|---|---|---|---|\n| https://x/1.png | 2026-09-27T00:00:00Z | %s | nicelydone | p | a |\n' "$PACK_SHA" > docs/design/refpacks/bx/sources.md
  printf 'brief=docs/design/briefs/bx/brief.md\nbrief_id=bx\nviewports=1440x900 390x844\n' > "$(_run_file)"
  [ -f "$(_run_file)" ] && grep -q "$PACK_SHA" docs/design/refpacks/bx/sources.md || { echo "fixture not built"; return 1; }
}

# An artifact with the given viewport sections, each holding the given finding lines.
# Usage: _art "<vp> <vp>" "<finding>" ...
_art() {
  local vps="$1" vp line; shift
  mkdir -p "$SANDBOX/docs/design/critique"
  {
    printf '%s\n\n' "# Design critique -- $TARGET"
    printf '%s\n' "- target: \`$TARGET\`" "- screenshot_sha256: \`abc123\`" "- brief: \`docs/design/briefs/bx/brief.md\`"
    printf '\n## What I looked at\nthe variant at each viewport\n\n## Findings\n'
    for vp in $vps; do
      printf '\n## Viewport %s\n\n' "$vp"
      if [ "$#" -eq 0 ]; then printf '%s\n' "Nothing to report at this viewport."; fi
      for line in "$@"; do printf '%s\n' "- $line"; done
    done
    printf '\n## What is working\nthe type scale\n'
  } > "$SANDBOX/docs/design/critique/2026-09-27-$SLUG.md"
}

@test "critique pack: a BELOW-BAR citing a screen of the pack is an anchored FAIL" {
  _pack_run
  _art "1440x900 390x844" "BELOW-BAR: no focal point -- the list and the detail weigh the same -- pack:${PACK_SHA:0:16}"
  run --separate-stderr bash "$(_crit)" finish "$TARGET"
  [ "$status" -eq 0 ] || { echo "an anchored BELOW-BAR was refused: $status $output $stderr"; false; }
  [[ "$output" == *"FAIL"* ]] && [[ "$output" == *"below-bar:  2"* ]] || { echo "not a FAIL counting both sections: $output"; false; }
  [[ "$output" != *"unjudged"* ]] || { echo "a judged viewport was reported unjudged: $output"; false; }
  [ ! -e "$(_run_file)" ] || { echo "the run record outlived its verdict"; false; }
}

@test "critique pack: a BELOW-BAR with no pack citation is REFUSED, not judged" {
  _pack_run
  _art "1440x900 390x844" "BELOW-BAR: feels generic -- everywhere"
  run --separate-stderr bash "$(_crit)" finish "$TARGET"
  [ "$status" -eq 1 ] || { echo "an unanchored BELOW-BAR was judged: $status $output"; false; }
  [[ "$stderr" == *"not anchored to the pack"* ]] && [[ "$stderr" == *"no pack screen cited"* ]] || { echo "refused, but not for the anchor: $stderr"; false; }
  [ -e "$(_run_file)" ] || { echo "a refusal dropped the run record, so the fixed critique could not be re-finished"; false; }
  run node "$SANDBOX/.claude/scripts/hq/spine.mjs" read --kind review.completed
  [[ "$output" != *"$TARGET"* ]] || { echo "a refused critique left a verdict receipt: $output"; false; }
}

@test "critique pack: a citation of a screen that is not in the pack is REFUSED" {
  _pack_run
  _art "1440x900 390x844" "BELOW-BAR: the rail is timid -- left edge -- pack:0123456789abcdef"
  run --separate-stderr bash "$(_crit)" finish "$TARGET"
  [ "$status" -eq 1 ] && [[ "$stderr" == *"pack:0123456789abcdef is not a screen in bx"* ]] || { echo "a foreign citation was accepted: $status $stderr"; false; }
}

@test "critique pack: a declared viewport with no section cannot PASS, even with zero findings" {
  _pack_run
  _art "1440x900"
  run bash "$(_crit)" finish "$TARGET"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL"* ]] && [[ "$output" == *"unjudged:   390x844"* ]] || { echo "an unjudged viewport passed: $output"; false; }
  run bash "$SANDBOX/.claude/scripts/core/review-ledger.sh" check design
  [ "$status" -ne 0 ] || { echo "an unjudged viewport stamped the ledger"; false; }
}

@test "critique pack: every viewport judged with nothing below the bar is PASS -- the control" {
  _pack_run
  _art "1440x900 390x844" "WEAKNESS: the footer is cramped -- bottom"
  run bash "$(_crit)" finish "$TARGET"
  [ "$status" -eq 0 ] && [[ "$output" == *"PASS"* ]] || { echo "a fully judged clean critique did not PASS: $output"; false; }
}

@test "critique pack: with no run record, finish judges as before -- an uncited BELOW-BAR is a plain FAIL" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123" "BELOW-BAR: no focal point -- everywhere"
  [ ! -e "$(_run_file)" ] || { echo "fixture: a run record exists"; false; }
  run bash "$(_crit)" finish "$TARGET"
  [ "$status" -eq 0 ] && [[ "$output" == *"FAIL"* ]] || { echo "the pre-S2 path changed: $status $output"; false; }
}

@test "critique pack: begin --brief refuses an explicit --viewport, a brief outside docs/design/briefs, and extra args" {
  _arc_design_sandbox
  run bash "$(_crit)" begin "$TARGET" --brief docs/design/briefs/bx/brief.md --viewport 390x844
  [ "$status" -eq 1 ] && [[ "$output" == *"derives the viewport set"* ]] || { echo "--viewport beside --brief was accepted: $status $output"; false; }
  run bash "$(_crit)" begin "$TARGET" --brief ../elsewhere/brief.md
  [ "$status" -eq 1 ] && [[ "$output" == *"docs/design/briefs/<id>/brief.md"* ]] || { echo "a brief outside the briefs dir was accepted: $status $output"; false; }
  run bash "$(_crit)" begin "$TARGET" --brief docs/design/briefs/nosuch/brief.md
  [ "$status" -eq 1 ] && [[ "$output" == *"no brief at"* ]] || { echo "a missing brief was accepted: $status $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 8 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 8 -- a @test was silently dropped"
    false
  }
}

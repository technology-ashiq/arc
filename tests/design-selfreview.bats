#!/usr/bin/env bats
# Cycle 16 Phase 01 (REQ-02b) -- the self-review manifest, and why it is checked against the
# artifacts rather than read as prose.
#
# ADR-1401 requires a per-variant manifest carrying input sha, output sha, defect claim and
# revision reason, so that "iteration 2 fixed what iteration 1 found" is PROVABLE from the
# hashes. The lane's own history is the reason: a whole cycle of critiques, rankings, receipts
# and a sealed prediction was built on pixels nobody in the session ever opened, and the owner
# scored the result 23/100. A manifest that merely NARRATES a fix is that failure in miniature.
#
# So every row is tied to a real render meta. The load-bearing case is the last one: a row whose
# input and output hashes are equal did not change anything, and may not claim it fixed a defect.
bats_require_minimum_version 1.5.0
load 'test_helper'

_sr_sandbox() {
  _arc_design_sandbox
  ID="lexos-v1"; V="a"
  EXD="$SANDBOX/docs/design/explore/$ID/variant-$V"
  SESS="$SANDBOX/.claude/state/design/renders/$ID--variant-$V"
  mkdir -p "$EXD/self-review" "$SESS"
  printf '<main><section data-arc-surface="product"><h1>M</h1></section></main>\n' > "$EXD/index.html"
  SLUG="docs--design--explore--$ID--variant-$V--index-html"
}

# A render meta for iteration N carrying the given hash.
_meta() {
  printf '{\n  "route": "docs/design/explore/%s/variant-%s/index.html",\n  "screenshot_sha256": "%s",\n  "viewport": "1440x900@1",\n  "session": "%s--variant-%s",\n  "iter": %s,\n  "unchanged": %s\n}\n' \
    "$ID" "$V" "$2" "$ID" "$V" "$1" "${3:-false}" > "$SESS/$SLUG--iter-$1.json"
}

_manifest() { cat > "$EXD/self-review/manifest.md"; }
_sr() { run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" selfreview "$ID"; }

A_SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
B_SHA="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
C_SHA="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

teardown() { _arc_teardown; }

@test "selfreview: no self-review directory at all is not an error" {
  _sr_sandbox
  rm -rf "$EXD/self-review"
  # A variant composed in one pass has nothing to prove. Absence is not a failure; only a
  # CLAIM that cannot be substantiated is.
  _sr
  [ "$status" -eq 0 ]
}

@test "selfreview: a self-review directory with no manifest is refused" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _sr
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "manifest"
}

@test "selfreview: a well-formed manifest whose hashes match the metas passes" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $B_SHA | the primary action sat below the fold | moved the action bar above the summary block |
EOF
  _sr
  [ "$status" -eq 0 ]
}

@test "selfreview: a row whose OUTPUT hash is not the iteration's real hash is refused" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $C_SHA | hierarchy | moved things |
EOF
  # The claim is tied to the artifact, not to the sentence. A manifest that can say anything
  # is the "report about pixels nobody opened" failure with extra formatting.
  _sr
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "output"
}

@test "selfreview: a row whose INPUT hash is not the previous iteration's hash is refused" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $C_SHA | $B_SHA | hierarchy | moved things |
EOF
  _sr
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "input"
}

@test "selfreview: a row naming an iteration with no render meta is refused" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $B_SHA | hierarchy | moved things |
EOF
  _sr
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "no render"
}

@test "selfreview: a NO-OP row may not claim it fixed a defect" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$A_SHA" true
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $A_SHA | the primary action sat below the fold | moved the action bar above the summary block |
EOF
  # THE case this file exists for. Identical hashes mean the pixels did not move, so no
  # defect was visibly fixed -- and a manifest asserting otherwise is exactly the narrated
  # verdict the lane's 23/100 cycle was built on.
  _sr
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "unchanged"
}

@test "selfreview: a NO-OP row that says so plainly is accepted" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$A_SHA" true
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $A_SHA | unchanged | unchanged — iteration 1 already cleared the bar |
EOF
  # "Nothing changed" is a first-class RESULT under ADR-1417, not a fault. The gate refuses a
  # false claim, never an honest null one.
  _sr
  [ "$status" -eq 0 ]
}

@test "selfreview: an empty defect or revision cell is refused" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $B_SHA |  | moved things |
EOF
  _sr
  [ "$status" -ne 0 ]
}

@test "selfreview: a manifest that only MENTIONS the table in prose is refused" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<'EOF'
## Self-review

I rendered twice and the second iteration fixed what the first showed. A table of
| iter | input | output | defect | revision |
rows would go here once the format settles.
EOF
  # The 2026-07-16 cosmetic-variant lesson and the 2026-08-02 prose-mention regex are the same
  # lesson: a line a human reads as meaningful must not satisfy a gate by looking like one.
  # A header row alone is not evidence; there must be a real data row.
  _sr
  [ "$status" -ne 0 ]
}

@test "selfreview: iteration 1 needs no row -- there is nothing before it to compare" {
  _sr_sandbox
  _meta 1 "$A_SHA"
  _manifest <<'EOF'
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
EOF
  # A header with no data rows, and only one iteration on disk: nothing is claimed and
  # nothing is owed.
  _sr
  [ "$status" -eq 0 ]
}

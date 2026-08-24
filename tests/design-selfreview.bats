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
D_SHA="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"

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
  # Named, not merely non-zero. A bare status check PASSED in the red run against a
  # subcommand that did not exist: "command missing" and "cell empty" are different facts.
  # This is the fourth instance of that shape in this cycle and testing.md already states
  # the rule -- an assertion a crash satisfies is measuring nothing.
  echo "$output" | grep -q "selfreview-empty"
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
  # And named, for the same reason as the empty-cell case above.
  echo "$output" | grep -q "selfreview-row-missing"
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

# ---------- two viewports per iteration (adversarial pass, 2026-08-24) ----------
#
# _meta_for globs "$sess"/*--iter-N.json and REFUSES when more than one file matches. That
# refusal is itself a fix from the previous pass: `ls | head -1` picked by LC_COLLATE, so a
# session holding a second route compared the wrong meta and WHICH one differed per OS leg.
# Ambiguity became a refusal, correctly.
#
# It stops being correct the moment the renderer starts writing a viewport component, which
# REQ-03 requires: one route rendered at desktop and at mobile inside one iteration is TWO
# metas, and neither of them is a decoy. So the question this section answers is not "which
# file" but "what is a self-review row CLAIMING about", and the answer is the primary surface
# -- the widest viewport rendered for that iteration. The composer's own review is about the
# page it designed; coverage separately proves the mobile surface was rendered at all.
#
# Genuine ambiguity -- two metas at the SAME viewport, which means two different routes -- must
# still refuse. Resolving the viewport case must not quietly resolve that one too.

# A render meta at an explicit viewport, written to the name the renderer will emit once the
# viewport is part of the path.
_meta_vp() {
  printf '{\n  "route": "docs/design/explore/%s/variant-%s/index.html",\n  "screenshot_sha256": "%s",\n  "viewport": "%s@1",\n  "session": "%s--variant-%s",\n  "iter": %s,\n  "unchanged": false\n}\n' \
    "$ID" "$V" "$3" "$2" "$ID" "$V" "$1" > "$SESS/$SLUG--$2--iter-$1.json"
}

@test "selfreview: desktop and mobile in one iteration -- the row claims the WIDEST" {
  _sr_sandbox
  _meta_vp 1 1440x900 "$A_SHA"
  _meta_vp 1 390x844  "$C_SHA"
  _meta_vp 2 1440x900 "$B_SHA"
  _meta_vp 2 390x844  "$C_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $B_SHA | the primary action sat below the fold | moved the action bar above the summary block |
EOF
  _sr
  [ "$status" -eq 0 ] || { echo "two viewports read as ambiguity: $output"; false; }
}

@test "selfreview: two metas at the SAME viewport is still ambiguous and still refuses" {
  _sr_sandbox
  # The control that keeps the previous pass's fix alive. Same viewport, same iteration means
  # two ROUTES in one session -- the decoy case -- and picking either one is the LC_COLLATE
  # bug returning under a new name.
  _meta_vp 1 1440x900 "$A_SHA"
  _meta_vp 2 1440x900 "$B_SHA"
  printf '{\n  "screenshot_sha256": "%s",\n  "viewport": "1440x900@1",\n  "iter": 2\n}\n' \
    "$C_SHA" > "$SESS/some--other--route--1440x900--iter-2.json"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $B_SHA | the primary action sat below the fold | moved the action bar above the summary block |
EOF
  _sr
  [ "$status" -ne 0 ] || { echo "a genuine decoy was silently picked past: $output"; false; }
}

# ---------- what the previous cases did NOT prove (attacker mutants, 2026-08-25) ----------
#
# Two mutants survived the whole suite, and both are here because a fresh attacker built them
# rather than because reading the tests suggested it.

@test "selfreview: the WIDEST wins even when it sorts LAST on disk" {
  # M1. The earlier case used 1440x900 and 390x844 -- and "1" sorts before "3", so the widest
  # file happened to come FIRST in glob order. An attacker replaced the width comparison with
  # "keep the first file seen" and the entire suite stayed green: the case named
  # "the row claims the WIDEST" did not test widest, it tested glob order agreeing with it.
  #
  # 900x600 against 390x844 inverts that: 900 is the WIDER viewport and "9" sorts AFTER "3",
  # so first-in-glob-order now picks the wrong one and the mutant dies.
  _sr_sandbox
  _meta_vp 1 390x844 "$A_SHA"
  _meta_vp 1 900x600 "$B_SHA"
  _meta_vp 2 390x844 "$C_SHA"
  _meta_vp 2 900x600 "$D_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $B_SHA | $D_SHA | the primary action sat below the fold | moved the action bar above the summary block |
EOF
  _sr
  [ "$status" -eq 0 ] || { echo "the widest was not chosen when it sorted last: $output"; false; }
}

@test "selfreview: a row with SIX cells is refused" {
  # M2. The row-shape refusal was entirely untested -- deleting it left the suite green.
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision | extra |
|---|---|---|---|---|---|
| 2 | $A_SHA | $B_SHA | cramped header | moved it | spare |
EOF
  _sr
  [ "$status" -ne 0 ] || { echo "a six-cell row was accepted: $output"; false; }
  echo "$output" | grep -q "row-shape" || { echo "refused, but not for its shape: $output"; false; }
}

@test "selfreview: an escaped pipe cannot buy an empty revision cell" {
  # THE ONE BOTH ATTACKERS FOUND, independently, in the same words: the check accepted 7|8
  # fields, and 8 is EXACTLY a row carrying one escaped pipe -- the case it was written to
  # refuse. The empty-revision rule was walked past with a single backslash-pipe, and the
  # refusal message said "five cells and nothing else" while the code accepted six.
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<EOF
## Self-review

| iter | input | output | defect | revision |
|---|---|---|---|---|
| 2 | $A_SHA | $B_SHA | tightened spacing \| and rhythm |  |
EOF
  _sr
  [ "$status" -ne 0 ] || { echo "an escaped pipe bought an empty revision cell: $output"; false; }
}

@test "selfreview: a manifest that NARRATES iterations with zero rows is refused" {
  # The narrated verdict this gate's own header says it exists to refuse -- and it passed.
  _sr_sandbox
  _meta 1 "$A_SHA"
  _meta 2 "$B_SHA"
  _manifest <<'EOF'
## Self-review

I ran three iterations and fixed the hierarchy each time. Trust me.
EOF
  _sr
  [ "$status" -ne 0 ] || { echo "prose claiming iterations was accepted as substantiation: $output"; false; }
}

@test "selfreview: an empty explore is a message, not a pass" {
  _sr_sandbox
  rm -rf "$EXD" "$SESS"
  _sr
  [ "$status" -ne 0 ] || { echo "an empty explore reported substantiated: $output"; false; }
}

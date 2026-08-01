#!/usr/bin/env bats
#
# wip-line.sh -- Cycle 4 portfolio, Phase 02 / REQ-03, spec section C.
#
# ADR-0052: WIP is VISIBLE, never gated. counted = LIVE + BLOCKED; /arc-kickoff preflight
# prints ONE info line and ALWAYS proceeds. The v2-v3 pack drafts had a blocking WIP gate
# at kickoff and the owner removed it in round 4, so the fixture that matters most on this
# page is not "the number is right" -- it is "nothing here can refuse".
#
# That fixture is built as control + subject, because "exit 0" is a claim a script that
# cannot fail satisfies by accident. At two eligible lanes the RESOLVER exits 3 (ambiguous)
# -- asserted here as the control -- while wip-line.sh, reading the same repo, exits 0.
# Without the control, the not-blocked test passes on a repo where nothing could have
# blocked in the first place and proves nothing at all.
#
# The line is NOT a WARN and must never be mistaken for one: it carries no
# Expected/Found/Example, it has no registered class, and it deliberately does not begin
# with `WARN `. Section A's shape sweep reads any line starting `WARN ` that is not
# `WARN [` as header-form drift, so an info line that borrowed the prefix would be read as
# a malformed WARN by a suite that never mentions it.
#
# Every @test name on this page is ASCII-only. Six em-dashed names once made windows shard
# 10/12 report "declared 93, executed 87": tests that existed, were counted, and never ran.

bats_require_minimum_version 1.5.0

load 'test_helper'

setup() {
  _arc_lane_sandbox
  cp "$ARC_CORE_SRC/wip-line.sh" "$SANDBOX/.claude/scripts/core/"
  WL="$SANDBOX/.claude/scripts/core/wip-line.sh"
  RESOLVER="$SANDBOX/.claude/scripts/core/lane-resolve.sh"
  DASH="$_ARC_WARN_DASH"
  printf -v DOT '\302\267'          # U+00B7 MIDDLE DOT, declared here INDEPENDENTLY of the
                                    # script so the expectation is a statement about bytes
                                    # rather than an echo of whatever the script emitted
}

teardown() { _arc_teardown; }

# Run wip-line against the sandbox. Streams are pinned into ARC_LINT_STATUS /
# ARC_LINT_OUTPUT / ARC_LINT_STDERR by the shared runner and nothing else is passed on,
# which forbids `|| true` laundering the exit code -- the exact code under test here.
_wl() { _arc_run_lint "$WL" --root "$SANDBOX"; }

# The whole expected line, rebuilt from parts. A substring assertion would pass on a line
# that also carried a second clause, a stray banner or a trailing separator.
_expect() {
  printf 'WIP: %s counted (LIVE+BLOCKED) %s guideline 2 %s informational, kickoff proceeds %s %s' \
    "$1" "$DOT" "$DOT" "$DASH" "$2"
}

# Write a lane whose PROGRESS.md body is given verbatim -- for the header-grammar cases
# _arc_make_lane's fixed template cannot express.
_lane_raw() {
  mkdir -p "$SANDBOX/initiatives/$1"
  cat > "$SANDBOX/initiatives/$1/PROGRESS.md"
}

_lines() { printf '%s\n' "$ARC_LINT_OUTPUT" | grep -c . || true; }

# ---------- the counted number at 0, 1, 2 and 3 (spec section C) ----------

@test "wip-line: 0 counted when lanes exist but none is LIVE or BLOCKED" {
  # NOT the same fact as root-mode silence below: initiatives/ exists and holds two real
  # lanes, so the company has lanes and none of them is holding attention. A zero here is
  # a measured zero, and it is printed rather than implied by an absent line.
  _arc_make_lane design IDLE
  _arc_make_lane later QUEUED
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 0 none)" ]
  [ -z "$ARC_LINT_STDERR" ]
}

@test "wip-line: 1 counted with a single LIVE lane" {
  _arc_make_lane portfolio LIVE
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: 2 counted, and the lanes are listed in the resolver's byte order" {
  _arc_make_lane portfolio LIVE
  _arc_make_lane design BLOCKED
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 2 "design, portfolio")" ]
}

@test "wip-line: 3 counted" {
  _arc_make_lane portfolio LIVE
  _arc_make_lane design BLOCKED
  _arc_make_lane growth LIVE
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 3 "design, growth, portfolio")" ]
}

# ---------- BLOCKED counts, QUEUED and IDLE do not (ADR-0052) ----------

@test "wip-line: BLOCKED is counted because it still holds the owner's attention" {
  _arc_make_lane design BLOCKED
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 design)" ]
}

@test "wip-line: QUEUED is not counted" {
  # Reachable state, not a hypothetical: ADR-0061 made QUEUED a status a BORN lane holds,
  # so a queued lane has a directory, a header and a board row and still must not count.
  _arc_make_lane portfolio LIVE
  _arc_make_lane later QUEUED
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: IDLE is not counted" {
  _arc_make_lane portfolio LIVE
  _arc_make_lane design IDLE
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

# ---------- never blocks: control + subject ----------

@test "wip-line: CONTROL - the resolver itself exits 3 at two eligible lanes" {
  # The negative control for the test below. If this ever stops exiting 3, the
  # not-blocked assertion is passing on a repo where nothing could have blocked, and it
  # must be rewritten rather than left green.
  _arc_make_lane portfolio LIVE
  _arc_make_lane design LIVE
  run bash "$RESOLVER" --root "$SANDBOX" --for kickoff --print machine
  [ "$status" -eq 3 ]
}

@test "wip-line: kickoff is NOT blocked at 2 counted lanes" {
  # ADR-0052 is owner-locked; the v3 day-one BLOCK is the mistake this fixture exists to
  # prevent recurring. The resolver's exit 3 (pinned by the control above) must not leak
  # through, and nothing may reach stderr for an operator to read as a refusal.
  _arc_make_lane portfolio LIVE
  _arc_make_lane design LIVE
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_STDERR" ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 2 "design, portfolio")" ]
}

@test "wip-line: kickoff is NOT blocked at 4 counted lanes either" {
  # Twice the working guideline. There is no ladder of counts at which this turns into a
  # prompt: the guideline is a number on the line, never a comparison the script makes.
  _arc_make_lane portfolio LIVE
  _arc_make_lane design LIVE
  _arc_make_lane growth BLOCKED
  _arc_make_lane ops LIVE
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_STDERR" ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 4 "design, growth, ops, portfolio")" ]
}

@test "wip-line: the output is exactly ONE line at every count" {
  _arc_make_lane portfolio LIVE
  _arc_make_lane design BLOCKED
  _wl
  [ "$(_lines)" -eq 1 ]
}

# ---------- root-mode silence (permanent consumer contract, ADR-0054) ----------

@test "wip-line: a repo with no initiatives dir prints nothing on either stream" {
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [ -z "$ARC_LINT_STDERR" ]
}

@test "wip-line: an initiatives dir holding no valid lane is root-mode, not zero" {
  # git does not track empty directories, so a stray mkdir or a partial checkout lands
  # here. Root-mode's contract is silence -- not "a line that says 0".
  mkdir -p "$SANDBOX/initiatives"
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [ -z "$ARC_LINT_STDERR" ]
}

# ---------- adversarial: constructed breaking inputs ----------

@test "wip-line: a case-folded directory name is not a lane and is not counted" {
  # initiatives/Design exists on disk on all three legs; only the grammar decides. On a
  # case-folding filesystem this is also the directory `design` would collide with.
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/Design"
  printf 'status: LIVE\n' > "$SANDBOX/initiatives/Design/PROGRESS.md"
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: a reserved device name is not a lane and is not counted" {
  # The creation is allowed to FAIL. `com1` is exactly the name mkdir refuses on
  # windows-git-bash and accepts on the other two legs, so asserting the mkdir succeeded
  # would make this a one-OS test. Either way the lane must not count, and that assertion
  # is identical on three legs -- the same reasoning that made the Phase 01 casing fixture
  # assert a refusal rather than a success.
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/com1" 2>/dev/null || true
  printf 'status: LIVE\n' > "$SANDBOX/initiatives/com1/PROGRESS.md" 2>/dev/null || true
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: a dot-entry under initiatives is invisible" {
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/.attic"
  printf 'status: LIVE\n' > "$SANDBOX/initiatives/.attic/PROGRESS.md"
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: markdown emphasis around the status still counts" {
  # Tolerant DETECTION, strict VALUE. `**LIVE**` is the same value as `LIVE`, and a count
  # that dropped it would under-report WIP on a header a human reads as live.
  _lane_raw portfolio <<'EOF'
# PROGRESS.md

**status:** **LIVE**
cycle: test cycle
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: a lowercase status value does not count" {
  # The other half of the same rule. `live` is not the ADR-0051 vocabulary, and a
  # case-insensitive VALUE match is how a typo becomes a silently counted lane.
  _lane_raw portfolio <<'EOF'
# PROGRESS.md

status: live
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 0 none)" ]
}

@test "wip-line: a status inside a fenced block does not count" {
  _lane_raw portfolio <<'EOF'
# PROGRESS.md

```
status: LIVE
```
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 0 none)" ]
}

@test "wip-line: a status below the first heading does not count" {
  # The machine header block ends at the first level-2 heading. A `status:` in prose
  # further down the file is a sentence, not a header field.
  _lane_raw portfolio <<'EOF'
# PROGRESS.md

## Now

status: LIVE
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 0 none)" ]
}

@test "wip-line: a lane with no PROGRESS.md is not counted" {
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/design"
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: a CRLF header still counts" {
  # A Windows checkout with autocrlf on. A trailing CR left on the value turns LIVE into
  # a status that matches nothing, and the lane silently stops counting on one leg only.
  _arc_make_lane portfolio LIVE
  awk '{ printf "%s\r\n", $0 }' "$SANDBOX/initiatives/portfolio/PROGRESS.md" \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.crlf"
  mv "$SANDBOX/initiatives/portfolio/PROGRESS.crlf" "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

@test "wip-line: tokens belonging to the calling command are ignored, never read" {
  # The same contract lane-resolve.sh holds: a phase number, a goal sentence or a stray
  # --lane belongs to the caller. None of them may change the count.
  _arc_make_lane portfolio LIVE
  _arc_run_lint "$WL" --root "$SANDBOX" --lane design 2 "Add a --lane flag to the docs"
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 1 portfolio)" ]
}

# ---------- adversarial: the script's own inputs ----------

@test "wip-line: a missing resolver degrades loudly and still exits 0" {
  _arc_make_lane portfolio LIVE
  rm -f "$RESOLVER"
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [[ "$ARC_LINT_STDERR" == *"lane-resolve.sh not found"* ]]
}

@test "wip-line: a resolver whose count contradicts its own list prints no number" {
  # A confident wrong number is worse than no number: `3 counted` beside two names is this
  # project's recurring bug in miniature -- a gate reporting on its own parse rather than
  # on the thing. The stub is the only way to reach the branch, and the branch has to
  # exist before a future resolver change can reach it for real.
  cat > "$RESOLVER" <<'EOF'
#!/usr/bin/env bash
echo "mode=lane"
echo "eligible=design portfolio"
echo "counted=5"
exit 0
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [[ "$ARC_LINT_STDERR" == *"counted=5 beside 2 eligible"* ]]
}

@test "wip-line: a non-numeric count prints no number" {
  cat > "$RESOLVER" <<'EOF'
#!/usr/bin/env bash
echo "mode=lane"
echo "eligible=portfolio"
echo "counted=one"
exit 0
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [[ "$ARC_LINT_STDERR" == *"no info line printed"* ]]
}

@test "wip-line: a resolver that says nothing at all is treated as root-mode" {
  cat > "$RESOLVER" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [ -z "$ARC_LINT_STDERR" ]
}

@test "wip-line: a resolver exiting non-zero with a usable count is still read" {
  # Exit 3 with a complete machine block is the ambiguous case, and dropping the code is
  # deliberate. This pins that the code is dropped rather than merely tolerated.
  cat > "$RESOLVER" <<'EOF'
#!/usr/bin/env bash
echo "mode=lane"
echo "eligible=design portfolio"
echo "counted=2"
exit 3
EOF
  _wl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ "$ARC_LINT_OUTPUT" = "$(_expect 2 "design, portfolio")" ]
}

# ---------- the info line is not a WARN ----------

@test "wip-line: the info line never begins with the WARN prefix" {
  # Section A's sweep reads any line starting `WARN ` that is not `WARN [` as header-form
  # drift. An info line that borrowed the prefix would be read as a malformed WARN by a
  # suite that does not know this script exists.
  _arc_make_lane portfolio LIVE
  _wl
  case "$ARC_LINT_OUTPUT" in "WARN "*) false;; esac
}

# ---------- the surface actually routes through it ----------

@test "surface/commands: arc-kickoff wires the WIP line and says it proceeds" {
  grep -q 'wip-line.sh' "$ARC_ROOT/.claude/commands/arc-kickoff.md"
  grep -q 'kickoff PROCEEDS' "$ARC_ROOT/.claude/commands/arc-kickoff.md"
}

@test "surface/products: wip-line.sh is mapped in the core manifest" {
  # Everything under .claude/ is the shipped surface; an unmapped file is refused by
  # product-lint, and a script nobody ships is a script the consumer's kickoff cannot run.
  grep -q 'core/wip-line.sh' "$ARC_ROOT/products/core/manifest.json"
}

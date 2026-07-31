#!/usr/bin/env bats
#
# The WARN-shape assertion helper -- Cycle 4 portfolio, Phase 02 / REQ-03, spec section A.
#
# This file tests the thing every other Phase-02 fixture asserts THROUGH, so its job is not
# to prove the helper accepts good input. Its job is to prove the helper REJECTS bad input,
# because a test helper that passes on a malformed WARN is a lying gate, and arc has shipped
# exactly that bug before ("PASS = zero VIOLATION" meant "broke no rule", so characterless
# work passed five runs running -- ADR-0049).
#
# Every rejection test asserts the SENTINEL 66 and a NAMED reason. Asserting `status -ne 0`
# would be satisfied by the helper simply not existing (bats reports 127), which is how a
# suite reports green for a function nobody wrote.
#
# String in, verdict out: no sandbox, no filesystem, no teardown. `run` is legal HERE and
# nowhere else, because the helper takes class, status and text as explicit arguments and
# reads no globals -- a helper that read $output/$status could not be tested under `run` at
# all, since `run` owns those names.
#
# Every @test name on this page is ASCII-only. tests/shard-tests.bats:184-197 greps the whole
# @test LINE, and six em-dashed names once made windows shard 10/12 report "declared 93,
# executed 87" -- tests that existed, were counted, and never ran. That recurred once inside
# this very cycle, so it is checked here rather than trusted.

bats_require_minimum_version 1.5.0

load 'test_helper'

setup() {
  DASH="$_ARC_WARN_DASH"
  ARROW="$_ARC_WARN_ARROW"
  CR="$_ARC_WARN_CR"
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
}

# One builder, driven by the registry row, so every malformed case below is this block with
# exactly ONE part mutated. A per-test hand-written block would let a typo masquerade as the
# defect under test.
_good_block() {
  local cls="$1" kind tgt loc ex
  _arc_warn_lookup "$cls" || return 1
  kind="$_ARC_W_KIND"; tgt="$_ARC_W_TGT"
  if [ "$kind" = "line" ]; then loc="PORTFOLIO.md:16"; else loc="PORTFOLIO.md"; fi
  case "$tgt" in
    board-row)    ex='| portfolio | LIVE | arc-portfolio |' ;;
    meta:Updated) ex='Updated: 2026-08-01' ;;
    meta:status)  ex='status: IDLE' ;;
    *)            ex='delete line 17, or run /arc-kickoff --lane develop' ;;
  esac
  printf 'WARN [%s] %s %s the board disagrees with its lane header\n' "$cls" "$loc" "$DASH"
  printf '  Expected: burn 1.9d   %s initiatives/portfolio/PROGRESS.md:8\n' "$ARROW"
  printf '  Found:    burn 1.4d   %s PORTFOLIO.md:16\n' "$ARROW"
  printf '  Example:  %s\n' "$ex"
}

# ---------- acceptance: the shape the spec actually documents ----------

@test "warn-shape: a well-formed WARN block is accepted and prints nothing" {
  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "warn-shape: every one of the nine registered classes is accepted by the same code path" {
  local c k t
  while read -r c k t; do
    run _arc_warn_shape "$c" 0 "$(_good_block "$c")"
    [ "$status" -eq 0 ] || { echo "class $c (kind=$k target=$t) was rejected: $output"; false; }
  done <<< "$(_ARC_WARN_CLASSES)"
}

@test "warn-shape: the class registry is exactly the nine classes the spec names" {
  local n sorted want
  n="$(_ARC_WARN_CLASSES | grep -c .)"
  [ "$n" -eq 9 ] || { echo "registry has $n rows, want 9"; false; }
  sorted="$(_ARC_WARN_CLASSES | awk '{print $1}' | LC_ALL=C sort | tr '\n' ' ')"
  want="board-bad-dependency-line board-bad-status board-header-drift board-row-no-lane board-stale-updated board-venture-in-initiatives lane-no-board-row lane-no-machine-header ownership-cross-lane "
  [ "$sorted" = "$want" ] || { echo "registry classes: $sorted"; echo "want:             $want"; false; }
  # every row declares a legal loc-kind and a legal Example target
  local c k t
  while read -r c k t; do
    case "$k" in line|file) ;; *) echo "$c: bad loc-kind '$k'"; false;; esac
    case "$t" in board-row|free|meta:*) ;; *) echo "$c: bad example-target '$t'"; false;; esac
  done <<< "$(_ARC_WARN_CLASSES)"
}

# ---------- H-01: the separator is parsed, not sniffed ----------

@test "warn-shape: a hyphen separator is rejected even when the summary itself contains an em dash" {
  local blk
  blk="WARN [board-header-drift] PORTFOLIO.md:16 - burn drifted, see phase 02 $DASH Parallel-safety floor
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  run _arc_warn_shape board-header-drift 0 "$blk"
  [ "$status" -eq 66 ]
  [[ "$output" == *"location is not a repo-relative line"* ]]
}

@test "warn-shape: junk between the location and the separator is not swallowed" {
  local blk
  blk="WARN [board-header-drift] PORTFOLIO.md:16 (row 3, cell 5) $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  run _arc_warn_shape board-header-drift 0 "$blk"
  [ "$status" -eq 66 ]
  [[ "$output" == *"location is not a repo-relative line"* ]]
}

# ---------- H-02 / H-14 / H-19: the label column is an equality ----------

@test "warn-shape: a value region of whitespace is rejected at every padding width, not read as a present value" {
  local w pad blk
  for w in 3 4 5 12 16; do
    pad="$(printf "%${w}s" "")"
    blk="WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected:$pad$ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
    run _arc_warn_shape board-header-drift 0 "$blk"
    [ "$status" -eq 66 ] || { echo "padding width $w was ACCEPTED"; false; }
    [[ "$output" == *"label column drift"* ]] || { echo "width $w gave: $output"; false; }
  done
}

@test "warn-shape: an over-padded label column is rejected in the same way as an under-padded one" {
  local blk
  blk="WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:      burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  run _arc_warn_shape board-header-drift 0 "$blk"
  [ "$status" -eq 66 ]
  [[ "$output" == *"label column drift"* ]]

  blk="WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found: burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  run _arc_warn_shape board-header-drift 0 "$blk"
  [ "$status" -eq 66 ]
  [[ "$output" == *"label column drift"* ]]
}

# ---------- H-03 / H-17 / H-18: the location grammar ----------

@test "warn-shape: a bare line number, line zero, a leading-zero line and a dot-dot or tilde path are all refused" {
  local loc
  for loc in "16" "PORTFOLIO.md:0" "PORTFOLIO.md:007" "../../PORTFOLIO.md:16" "~/arc/PORTFOLIO.md:16" "./PORTFOLIO.md:16"; do
    run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] $loc $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
    [ "$status" -eq 66 ] || { echo "location '$loc' was ACCEPTED"; false; }
    [[ "$output" == *"location is not a repo-relative"* ]] || { echo "location '$loc': $output"; false; }
  done
}

@test "warn-shape: absolute and windows drive-qualified locations are rejected" {
  local loc
  for loc in "/abs/PORTFOLIO.md:16" "E:/w/PORTFOLIO.md:16"; do
    run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] $loc $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
    [ "$status" -eq 66 ] || { echo "location '$loc' was ACCEPTED"; false; }
  done
}

@test "warn-shape: a tracked path containing a space is a valid location and is not truncated" {
  local p="tests/fixtures/products/good-space/.claude/scripts/my tool.sh"
  run _arc_warn_shape ownership-cross-lane 0 "WARN [ownership-cross-lane] $p $DASH edited outside the selected lane
  Expected: portfolio owns this path   $ARROW .claude/rules/lanes.md:60
  Found:    edited while lane=design   $ARROW PORTFOLIO.md:16
  Example:  git restore --worktree -- '$p'"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "warn-shape: the class strip is quoted so a bracketed class name is not read as a glob" {
  # With an UNQUOTED ${_l#WARN [$_class] } the bracket set matches one character, the strip
  # removes nothing, and the spec's own sample fails with a location error. This is the guard.
  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)"
  [ "$status" -eq 0 ]
  [[ "$output" != *"WARN line: want exactly"* ]]
}

@test "warn-shape: the two whole-file classes cite a bare path and a line-kind class still may not" {
  run _arc_warn_shape lane-no-board-row 0 "$(_good_block lane-no-board-row)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run _arc_warn_shape ownership-cross-lane 0 "$(_good_block ownership-cross-lane)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # a line-kind class handed a bare path is still wrong
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
}

# ---------- H-16: absence is expressible ----------

@test "warn-shape: a genuinely absent artifact is spelled none in parens and a blank value is still refused" {
  run _arc_warn_shape lane-no-machine-header 0 "WARN [lane-no-machine-header] initiatives/design/PROGRESS.md:1 $DASH no machine header to derive the board row from
  Expected: status: IDLE   $ARROW docs/adr/0062-port-i-amendment-a-board-row-needs-a-machine-header.md:40
  Found:    (none)   $ARROW initiatives/design/PROGRESS.md:1
  Example:  status: IDLE"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  run _arc_warn_shape lane-no-machine-header 0 "WARN [lane-no-machine-header] initiatives/design/PROGRESS.md:1 $DASH no machine header
  Expected: status: IDLE   $ARROW docs/adr/0062-port-i-amendment-a-board-row-needs-a-machine-header.md:40
  Found:       $ARROW initiatives/design/PROGRESS.md:1
  Example:  status: IDLE"
  [ "$status" -eq 66 ]
  [[ "$output" == *"(none)"* ]]
}

# ---------- H-07: a difference must show two values ----------

@test "warn-shape: a block whose Expected and Found values are identical is refused" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.9d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"identical"* ]]

  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH TODO
  Expected: TODO   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    TODO   $ARROW PORTFOLIO.md:16
  Example:  | TODO |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"identical"* ]]
}

# ---------- the source pointer is mandatory and checkable ----------

@test "warn-shape: an Expected or Found value with no source pointer is rejected" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"Expected: source pointer missing"* ]]

  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"Found: source pointer missing"* ]]
}

@test "warn-shape: an Expected source with no line number is rejected" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"source not a repo-relative file:line"* ]]
}

@test "warn-shape: the source token survives a trailing comma and a two-space annotation" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8  \`burn: 1.9d\`
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16, column \`appetite/burn\`
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- H-04 / H-05: the Example target is registry data ----------

@test "warn-shape: a TODO-colon prose Example and a board row with no cells are both refused" {
  local ex
  for ex in "TODO: ask the owner what the right value is" "fix: set the burn cell to 1.9d" "|" "| | | | |"; do
    run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  $ex"
    [ "$status" -eq 66 ] || { echo "Example '$ex' was ACCEPTED"; false; }
  done
}

@test "warn-shape: a deletion instruction and a git command are valid Examples for the classes registered free" {
  run _arc_warn_shape board-row-no-lane 0 "WARN [board-row-no-lane] PORTFOLIO.md:17 $DASH row resolves to no lane directory
  Expected: a row iff initiatives/develop/ exists   $ARROW docs/adr/0061-board-indexes-born-lanes-only.md:47
  Found:    row present, directory absent   $ARROW PORTFOLIO.md:17
  Example:  delete line 17, or run /arc-kickoff --lane develop"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  run _arc_warn_shape ownership-cross-lane 0 "WARN [ownership-cross-lane] initiatives/design/PROGRESS.md $DASH edited from another lane
  Expected: portfolio owns the edited paths   $ARROW .claude/rules/lanes.md:60
  Found:    initiatives/design touched   $ARROW PORTFOLIO.md:16
  Example:  git restore --worktree initiatives/design/PROGRESS.md"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "warn-shape: the meta classes demand their own key and reject the other one" {
  run _arc_warn_shape board-stale-updated 0 "WARN [board-stale-updated] PORTFOLIO.md:14 $DASH Updated is older than the newest lane header
  Expected: Updated: 2026-08-01   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    Updated: 2026-07-31   $ARROW PORTFOLIO.md:14
  Example:  status: IDLE"
  [ "$status" -eq 66 ]
  [[ "$output" == *"must begin 'Updated: '"* ]]
}

@test "warn-shape: an Example carrying a source arrow is rejected" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio |   $ARROW PORTFOLIO.md:16"
  [ "$status" -eq 66 ]
  [[ "$output" == *"carries a source arrow"* ]]
}

# ---------- H-06: the sweep is whole-output ----------

@test "warn-shape: a malformed sibling WARN and an unregistered class name both fail the assertion" {
  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)
WARN [board-stale-updated] PORTFOLIO.md:14 - stale"
  [ "$status" -eq 66 ]
  [[ "$output" == *"board-stale-updated"* ]]

  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)
WARN [board-nonsense] PORTFOLIO.md:14 $DASH whatever"
  [ "$status" -eq 66 ]
  [[ "$output" == *"unregistered class emitted"* ]]
}

@test "warn-shape: an unregistered class argument is refused" {
  run _arc_warn_shape board-header-drfit 0 "$(_good_block board-header-drift)"
  [ "$status" -eq 66 ]
  [[ "$output" == *"class not registered"* ]]
}

@test "warn-shape: a WARN of a different registered class does not satisfy this class" {
  run _arc_warn_shape board-header-drift 0 "$(_good_block board-bad-status)"
  [ "$status" -eq 66 ]
  [[ "$output" == *"WARN line missing"* ]]
}

# ---------- H-11: hygiene is scoped to the block, never the chatter ----------

@test "warn-shape: trailing whitespace on an unrelated chatter line does not fail a pristine block" {
  run _arc_warn_shape board-header-drift 0 "board-lint: scanning PORTFOLIO.md
$(_good_block board-header-drift)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  # the companion half: trailing space INSIDE the block is still a rejection
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"trailing whitespace"* ]]
}

@test "warn-shape: the block is found among surrounding clean lint chatter" {
  run _arc_warn_shape board-header-drift 0 "Selected lane: portfolio (via auto)
board-lint: scanning PORTFOLIO.md
$(_good_block board-header-drift)
board-lint: 1 warning"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- H-12: CR handling ----------

@test "warn-shape: a carriage return in the middle of a value is refused while CRLF line endings stay accepted" {
  local crlf
  crlf="WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift${CR}
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8${CR}
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16${CR}
  Example:  | portfolio | LIVE |${CR}"
  run _arc_warn_shape board-header-drift 0 "$crlf"
  [ "$status" -eq 0 ] || { echo "CRLF block rejected: $output"; false; }

  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d${CR}xx   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"carriage return inside the line"* ]]
}

# ---------- the headline WARN-first rule ----------

@test "warn-shape: a well-formed block with a non-zero exit status is rejected" {
  local st
  for st in 1 2; do
    run _arc_warn_shape board-header-drift "$st" "$(_good_block board-header-drift)"
    [ "$status" -eq 66 ] || { echo "exit status $st was ACCEPTED"; false; }
    [[ "$output" == *"exit status not 0"* ]] || { echo "$output"; false; }
  done
}

@test "warn-shape: the two-space WARN form used by kickoff-lint is named as a header-form drift" {
  run _arc_warn_shape board-header-drift 0 "WARN  [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"header-form drift"* ]]
}

@test "warn-shape: an indented WARN line is rejected" {
  run _arc_warn_shape board-header-drift 0 "  $(_good_block board-header-drift)"
  [ "$status" -eq 66 ]
  [[ "$output" == *"WARN line missing"* ]]
}

# ---------- ordering, contiguity, attributable diagnosis ----------

@test "warn-shape: parts present but out of order or non-contiguous are rejected" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"Expected"* ]]

  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift

  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
}

@test "warn-shape: a block missing one part is rejected naming only that part" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  | portfolio | LIVE |
  Example:  | portfolio | LIVE |"
  [ "$status" -eq 66 ]
  [[ "$output" == *"Expected"* ]]

  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16"
  [ "$status" -eq 66 ]
  [[ "$output" == *"Example"* ]]
  [[ "$output" != *"Expected: source pointer missing"* ]]
}

# ---------- counting ----------

@test "warn-shape: a duplicated WARN of the same class fails the default count" {
  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)
$(_good_block board-header-drift)"
  [ "$status" -eq 66 ]
  [[ "$output" == *"occurrence count"* ]]
}

@test "warn-shape: an explicit count of two accepts two blocks and rejects a malformed second" {
  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)
$(_good_block board-header-drift)" 2
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)
WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.4d   $ARROW PORTFOLIO.md:16
  Example:  " 2
  [ "$status" -eq 66 ]
  [[ "$output" == *"Example"* ]]
}

# ---------- caller errors fail loudly ----------

@test "warn-shape: empty text is rejected and says so explicitly" {
  run _arc_warn_shape board-header-drift 0 ""
  [ "$status" -eq 66 ]
  [[ "$output" == *"WARN line missing"* ]]
  [[ "$output" == *"(captured output was empty)"* ]]
}

@test "warn-shape: a mis-called helper fails loudly instead of passing" {
  run _arc_warn_shape board-header-drift 0
  [ "$status" -eq 66 ]
  [[ "$output" == *"bad helper call"* ]]

  run _arc_warn_shape board-header-drift 0 "x" 1 extra
  [ "$status" -eq 66 ]
  [[ "$output" == *"bad helper call"* ]]

  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)" two
  [ "$status" -eq 66 ]
  [[ "$output" == *"bad helper call"* ]]

  run _arc_warn_shape board-header-drift 0 "$(_good_block board-header-drift)" 0
  [ "$status" -eq 66 ]
  [[ "$output" == *"bad helper call"* ]]
}

@test "warn-shape: a backslash and a leading dash in the Example row survive intact in the diagnosis" {
  run _arc_warn_shape board-header-drift 0 "WARN [board-header-drift] PORTFOLIO.md:16 $DASH drift
  Expected: burn 1.9d   $ARROW initiatives/portfolio/PROGRESS.md:8
  Found:    burn 1.9d   $ARROW PORTFOLIO.md:16
  Example:  | a\\b | -lead |"
  [ "$status" -eq 66 ]
  [[ "$output" == *'| a\b | -lead |'* ]]
}

# ---------- the ratchets: these govern every OTHER test file ----------
#
# H-08/H-09/H-10. A guard that can only ever pass is decoration. Each of the three below is
# paired with a proof that its own matcher rejects a synthetic bad line, so "no violations
# found" means the corpus is clean rather than the pattern being broken.

_call_sites() {
  grep -n '_arc_warn_shape\|_arc_run_lint' "$REPO_ROOT"/tests/*.bats 2>/dev/null \
    | grep -v '^[^:]*warn-shape\.bats:' || :
}

@test "warn-shape: no call site outside the self-test file wraps the assertion in run, if, or or-true" {
  local bad
  bad="$(_call_sites | grep -E '(run |if |while |until |! |\|\| *(true|:)|&&)' || :)"
  [ -z "$bad" ] || { echo "wrapped call sites disarm the assertion:"; echo "$bad"; false; }

  # the matcher must be able to fail
  local probe='tests/x.bats:9:  run _arc_warn_shape board-header-drift "$s" "$o"'
  echo "$probe" | grep -qE '(run |if |while |until |! |\|\| *(true|:)|&&)' \
    || { echo "the wrapper matcher does not match a known-bad line"; false; }
}

@test "warn-shape: every call site takes its status and output from _arc_run_lint" {
  local bad
  bad="$(_call_sites | grep '_arc_warn_shape' | grep -v 'ARC_LINT_STATUS" *"\$ARC_LINT_OUTPUT"' || :)"
  [ -z "$bad" ] || { echo "call sites not pinned to _arc_run_lint streams:"; echo "$bad"; false; }

  local probe='tests/x.bats:9:  _arc_warn_shape board-header-drift "$status" "$output"'
  echo "$probe" | grep -qv 'ARC_LINT_STATUS" *"\$ARC_LINT_OUTPUT"' \
    || { echo "the provenance matcher does not reject an ambient-globals call"; false; }
}

@test "warn-shape: registering a class creates an obligation, and the guard arms itself" {
  local c k t covered=0 missing="" total=0
  while read -r c k t; do
    total=$((total + 1))
    if _call_sites | grep -q "_arc_warn_shape $c "; then
      covered=$((covered + 1))
    else
      missing="$missing $c"
    fi
  done <<< "$(_ARC_WARN_CLASSES)"

  # Honest state machine rather than a permanent red or a permanent skip:
  #   0 covered  -> sections B and D have not started; nothing to check yet
  #   1..8       -> FAIL, naming what is left; this is what forces completion
  #   9          -> the obligation is met
  if [ "$covered" -eq 0 ]; then
    skip "no class fixtures yet -- this guard arms itself on the first one (sections B and D)"
  fi
  [ "$covered" -eq "$total" ] || { echo "$covered/$total classes fixtured; missing:$missing"; false; }
}

# ---------- file-scope cost and the ASCII rule ----------

@test "warn-shape: the unicode constants are set with printf -v and no command substitution runs at file scope" {
  local banner
  banner="$(sed -n '/WARN message shape/,/^_arc_run_lint/p' "$REPO_ROOT/tests/test_helper.bash")"
  [ -n "$banner" ] || { echo "WARN-shape banner not found in test_helper.bash"; false; }
  printf '%s\n' "$banner" | grep -q "printf -v _ARC_WARN_DASH" || { echo "DASH not set with printf -v"; false; }
  printf '%s\n' "$banner" | grep -q "printf -v _ARC_WARN_ARROW" || { echo "ARROW not set with printf -v"; false; }
  printf '%s\n' "$banner" | grep -q "printf -v _ARC_WARN_CR" || { echo "CR not set with printf -v"; false; }
  # no _ARC_WARN constant may be assigned from a command substitution
  ! printf '%s\n' "$banner" | grep -q '_ARC_WARN_[A-Z]*="\$(' || { echo "a constant uses a command substitution"; false; }
}

@test "warn-shape: every @test line in this file is ASCII-only" {
  local bad
  bad="$(LC_ALL=C grep -n '^@test' "$REPO_ROOT/tests/warn-shape.bats" | LC_ALL=C grep -n '[^ -~]' || :)"
  [ -z "$bad" ] || { echo "non-ASCII in an @test line -- windows shards count it and never run it:"; echo "$bad"; false; }
}

@test "warn-shape: every bats file that passes flags to run declares bats_require_minimum_version" {
  local f bad=""
  for f in "$REPO_ROOT"/tests/*.bats; do
    grep -qE '^[[:space:]]*run[[:space:]]+--' "$f" || continue
    grep -q 'bats_require_minimum_version' "$f" || bad="$bad ${f##*/}"
  done
  [ -z "$bad" ] || { echo "flagged run without a version declaration:$bad"; false; }
}

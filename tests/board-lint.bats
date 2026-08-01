#!/usr/bin/env bats
#
# board-lint.sh -- Cycle 4 portfolio, Phase 02 / REQ-03, spec section B.
#
# The board is a VIEW (ADR-0051): every Active-initiatives cell derives from that lane's
# PROGRESS machine header, and a row exists iff `initiatives/<lane>/` does, in BOTH
# directions (ADR-0061). This file feeds the lint hand-broken boards in a sandbox and pins
# the verdict. tests/portfolio-board.bats keeps the LIVE-repo assertions -- a different
# setup and a different failure mode -- and gains exactly one test, that the real board
# lints silently.
#
# Every WARN here is asserted THROUGH section A's shape assertion, called directly on its
# own line and fed only the streams the lint runner pinned. Wrapping that call in `run`,
# `if` or an or-true silently disarms it, and warn-shape.bats greps every call site in the
# repo for exactly those shapes -- a prose mention of the helper's name on any other line
# is caught by the same grep, which is why this banner does not spell it.
# The shape assertion judges SHAPE, not correctness -- a WARN citing the right file and the
# wrong line passes it -- so each class also pins the exact Expected/Found/Example bytes.
#
# Every @test name on this page is ASCII-only. Six em-dashed names once made windows shard
# 10/12 report "declared 93, executed 87": tests that existed, were counted, and never ran.

bats_require_minimum_version 1.5.0

load 'test_helper'

setup() {
  _arc_lane_sandbox
  cp "$ARC_CORE_SRC/board-lint.sh" "$SANDBOX/.claude/scripts/core/"
  BL="$SANDBOX/.claude/scripts/core/board-lint.sh"
  DASH="$_ARC_WARN_DASH"
}

teardown() { _arc_teardown; }

# Run the lint against the sandbox. Streams are pinned by _arc_run_lint into
# ARC_LINT_STATUS / ARC_LINT_OUTPUT / ARC_LINT_STDERR and nothing else is passed on.
_bl() { _arc_run_lint "$BL" --root "$SANDBOX"; }

# A lane and a board row that agree on every derived column, so the lint must be silent.
# Mirrors _arc_make_lane's header exactly: cycle `test cycle`, phase `00 <dash> fixture`,
# appetite 3d, burn 0d, both dependency halves empty.
_matching() {
  _arc_make_lane "$1" "$2" "test cycle"
  _arc_make_board "$1|$2|test cycle|00 $DASH fixture"
}

# ---------- silence: the case a lint that cries wolf would fail ----------

@test "board-lint: a board that agrees with its lanes is completely silent" {
  _matching design IDLE
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [ -z "$ARC_LINT_STDERR" ]
}

@test "board-lint: markdown emphasis in a board cell is not drift" {
  # The header parser tolerates bold; the board side must too, or the lint reports on its
  # own strictness. `**IDLE**` and `IDLE` are the same value.
  _matching design IDLE
  sed -i.bak 's/| IDLE |/| **IDLE** |/' "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "board-lint: a second matching lane stays silent (both directions of the iff hold)" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_lane portfolio LIVE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture" \
                  "portfolio|LIVE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

# ---------- root-mode: a permanent consumer contract (ADR-0054) ----------

@test "root-mode: no initiatives dir emits nothing on stdout AND nothing on stderr" {
  _arc_make_board
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [ -z "$ARC_LINT_STDERR" ]
}

@test "root-mode: an initiatives dir holding no valid lane is root-mode, not a dead end" {
  # git does not track empty directories, so a stray mkdir must not strand the lint in a
  # verdict about a lane set that does not exist. Same rule as lane-resolve.sh:172-175.
  mkdir -p "$SANDBOX/initiatives"
  _arc_make_board
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "root-mode: a directory whose name breaks the lane grammar is not a lane" {
  mkdir -p "$SANDBOX/initiatives/Design"
  _arc_make_board
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "root-mode: no PORTFOLIO.md at all is silent rather than a crash" {
  _arc_make_lane design IDLE "test cycle"
  rm -f "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
}

# ---------- board-row-no-lane (ADR-0061, rows -> lanes) ----------

@test "board-row-no-lane: a row naming a lane that does not exist" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture" \
                  "ghost|LIVE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-row-no-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "board-row-no-lane: the WARN names the row line and offers both real corrections" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture" \
                  "ghost|LIVE|test cycle|00 $DASH fixture"
  _bl
  [[ "$ARC_LINT_OUTPUT" == *"no row, or a lane directory initiatives/ghost/"* ]]
  [[ "$ARC_LINT_OUTPUT" == *"row present, initiatives/ghost/ absent from the lane inventory"* ]]
  [[ "$ARC_LINT_OUTPUT" == *'/arc-kickoff --lane ghost'* ]]
}

# ---------- lane-no-board-row (ADR-0061, lanes -> rows) ----------

@test "lane-no-board-row: a lane directory with a header but no row" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_lane orphan LIVE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape lane-no-board-row "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "lane-no-board-row: it cites the lane file and its Example is a paste-able row" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_lane orphan LIVE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  # loc-kind `file`: a BARE repo-relative path, no line suffix on the WARN head.
  [[ "$ARC_LINT_OUTPUT" == *"WARN [lane-no-board-row] PORTFOLIO.md "* ]]
  [[ "$ARC_LINT_OUTPUT" == *"| orphan | LIVE | test cycle |"* ]]
}

# ---------- board-venture-in-initiatives (ADR-0059) ----------

@test "board-venture-in-initiatives: a passport pasted into the initiatives table" {
  # Classification order is load-bearing: the iff check would tell the operator to run
  # /arc-kickoff --lane lexos, which is exactly what ADR-0059 forbids.
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture" \
                  "lexos|LIVE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-venture-in-initiatives "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "board-venture-in-initiatives: it never advises creating the lane" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture" \
                  "lexos|LIVE|test cycle|00 $DASH fixture"
  _bl
  [[ "$ARC_LINT_OUTPUT" == *"initiatives/lexos/ must never be created"* ]]
  [[ "$ARC_LINT_OUTPUT" != *'/arc-kickoff --lane lexos'* ]]
  # The venture row must not ALSO be reported as a row with no lane. Asserted by absence of
  # the class name in the output, never by calling the shape assertion and inverting it --
  # negating or or-ing that call disarms it, and the section-A ratchet greps every call
  # site in this repo for exactly those wrappers.
  [[ "$ARC_LINT_OUTPUT" != *"board-row-no-lane"* ]]
}

# ---------- board-bad-status ----------

@test "board-bad-status: a board status outside the ADR-0051 vocabulary" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|SHIPPED|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-bad-status "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "board-bad-status: Expected names the vocabulary and cites the lane header line" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|SHIPPED|test cycle|00 $DASH fixture"
  _bl
  [[ "$ARC_LINT_OUTPUT" == *"one of LIVE|BLOCKED|QUEUED|IDLE"* ]]
  [[ "$ARC_LINT_OUTPUT" == *"initiatives/design/PROGRESS.md:3"* ]]
  [[ "$ARC_LINT_OUTPUT" == *'column `status`'* ]]
}

@test "board-bad-status: a header with no valid status is reported against the header" {
  _arc_make_lane design IDLE "test cycle"
  sed -i.bak 's/^status: IDLE$/status: SHIPPED/' "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-bad-status "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"machine header carries no valid status"* ]]
  # The Example must stay paste-able: the board's own valid status fills the cell.
  [[ "$ARC_LINT_OUTPUT" == *"| design | IDLE | test cycle |"* ]]
}

# ---------- board-header-drift ----------

@test "board-header-drift: a hand-edited status cell disagrees with the lane header" {
  _arc_make_lane design LIVE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-header-drift "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "board-header-drift: Expected is the header value and cites the header line" {
  _arc_make_lane design LIVE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  # `status:` is line 3 of the file _arc_make_lane writes. A WARN citing the right file and
  # the wrong line passes the shape helper, so the line number is pinned here.
  [[ "$ARC_LINT_OUTPUT" == *"Expected: LIVE   $_ARC_WARN_ARROW initiatives/design/PROGRESS.md:3"* ]]
  [[ "$ARC_LINT_OUTPUT" == *'Found:    IDLE'* ]]
}

@test "board-header-drift: the cycle column drifts independently of status" {
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|other cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-header-drift "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *'column `cycle` disagrees'* ]]
}

@test "board-header-drift: the position column derives from the header key phase" {
  # A name-driven lookup for a key called `position` returns the empty string and the lint
  # emits a confident WARN about its own failed lookup. The map is a closed table.
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|test cycle|01 $DASH wrong"
  _bl
  _arc_warn_shape board-header-drift "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *'column `position` disagrees with its lane header key `phase`'* ]]
}

@test "board-header-drift: look-alike bytes are named rather than left invisible" {
  # U+2013 and U+2014 are one byte apart and pixel-identical in a CI log. A WARN whose two
  # values render identically is a muted WARN.
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $(printf '\342\200\223') fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-header-drift "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"header bytes "* ]]
  [[ "$ARC_LINT_OUTPUT" == *"board bytes "* ]]
}

# ---------- board-bad-dependency-line ----------

@test "board-bad-dependency-line: a dependency cell that is not the ADR-0051 convention" {
  _matching design IDLE
  sed -i.bak "s@| $DASH | $DASH |@| blocked by stuff | $DASH |@" "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-bad-dependency-line "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "board-bad-dependency-line: the Example keeps the words and supplies the target" {
  # A cell with words is a real dependency missing its target, so the correction must not
  # silently delete the fact.
  _matching design IDLE
  sed -i.bak "s@| $DASH | $DASH |@| blocked by stuff | $DASH |@" "$SANDBOX/PORTFOLIO.md"
  _bl
  [[ "$ARC_LINT_OUTPUT" == *"external $DASH blocked by stuff"* ]]
}

@test "board-bad-dependency-line: a look-alike dash is not the empty marker" {
  # An en dash is not U+2014. "is this cell empty" is a byte comparison, never a
  # dash-shaped character class and never a length test.
  _matching design IDLE
  sed -i.bak "s@| $DASH | $DASH |@| $(printf '\342\200\223') | $DASH |@" "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-bad-dependency-line "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "board-bad-dependency-line: a well-formed populated cell is accepted" {
  _arc_make_lane design IDLE "test cycle"
  sed -i.bak "s/^blocked-on: $DASH\$/blocked-on: external $DASH vendor api/" \
    "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  sed -i.bak "s@| $DASH | $DASH |@| external $DASH vendor api / $DASH | $DASH |@" \
    "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [[ "$ARC_LINT_OUTPUT" != *"board-bad-dependency-line"* ]]
}

# ---------- lane-no-machine-header (ADR-0062) ----------

@test "lane-no-machine-header: a lane whose PROGRESS.md carries no header block" {
  _arc_make_lane design IDLE "test cycle"
  mkdir -p "$SANDBOX/initiatives/bare"
  printf '# PROGRESS.md\n\n## Now\n\nnothing derivable here.\n' \
    > "$SANDBOX/initiatives/bare/PROGRESS.md"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape lane-no-machine-header "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "lane-no-machine-header: a lane directory with no PROGRESS.md at all" {
  _arc_make_lane design IDLE "test cycle"
  mkdir -p "$SANDBOX/initiatives/empty"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape lane-no-machine-header "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"has no readable PROGRESS.md"* ]]
}

@test "lane-no-machine-header: one defect gets one WARN, not two" {
  # A headerless lane also has no row. Reporting both would make the count non-deterministic
  # and hand the operator an Example of seven (none) cells.
  _arc_make_lane design IDLE "test cycle"
  mkdir -p "$SANDBOX/initiatives/empty"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [[ "$ARC_LINT_OUTPUT" != *"lane-no-board-row"* ]]
}

@test "lane-no-machine-header: an unclosed fence that swallows the header is named as such" {
  _arc_make_lane design IDLE "test cycle"
  mkdir -p "$SANDBOX/initiatives/fenced"
  printf '# PROGRESS.md\n\n```\nstatus: LIVE\ncycle: x\n\n## Now\n' \
    > "$SANDBOX/initiatives/fenced/PROGRESS.md"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape lane-no-machine-header "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"swallowed by a fenced block that never closes"* ]]
}

# ---------- board-stale-updated ----------

@test "board-stale-updated: Updated older than the newest lane header commit" {
  # Freshness is measured against the repo's own facts, never date +%F: a gate whose verdict
  # changes with the day it runs is not reporting on the thing.
  _matching design IDLE
  git -C "$SANDBOX" add -A
  GIT_AUTHOR_DATE="2026-07-31T10:00:00" GIT_COMMITTER_DATE="2026-07-31T10:00:00" \
    git -C "$SANDBOX" commit -qm "seed lane"
  sed -i.bak 's/^Updated: .*/Updated: 2026-07-01/' "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-stale-updated "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"Example:  Updated: 2026-07-31"* ]]
}

@test "board-stale-updated: an unpadded date is refused rather than read as fresh" {
  # 2026-8-1 sorts AFTER 2026-12-31, so an unpadded date would read as permanently fresh.
  _matching design IDLE
  git -C "$SANDBOX" add -A
  GIT_AUTHOR_DATE="2026-07-31T10:00:00" GIT_COMMITTER_DATE="2026-07-31T10:00:00" \
    git -C "$SANDBOX" commit -qm "seed lane"
  sed -i.bak 's/^Updated: .*/Updated: 2026-8-1/' "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-stale-updated "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"not a zero-padded ISO date"* ]]
}

@test "board-stale-updated: an uncommitted sandbox has no reference date and stays silent" {
  # No reference date means no verdict: WARN-first never invents a fact. This is also what
  # keeps the class from firing on a shallow CI clone, where every path dates to the tip.
  _matching design IDLE
  sed -i.bak 's/^Updated: .*/Updated: 2020-01-01/' "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [[ "$ARC_LINT_OUTPUT" != *"board-stale-updated"* ]]
}

# ---------- the two parsers must agree (spec section B) ----------

@test "parsers: board-lint and lane-resolve read the same status from an awkward header" {
  # Tolerant DETECTION, strict value grammar: bold key, odd case, leading whitespace, a
  # repeated key where the LAST wins, and a fenced block that must be skipped entirely.
  mkdir -p "$SANDBOX/initiatives/design"
  printf '# PROGRESS.md\n\n  **Status**:  BLOCKED\ncycle: test cycle\n' \
    > "$SANDBOX/initiatives/design/PROGRESS.md"
  printf '```\nstatus: LIVE\n```\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  printf 'status: IDLE\nphase: 00 %s fixture\nappetite: 3d\nburn: 0d\n' "$DASH" \
    >> "$SANDBOX/initiatives/design/PROGRESS.md"
  printf 'blocked-on: %s\ndepends-on: %s\n\n## Now\n' "$DASH" "$DASH" \
    >> "$SANDBOX/initiatives/design/PROGRESS.md"
  # The resolver's verdict: IDLE is not eligible, so it counts zero lanes.
  run bash "$SANDBOX/.claude/scripts/core/lane-resolve.sh" --root "$SANDBOX" --for resume
  [ "$(_arc_field counted)" = "0" ]
  # The lint's verdict on the same bytes: a board saying IDLE is silent, so it read IDLE too.
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [[ "$ARC_LINT_OUTPUT" != *"board-header-drift"* ]]
}

@test "parsers: a heading ends the header block for both readers" {
  mkdir -p "$SANDBOX/initiatives/design"
  printf '# PROGRESS.md\n\nstatus: IDLE\ncycle: test cycle\nphase: 00 %s fixture\n' "$DASH" \
    > "$SANDBOX/initiatives/design/PROGRESS.md"
  printf 'appetite: 3d\nburn: 0d\nblocked-on: %s\ndepends-on: %s\n\n' "$DASH" "$DASH" \
    >> "$SANDBOX/initiatives/design/PROGRESS.md"
  printf '## Now\n\nstatus: LIVE\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

# ---------- board grammar: the inputs a first draft gets wrong ----------

@test "board: the HTML comment block is not parsed as rows" {
  # The shipped PORTFOLIO.md ends with a commented-out note that MENTIONS lane names and row
  # syntax. A parser that reads it invents lanes nobody wrote.
  _matching design IDLE
  printf '\n<!--\n| develop | LIVE | x | y | 3d / 0d | %s | %s |\n-->\n' "$DASH" "$DASH" \
    >> "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [[ "$ARC_LINT_OUTPUT" != *"develop"* ]]
}

@test "board: a venture row is grammar-checked but exempt from the directory check" {
  # ADR-0059: a passport row is the whole of a venture's presence. Applying the iff rule to
  # the passports table would demand initiatives/lexos/, which is precisely forbidden.
  _matching design IDLE
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [[ "$ARC_LINT_OUTPUT" != *"lexos"* ]]
}

@test "board: CRLF line endings do not change any verdict" {
  _matching design IDLE
  awk '{ printf "%s\r\n", $0 }' "$SANDBOX/PORTFOLIO.md" > "$SANDBOX/PORTFOLIO.crlf"
  mv "$SANDBOX/PORTFOLIO.crlf" "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "board: a trailing-space column is not drift" {
  _matching design IDLE
  sed -i.bak 's/| IDLE |/| IDLE  |/' "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "board: a row with the wrong column count reports no invented per-column drift" {
  # There is no column-count class and inventing one is forbidden, so the positional read is
  # suppressed. A deliberate stated silence beats a guess about which cell is which.
  _matching design IDLE
  sed -i.bak "s@^| design | IDLE |.*@| design | IDLE | test cycle |@" "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [[ "$ARC_LINT_OUTPUT" != *"board-header-drift"* ]]
  [[ "$ARC_LINT_OUTPUT" != *"lane-no-board-row"* ]]
}

@test "board: a table under the wrong heading is not the initiatives table" {
  _arc_make_lane design IDLE "test cycle"
  {
    echo "# PORTFOLIO.md"
    echo ""
    echo "Updated: 2026-07-31"
    echo ""
    echo "## Notes"
    echo ""
    echo "| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |"
    echo "|---|---|---|---|---|---|---|"
    echo "| design | LIVE | wrong | wrong | 9d / 9d | $DASH | $DASH |"
  } > "$SANDBOX/PORTFOLIO.md"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  # The rows above are not in Active initiatives, so design has no row at all.
  _arc_warn_shape lane-no-board-row "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "board: a lane name with a unicode look-alike never reaches the log raw" {
  # A lane name is ASCII by grammar, so a non-ASCII byte in one is a Cyrillic look-alike or
  # a stray control byte. lane-resolve.sh:95's renderer maps it to `?`.
  #
  # PER BYTE, not per character: Cyrillic small ghe is the two bytes D0 B3 under LC_ALL=C,
  # and `tr -c` substitutes each one, so the rendered name is `desi??n`. Asserting a single
  # `?` here is what CI caught on all three legs -- the renderer was right and the fixture
  # was counting characters in a file that is pinned to byte semantics.
  _arc_make_lane design IDLE "test cycle"
  _arc_make_board "design|IDLE|test cycle|00 $DASH fixture" \
                  "$(printf 'desi\320\263n')|LIVE|test cycle|00 $DASH fixture"
  _bl
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape board-row-no-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"desi??n"* ]]
  # and the point of the class: the raw bytes must not survive into the log at all
  [[ "$ARC_LINT_OUTPUT" != *"$(printf 'desi\320\263n')"* ]]
}

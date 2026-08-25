#!/usr/bin/env bats
# Cycle 4 portfolio — Phase 01 (REQ-02): the self-hosting move.
#
# This phase physically relocates arc's own tracker into initiatives/portfolio/. The
# risk it carries is A5, which FIRED on 2026-07-31 for a mechanism (locale collation)
# that is NOT the one this phase depends on — `git mv` casing was A5's original
# subject and went untested. So the casing half is pinned here, first, before the
# mover exists.
#
# The failure being guarded is the SILENT one. On a case-folding filesystem
# (Windows, default macOS) `mkdir initiatives/design` succeeds when
# `initiatives/Design` is already on disk — and lands inside `Design`. The mover then
# reports a successful migration into a directory the RESOLVER cannot see, because
# lane membership is decided by exact comparison against readdir and `Design` fails
# the grammar. Tracker gone, lane invisible, exit code 0.
#
# Two rules follow, and every test below exists to hold one of them:
#   1. IDENTICAL ON THREE LEGS. A case-only collision is refused everywhere — never
#      "works on Linux, refuses on Windows". A deterministic refusal is identical by
#      construction; a success would depend on the filesystem underneath.
#   2. ASK GIT, NOT THE PATH STRING. What moved is read out of git's index (paths
#      compared byte-for-byte, blob oids compared before/after). A path-string compare
#      is exactly what a case-folding filesystem defeats.
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_teardown; }

# ---------- A5: the casing half, pinned ----------

@test "migrate: refuses a target lane whose directory exists under a different case (A5)" {
  _arc_migrate_sandbox
  mkdir -p initiatives/Design
  printf 'placeholder\n' > initiatives/Design/NOTES.md
  git add -A && git commit -qm "lane dir with a capital"

  run _arc_migrate --lane design
  [ "$status" -eq 6 ]
  [[ "$output" == *"STOP"* ]]
  # Both byte-strings are named, so the operator can see WHY it folded.
  [[ "$output" == *"Design"* ]]
  [[ "$output" == *"design"* ]]
}

@test "migrate: the case-fold refusal leaves git's record completely untouched" {
  _arc_migrate_sandbox
  mkdir -p initiatives/Design
  printf 'placeholder\n' > initiatives/Design/NOTES.md
  git add -A && git commit -qm "lane dir with a capital"
  before="$(_arc_oid PLAN.md)"

  run _arc_migrate --lane design
  [ "$status" -eq 6 ]
  # Nothing half-moved: the tracker is still at the root, byte-identical blob.
  _arc_in_index "PLAN.md"
  [ "$(_arc_oid PLAN.md)" = "$before" ]
  ! _arc_in_index "initiatives/design/PLAN.md"
  ! _arc_in_index "initiatives/Design/PLAN.md"
  # And the working tree is clean — a refusal that stages something is not a refusal.
  [ -z "$(git -C "$SANDBOX" status --porcelain)" ]
}

@test "migrate: --dry-run refuses the same case-fold (the guard is not real-run-only)" {
  _arc_migrate_sandbox
  mkdir -p initiatives/Design
  printf 'placeholder\n' > initiatives/Design/NOTES.md
  git add -A && git commit -qm "lane dir with a capital"

  run _arc_migrate --lane design --dry-run
  [ "$status" -eq 6 ]
  [[ "$output" == *"STOP"* ]]
}

@test "migrate: a lane colliding only in case with a VALID lane is refused as already-existing" {
  _arc_migrate_sandbox
  _arc_make_lane portfolio LIVE
  git add -A && git commit -qm "existing lane"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"already"* ]]
}

# ---------- ask git, not the path string ----------

@test "migrate: the new paths are in git's index, byte-exact, carrying the same blob oids" {
  _arc_migrate_sandbox
  oid_plan="$(_arc_oid PLAN.md)"
  oid_p00="$(_arc_oid phases/phase-00-spec.md)"
  oid_p01="$(_arc_oid phases/phase-01-spec.md)"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]

  _arc_in_index "initiatives/portfolio/PLAN.md"
  _arc_in_index "initiatives/portfolio/PROGRESS.md"
  _arc_in_index "initiatives/portfolio/phases/phase-00-spec.md"
  _arc_in_index "initiatives/portfolio/phases/phase-01-spec.md"
  # Same content moved, not a copy-and-rewrite: git's own oid says so. PROGRESS.md is
  # excluded on purpose — it is moved AND amended with the ADR-0051 machine header in
  # this same commit, so an unchanged oid there would mean the header never landed.
  [ "$(_arc_oid initiatives/portfolio/PLAN.md)" = "$oid_plan" ]
  [ "$(_arc_oid initiatives/portfolio/phases/phase-00-spec.md)" = "$oid_p00" ]
  [ "$(_arc_oid initiatives/portfolio/phases/phase-01-spec.md)" = "$oid_p01" ]
}

@test "migrate: PROGRESS.md is amended, never rewritten -- the original body survives" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  grep -q "^# PROGRESS.md fixture"   "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  grep -q "^## Now"                  "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  grep -q "fixture\."                "$SANDBOX/initiatives/portfolio/PROGRESS.md"
}

@test "migrate: refuses to invent machine-header values it was not given" {
  _arc_migrate_sandbox
  run _arc_migrate_raw --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"--cycle"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses a status outside the ADR-0051 vocabulary" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio --status ACTIVE
  [ "$status" -eq 2 ]
  [[ "$output" == *"LIVE"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: reports what it moved from git's record, not from its own intentions" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  # The transcript is evidence for the phase, so it must name every path pair.
  [[ "$output" == *"PLAN.md -> initiatives/portfolio/PLAN.md"* ]]
  [[ "$output" == *"PROGRESS.md -> initiatives/portfolio/PROGRESS.md"* ]]
  [[ "$output" == *"phases/phase-00-spec.md -> initiatives/portfolio/phases/phase-00-spec.md"* ]]
  [[ "$output" == *"verified against git index"* ]]
}

@test "migrate: the old tracker paths are gone from the index (only stubs remain)" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  ! _arc_in_index "phases/phase-00-spec.md"
  ! _arc_in_index "phases/phase-01-spec.md"
}

# ---------- dry run ----------

@test "migrate: --dry-run prints the whole plan and changes absolutely nothing" {
  _arc_migrate_sandbox
  before="$(git -C "$SANDBOX" ls-files | LC_ALL=C sort)"

  run _arc_migrate --lane portfolio --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRY RUN"* ]]
  [[ "$output" == *"PLAN.md -> initiatives/portfolio/PLAN.md"* ]]
  [[ "$output" == *"phases/phase-01-spec.md -> initiatives/portfolio/phases/phase-01-spec.md"* ]]

  [ "$(git -C "$SANDBOX" ls-files | LC_ALL=C sort)" = "$before" ]
  [ -z "$(git -C "$SANDBOX" status --porcelain)" ]
  [ ! -d "$SANDBOX/initiatives" ]
}

# ---------- preconditions ----------

@test "migrate: refuses a dirty working tree (the move must be one reviewable commit)" {
  _arc_migrate_sandbox
  printf 'uncommitted\n' >> PLAN.md

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"uncommitted"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses an invalid lane name using the resolver's own grammar" {
  _arc_migrate_sandbox
  run _arc_migrate --lane Portfolio
  [ "$status" -eq 5 ]
  [[ "$output" == *"invalid lane name"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses a reserved device name on every OS, not just Windows" {
  _arc_migrate_sandbox
  run _arc_migrate --lane con
  [ "$status" -eq 5 ]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses when the root tracker is not there to move" {
  _arc_migrate_sandbox
  git rm -q PLAN.md && git commit -qm "no plan"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"PLAN.md"* ]]
}

# ---------- holes found by the adversarial pass, each pinned by the input that found it ----------
#
# All three were live in the first green version of the mover. None was found by
# reading it; each was found by building the input that breaks it.

@test "migrate: two --lane flags with different values is an operator error, not last-wins" {
  # Found by: --lane design --lane portfolio. The mover collapsed them to the last one
  # and forwarded only that to the resolver, so the resolver's own duplicate rule
  # (.claude/rules/lanes.md, exit 5) never saw a duplicate — and a whole tracker would
  # have moved into a lane the operator named only by accident.
  _arc_migrate_sandbox
  run _arc_migrate --lane design --lane portfolio --dry-run
  [ "$status" -eq 5 ]
  [[ "$output" == *"more than once"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: the same --lane value twice is not an error (nothing is ambiguous)" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio --lane portfolio --dry-run
  [ "$status" -eq 0 ]
}

@test "migrate: a root outside a git work tree STOPs instead of passing every check" {
  # Found by: --root <plain directory>. `git status --porcelain` wrote its error to
  # stderr and an EMPTY stdout, which reads exactly like a clean tree — so the
  # dirty-tree guard could not fail, and the run got as far as git mv. A check that
  # cannot fail is Phase 00's lesson repeating.
  NOTREPO="$(mktemp -d)"
  mkdir -p "$NOTREPO/phases"
  printf 'plan\n'     > "$NOTREPO/PLAN.md"
  printf 'progress\n' > "$NOTREPO/PROGRESS.md"
  printf 'spec\n'     > "$NOTREPO/phases/phase-00-spec.md"

  run bash "$ARC_MIGRATE_SRC" --root "$NOTREPO" \
      --lane portfolio --cycle c --phase p --appetite 1d --burn 0d
  [ "$status" -eq 2 ]
  [[ "$output" == *"not inside a git work tree"* ]]
  [ ! -d "$NOTREPO/initiatives" ]
  rm -r "$NOTREPO"
}

@test "migrate: tracker presence is read from git's index, not from a folding filesystem" {
  # Found by: an index that says `Phases/` on a case-folding checkout. `[ -e phases ]`
  # answers TRUE on Windows/macOS and false on Linux for the identical repo — a
  # one-OS surprise in the exact shape A5 named. Deciding from `git ls-files` gives
  # the same answer on all three legs: this tracker is not the one we were asked for.
  _arc_migrate_sandbox
  git mv phases Phases-tmp && git mv Phases-tmp Phases
  git commit -qm "phases dir with a capital"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"phases/"* ]]
  [[ "$output" == *"index"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

# ---------- what must NOT move ----------

@test "migrate: frozen docs/archive and docs/evidence are not touched (ADR-0058)" {
  _arc_migrate_sandbox
  oid_arch="$(_arc_oid docs/archive/old-cycle.md)"
  oid_ev="$(_arc_oid docs/evidence/phase-00/proof.txt)"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  _arc_in_index "docs/archive/old-cycle.md"
  _arc_in_index "docs/evidence/phase-00/proof.txt"
  [ "$(_arc_oid docs/archive/old-cycle.md)" = "$oid_arch" ]
  [ "$(_arc_oid docs/evidence/phase-00/proof.txt)" = "$oid_ev" ]
  ! _arc_in_index "initiatives/portfolio/evidence/phase-00/proof.txt"
}

# ---------- pointer stubs + the resolver's verdict afterwards ----------

@test "migrate: pointer stubs stay at the old root paths and name the new home" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  _arc_in_index "PLAN.md"
  _arc_in_index "PROGRESS.md"
  grep -q "initiatives/portfolio/PLAN.md"     "$SANDBOX/PLAN.md"
  grep -q "initiatives/portfolio/PROGRESS.md" "$SANDBOX/PROGRESS.md"
  # A stub must not read as a tracker: no ## Now section for a hook to scrape.
  ! grep -q "^## Now" "$SANDBOX/PROGRESS.md"
}

@test "migrate: after the move the resolver auto-resolves the new lane" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]

  run bash "$SANDBOX/.claude/scripts/core/lane-resolve.sh" --root "$SANDBOX" --for resume
  [ "$status" -eq 0 ]
  [ "$(_arc_field mode)" = "lane" ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field via)" = "auto" ]
  [ "$(_arc_field tracker)" = "initiatives/portfolio" ]
}

@test "migrate: the moved PROGRESS.md opens with the ADR-0051 machine header" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^status: LIVE"
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^cycle: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^phase: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^appetite: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^burn: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^blocked-on: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^depends-on: "
}

@test "migrate: refuses to run twice -- the second run finds a lane, not a root tracker" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  git -C "$SANDBOX" commit -qm "the move"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"already"* ]]
}

# ---------- SessionStart degraded rule (ADR-0054 · pack §4 round 5) ----------
#
# A passive hook cannot ask a question, so it may never guess an answer either. The
# rule has exactly three branches and each one is pinned below:
#   no lanes at all           -> ROOT-MODE, byte-identical to pre-portfolio arc
#   exactly one eligible lane -> canonical order: lane echo -> board -> ## Now
#   zero or 2+ eligible       -> board + one hint line, and NOTHING is selected
#
# The move itself created the need: with the tracker at initiatives/portfolio/, the
# root PROGRESS.md is a pointer stub with no `## Now`, so a hook that keeps reading
# the root path reports an EMPTY position and looks like it worked.

@test "session-start: root-mode prints no lane line and no board line" {
  _arc_tracker_sandbox
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" != *"Selected lane:"* ]]
  [[ "$output" != *"Board"* ]]
  [[ "$output" == *"fixture position line one"* ]]
}

@test "session-start: exactly one eligible lane is auto-selected and echoed first" {
  _arc_tracker_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" == *"Selected lane: portfolio (via auto)"* ]]
}

@test "session-start: the position comes from the LANE's tracker, not the root stub" {
  _arc_tracker_sandbox
  _arc_make_lane portfolio LIVE
  # The root file is what a post-migration repo really has: a stub with no ## Now.
  printf '# PROGRESS.md — moved\n\nSee initiatives/portfolio/PROGRESS.md\n' > PROGRESS.md
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" == *"initiatives/portfolio/PROGRESS.md"* ]]
  [[ "$output" == *"**Position:** fixture."* ]]
  [[ "$output" != *"fixture position line one"* ]]
}

@test "session-start: two eligible lanes select NOTHING and print the hint" {
  _arc_tracker_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design BLOCKED
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" != *"Selected lane:"* ]]
  [[ "$output" == *"/arc-resume --lane"* ]]
  [[ "$output" == *"portfolio"* ]]
  [[ "$output" == *"design"* ]]
}

@test "session-start: BLOCKED counts as eligible -- it is attention, not absence" {
  _arc_tracker_sandbox
  _arc_make_lane portfolio BLOCKED
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" == *"Selected lane: portfolio (via auto)"* ]]
}

@test "session-start: lanes exist but none eligible -- hint, no selection, no crash" {
  _arc_tracker_sandbox
  _arc_make_lane portfolio IDLE
  _arc_make_lane design IDLE
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" != *"Selected lane:"* ]]
  [[ "$output" == *"/arc-resume --lane"* ]]
}

@test "session-start: the board summary appears, and only when there is a board" {
  _arc_tracker_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" != *"Board"* ]]

  _arc_make_board "portfolio|LIVE|arc-portfolio|phase 01" "design|IDLE|arc-design|closed"
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" == *"Board"* ]]
  [[ "$output" == *"Updated: 2026-07-31"* ]]
  [[ "$output" == *"portfolio LIVE"* ]]
  [[ "$output" == *"design IDLE"* ]]
  # The passports table is a different table; a venture must never read as a lane.
  [[ "$output" != *"lexos"* ]]
}

@test "session-start: canonical order -- lane echo, then board, then the position" {
  _arc_tracker_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_board "portfolio|LIVE|arc-portfolio|phase 01"
  run _arc_session_start
  [ "$status" -eq 0 ]
  lane_at="$(printf '%s\n' "$output" | grep -n "Selected lane:"  | head -n1 | cut -d: -f1)"
  board_at="$(printf '%s\n' "$output" | grep -n "Board"          | head -n1 | cut -d: -f1)"
  pos_at="$(printf '%s\n' "$output"   | grep -n "Build status"   | head -n1 | cut -d: -f1)"
  [ -n "$lane_at" ] && [ -n "$board_at" ] && [ -n "$pos_at" ]
  [ "$lane_at" -lt "$board_at" ]
  [ "$board_at" -lt "$pos_at" ]
}

@test "session-start: an initiatives/ dir holding no valid lane is root-mode, not a dead end" {
  _arc_tracker_sandbox
  mkdir -p initiatives/.keep-me-not-a-lane
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" != *"Selected lane:"* ]]
  [[ "$output" != *"/arc-resume --lane"* ]]
  [[ "$output" == *"fixture position line one"* ]]
}

@test "session-start: stays advisory -- exits 0 even with an unreadable lane tracker" {
  _arc_tracker_sandbox
  mkdir -p initiatives/portfolio
  printf 'status: LIVE\n' > initiatives/portfolio/PROGRESS.md   # no ## Now at all
  run _arc_session_start
  [ "$status" -eq 0 ]
  [[ "$output" == *"Selected lane: portfolio (via auto)"* ]]
}

# ---------- board v1 + the migrated repo, asserted against THIS repo ----------
#
# Sandboxes prove the machinery; these prove the actual tree the machinery now runs on.
# They are the "verified against the real system" half of Phase 01's DoD, and they are
# the reason a hand-edit to PORTFOLIO.md cannot quietly drift from the lanes it claims
# to index — the board is a VIEW (ADR-0051), so every value here has a source, and each
# test below names the source it checks against.

@test "board: PORTFOLIO.md exists with both tables and a dated Updated line" {
  [ -f "$ARC_ROOT/PORTFOLIO.md" ]
  grep -qE '^Updated: 20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]$' "$ARC_ROOT/PORTFOLIO.md"
  grep -qE '^##[[:space:]]+Active initiatives[[:space:]]*$' "$ARC_ROOT/PORTFOLIO.md"
  grep -qE '^##[[:space:]]+Venture passports[[:space:]]*$'  "$ARC_ROOT/PORTFOLIO.md"
}

@test "board: every initiatives row resolves to an initiatives/<lane>/ directory" {
  run _arc_board_rows "$ARC_ROOT/PORTFOLIO.md" "active initiatives"
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  while IFS="$(printf '\t')" read -r lane _st; do
    [ -n "$lane" ] || continue
    [ -d "$ARC_ROOT/initiatives/$lane" ] || { echo "board row '$lane' has no initiatives/$lane/"; return 1; }
  done <<< "$output"
}

@test "board: every lane directory with a tracker has a board row (drift runs both ways)" {
  rows="$(_arc_board_rows "$ARC_ROOT/PORTFOLIO.md" "active initiatives" | cut -f1)"
  for d in "$ARC_ROOT"/initiatives/*/; do
    [ -d "$d" ] || continue
    lane="$(basename "$d")"
    [ -f "$d/PROGRESS.md" ] || continue
    printf '%s\n' "$rows" | grep -qx "$lane" || { echo "lane '$lane' is not on the board"; return 1; }
  done
}

@test "board: each row's status is the one in that lane's PROGRESS machine header" {
  # ADR-0051's single-source rule, enforced rather than asserted: the board copies
  # nothing by hand, so a hand-edited status here must not survive.
  run _arc_board_rows "$ARC_ROOT/PORTFOLIO.md" "active initiatives"
  [ "$status" -eq 0 ]
  while IFS="$(printf '\t')" read -r lane st; do
    [ -n "$lane" ] || continue
    prog="$ARC_ROOT/initiatives/$lane/PROGRESS.md"
    [ -f "$prog" ] || continue
    hdr="$(_arc_lane_header "$prog" status)"
    [ "$st" = "$hdr" ] || { echo "board says '$lane' is $st; its header says $hdr"; return 1; }
  done <<< "$output"
}

@test "board: statuses come from the ADR-0051 vocabulary only" {
  run _arc_board_rows "$ARC_ROOT/PORTFOLIO.md" "active initiatives"
  [ "$status" -eq 0 ]
  while IFS="$(printf '\t')" read -r lane st; do
    [ -n "$lane" ] || continue
    case "$st" in LIVE|BLOCKED|QUEUED|IDLE) ;; *) echo "bad status '$st' for '$lane'"; return 1;; esac
  done <<< "$output"
}

@test "board: no venture leaks into the initiatives table (the boundary stays clean)" {
  lanes="$(_arc_board_rows "$ARC_ROOT/PORTFOLIO.md" "active initiatives" | cut -f1)"
  vents="$(_arc_board_rows "$ARC_ROOT/PORTFOLIO.md" "venture passports" | cut -f1)"
  [ -n "$vents" ]
  for v in $vents; do
    printf '%s\n' "$lanes" | grep -qx "$v" && { echo "venture '$v' also appears as a lane"; return 1; }
    [ -d "$ARC_ROOT/initiatives/$v" ] && { echo "venture '$v' has a lane directory"; return 1; }
  done
  return 0
}

# These two assert the RULE, not today's cycle state. The original pinned
# "auto-resolves to portfolio, counted == 1", which was true only while exactly one lane
# was LIVE; closing Cycle 4 put both lanes IDLE and turned a correct resolver into a red
# suite. A test that has to be edited every time a cycle opens or closes is measuring the
# calendar, not the resolver -- so the count-dependent branch is now part of the assertion.
@test "repo: this tree is in lane-mode, and resolution follows the live lane count" {
  run bash "$ARC_CORE_SRC/lane-resolve.sh" --root "$ARC_ROOT" --for resume
  # Permanently true here: initiatives/ holds valid lanes, so this repo is never root-mode.
  [ "$(_arc_field mode)" = "lane" ]
  counted="$(_arc_field counted)"
  case "$counted" in
    1)  # exactly one eligible lane -> auto-resolve to it
        [ "$status" -eq 0 ]
        [ "$(_arc_field via)" = "auto" ]
        [ -n "$(_arc_field lane)" ]
        ;;
    *)  # zero or 2+ eligible -> ask, never guess (ADR-0054); exit 3, no lane selected
        [ "$status" -eq 3 ]
        [ -z "$(_arc_field lane)" ]
        ;;
  esac
}

@test "repo: --lane portfolio resolves whatever the cycle state (explicit beats auto)" {
  run bash "$ARC_CORE_SRC/lane-resolve.sh" --root "$ARC_ROOT" --for resume --lane portfolio
  [ "$status" -eq 0 ]
  [ "$(_arc_field mode)" = "lane" ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field via)" = "arg" ]
}

@test "repo: the live tracker is at initiatives/portfolio/ and the root paths are stubs" {
  [ -f "$ARC_ROOT/initiatives/portfolio/PLAN.md" ]
  [ -f "$ARC_ROOT/initiatives/portfolio/PROGRESS.md" ]
  [ -d "$ARC_ROOT/initiatives/portfolio/phases" ]
  grep -q "initiatives/portfolio/PLAN.md"     "$ARC_ROOT/PLAN.md"
  grep -q "initiatives/portfolio/PROGRESS.md" "$ARC_ROOT/PROGRESS.md"
  # A stub must not read as a tracker for anything that scrapes the old path.
  ! grep -q "^## Now" "$ARC_ROOT/PROGRESS.md"
}

@test "repo: the portfolio lane carries a complete ADR-0051 machine header" {
  prog="$ARC_ROOT/initiatives/portfolio/PROGRESS.md"
  for k in status cycle phase appetite burn blocked-on depends-on; do
    v="$(_arc_lane_header "$prog" "$k")"
    [ -n "$v" ] || { echo "machine header field '$k' is empty"; return 1; }
  done
  # Valid vocabulary, not a pinned value: `status` is LIVE mid-cycle and IDLE once the
  # cycle closes, and both are correct. What must never happen is a status outside the
  # vocabulary the board derives from (ADR-0051).
  case "$(_arc_lane_header "$prog" status)" in
    LIVE|BLOCKED|QUEUED|IDLE) ;;
    *) echo "status '$(_arc_lane_header "$prog" status)' is outside LIVE|BLOCKED|QUEUED|IDLE"; return 1;;
  esac
}

@test "design: the lane links its history and copies none of it (ADR-0058)" {
  idx="$ARC_ROOT/initiatives/design/HISTORY-INDEX.md"
  [ -f "$idx" ]
  grep -q "docs/archive/"  "$idx"
  grep -q "docs/evidence/" "$idx"
  # Link, never copy -- asserted as a COPY check rather than as "these directories must not
  # exist". The original form pinned "design is IDLE forever" as an invariant and broke the
  # moment Cycle 16 opened: ADR-0055 REQUIRES a live lane to hold initiatives/<lane>/evidence/,
  # and HISTORY-INDEX.md itself says a lane-local archive/ "would only ever hold cycles closed
  # AFTER portfolio adoption" -- which develop and engine both already do. What ADR-0058
  # actually forbids is a SECOND copy of the frozen pre-portfolio records, so that is what is
  # checked: none of the frozen filenames may be reproduced anywhere inside the lane.
  for frozen in PLAN-2026-07-30.md PROGRESS-2026-07-30.md; do
    if find "$ARC_ROOT/initiatives/design" -name "$frozen" 2>/dev/null | grep -q .; then
      echo "the lane holds a COPY of frozen history: $frozen" >&2
      return 1
    fi
  done
  [ ! -d "$ARC_ROOT/initiatives/design/phases-design-2026-07-30" ]
  # And every frozen path it points at must actually be there.
  for p in docs/archive/PLAN-2026-07-30.md docs/archive/PROGRESS-2026-07-30.md \
           docs/archive/phases-design-2026-07-30 docs/evidence/phase-02 docs/design; do
    grep -q "$p" "$idx" || { echo "index does not mention $p"; return 1; }
    [ -e "$ARC_ROOT/$p" ] || { echo "index points at missing $p"; return 1; }
  done
}

@test "an IDLE lane is not counted, so one live cycle still auto-resolves" {
  # This asserted that the DESIGN lane specifically was IDLE, which stopped being a fact the
  # moment that lane opened Cycle 16 -- a test hardcoding one lane's transient state, which is
  # the same rot pattern the band table keeps producing. The law from .claude/rules/lanes.md is
  # state-agnostic and is what gets checked now: eligibility comes ONLY from status LIVE or
  # BLOCKED, for every lane, whichever lanes happen to be idle today.
  local seen=0
  for d in "$ARC_ROOT"/initiatives/*/; do
    [ -f "$d/PROGRESS.md" ] || continue
    local st; st="$(_arc_lane_header "$d/PROGRESS.md" status)"
    case "$st" in
      LIVE|BLOCKED) ;;
      *) seen=$((seen + 1));;
    esac
  done
  # There must be at least one non-eligible lane for this assertion to mean anything -- a
  # vacuous pass here would look identical to a working rule.
  [ "$seen" -gt 0 ] || { echo "no IDLE lane exists, so this check proved nothing" >&2; return 1; }
}

@test "frozen: docs/archive and docs/evidence are still tracked where they always were" {
  # ADR-0058's sole-canonical-copy rule, checked against git rather than the filesystem.
  n_arch="$(git -C "$ARC_ROOT" ls-files -- docs/archive | wc -l | tr -d ' ')"
  n_ev="$(git -C "$ARC_ROOT" ls-files -- docs/evidence | wc -l | tr -d ' ')"
  [ "$n_arch" -gt 0 ]
  [ "$n_ev" -gt 0 ]
  [ "$(git -C "$ARC_ROOT" ls-files -- 'initiatives/*/archive' | wc -l | tr -d ' ')" -eq 0 ]
}

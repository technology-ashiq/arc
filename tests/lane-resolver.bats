#!/usr/bin/env bats
# Lane resolver — Cycle 4 portfolio Phase 00, REQ-01 (ADR-0054, PORT-E).
#
# The resolver is the ONE new moving part of this cycle: it decides which tracker
# workspace a command operates on. Its contract, in order of precedence:
#   explicit --lane  >  auto-resolve (exactly one eligible lane)  >  ASK. Never guess.
# No initiatives/ dir  ->  ROOT-MODE, byte-identical to pre-portfolio arc (the
# permanent consumer contract; root-golden.bats pins the bytes).
# Lane creation is /arc-kickoff's privilege ONLY; every other surface hard-STOPs on
# an unknown lane and creates nothing.
#
# TWO IMPLEMENTATIONS on purpose: bash for the hooks (a SessionStart hook must not
# spawn node — process spawn is the expensive thing on Windows, and a no-node box
# must still get its heads-up) and .mjs for kickoff-lint (a Node consumer must not
# require bash on PATH). They are kept honest by the equivalence gate at the bottom,
# the same way node:sqlite is kept honest against the JSONL scan (spine-equivalence.bats).
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_teardown; }

# ---------- root-mode (no initiatives/) ----------

@test "lane: bare repo resolves to ROOT-MODE and selects nothing" {
  _arc_lane_sandbox
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field mode)" = "root" ]
  [ "$(_arc_field status)" = "ok" ]
  [ "$(_arc_field via)" = "none" ]
  [ "$(_arc_field tracker)" = "." ]
  [ "$(_arc_field lane)" = "" ]
}

@test "lane: ROOT-MODE human output is EMPTY (byte-identical consumer contract)" {
  _arc_lane_sandbox
  run _arc_lane_sh --print human
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "lane: --lane on a bare repo hard-STOPs for a non-kickoff surface" {
  _arc_lane_sandbox
  run _arc_lane_sh --lane portfolio
  [ "$status" -eq 4 ]
  [ "$(_arc_field status)" = "unknown" ]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "lane: --lane on a bare repo is a CREATE for kickoff (birth ceremony)" {
  _arc_lane_sandbox
  run _arc_lane_sh --lane portfolio --for kickoff
  [ "$status" -eq 0 ]
  [ "$(_arc_field status)" = "create" ]
  [ "$(_arc_field mode)" = "lane" ]
  [ "$(_arc_field tracker)" = "initiatives/portfolio" ]
  # resolution NEVER creates the folder — it only reports the decision
  [ ! -d "$SANDBOX/initiatives" ]
}

# ---------- auto-resolution ----------

@test "lane: exactly one eligible lane auto-resolves" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field mode)" = "lane" ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field via)" = "auto" ]
  [ "$(_arc_field counted)" = "1" ]
}

@test "lane: IDLE and QUEUED lanes are not counted, so the single LIVE lane still auto-resolves" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design IDLE
  _arc_make_lane develop QUEUED
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field counted)" = "1" ]
  [ "$(_arc_field lanes)" = "design develop portfolio" ]
}

@test "lane: BLOCKED counts toward WIP - LIVE+BLOCKED means ASK, never guess" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design BLOCKED
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field status)" = "ambiguous" ]
  [ "$(_arc_field counted)" = "2" ]
  [ "$(_arc_field lane)" = "" ]
}

@test "lane: zero eligible lanes ASKs rather than picking an IDLE one" {
  _arc_lane_sandbox
  _arc_make_lane design IDLE
  _arc_make_lane develop QUEUED
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field counted)" = "0" ]
  [ "$(_arc_field lane)" = "" ]
}

@test "lane: explicit --lane wins over ambiguity" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design LIVE
  run _arc_lane_sh --lane design
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "design" ]
  [ "$(_arc_field via)" = "arg" ]
}

# ---------- unknown lane: hard STOP, never create ----------

@test "lane: typo'd lane hard-STOPs, lists known lanes, and creates no folder" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design IDLE
  run _arc_lane_sh --lane portfolo
  [ "$status" -eq 4 ]
  [ "$(_arc_field status)" = "unknown" ]
  [ "$(_arc_field lanes)" = "design portfolio" ]
  [ ! -d "$SANDBOX/initiatives/portfolo" ]
}

@test "lane: unknown lane STOP message names the lane and the known lanes" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh --lane nope --print human
  [ "$status" -eq 4 ]
  [[ "$output" == *"STOP"* ]]
  [[ "$output" == *"nope"* ]]
  [[ "$output" == *"portfolio"* ]]
  [[ "$output" == *"kickoff"* ]]
}

@test "lane: every non-kickoff surface refuses to create - only kickoff may" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  for surface in resume change phase-done retro evidence lint; do
    run _arc_lane_sh --lane brandnew --for "$surface"
    [ "$status" -eq 4 ] || { echo "surface $surface did not STOP"; false; }
  done
  run _arc_lane_sh --lane brandnew --for kickoff
  [ "$status" -eq 0 ]
  [ "$(_arc_field status)" = "create" ]
}

# ---------- lane-name grammar (adversarial) ----------

@test "lane: adversarial lane names are rejected before any filesystem touch" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  # traversal · absolute · empty · uppercase · leading digit · slash · dot · space · tilde
  for bad in "../etc" "/etc/passwd" "" "Design" "9lives" "a/b" "." ".." "my lane" "~root" "a\\b" "lane;rm" 'a$b' "-lead"; do
    run _arc_lane_sh --lane "$bad" --for kickoff
    [ "$status" -eq 5 ] || { echo "accepted bad name: [$bad] status=$status"; false; }
  done
}

@test "lane: Windows reserved device names are rejected (mkdir would fail on one OS only)" {
  _arc_lane_sandbox
  for bad in con prn aux nul com1 com9 lpt1 lpt9; do
    run _arc_lane_sh --lane "$bad" --for kickoff
    [ "$status" -eq 5 ] || { echo "accepted reserved name: [$bad]"; false; }
  done
}

@test "lane: an over-long lane name is rejected (path-length hygiene)" {
  _arc_lane_sandbox
  local long; long="$(printf 'a%.0s' $(seq 1 80))"
  run _arc_lane_sh --lane "$long" --for kickoff
  [ "$status" -eq 5 ]
}

@test "lane: valid grammar shapes are accepted" {
  _arc_lane_sandbox
  for ok in a ab a1 a-b portfolio arc-develop x9-y9; do
    run _arc_lane_sh --lane "$ok" --for kickoff
    [ "$status" -eq 0 ] || { echo "rejected good name: [$ok]"; false; }
  done
}

@test "lane: a directory whose name breaks the grammar is NOT a lane on any OS" {
  # Case-insensitive filesystems (Windows/macOS) would let `--lane design` find a
  # dir named `Design`; Linux would not. Membership is decided by exact comparison
  # against what readdir returned, so the answer is the same on all three.
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/Design" "$SANDBOX/initiatives/_scratch"
  run _arc_lane_sh --lane design
  [ "$status" -eq 4 ]
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lanes)" = "portfolio" ]
  [ "$(_arc_field skipped)" = "Design _scratch" ]
}

# ---------- PROGRESS machine-header parsing (markdown-contract bug class) ----------

@test "lane: a status line inside a fenced code block is not a status" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\n```\nstatus: LIVE\n```\n\nstatus: IDLE\n\n## Now\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field counted)" = "0" ]
}

@test "lane: a status line below the header block (after a ## heading) is ignored" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\nstatus: IDLE\n\n## Now\n\nstatus: LIVE\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field counted)" = "0" ]
}

@test "lane: a repeated status key takes the LAST value in the header block" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\nstatus: LIVE\nstatus: IDLE\n\n## Now\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field counted)" = "0" ]
}

@test "lane: the bold cosmetic variant **status:** is still detected" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\n**status:** LIVE\n\n## Now\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "portfolio" ]
}

@test "lane: a lowercase status value fails the strict value grammar (tolerant detect, strict value)" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\nstatus: live\n\n## Now\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field counted)" = "0" ]
  [ "$(_arc_field lanes)" = "portfolio" ]
}

@test "lane: a lane with no PROGRESS.md is known but never eligible" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/empty"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field lanes)" = "empty portfolio" ]
}

# ---------- canonical output order ----------

@test "lane: human output leads with the Selected lane echo (wrong-lane risk first)" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh --print human
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: portfolio (via auto)" ]
}

@test "lane: an explicitly passed lane echoes 'via arg'" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh --lane portfolio --print human
  [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: portfolio (via arg)" ]
}

@test "lane: ambiguity asks and names every eligible lane" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design BLOCKED
  run _arc_lane_sh --print human
  [ "$status" -eq 3 ]
  [[ "$output" == *"--lane"* ]]
  [[ "$output" == *"portfolio"* ]]
  [[ "$output" == *"design"* ]]
  [[ "$output" != *"Selected lane:"* ]]
}

# ---------- free-text safety (PORT-E round 6) ----------

@test "lane: a bare token is never parsed as a lane" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design IDLE
  # "design" arriving as a positional (a description word, a route, a phase label)
  # must not select the design lane — only --lane does that.
  run _arc_lane_sh design
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field via)" = "auto" ]
}

@test "lane: free text containing the literal --lane substring does not become the flag" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh --text "Add --lane flag docs"
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field via)" = "auto" ]
}

@test "lane: --lane with no value is an invalid name, not a silent auto-resolve" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh --lane
  [ "$status" -eq 5 ]
}

# ---------- adversarial pass findings (Phase 00, construct-a-breaking-input) ----------
# Every case below is a hole a fresh-context attacker actually opened in code that
# passed all of the tests above it. They are pinned so the hole cannot reopen.
# All of them run through _arc_lane_both, so each is an equivalence case too.

@test "adversarial: a ~~~ fenced block is a fence, exactly like a backtick fence" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\n~~~\nstatus: LIVE\n~~~\n\nstatus: IDLE\n\n## Now\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field counted)" = "0" ]
}

@test "adversarial: a fence opened with ~~~ is not closed by \`\`\`" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\n~~~\n```\nstatus: LIVE\n\n## Now\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 3 ]
  [ "$(_arc_field counted)" = "0" ]
}

@test "adversarial: a NUL byte in the status value cannot flip eligibility" {
  _arc_lane_sandbox
  _arc_make_lane portfolio IDLE
  printf '# PROGRESS\n\nstatus: LIVE\000\n\n## Now\n' \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "portfolio" ]
}

@test "adversarial: dot-entries under initiatives/ are invisible to both twins" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/.git" "$SANDBOX/initiatives/.hidden"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lanes)" = "portfolio" ]
  [ "$(_arc_field skipped)" = "" ]
}

@test "adversarial: a directory name with a space or glob char never word-splits" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/My Lane" "$SANDBOX/initiatives/[a]"
  # A cwd full of decoys: an unquoted expansion would glob-expand the directory names
  # against the CALLER's working directory and splice its filenames into the report.
  local decoy="$BATS_TEST_TMPDIR/decoy"; mkdir -p "$decoy"; : > "$decoy/a"; : > "$decoy/aXb"
  cd "$decoy"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lanes)" = "portfolio" ]
  [ "$(_arc_field skipped)" = "My Lane [a]" ]
}

@test "adversarial: initiatives/ with no valid lane is ROOT-MODE, not a dead end" {
  # git does not track empty directories, so a stray mkdir or partial checkout must
  # not strand every surface in an un-answerable "pick a lane" with nothing to pick.
  _arc_lane_sandbox
  mkdir -p "$SANDBOX/initiatives"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field mode)" = "root" ]
  [ "$(_arc_field tracker)" = "." ]
}

@test "adversarial: initiatives/ holding only invalid dirs is still ROOT-MODE" {
  _arc_lane_sandbox
  mkdir -p "$SANDBOX/initiatives/Design" "$SANDBOX/initiatives/_scratch"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field mode)" = "root" ]
}

@test "adversarial: two different --lane values STOP instead of silently last-winning" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design LIVE
  run _arc_lane_sh --lane portfolio --lane design
  [ "$status" -eq 5 ]
  [ "$(_arc_field reason)" = "duplicate-lane" ]
}

@test "adversarial: repeating the SAME --lane value is not an error" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh --lane portfolio --lane portfolio
  [ "$status" -eq 0 ]
  [ "$(_arc_field lane)" = "portfolio" ]
}

@test "adversarial: a non-UTF-8 lane name echoes the same bytes from both twins" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  run _arc_lane_sh --lane "$(printf '\377\376')" --print human
  [ "$status" -eq 5 ]
  [[ "$output" == *"invalid lane name"* ]]
}

@test "adversarial: non-ASCII directory names sort identically in both twins" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/initiatives/$(printf '\357\244\200')Zed"
  mkdir -p "$SANDBOX/initiatives/$(printf '\360\237\230\200')Emo"
  run _arc_lane_sh
  [ "$status" -eq 0 ]
  [ "$(_arc_field lanes)" = "portfolio" ]
}

@test "adversarial: the default root is the git toplevel, not the caller's cwd" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  mkdir -p "$SANDBOX/some/deep/dir"
  cd "$SANDBOX/some/deep/dir"
  # no --root: both twins must find the repo above and agree
  run bash -c '
    a="$(bash "$1/.claude/scripts/core/lane-resolve.sh" 2>&1; echo "exit=$?")"
    b="$(node "$1/.claude/scripts/core/lane-resolve.mjs" 2>&1; echo "exit=$?")"
    [ "$a" = "$b" ] || { echo "--- sh"; echo "$a"; echo "--- mjs"; echo "$b"; exit 1; }
    printf "%s\n" "$a"
  ' _ "$SANDBOX"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"lane=portfolio"* ]]
}

@test "adversarial: resolution never creates anything, whatever it is asked" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  local before after
  before="$(find "$SANDBOX" -not -path '*/.git/*' | LC_ALL=C sort)"
  _arc_lane_sh --lane brandnew --for kickoff || true
  _arc_lane_sh --lane brandnew || true
  _arc_lane_sh --lane ../escape --for kickoff || true
  _arc_lane_sh --lane con --for kickoff || true
  _arc_lane_sh --print human || true
  after="$(find "$SANDBOX" -not -path '*/.git/*' | LC_ALL=C sort)"
  [ "$before" = "$after" ] || { echo "resolution mutated the tree:"; diff <(echo "$before") <(echo "$after"); false; }
}

# ---------- equivalence gate: bash and node must agree, always ----------

@test "equivalence: both resolver implementations return identical bytes and status" {
  _arc_lane_sandbox
  _arc_make_lane portfolio LIVE
  _arc_make_lane design BLOCKED
  _arc_make_lane develop QUEUED
  mkdir -p "$SANDBOX/initiatives/Design"
  # every decision branch: auto/ambiguous, arg, unknown, invalid, create, root-mode
  run bash -c '
    set -u
    fail=0
    S="$1/.claude/scripts/core/lane-resolve.sh"
    M="$1/.claude/scripts/core/lane-resolve.mjs"
    run_case() {
      a="$(bash "$S" --root "$1" "${@:2}" 2>&1; echo "exit=$?")"
      b="$(node "$M" --root "$1" "${@:2}" 2>&1; echo "exit=$?")"
      if [ "$a" != "$b" ]; then
        echo "DIVERGED for args: ${*:2}"; echo "--- sh"; echo "$a"; echo "--- mjs"; echo "$b"; fail=1
      fi
    }
    run_case "$1"
    run_case "$1" --print human
    run_case "$1" --lane portfolio
    run_case "$1" --lane portfolio --print human
    run_case "$1" --lane design
    run_case "$1" --lane nope
    run_case "$1" --lane nope --print human
    run_case "$1" --lane nope --for kickoff
    run_case "$1" --lane ../etc --for kickoff
    run_case "$1" --lane Design
    run_case "$1" --lane con --for kickoff
    exit $fail
  ' _ "$SANDBOX"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "equivalence: both implementations agree on a bare root-mode repo" {
  _arc_lane_sandbox
  run bash -c '
    S="$1/.claude/scripts/core/lane-resolve.sh"; M="$1/.claude/scripts/core/lane-resolve.mjs"
    a="$(bash "$S" --root "$1" 2>&1; echo "exit=$?")"
    b="$(node "$M" --root "$1" 2>&1; echo "exit=$?")"
    [ "$a" = "$b" ] || { echo "--- sh"; echo "$a"; echo "--- mjs"; echo "$b"; exit 1; }
  ' _ "$SANDBOX"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

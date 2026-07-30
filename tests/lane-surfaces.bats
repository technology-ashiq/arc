#!/usr/bin/env bats
# Lane-mode surfaces — Cycle 4 portfolio Phase 00, REQ-01 (ADR-0054).
#
# The resolver's own contract is proven in lane-resolver.bats. This file proves the
# SURFACES actually route through it: kickoff-lint and arc-evidence each read the
# right workspace in lane-mode, keep reading the COMPANY layer from the repo root
# (docs/adr, docs/retro-log are single and never per-lane — ADR-0053), echo the
# selected lane first, and hard-STOP on an unknown lane without creating anything.
# Root-mode behaviour is pinned byte-for-byte in root-golden.bats.
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_teardown; }

LINT="$ARC_ROOT/.claude/scripts/plan/kickoff-lint.mjs"
FIXTURE="$ARC_ROOT/tests/fixtures/kickoff-lint/good"

# A repo where the TRACKER lives in a lane and the COMPANY docs live at the root —
# the split the dual-mode refactor introduces.
_lane_repo() {
  _arc_lane_sandbox
  mkdir -p "$SANDBOX/initiatives/portfolio"
  cp "$FIXTURE/PLAN.md" "$FIXTURE/PROGRESS.md" "$SANDBOX/initiatives/portfolio/"
  cp -r "$FIXTURE/phases" "$SANDBOX/initiatives/portfolio/"
  cp -r "$FIXTURE/docs" "$SANDBOX/docs"
  # machine header (ADR-0051) so the lane is eligible for auto-resolution
  printf 'status: LIVE\ncycle: fixture\nphase: 00 — fixture\nappetite: 3d\nburn: 0d\n\n%s' \
    "$(cat "$SANDBOX/initiatives/portfolio/PROGRESS.md")" \
    > "$SANDBOX/initiatives/portfolio/PROGRESS.tmp"
  mv "$SANDBOX/initiatives/portfolio/PROGRESS.tmp" "$SANDBOX/initiatives/portfolio/PROGRESS.md"
}

# ---------- kickoff-lint ----------

@test "surface/lint: lints the lane's tracker and echoes the lane first" {
  _lane_repo
  run node "$LINT" "$SANDBOX" --lane portfolio
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: portfolio (via arg)" ]
  [[ "$output" == *"all checks passed"* ]]
}

@test "surface/lint: auto-resolves the single eligible lane with no --lane" {
  _lane_repo
  run node "$LINT" "$SANDBOX"
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: portfolio (via auto)" ]
}

@test "surface/lint: the ADR ledger is read from the COMPANY root, not the lane" {
  _lane_repo
  # The lane has no docs/ of its own; the ADR the lane's PLAN indexes lives at the
  # repo root. If the lint looked for docs/adr inside the lane this would fail [adr].
  [ ! -d "$SANDBOX/initiatives/portfolio/docs" ]
  run node "$LINT" "$SANDBOX" --lane portfolio
  [ "$status" -eq 0 ]
  [[ "$output" != *"[adr]"* ]]
}

@test "surface/lint: a missing company ADR still fails from inside a lane" {
  _lane_repo
  rm -rf "$SANDBOX/docs/adr"
  run node "$LINT" "$SANDBOX" --lane portfolio
  [ "$status" -eq 1 ]
  [[ "$output" == *"[adr]"* ]]
}

@test "surface/lint: an unknown lane hard-STOPs and creates nothing" {
  _lane_repo
  run node "$LINT" "$SANDBOX" --lane portfolo
  [ "$status" -eq 4 ]
  [[ "$output" == *"STOP"* ]]
  [[ "$output" == *"portfolio"* ]]
  [ ! -d "$SANDBOX/initiatives/portfolo" ]
}

@test "surface/lint: an invalid lane name is refused before any lint work" {
  _lane_repo
  run node "$LINT" "$SANDBOX" --lane ../etc
  [ "$status" -eq 5 ]
  [[ "$output" != *"checks passed"* ]]
}

@test "surface/lint: ambiguity asks instead of picking a lane" {
  _lane_repo
  _arc_make_lane design LIVE
  run node "$LINT" "$SANDBOX"
  [ "$status" -eq 3 ]
  [[ "$output" == *"--lane"* ]]
  [[ "$output" != *"Selected lane:"* ]]
}

@test "surface/lint: root-mode prints no lane echo at all (consumer contract)" {
  _arc_lane_sandbox
  cp -r "$FIXTURE"/. "$SANDBOX/"
  run node "$LINT" "$SANDBOX"
  [ "$status" -eq 0 ]
  [[ "$output" != *"Selected lane"* ]]
}

# ---------- arc-evidence ----------

EV="$ARC_ROOT/.claude/scripts/plan/arc-evidence.sh"

@test "surface/evidence: lane-mode bundles land inside the lane workspace" {
  _lane_repo
  run bash "$EV" bundle 1 --lane portfolio
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: portfolio (via arg)" ]
  [ -f "$SANDBOX/initiatives/portfolio/evidence/phase-01/manifest.json" ]
  [ ! -d "$SANDBOX/docs/evidence" ]
}

@test "surface/evidence: auto-resolution puts the bundle in the single eligible lane" {
  _lane_repo
  run bash "$EV" bundle 2
  [ "$status" -eq 0 ]
  [ -f "$SANDBOX/initiatives/portfolio/evidence/phase-02/manifest.json" ]
}

@test "surface/evidence: verify reads back from the lane workspace" {
  _lane_repo
  bash "$EV" bundle 3 --lane portfolio >/dev/null
  run bash "$EV" verify 3 --lane portfolio
  [ "$status" -eq 0 ]
  [[ "$output" == *"verified"* ]]
}

@test "surface/evidence: an unknown lane STOPs and writes nothing" {
  _lane_repo
  run bash "$EV" bundle 1 --lane nope
  [ "$status" -eq 4 ]
  [ ! -d "$SANDBOX/initiatives/nope" ]
  [ ! -d "$SANDBOX/initiatives/portfolio/evidence" ]
}

@test "surface/evidence: an explicit --out still wins and stays silent about lanes" {
  _lane_repo
  run bash "$EV" bundle 4 --out "$SANDBOX/custom"
  [ "$status" -eq 0 ]
  [ -f "$SANDBOX/custom/phase-04/manifest.json" ]
  [[ "$output" != *"Selected lane"* ]]
}

@test "surface/evidence: root-mode keeps writing docs/evidence (frozen path, unchanged)" {
  _arc_lane_sandbox
  run bash "$EV" bundle 5
  [ "$status" -eq 0 ]
  [ -f "$SANDBOX/docs/evidence/phase-05/manifest.json" ]
  [[ "$output" != *"Selected lane"* ]]
}

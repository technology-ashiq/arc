#!/usr/bin/env bats
# Phase 02 -- committed, tamper-evident evidence bundles.
bats_require_minimum_version 1.5.0
load 'test_helper'

EV() { echo "$ARC_ROOT/.claude/scripts/arc-evidence.sh"; }

@test "evidence: bundle assembles a manifest and gathers present artifacts" {
  _arc_sandbox
  mkdir -p .claude/state/scan
  echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  run bash "$(EV)" bundle 2 --out evidence
  [ "$status" -eq 0 ]
  [ -f evidence/phase-02/manifest.json ]
  [ -f evidence/phase-02/scan-verdict.json ]
  run jq -r '.phase' evidence/phase-02/manifest.json
  [ "$output" = "02" ]
}

@test "evidence: manifest records the current commit" {
  _arc_sandbox
  run bash "$(EV)" bundle 2 --out evidence
  local head; head="$(git rev-parse HEAD)"
  run jq -r '.commit' evidence/phase-02/manifest.json
  [ "$output" = "$head" ]
}

@test "evidence: verify passes on an intact bundle" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  bash "$(EV)" bundle 2 --out evidence
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 0 ]
}

@test "evidence: verify FAILS on a tampered artifact (tamper-evident)" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  bash "$(EV)" bundle 2 --out evidence
  echo 'tampered' >> evidence/phase-02/scan-verdict.json
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 2 ]
  [[ "$output" == *"TAMPERED"* ]]
}

@test "evidence: verify FAILS when no bundle exists (phase cannot close)" {
  _arc_sandbox
  run bash "$(EV)" verify 7 --out evidence
  [ "$status" -eq 2 ]
  [[ "$output" == *"no bundle"* ]]
}

@test "evidence: bundle degrades gracefully when no artifacts are present" {
  _arc_sandbox
  run bash "$(EV)" bundle 3 --out evidence
  [ "$status" -eq 0 ]
  run jq '.files | length' evidence/phase-03/manifest.json
  [ "$output" -eq 0 ]
}

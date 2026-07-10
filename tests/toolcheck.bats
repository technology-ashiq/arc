#!/usr/bin/env bats
# Phase 03 #7 -- /arc-toolcheck must cover the new security verifiers so a user
# knows how to install them (Quick-fix lines). Env-independent: the row shows
# whether the tool is ready or missing, but the NAME + install action are always
# present.
bats_require_minimum_version 1.5.0
load 'test_helper'

TC="$ARC_ROOT/.claude/scripts/toolchain-health.sh"

@test "toolcheck: full report runs and lists trivy (SCA)" {
  run bash "$TC"
  [ "$status" -eq 0 ]
  [[ "$output" == *"trivy"* ]]
}

@test "toolcheck: full report lists trufflehog (verified secrets)" {
  run bash "$TC"
  [ "$status" -eq 0 ]
  [[ "$output" == *"trufflehog"* ]]
}

@test "toolcheck: a missing trivy flows an install action into Quick-fix" {
  command -v trivy >/dev/null 2>&1 && skip "trivy installed on this runner"
  run bash "$TC"
  [ "$status" -eq 0 ]
  [[ "$output" == *"install trivy"* ]]        # scoop/brew both match 'install trivy'
}

@test "toolcheck: lists codeql as an optional deep-SAST verifier" {
  run bash "$TC"
  [ "$status" -eq 0 ]
  [[ "$output" == *"codeql"* ]]
  [[ "$output" == *"Optional"* ]]              # codeql is optional (ADR-0004)
}

@test "toolcheck: --brief still emits the one-line summary" {
  run bash "$TC" --brief
  [ "$status" -eq 0 ]
  [[ "$output" == *"Toolchain:"* ]]
}

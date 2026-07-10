#!/usr/bin/env bats
# Phase 03 #2 -- pinned arc-tools docker image (ADR-0006 amendment).
# STATIC invariant checks (offline, no docker daemon): a verdict is only
# evidence if reproducible, so the image must pin its base + tool versions and
# bake the vuln DB. The real build + a live vulnerable-dep block run in CI
# (ci-tier job) and the local demo -- bats stays hermetic (.claude/rules/testing).
bats_require_minimum_version 1.5.0
load 'test_helper'

DOCKERFILE="$ARC_ROOT/docker/arc-tools/Dockerfile"
IMGSCRIPT="$ARC_ROOT/.claude/scripts/arc-tools-image.sh"

@test "arc-tools image: Dockerfile exists" {
  [ -f "$DOCKERFILE" ]
}

@test "arc-tools image: no floating :latest tags (reproducibility)" {
  run grep -nE ':latest' "$DOCKERFILE"
  [ "$status" -ne 0 ]                       # grep finds nothing => no :latest
}

@test "arc-tools image: base image is pinned (explicit tag or digest, not latest)" {
  run grep -E '^FROM ' "$DOCKERFILE"
  [ "$status" -eq 0 ]
  [[ "$output" == *"@sha256:"* || "$output" == *":bookworm-slim"* ]]
}

@test "arc-tools image: Trivy version is pinned via ARG" {
  run grep -E '^ARG TRIVY_VERSION=[0-9]+\.[0-9]+' "$DOCKERFILE"
  [ "$status" -eq 0 ]
}

@test "arc-tools image: vuln DB is baked at build time (download-db-only)" {
  run grep -E 'download-db-only' "$DOCKERFILE"
  [ "$status" -eq 0 ]
}

@test "arc-tools image: runs as a non-root user" {
  run grep -E '^USER ' "$DOCKERFILE"
  [ "$status" -eq 0 ]
  [[ "$output" != *"root"* ]]
}

@test "arc-tools image: /src workdir contract (matches arc_docker_scan mount)" {
  run grep -E '^WORKDIR /src' "$DOCKERFILE"
  [ "$status" -eq 0 ]
}

@test "arc-tools image: trivy docker rung pins the DB (--skip-db-update -> baked DB)" {
  run grep -E 'skip-db-update' "$ARC_SCAN_SRC/adapters/trivy.sh"
  [ "$status" -eq 0 ]
}

@test "arc-tools image: helper script exposes build/verify/scan/ref/digest subcommands" {
  [ -f "$IMGSCRIPT" ]
  for sub in build verify scan ref digest; do
    grep -qE "\b$sub\b" "$IMGSCRIPT" || { echo "missing subcommand: $sub"; return 1; }
  done
}

@test "arc-tools image: ref honors the ARC_TOOLS_IMAGE override (offline)" {
  run env ARC_TOOLS_IMAGE=arc-tools:test bash "$IMGSCRIPT" ref
  [ "$status" -eq 0 ]
  [ "$output" = "arc-tools:test" ]
}

@test "arc-tools image: ref falls back to a default and is never empty" {
  run env -u ARC_TOOLS_IMAGE bash "$IMGSCRIPT" ref
  [ "$status" -eq 0 ]
  [ -n "$output" ]
}

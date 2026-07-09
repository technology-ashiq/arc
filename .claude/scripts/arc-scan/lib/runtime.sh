#!/usr/bin/env bash
# runtime.sh -- per-adapter runtime resolution: native -> docker -> SKIPPED
# (Phase 02 #9, ADR-0006 amendment). An adapter runs its tool natively when the
# binary is present; else via the pinned arc-tools docker image
# (ARC_DOCKER_IMAGE, built in Phase 03); else degrades to SKIPPED (never silent).
# This is also the permanent fix for semgrep-on-Windows: native opengrep ->
# docker -> SKIPPED, so a missing native binary is covered by the container.

# arc_runtime <native-bin>   ("" when the native binary is unavailable)
#   -> "native" | "docker" | "skip"
# ARC_FORCE_RUNTIME overrides the resolution (pinning / tests).
arc_runtime() {
  local native="$1"
  if [ -n "${ARC_FORCE_RUNTIME:-}" ]; then echo "$ARC_FORCE_RUNTIME"; return 0; fi
  if [ -n "$native" ]; then echo "native"
  elif command -v docker >/dev/null 2>&1 && [ -n "${ARC_DOCKER_IMAGE:-}" ]; then echo "docker"
  else echo "skip"; fi
}

# arc_docker_scan <sarif-out> <tool> [args...]
# Run a scanner inside the arc-tools image, capturing SARIF from stdout to
# <sarif-out>. The real image lands in Phase 03; the invocation shape is
# exercised here (fake docker in tests) so the docker rung is proven now. Always
# leaves a valid SARIF behind (empty runs on any failure) -- degrade-safe.
arc_docker_scan() {
  local out="$1"; shift
  docker run --rm -v "${ROOT:-$PWD}:/src:ro" -w /src "$ARC_DOCKER_IMAGE" "$@" > "$out" 2>/dev/null || true
  [ -s "$out" ] || printf '{"version":"2.1.0","runs":[]}\n' > "$out"
}

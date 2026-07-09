#!/usr/bin/env bats
# Phase 02 #9 -- per-adapter runtime fallback: native -> docker -> SKIPPED.
bats_require_minimum_version 1.5.0
load 'test_helper'

RTLIB() { echo ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/runtime.sh'"; }

# Fake `docker` that emits a one-finding SARIF to stdout; echoes its bin dir.
_fake_docker() {
  local d; d="$(mktemp -d)"
  cat > "$d/docker" <<'EOF'
#!/usr/bin/env bash
echo '{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"fake"}},"results":[{"ruleId":"r","message":{"text":"m"},"locations":[{"physicalLocation":{"artifactLocation":{"uri":"x.js"},"region":{"startLine":1}}}]}]}]}'
EOF
  chmod +x "$d/docker"; echo "$d"
}

# ---- resolver ----
@test "runtime: native binary present => native" {
  run bash -c "$(RTLIB); arc_runtime opengrep"
  [ "$output" = "native" ]
}

@test "runtime: no native + no docker image => skip" {
  run env ARC_DOCKER_IMAGE= bash -c "$(RTLIB); arc_runtime ''"
  [ "$output" = "skip" ]
}

@test "runtime: no native + docker present + image set => docker" {
  local fb; fb="$(_fake_docker)"
  run env PATH="$fb:$PATH" ARC_DOCKER_IMAGE=arc-tools:test bash -c "$(RTLIB); arc_runtime ''"
  [ "$output" = "docker" ]
  rm -rf "$fb"
}

@test "runtime: ARC_FORCE_RUNTIME overrides resolution" {
  run env ARC_FORCE_RUNTIME=docker bash -c "$(RTLIB); arc_runtime opengrep"
  [ "$output" = "docker" ]
}

# ---- adapter rungs ----
@test "semgrep adapter: skip rung => SKIPPED, empty SARIF, exit 0" {
  local d; d="$(mktemp -d)"; echo "x.js" > "$d/scope.txt"
  run env ARC_FORCE_RUNTIME=skip bash "$ARC_SCAN_SRC/adapters/semgrep.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED semgrep"* ]]
  run jq '[.runs[].results[]?]|length' "$d/o.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "semgrep adapter: docker rung runs the tool via the image (fake docker)" {
  local fb; fb="$(_fake_docker)"; local d; d="$(mktemp -d)"
  printf 'function h(r){ return eval(r.q); }\n' > "$d/a.js"; printf '%s\n' "$d/a.js" > "$d/scope.txt"
  run env PATH="$fb:$PATH" ARC_FORCE_RUNTIME=docker ARC_DOCKER_IMAGE=arc-tools:test \
    bash "$ARC_SCAN_SRC/adapters/semgrep.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"via docker"* ]]
  run jq '[.runs[].results[]?]|length' "$d/o.sarif"
  [ "$output" -eq 1 ]                       # finding came from the (fake) image
  rm -rf "$fb" "$d"
}

@test "gitleaks adapter: docker rung runs the tool via the image (fake docker)" {
  local fb; fb="$(_fake_docker)"; local d; d="$(mktemp -d)"
  printf 'const t="x";\n' > "$d/c.js"; printf '%s\n' "$d/c.js" > "$d/scope.txt"
  run env PATH="$fb:$PATH" ARC_FORCE_RUNTIME=docker ARC_DOCKER_IMAGE=arc-tools:test \
    bash "$ARC_SCAN_SRC/adapters/gitleaks.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"via docker"* ]]
  run jq '[.runs[].results[]?]|length' "$d/o.sarif"
  [ "$output" -eq 1 ]
  rm -rf "$fb" "$d"
}

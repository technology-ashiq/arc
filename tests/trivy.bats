#!/usr/bin/env bats
# Phase 03 -- Trivy SCA adapter (dependency/lockfile vulnerabilities).
# Same adapter contract as semgrep/gitleaks: tool missing -> SKIPPED + empty
# SARIF + exit 0; irrelevant scope -> empty SARIF; findings or not -> exit 0.
# Real trivy needs a network vuln DB, so these use a deterministic FAKE trivy
# (offline, per .claude/rules/testing.md) plus the native/docker/skip rungs.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup()    { _arc_load_libs; }
teardown() { _arc_teardown; }

# Fake `trivy` that emits a deterministic SCA SARIF (one HIGH CVE against
# package-lock.json) to stdout, ignoring args. Echoes its bin dir.
_fake_trivy() {
  local d; d="$(mktemp -d)"
  cat > "$d/trivy" <<'EOF'
#!/usr/bin/env bash
echo '{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"Trivy","rules":[{"id":"CVE-2021-23337","defaultConfiguration":{"level":"error"}}]}},"results":[{"ruleId":"CVE-2021-23337","ruleIndex":0,"level":"error","message":{"text":"lodash: Command Injection (CVE-2021-23337)"},"locations":[{"physicalLocation":{"artifactLocation":{"uri":"package-lock.json"},"region":{"startLine":1}}}]}]}]}'
EOF
  chmod +x "$d/trivy"; echo "$d"
}

# Fake `docker` that emits a one-finding SARIF to stdout (same shape as the
# runtime.bats fixture); echoes its bin dir.
_fake_docker() {
  local d; d="$(mktemp -d)"
  cat > "$d/docker" <<'EOF'
#!/usr/bin/env bash
echo '{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"fake"}},"results":[{"ruleId":"CVE-x","level":"error","message":{"text":"m"},"locations":[{"physicalLocation":{"artifactLocation":{"uri":"package-lock.json"},"region":{"startLine":1}}}]}]}]}'
EOF
  chmod +x "$d/docker"; echo "$d"
}

# ---------------------------------------------------------------------------
# 1. Adapter degrade -- missing tool => SKIPPED, empty SARIF, exit 0
# ---------------------------------------------------------------------------

@test "trivy adapter: missing tool degrades to SKIPPED (exit 0, empty runs)" {
  local d; d="$(mktemp -d)"; echo "package-lock.json" > "$d/scope.txt"
  ARC_TRIVY_BIN="arc-no-such-bin" ARC_DOCKER_IMAGE= \
    run bash "$ARC_SCAN_SRC/adapters/trivy.sh" "$d/scope.txt" "$d/out.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED trivy"* ]]
  run jq '[.runs[].results[]?] | length' "$d/out.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "trivy adapter: empty scope => empty SARIF, exit 0" {
  local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  local ft; ft="$(_fake_trivy)"
  ARC_TRIVY_BIN="$ft/trivy" run bash "$ARC_SCAN_SRC/adapters/trivy.sh" "$d/scope.txt" "$d/out.sarif"
  [ "$status" -eq 0 ]
  run jq '[.runs[].results[]?] | length' "$d/out.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d" "$ft"
}

@test "trivy adapter: non-manifest files in scope => nothing staged, empty SARIF" {
  local ft; ft="$(_fake_trivy)"
  _arc_sandbox
  mkdir -p src; printf 'export const x = 1;\n' > src/app.js
  printf 'src/app.js\n' > scope.txt
  ARC_TRIVY_BIN="$ft/trivy" run bash "$ARC_SCAN_SRC/adapters/trivy.sh" scope.txt out.sarif
  [ "$status" -eq 0 ]
  run jq '[.runs[].results[]?] | length' out.sarif
  [ "$output" -eq 0 ]                            # app.js is not a dependency manifest
  rm -rf "$ft"
}

# ---------------------------------------------------------------------------
# 2. Real finding path (fake trivy) -- diff-scoped manifest, repo-relative URI
# ---------------------------------------------------------------------------

@test "trivy adapter: vulnerable manifest in scope => CVE finding, repo-relative path" {
  local ft; ft="$(_fake_trivy)"
  _arc_sandbox
  printf '{ "name":"x","lockfileVersion":3 }\n' > package-lock.json
  printf 'package-lock.json\n' > scope.txt
  ARC_TRIVY_BIN="$ft/trivy" run bash "$ARC_SCAN_SRC/adapters/trivy.sh" scope.txt out.sarif
  [ "$status" -eq 0 ]
  run jq -r '.runs[].results[].ruleId' out.sarif
  [ "$output" = "CVE-2021-23337" ]
  run jq -r '.runs[].results[].locations[].physicalLocation.artifactLocation.uri' out.sarif
  [ "$output" = "package-lock.json" ]            # no staging temp dir leaked
  rm -rf "$ft"
}

@test "normalize: trivy CVE finding resolves to error severity" {
  local ft; ft="$(_fake_trivy)"
  _arc_sandbox
  printf '{}\n' > package-lock.json
  printf 'package-lock.json\n' > scope.txt
  ARC_TRIVY_BIN="$ft/trivy" bash "$ARC_SCAN_SRC/adapters/trivy.sh" scope.txt t.sarif
  run bash -c ". '$ARC_CORE_SRC/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_normalize trivy t.sarif | jq -r '.level' | head -1"
  [ "$status" -eq 0 ]
  [ "$output" = "error" ]
  rm -rf "$ft"
}

# ---------------------------------------------------------------------------
# 3. Runtime rungs -- skip / docker (native covered above)
# ---------------------------------------------------------------------------

@test "trivy adapter: skip rung => SKIPPED, empty SARIF, exit 0" {
  _arc_sandbox
  printf '{}\n' > package-lock.json
  printf 'package-lock.json\n' > scope.txt
  run env ARC_FORCE_RUNTIME=skip bash "$ARC_SCAN_SRC/adapters/trivy.sh" scope.txt o.sarif
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED trivy"* ]]
  run jq '[.runs[].results[]?]|length' o.sarif
  [ "$output" -eq 0 ]
}

@test "trivy adapter: docker rung runs the tool via the image (fake docker)" {
  local fb; fb="$(_fake_docker)"
  _arc_sandbox
  printf '{}\n' > package-lock.json
  printf 'package-lock.json\n' > scope.txt
  run env PATH="$fb:$PATH" ARC_FORCE_RUNTIME=docker ARC_DOCKER_IMAGE=arc-tools:test \
    bash "$ARC_SCAN_SRC/adapters/trivy.sh" scope.txt o.sarif
  [ "$status" -eq 0 ]
  [[ "$output" == *"via docker"* ]]
  run jq '[.runs[].results[]?]|length' o.sarif
  [ "$output" -eq 1 ]
  rm -rf "$fb"
}

# ---------------------------------------------------------------------------
# 4. End-to-end -- a vulnerable dependency BLOCKS the scan
# ---------------------------------------------------------------------------

@test "e2e: vulnerable manifest BLOCKS via trivy and does not stamp scan" {
  local ft; ft="$(_fake_trivy)"
  _arc_sandbox
  printf '{ "name":"x" }\n' > package-lock.json
  printf 'package-lock.json\n' > scope.txt
  ARC_TRIVY_BIN="$ft/trivy" run bash "$(_arc_scan)" --scope scope.txt --stamp
  [ "$status" -eq 2 ]                                  # block => exit 2
  run jq -r '.verdict' .claude/state/scan/verdict.json
  [ "$output" = "block" ]
  [ ! -f "$(_arc_ledger_file)" ] || ! grep -qx scan "$(_arc_ledger_file)"
  rm -rf "$ft"
}

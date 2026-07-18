#!/usr/bin/env bats
# Phase 03 #5 -- ZAP baseline (DAST). CI-tier, docker, scans a running app at a
# URL and merges findings into the SARIF pipeline. ZAP emits JSON (not SARIF), so
# the adapter converts + maps risk -> level (high=error, medium=warning, low/
# info=note) to keep passive header noise out of the block path. A live scan needs
# the ZAP image + a target, so tests use a FAKE ZAP runner (ARC_ZAP_CMD).
bats_require_minimum_version 1.5.0
load 'test_helper'

setup()    { _arc_load_libs; }
teardown() { _arc_teardown; }

# Fake ZAP runner: prints a canned ZAP JSON report (high XSS + medium CSP + low
# X-Frame) to stdout, ignoring the target. Echoes its bin dir.
_fake_zap() {
  local d; d="$(mktemp -d)"
  cat > "$d/zap" <<'EOF'
#!/usr/bin/env bash
cat <<'JSON'
{"site":[{"@name":"https://app.example","alerts":[
  {"pluginid":"40012","alert":"Cross Site Scripting (Reflected)","riskcode":"3","instances":[{"uri":"https://app.example/search","method":"GET"}]},
  {"pluginid":"10038","alert":"Content Security Policy (CSP) Header Not Set","riskcode":"2","instances":[{"uri":"https://app.example/","method":"GET"}]},
  {"pluginid":"10020","alert":"X-Frame-Options Header Not Set","riskcode":"1","instances":[{"uri":"https://app.example/","method":"GET"}]}
]}]}
JSON
EOF
  chmod +x "$d/zap"; echo "$d/zap"
}

@test "zap adapter: no target URL => SKIPPED, empty SARIF" {
  local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  run env -u CI -u ARC_ZAP_TARGET ARC_TIER=ci bash "$ARC_SCAN_SRC/adapters/zap.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED zap"* ]]
  [[ "$output" == *"target"* ]]
  run jq '[.runs[].results[]?]|length' "$d/o.sarif"; [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "zap adapter: hook tier (not CI) => SKIPPED" {
  local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  run env -u CI -u ARC_TIER ARC_ZAP_TARGET="https://app.example" bash "$ARC_SCAN_SRC/adapters/zap.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED zap"* ]]
  [[ "$output" == *"CI-tier"* ]]
  rm -rf "$d"
}

@test "zap adapter: CI-tier + target + fake ZAP => findings converted to SARIF" {
  local fz; fz="$(_fake_zap)"; local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  run env -u CI ARC_TIER=ci ARC_ZAP_TARGET="https://app.example" ARC_ZAP_CMD="cat '$fz' | bash" \
    bash "$ARC_SCAN_SRC/adapters/zap.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  run jq '[.runs[].results[]?]|length' "$d/o.sarif"
  [ "$output" -eq 3 ]
  rm -rf "$fz" "$d"
}

@test "zap adapter: risk maps to level (high=error, medium=warning, low=note)" {
  local fz; fz="$(_fake_zap)"; local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  env -u CI ARC_TIER=ci ARC_ZAP_TARGET="https://app.example" ARC_ZAP_CMD="cat '$fz' | bash" \
    bash "$ARC_SCAN_SRC/adapters/zap.sh" "$d/scope.txt" "$d/o.sarif"
  run jq -r '.runs[].results[] | select(.ruleId=="40012") | .level' "$d/o.sarif"
  [ "$output" = "error" ]                              # high XSS
  run jq -r '.runs[].results[] | select(.ruleId=="10038") | .level' "$d/o.sarif"
  [ "$output" = "warning" ]                            # medium CSP
  run jq -r '.runs[].results[] | select(.ruleId=="10020") | .level' "$d/o.sarif"
  [ "$output" = "note" ]                               # low X-Frame
  rm -rf "$fz" "$d"
}

@test "normalize: a high ZAP finding resolves to error severity" {
  local fz; fz="$(_fake_zap)"; local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  env -u CI ARC_TIER=ci ARC_ZAP_TARGET="https://app.example" ARC_ZAP_CMD="cat '$fz' | bash" \
    bash "$ARC_SCAN_SRC/adapters/zap.sh" "$d/scope.txt" "$d/z.sarif"
  run bash -c ". '$ARC_CORE_SRC/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_normalize zap '$d/z.sarif' | jq -r 'select(.ruleId==\"40012\") | .level'"
  [ "$status" -eq 0 ]
  [ "$output" = "error" ]
  rm -rf "$fz" "$d"
}

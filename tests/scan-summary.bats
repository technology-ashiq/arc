#!/usr/bin/env bats
# Phase 03 #6 -- the security-auditor consumes arc-scan's committed results as
# Pass 0 (tool tier) instead of re-running semgrep/gitleaks/trivy/etc ad hoc.
# arc-scan-summary.sh is the deterministic digest the agent reads.
bats_require_minimum_version 1.5.0
load 'test_helper'

SUMMARY="$ARC_SCAN_SRC/arc-scan-summary.sh"

@test "scan-summary: no scan results => notice, exit 0" {
  local d; d="$(mktemp -d)"
  run bash "$SUMMARY" "$d/none.sarif" "$d/none.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no arc-scan results"* ]]
  rm -rf "$d"
}

@test "scan-summary: digests verdict, per-tool tally, and findings" {
  local d; d="$(mktemp -d)"
  cat > "$d/m.sarif" <<'EOF'
{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"arc-scan"}},"results":[
  {"ruleId":"eval-injection","level":"error","message":{"text":"eval"},"locations":[{"physicalLocation":{"artifactLocation":{"uri":"app.js"},"region":{"startLine":3}}}],"properties":{"tool":"semgrep"}},
  {"ruleId":"CVE-2021-23337","level":"error","message":{"text":"lodash"},"locations":[{"physicalLocation":{"artifactLocation":{"uri":"package-lock.json"},"region":{"startLine":1}}}],"properties":{"tool":"trivy"}}
]}]}
EOF
  printf '{"verdict":"block","findings":2,"new_errors":2,"tools_ran":["semgrep","trivy"]}\n' > "$d/v.json"
  run bash "$SUMMARY" "$d/m.sarif" "$d/v.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"verdict: block"* ]]
  [[ "$output" == *"semgrep"* ]]
  [[ "$output" == *"trivy"* ]]
  [[ "$output" == *"CVE-2021-23337"* ]]
  [[ "$output" == *"app.js:3"* ]]
  rm -rf "$d"
}

@test "scan-summary: empty SARIF => reports zero findings" {
  local d; d="$(mktemp -d)"
  printf '{"version":"2.1.0","runs":[]}\n' > "$d/e.sarif"
  printf '{"verdict":"pass","findings":0,"new_errors":0,"tools_ran":["semgrep"]}\n' > "$d/v.json"
  run bash "$SUMMARY" "$d/e.sarif" "$d/v.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"verdict: pass"* ]]
  [[ "$output" == *"0 finding"* ]]
  rm -rf "$d"
}

@test "security-auditor agent: Pass 0 consumes arc-scan (not ad-hoc tool reruns)" {
  run grep -iE 'arc-scan-summary|pass 0' "$ARC_ROOT/.claude/agents/security-auditor.md"
  [ "$status" -eq 0 ]
}

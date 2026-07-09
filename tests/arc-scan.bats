#!/usr/bin/env bats
# Phase 00 steel-thread self-tests. Covers the four exit-criteria pillars:
#   adapter degrade · SARIF normalize+merge · triage verdict · ledger stamp,
#   plus the end-to-end block/pass demo.
load 'test_helper'

setup()    { _arc_load_libs; }
teardown() { _arc_teardown; }

# ---------------------------------------------------------------------------
# 1. Adapter degrade -- missing tool => SKIPPED, empty SARIF, exit 0
# ---------------------------------------------------------------------------

@test "semgrep adapter: missing tool degrades to SKIPPED (exit 0, empty runs)" {
  local d; d="$(mktemp -d)"; echo "code.js" > "$d/scope.txt"
  ARC_SEMGREP_BIN="arc-no-such-bin" run bash "$ARC_SCAN_SRC/adapters/semgrep.sh" "$d/scope.txt" "$d/out.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED semgrep"* ]]
  run jq '[.runs[].results[]?] | length' "$d/out.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "gitleaks adapter: missing tool degrades to SKIPPED (exit 0, empty runs)" {
  local d; d="$(mktemp -d)"; echo "code.js" > "$d/scope.txt"
  ARC_GITLEAKS_BIN="arc-no-such-bin" run bash "$ARC_SCAN_SRC/adapters/gitleaks.sh" "$d/scope.txt" "$d/out.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED gitleaks"* ]]
  run jq '[.runs[].results[]?] | length' "$d/out.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "adapter: empty scope => empty SARIF, exit 0" {
  local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  run bash "$ARC_SCAN_SRC/adapters/semgrep.sh" "$d/scope.txt" "$d/out.sarif"
  [ "$status" -eq 0 ]
  run jq '[.runs[].results[]?] | length' "$d/out.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "gitleaks adapter: finding URI is repo-relative, not the staging temp dir" {
  _arc_need_gitleaks
  _arc_sandbox                                   # git repo; cwd = sandbox root
  mkdir -p src
  printf 'const t="ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > src/config.js
  printf 'src/config.js\n' > scope.txt
  bash "$ARC_SCAN_SRC/adapters/gitleaks.sh" scope.txt g.sarif
  run jq -r '.runs[].results[].locations[].physicalLocation.artifactLocation.uri' g.sarif
  [ "$output" = "src/config.js" ]              # exact repo-relative path, no temp dir
}

# ---------------------------------------------------------------------------
# 2. SARIF normalize + merge
# ---------------------------------------------------------------------------

@test "normalize: resolves rule-level severity (semgrep eval => error)" {
  _arc_need_semgrep
  local d; d="$(mktemp -d)"
  printf 'function h(req){ return eval(req.query.q); }\n' > "$d/app.js"
  echo "$d/app.js" > "$d/scope.txt"
  bash "$ARC_SCAN_SRC/adapters/semgrep.sh" "$d/scope.txt" "$d/n.sarif"
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_normalize semgrep '$d/n.sarif' | jq -r '.level'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"error"* ]]
  rm -rf "$d"
}

@test "normalize: gitleaks finding defaults to error severity" {
  _arc_need_gitleaks
  local d; d="$(mktemp -d)"
  printf 'const t = "ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > "$d/c.js"
  echo "$d/c.js" > "$d/scope.txt"
  bash "$ARC_SCAN_SRC/adapters/gitleaks.sh" "$d/scope.txt" "$d/g.sarif"
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_normalize gitleaks '$d/g.sarif' | jq -r '.level' | head -1"
  [ "$status" -eq 0 ]
  [ "$output" = "error" ]
  rm -rf "$d"
}

@test "merge: dedupes by fingerprint and emits minimal SARIF fields" {
  local d; d="$(mktemp -d)"
  local f='{"tool":"semgrep","ruleId":"r1","level":"error","message":"m","file":"a.js","line":3,"fingerprint":"deadbeef"}'
  printf '%s\n%s\n' "$f" "$f" > "$d/findings.jsonl"   # duplicate fingerprint
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_merge '$d/findings.jsonl' | jq '[.runs[].results[]] | length'"
  [ "$status" -eq 0 ]
  [ "$output" -eq 1 ]   # deduped to one
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_merge '$d/findings.jsonl' | jq -r '.runs[0].results[0] | .ruleId + \"|\" + .level + \"|\" + .message.text + \"|\" + .locations[0].physicalLocation.artifactLocation.uri + \"|\" + .partialFingerprints.arcFingerprint'"
  [ "$output" = "r1|error|m|a.js|deadbeef" ]
  rm -rf "$d"
}

# ---------------------------------------------------------------------------
# 3. Triage verdict logic
# ---------------------------------------------------------------------------

@test "triage: any error-level finding => block" {
  local d; d="$(mktemp -d)"
  cat > "$d/m.sarif" <<'EOF'
{"version":"2.1.0","runs":[{"results":[{"level":"error"},{"level":"warning"}]}]}
EOF
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/triage.sh'; arc_triage_verdict '$d/m.sarif' semgrep '' | jq -r '.verdict'"
  [ "$output" = "block" ]
  rm -rf "$d"
}

@test "triage: no error-level findings => pass" {
  local d; d="$(mktemp -d)"
  cat > "$d/m.sarif" <<'EOF'
{"version":"2.1.0","runs":[{"results":[{"level":"warning"},{"level":"note"}]}]}
EOF
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/triage.sh'; arc_triage_verdict '$d/m.sarif' semgrep '' | jq -r '.verdict'"
  [ "$output" = "pass" ]
  rm -rf "$d"
}

@test "triage: empty findings => pass" {
  local d; d="$(mktemp -d)"
  printf '{"version":"2.1.0","runs":[]}\n' > "$d/m.sarif"
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/triage.sh'; arc_triage_verdict '$d/m.sarif' '' '' | jq -r '.verdict'"
  [ "$output" = "pass" ]
  rm -rf "$d"
}

# ---------------------------------------------------------------------------
# 4. Ledger stamp (scan kind)
# ---------------------------------------------------------------------------

@test "ledger: scan is a valid kind (stamp/check/status)" {
  _arc_sandbox
  run bash .claude/scripts/review-ledger.sh stamp scan
  [ "$status" -eq 0 ]
  run bash .claude/scripts/review-ledger.sh check scan
  [ "$status" -eq 0 ]
  run bash .claude/scripts/review-ledger.sh status
  [[ "$output" == *"scan"* ]]
}

# ---------------------------------------------------------------------------
# 5. End-to-end steel thread
# ---------------------------------------------------------------------------

@test "e2e: seeded dirty repo BLOCKS and does not stamp scan" {
  _arc_need_semgrep; _arc_need_gitleaks
  _arc_sandbox
  printf 'function h(req){ return eval(req.query.q); }\n' > bad.js
  printf 'const t = "ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > secret.js
  printf 'bad.js\nsecret.js\n' > scope.txt
  run bash "$(_arc_scan)" --scope scope.txt --stamp
  [ "$status" -eq 2 ]                                  # block => exit 2
  run jq -r '.verdict' .claude/state/scan/verdict.json
  [ "$output" = "block" ]
  [ ! -f "$(_arc_ledger_file)" ] || ! grep -qx scan "$(_arc_ledger_file)"
}

@test "e2e: clean repo PASSES and stamps scan in the ledger" {
  _arc_need_semgrep; _arc_need_gitleaks
  _arc_sandbox
  printf 'function add(a,b){ return a + b; }\n' > ok.js
  printf 'ok.js\n' > scope.txt
  run bash "$(_arc_scan)" --scope scope.txt --stamp
  [ "$status" -eq 0 ]                                  # pass => exit 0
  run jq -r '.verdict' .claude/state/scan/verdict.json
  [ "$output" = "pass" ]
  grep -qx scan "$(_arc_ledger_file)"                  # scan stamped
}

@test "e2e: scan-result.sarif is valid SARIF with a version + runs" {
  _arc_need_semgrep
  _arc_sandbox
  printf 'function h(req){ return eval(req.query.q); }\n' > bad.js
  printf 'bad.js\n' > scope.txt
  run bash "$(_arc_scan)" --scope scope.txt --no-stamp --exit-zero
  [ "$status" -eq 0 ]
  run jq -e '.version == "2.1.0" and (.runs | type == "array")' .claude/state/scan/scan-result.sarif
  [ "$status" -eq 0 ]
}

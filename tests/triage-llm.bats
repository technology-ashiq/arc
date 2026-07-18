#!/usr/bin/env bats
# Phase 02 #3 -- LLM triage v1: downgrade-only false-positive filter.
# A NEW error below the confidence threshold (default 8) is downgraded
# error->note (tagged, kept in SARIF). Never upgrades, never invents; any
# backend error/absence => kept (fail-closed). Backend is pluggable via
# ARC_TRIAGE_CMD (finding JSON on stdin -> {confidence,reason}); unset => the
# deterministic fake trusts every finding (confidence 10).
bats_require_minimum_version 1.5.0
load 'test_helper'

LIBS() { echo ". '$ARC_CORE_SRC/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; . '$ARC_SCAN_SRC/lib/triage.sh'; . '$ARC_SCAN_SRC/lib/triage-llm.sh'"; }

# _write -- slurp heredoc/stdin into a temp file, echo its path.
_write() { local p; p="$(mktemp)"; cat > "$p"; echo "$p"; }

# A backend that scores by ruleId: "noise" => 3, else 9. Reads finding on stdin.
BK_BYRULE="jq -c '{confidence: (if .ruleId==\"noise\" then 3 else 9 end), reason: (\"rule \" + (.ruleId // \"?\"))}'"

# ---- confidence resolver ----
@test "triage-llm: no backend => trust all (confidence 10)" {
  run bash -c "$(LIBS); arc_triage_confidence '{\"ruleId\":\"x\"}' | cut -f1"
  [ "$output" = "10" ]
}

@test "triage-llm: backend object {confidence,reason} is parsed" {
  run env ARC_TRIAGE_CMD="$BK_BYRULE" bash -c "$(LIBS); arc_triage_confidence '{\"ruleId\":\"noise\"}'"
  [ "${output%%$'\t'*}" = "3" ]
  [[ "${output#*$'\t'}" == rule\ noise* ]]
}

@test "triage-llm: backend bare number is accepted" {
  run env ARC_TRIAGE_CMD="echo 4" bash -c "$(LIBS); arc_triage_confidence '{}' | cut -f1"
  [ "$output" = "4" ]
}

@test "triage-llm: garbage backend => fail-closed to 10 (kept)" {
  run env ARC_TRIAGE_CMD="echo not-json" bash -c "$(LIBS); arc_triage_confidence '{}' | cut -f1"
  [ "$output" = "10" ]
}

# ---- filter behaviour ----
@test "triage-llm: no backend keeps a new error blocking" {
  local m; m="$(_write <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"ruleId":"noise","level":"error","properties":{"new":true}}
]}]}
EOF
)"
  local o; o="$(mktemp)"
  bash -c "$(LIBS); arc_triage_llm_filter '$m' '$o'"
  [ "$(jq -r '.runs[0].results[0].level' "$o")" = "error" ]
  [ "$(jq -r '.runs[0].results[0].properties.triage_downgraded // false' "$o")" = "false" ]
  run bash -c "$(LIBS); arc_triage_verdict '$o' '' '' | jq -r .verdict"
  [ "$output" = "block" ]
}

@test "triage-llm: low-confidence new error is downgraded error->note (tagged)" {
  local m; m="$(_write <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"ruleId":"noise","level":"error","properties":{"new":true}}
]}]}
EOF
)"
  local o; o="$(mktemp)"
  ARC_TRIAGE_CMD="$BK_BYRULE" bash -c "$(LIBS); arc_triage_llm_filter '$m' '$o'"
  [ "$(jq -r '.runs[0].results[0].level' "$o")" = "note" ]
  [ "$(jq -r '.runs[0].results[0].properties.triage_downgraded' "$o")" = "true" ]
  [ "$(jq -r '.runs[0].results[0].properties.triage_confidence' "$o")" = "3" ]
  [ -n "$(jq -r '.runs[0].results[0].properties.triage_reason' "$o")" ]
  run bash -c "$(LIBS); arc_triage_verdict '$o' '' '' | jq -rc '{v:.verdict,n:.new_errors}'"
  [ "$output" = '{"v":"pass","n":0}' ]
}

@test "triage-llm: high-confidence new error is kept blocking" {
  local m; m="$(_write <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"ruleId":"eval-injection","level":"error","properties":{"new":true}}
]}]}
EOF
)"
  local o; o="$(mktemp)"
  ARC_TRIAGE_CMD="$BK_BYRULE" bash -c "$(LIBS); arc_triage_llm_filter '$m' '$o'"
  [ "$(jq -r '.runs[0].results[0].level' "$o")" = "error" ]
  run bash -c "$(LIBS); arc_triage_verdict '$o' '' '' | jq -r .verdict"
  [ "$output" = "block" ]
}

@test "triage-llm: never upgrades -- a note stays a note" {
  local m; m="$(_write <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"ruleId":"eval-injection","level":"note","properties":{"new":true}}
]}]}
EOF
)"
  local o; o="$(mktemp)"
  ARC_TRIAGE_CMD="$BK_BYRULE" bash -c "$(LIBS); arc_triage_llm_filter '$m' '$o'"
  [ "$(jq -r '.runs[0].results[0].level' "$o")" = "note" ]
  [ "$(jq -r '.runs[0].results[0].properties.triage_downgraded // false' "$o")" = "false" ]
}

@test "triage-llm: never invents -- result count is unchanged" {
  local m; m="$(_write <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"ruleId":"noise","level":"error","properties":{"new":true}},
  {"ruleId":"noise","level":"error","properties":{"new":true}}
]}]}
EOF
)"
  local o; o="$(mktemp)"
  ARC_TRIAGE_CMD="$BK_BYRULE" bash -c "$(LIBS); arc_triage_llm_filter '$m' '$o'"
  [ "$(jq '[.runs[].results[]] | length' "$o")" -eq 2 ]
}

@test "triage-llm: baseline + suppressed findings are never triaged" {
  local m; m="$(_write <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"ruleId":"noise","level":"error","properties":{"new":false}},
  {"ruleId":"noise","level":"error","properties":{"new":true,"suppressed":true}}
]}]}
EOF
)"
  local o; o="$(mktemp)"
  ARC_TRIAGE_CMD="$BK_BYRULE" bash -c "$(LIBS); arc_triage_llm_filter '$m' '$o'"
  # neither is a NEW-unsuppressed error, so neither is downgraded
  [ "$(jq -r '.runs[0].results[0].level' "$o")" = "error" ]
  [ "$(jq -r '.runs[0].results[0].properties.triage_downgraded // false' "$o")" = "false" ]
  [ "$(jq -r '.runs[0].results[1].level' "$o")" = "error" ]
  [ "$(jq -r '.runs[0].results[1].properties.triage_downgraded // false' "$o")" = "false" ]
}

@test "triage-llm: garbage backend keeps a real finding blocking (fail-closed)" {
  local m; m="$(_write <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"ruleId":"secret","level":"error","properties":{"new":true}}
]}]}
EOF
)"
  local o; o="$(mktemp)"
  ARC_TRIAGE_CMD="echo not-json" bash -c "$(LIBS); arc_triage_llm_filter '$m' '$o'"
  [ "$(jq -r '.runs[0].results[0].level' "$o")" = "error" ]
  run bash -c "$(LIBS); arc_triage_verdict '$o' '' '' | jq -r .verdict"
  [ "$output" = "block" ]
}

# ---- e2e through arc-scan.sh ----
@test "triage-llm e2e: low-confidence backend downgrades a planted secret -> pass; without -> block" {
  _arc_need_gitleaks
  local d; d="$(mktemp -d)"; : > "$d/bl.jsonl"
  printf 'const t="ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > "$d/s.js"
  printf '%s\n' "$d/s.js" > "$d/scope.txt"
  local args="--scope $d/scope.txt --no-stamp --out-dir $d/o --baseline-file $d/bl.jsonl --suppress-file $d/none.md --exit-zero"
  # no backend -> the new secret blocks
  bash "$ARC_SCAN_SRC/arc-scan.sh" $args
  [ "$(jq -r '.verdict' "$d/o/verdict.json")" = "block" ]
  # low-confidence backend -> downgraded -> pass, and the SARIF records the downgrade
  ARC_TRIAGE_CMD="jq -c '{confidence:2,reason:\"fixture\"}'" bash "$ARC_SCAN_SRC/arc-scan.sh" $args
  [ "$(jq -r '.verdict' "$d/o/verdict.json")" = "pass" ]
  [ "$(jq -r '[.runs[].results[] | select(.properties.triage_downgraded==true)] | length' "$d/o/scan-result.sarif")" -ge 1 ]
  rm -rf "$d"
}

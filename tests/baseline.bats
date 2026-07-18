#!/usr/bin/env bats
# Phase 02 -- baseline / new-code-only blocking (ADR-0002, the core noise defense).
bats_require_minimum_version 1.5.0
load 'test_helper'

LIBS() { echo ". '$ARC_CORE_SRC/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; . '$ARC_SCAN_SRC/lib/baseline.sh'; . '$ARC_SCAN_SRC/lib/triage.sh'"; }

@test "baseline freeze: fingerprints written sorted + unique" {
  local d; d="$(mktemp -d)"
  printf '%s\n%s\n%s\n' \
    '{"fingerprint":"bbb","tool":"t","ruleId":"r","file":"f"}' \
    '{"fingerprint":"aaa","tool":"t","ruleId":"r","file":"f"}' \
    '{"fingerprint":"aaa","tool":"t","ruleId":"r","file":"f"}' > "$d/f.jsonl"
  run bash -c "$(LIBS); arc_baseline_freeze '$d/f.jsonl' '$d/bl.jsonl'; jq -r .fingerprint '$d/bl.jsonl' | tr -d '\r'"
  [ "${lines[0]}" = "aaa" ]           # sorted
  [ "${lines[1]}" = "bbb" ]
  [ "${#lines[@]}" -eq 2 ]            # deduped (aaa once)
  rm -rf "$d"
}

@test "baseline freeze: append-only union with an existing baseline" {
  local d; d="$(mktemp -d)"
  printf '{"fingerprint":"old","tool":"t","ruleId":"r","file":"f"}\n' > "$d/bl.jsonl"
  printf '{"fingerprint":"new","tool":"t","ruleId":"r","file":"f"}\n' > "$d/f.jsonl"
  run bash -c "$(LIBS); arc_baseline_freeze '$d/f.jsonl' '$d/bl.jsonl'; jq -s length '$d/bl.jsonl'"
  [ "$output" -eq 2 ]                 # old preserved + new added
  rm -rf "$d"
}

@test "baseline partition: known fp => new=false, novel fp => new=true" {
  local d; d="$(mktemp -d)"
  printf '{"fingerprint":"known"}\n' > "$d/bl.jsonl"
  printf '%s\n%s\n' '{"fingerprint":"known","level":"error"}' '{"fingerprint":"novel","level":"error"}' > "$d/f.jsonl"
  run bash -c "$(LIBS); arc_baseline_partition '$d/f.jsonl' '$d/bl.jsonl'"
  [ "$(echo "$output" | jq -s -r '.[0].new')" = "false" ]
  [ "$(echo "$output" | jq -s -r '.[1].new')" = "true" ]
  rm -rf "$d"
}

@test "merge preserves new=false (regression: jq // treats false as absent)" {
  local d; d="$(mktemp -d)"
  printf '{"tool":"t","ruleId":"r","level":"error","message":"m","file":"a.js","line":1,"fingerprint":"x","new":false}\n' > "$d/f.jsonl"
  run bash -c "$(LIBS); arc_sarif_merge '$d/f.jsonl' | jq -r '.runs[0].results[0].properties.new'"
  [ "$output" = "false" ]            # must NOT be flipped to true
  rm -rf "$d"
}

@test "triage: a baselined error does not block (new_errors excludes baseline)" {
  local d; d="$(mktemp -d)"
  cat > "$d/m.sarif" <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"level":"error","properties":{"new":false}},
  {"level":"error","properties":{"new":true}}
]}]}
EOF
  run bash -c "$(LIBS); arc_triage_verdict '$d/m.sarif' '' '' | jq -rc '{v:.verdict,n:.new_errors,b:.baseline}'"
  [ "$output" = '{"v":"block","n":1,"b":1}' ]   # 1 new blocks, 1 baselined does not
  rm -rf "$d"
}

@test "e2e: freeze a finding -> rescan PASSES; a novel finding still BLOCKS" {
  _arc_need_semgrep
  local d; d="$(mktemp -d)"
  printf 'function h(req){ return eval(req.query.q); }\n' > "$d/a.js"
  printf '%s\n' "$d/a.js" > "$d/scope.txt"
  run bash "$ARC_SCAN_SRC/arc-scan.sh" --scope "$d/scope.txt" --no-stamp --out-dir "$d/o" --baseline-file "$d/bl.jsonl"
  [ "$status" -eq 2 ]                                     # blocks before baseline
  bash "$ARC_SCAN_SRC/arc-scan.sh" --scope "$d/scope.txt" --baseline --out-dir "$d/o" --baseline-file "$d/bl.jsonl"
  run bash "$ARC_SCAN_SRC/arc-scan.sh" --scope "$d/scope.txt" --no-stamp --out-dir "$d/o" --baseline-file "$d/bl.jsonl"
  [ "$status" -eq 0 ]                                     # baselined => passes
  # a novel finding still blocks
  printf 'const t="ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > "$d/b.js"
  printf '%s\n%s\n' "$d/a.js" "$d/b.js" > "$d/scope2.txt"
  run bash "$ARC_SCAN_SRC/arc-scan.sh" --scope "$d/scope2.txt" --no-stamp --out-dir "$d/o" --baseline-file "$d/bl.jsonl"
  [ "$status" -eq 2 ]
  run jq -rc '{n:.new_errors,b:.baseline}' "$d/o/verdict.json"
  [ "$output" = '{"n":1,"b":1}' ]
  rm -rf "$d"
}

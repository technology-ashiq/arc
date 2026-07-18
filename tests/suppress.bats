#!/usr/bin/env bats
# Phase 02 -- suppression ledger (justified waivers) + fingerprint determinism.
bats_require_minimum_version 1.5.0
load 'test_helper'

LIBS() { echo ". '$ARC_CORE_SRC/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; . '$ARC_SCAN_SRC/lib/suppress.sh'; . '$ARC_SCAN_SRC/lib/triage.sh'"; }

_sup() {  # write a suppressions.md with the given table body, echo path
  local p; p="$(mktemp)"
  { printf '# Suppressions\n\n| fingerprint | justification | date | by |\n|---|---|---|---|\n'; printf '%s\n' "$1"; } > "$p"
  echo "$p"
}

@test "suppress: only justified rows count; unjustified are excluded" {
  local s; s="$(_sup '| aaa | real reason | 2026-07-09 | me |
| bbb |  | 2026-07-09 | me |')"
  run bash -c "$(LIBS); arc_suppress_valid '$s'"
  [ "$output" = "aaa" ]                          # bbb has no justification
  run bash -c "$(LIBS); arc_suppress_unjustified '$s'"
  [ "$output" = "bbb" ]
}

@test "suppress: annotate marks a justified fingerprint suppressed=true" {
  local s; s="$(_sup '| known | accepted risk | 2026-07-09 | me |')"
  local d; d="$(mktemp -d)"
  printf '%s\n%s\n' '{"fingerprint":"known","level":"error"}' '{"fingerprint":"other","level":"error"}' > "$d/f.jsonl"
  run bash -c "$(LIBS); arc_suppress_annotate '$d/f.jsonl' '$s'"
  [ "$(echo "$output" | jq -s -r '.[0].suppressed')" = "true" ]
  [ "$(echo "$output" | jq -s -r '.[1].suppressed')" = "false" ]
  rm -rf "$d"
}

@test "triage: a suppressed error does not block" {
  local d; d="$(mktemp -d)"
  cat > "$d/m.sarif" <<'EOF'
{"version":"2.1.0","runs":[{"results":[
  {"level":"error","properties":{"new":true,"suppressed":true}},
  {"level":"error","properties":{"new":true,"suppressed":false}}
]}]}
EOF
  run bash -c "$(LIBS); arc_triage_verdict '$d/m.sarif' '' '' | jq -rc '{v:.verdict,n:.new_errors,s:.suppressed}'"
  [ "$output" = '{"v":"block","n":1,"s":1}' ]     # 1 blocks, 1 suppressed
  rm -rf "$d"
}

@test "fingerprint is deterministic across identical scans (regression)" {
  _arc_need_gitleaks
  local d; d="$(mktemp -d)"
  printf 'const t="ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > "$d/s.js"
  printf '%s\n' "$d/s.js" > "$d/scope.txt"
  bash "$ARC_SCAN_SRC/adapters/gitleaks.sh" "$d/scope.txt" "$d/a.sarif"
  bash "$ARC_SCAN_SRC/adapters/gitleaks.sh" "$d/scope.txt" "$d/b.sarif"
  local fa fb
  fa="$(bash -c "$(LIBS); arc_sarif_normalize gitleaks '$d/a.sarif' | jq -r .fingerprint")"
  fb="$(bash -c "$(LIBS); arc_sarif_normalize gitleaks '$d/b.sarif' | jq -r .fingerprint")"
  [ -n "$fa" ] && [ "$fa" = "$fb" ]              # same finding => same fingerprint
  rm -rf "$d"
}

@test "e2e: justified suppression PASSES, unjustified still BLOCKS" {
  _arc_need_gitleaks
  local d; d="$(mktemp -d)"; : > "$d/bl.jsonl"
  printf 'const t="ghp_16C7e42F292c6912E7710c838347Ae178B4a";\n' > "$d/s.js"
  printf '%s\n' "$d/s.js" > "$d/scope.txt"
  local args="--scope $d/scope.txt --no-stamp --out-dir $d/o --baseline-file $d/bl.jsonl --exit-zero"
  # capture the fingerprint
  bash "$ARC_SCAN_SRC/arc-scan.sh" $args --suppress-file "$d/none.md"
  local fp; fp="$(jq -r '.runs[].results[0].partialFingerprints.arcFingerprint' "$d/o/scan-result.sarif")"
  # justified -> pass
  { printf '| fingerprint | justification | date | by |\n|---|---|---|---|\n'; printf '| %s | fixture | 2026-07-09 | me |\n' "$fp"; } > "$d/sup.md"
  bash "$ARC_SCAN_SRC/arc-scan.sh" $args --suppress-file "$d/sup.md"
  [ "$(jq -r '.verdict' "$d/o/verdict.json")" = "pass" ]
  # unjustified -> block
  { printf '| fingerprint | justification | date | by |\n|---|---|---|---|\n'; printf '| %s |  | 2026-07-09 | me |\n' "$fp"; } > "$d/sup.md"
  bash "$ARC_SCAN_SRC/arc-scan.sh" $args --suppress-file "$d/sup.md"
  [ "$(jq -r '.verdict' "$d/o/verdict.json")" = "block" ]
  rm -rf "$d"
}

#!/usr/bin/env bats
# Phase 03 #3 -- CodeQL adapter (deep SAST, OPTIONAL tier, ADR-0004).
# Two gates before it ever runs: it is CI-tier only (ADR-0006; too heavy for the
# <30s hook budget) and OPTIONAL (semgrep is the always-available spine, so a
# missing codeql is a SKIP, never a failure). When present it builds a DB over
# the source root and analyzes the detected language. Real codeql is a huge
# install, so tests use a deterministic FAKE codeql (create + analyze).
bats_require_minimum_version 1.5.0
load 'test_helper'

setup()    { _arc_load_libs; }
teardown() { _arc_teardown; }

# Fake `codeql`: `database create <db> ...` makes the dir; `database analyze <db>
# <suite> --output <f> ...` writes a canned SARIF (one JS SQL-injection error).
_fake_codeql() {
  local d; d="$(mktemp -d)"
  cat > "$d/codeql" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = "database" ] && [ "$2" = "create" ]; then mkdir -p "$3" 2>/dev/null || true; exit 0; fi
if [ "$1" = "database" ] && [ "$2" = "analyze" ]; then
  out=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --output) out="$2"; shift 2;;
      --output=*) out="${1#--output=}"; shift;;
      *) shift;;
    esac
  done
  [ -n "$out" ] && printf '%s' '{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"CodeQL","rules":[{"id":"js/sql-injection","defaultConfiguration":{"level":"error"}}]}},"results":[{"ruleId":"js/sql-injection","ruleIndex":0,"level":"error","message":{"text":"Database query built from user-controlled sources"},"locations":[{"physicalLocation":{"artifactLocation":{"uri":"src/app.js"},"region":{"startLine":10}}}]}]}]}' > "$out"
  exit 0
fi
exit 0
EOF
  chmod +x "$d/codeql"; echo "$d"
}

# ---------------------------------------------------------------------------
# 1. Tier + optionality gates
# ---------------------------------------------------------------------------

@test "codeql adapter: hook tier (not CI) => SKIPPED, empty SARIF" {
  local d; d="$(mktemp -d)"; echo "src/app.js" > "$d/scope.txt"
  run env -u CI -u ARC_TIER ARC_CODEQL_BIN="anything" bash "$ARC_SCAN_SRC/adapters/codeql.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED codeql"* ]]
  [[ "$output" == *"CI-tier"* ]]
  run jq '[.runs[].results[]?]|length' "$d/o.sarif"; [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "codeql adapter: CI-tier + tool missing => SKIPPED (optional), empty SARIF" {
  local d; d="$(mktemp -d)"; echo "src/app.js" > "$d/scope.txt"
  run env -u CI ARC_TIER=ci ARC_CODEQL_BIN="arc-no-such-bin" bash "$ARC_SCAN_SRC/adapters/codeql.sh" "$d/scope.txt" "$d/o.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED codeql"* ]]
  run jq '[.runs[].results[]?]|length' "$d/o.sarif"; [ "$output" -eq 0 ]
  rm -rf "$d"
}

# ---------------------------------------------------------------------------
# 2. Language detection + analysis
# ---------------------------------------------------------------------------

@test "codeql adapter: CI-tier + codeql + JS in scope => finding (fake)" {
  local fc; fc="$(_fake_codeql)"
  _arc_sandbox
  mkdir -p src; printf 'const q = db.query(req.body.x);\n' > src/app.js
  printf 'src/app.js\n' > scope.txt
  run env -u CI ARC_TIER=ci ARC_CODEQL_BIN="$fc/codeql" bash "$ARC_SCAN_SRC/adapters/codeql.sh" scope.txt o.sarif
  [ "$status" -eq 0 ]
  run jq -r '.runs[].results[].ruleId' o.sarif
  [ "$output" = "js/sql-injection" ]
  rm -rf "$fc"
}

@test "codeql adapter: CI-tier + no supported language in scope => empty SARIF" {
  local fc; fc="$(_fake_codeql)"
  _arc_sandbox
  printf '# readme\n' > README.md
  printf 'README.md\n' > scope.txt
  run env -u CI ARC_TIER=ci ARC_CODEQL_BIN="$fc/codeql" bash "$ARC_SCAN_SRC/adapters/codeql.sh" scope.txt o.sarif
  [ "$status" -eq 0 ]
  run jq '[.runs[].results[]?]|length' o.sarif
  [ "$output" -eq 0 ]
  rm -rf "$fc"
}

@test "codeql adapter: detects python when no JS in scope" {
  local fc; fc="$(_fake_codeql)"
  _arc_sandbox
  printf 'import os\n' > app.py
  printf 'app.py\n' > scope.txt
  run env -u CI ARC_TIER=ci ARC_CODEQL_BIN="$fc/codeql" bash "$ARC_SCAN_SRC/adapters/codeql.sh" scope.txt o.sarif
  [ "$status" -eq 0 ]
  [[ "$output" == *"analyzed python"* ]]        # language detection: python picked
  rm -rf "$fc"
}

@test "normalize: codeql finding resolves to error severity" {
  local fc; fc="$(_fake_codeql)"
  _arc_sandbox
  mkdir -p src; printf 'x\n' > src/app.js; printf 'src/app.js\n' > scope.txt
  env -u CI ARC_TIER=ci ARC_CODEQL_BIN="$fc/codeql" bash "$ARC_SCAN_SRC/adapters/codeql.sh" scope.txt c.sarif
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_normalize codeql c.sarif | jq -r '.level' | head -1"
  [ "$status" -eq 0 ]
  [ "$output" = "error" ]
  rm -rf "$fc"
}

#!/usr/bin/env bash
# arc-scan.sh -- the steel-thread spine (Phase 00).
#   diff-scope -> adapters (semgrep, gitleaks) -> normalize -> SARIF merge
#   -> triage stub -> review-ledger stamp.
#
# Every stage degrades loudly: a missing tool is SKIPPED (never silent), a
# missing jq downgrades the verdict to "skipped" rather than crashing the hook.
#
# Usage:
#   arc-scan.sh [--base <ref> | --scope <file> | --all]
#               [--out-dir <dir>] [--stamp|--no-stamp] [--exit-zero]
#
# Exit: 0 = pass/skipped, 2 = block (unless --exit-zero). Mirrors the
# review-ledger BLOCK convention so hooks can treat non-zero uniformly.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/lib/common.sh"
. "$HERE/lib/sarif.sh"
. "$HERE/lib/triage.sh"
. "$HERE/lib/baseline.sh"
. "$HERE/lib/suppress.sh"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LEDGER="$ROOT/.claude/scripts/review-ledger.sh"
# Scan gate mode from the active strictness profile (block-by-default). In warn
# mode a block verdict is reported but downgraded to advisory (exit 0).
SCAN_MODE="$(bash "$ROOT/.claude/scripts/arc-profile.sh" mode scan 2>/dev/null || echo block)"

# --- args --------------------------------------------------------------------
base=""; scope_file=""; scope_mode="default"; out_dir=""
do_stamp="auto"; exit_zero=0; mode="scan"; baseline_file=""; suppress_file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --base)     base="${2:-}"; scope_mode="base"; shift 2;;
    --scope)    scope_file="${2:-}"; scope_mode="explicit"; shift 2;;
    --all)      scope_mode="all"; shift;;
    --baseline) mode="baseline"; shift;;
    --baseline-file) baseline_file="${2:-}"; shift 2;;
    --suppress-file) suppress_file="${2:-}"; shift 2;;
    --out-dir)  out_dir="${2:-}"; shift 2;;
    --stamp)    do_stamp="yes"; shift;;
    --no-stamp) do_stamp="no"; shift;;
    --exit-zero) exit_zero=1; shift;;
    -h|--help)
      grep '^#' "$HERE/arc-scan.sh" | sed 's/^# \{0,1\}//'; exit 0;;
    *) arc_die "unknown arg: $1";;
  esac
done

out_dir="${out_dir:-$ROOT/.claude/state/scan}"
mkdir -p "$out_dir"
work="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-scan.$$")"; mkdir -p "$work"
trap 'rm -rf "$work"' EXIT

# --- 1. diff scope -----------------------------------------------------------
scope="$work/scope.txt"; : > "$scope"
case "$scope_mode" in
  explicit) [ -f "$scope_file" ] && cp "$scope_file" "$scope" || arc_die "scope file not found: $scope_file";;
  base)     git -C "$ROOT" diff --name-only --diff-filter=ACMR "$base"...HEAD > "$scope" 2>/dev/null || true;;
  all)      git -C "$ROOT" ls-files > "$scope" 2>/dev/null || true;;
  default)
    # working-tree + staged changes vs HEAD; fall back to all tracked files
    { git -C "$ROOT" diff --name-only --diff-filter=ACMR HEAD 2>/dev/null;
      git -C "$ROOT" diff --name-only --cached --diff-filter=ACMR 2>/dev/null; } \
      | sort -u > "$scope" || true
    [ -s "$scope" ] || git -C "$ROOT" ls-files > "$scope" 2>/dev/null || true;;
esac
scope_n="$(grep -c . "$scope" 2>/dev/null || echo 0)"
arc_log "scope: $scope_n file(s) [$scope_mode]"

# --- 2. adapters -> native SARIF ---------------------------------------------
ran=(); skipped=(); jsonl="$work/findings.jsonl"; : > "$jsonl"
jq_ok=1; [ -z "$(arc_jq_bin)" ] && jq_ok=0

# Only called when the tool is present, so a produced SARIF => the tool ran.
# Normalizing an empty runs[] yields zero lines, so appending is always safe.
run_adapter() {
  local name="$1" native="$work/$1.sarif"
  bash "$HERE/adapters/$1.sh" "$scope" "$native"
  ran+=("$name")
  [ "$jq_ok" -eq 1 ] && [ -s "$native" ] && arc_sarif_normalize "$name" "$native" >> "$jsonl"
}
# Detect true skips (tool missing) up front for honest reporting.
[ -n "$(arc_semgrep_bin)" ]  && run_adapter semgrep  || { skipped+=("semgrep");  arc_skip "semgrep"; }
[ -n "$(arc_gitleaks_bin)" ] && run_adapter gitleaks || { skipped+=("gitleaks"); arc_skip "gitleaks"; }

ran_csv="$(IFS=,; echo "${ran[*]:-}")"
skipped_csv="$(IFS=,; echo "${skipped[*]:-}")"

# --- 2b. baseline (new-code-only, ADR-0002) ----------------------------------
baseline_file="${baseline_file:-${ARC_BASELINE:-$ROOT/.claude/state/scan-baseline.jsonl}}"
if [ "$mode" = "baseline" ]; then
  if [ "$jq_ok" -eq 1 ]; then
    arc_baseline_freeze "$jsonl" "$baseline_file"
    arc_log "baseline: froze $(arc_baseline_count "$baseline_file") fingerprint(s) -> $baseline_file"
  else
    arc_skip "baseline (jq not installed)"
  fi
  exit 0
fi
# normal scan: annotate each finding new (blocks) vs baseline, then suppression.
# A finding blocks only if it is a NEW error AND not justified-suppressed.
suppress_file="${suppress_file:-${ARC_SUPPRESSIONS:-$ROOT/docs/suppressions.md}}"
if [ "$jq_ok" -eq 1 ]; then
  arc_baseline_partition "$jsonl" "$baseline_file" > "$work/annotated.jsonl"
  [ -s "$work/annotated.jsonl" ] && jsonl="$work/annotated.jsonl"
  arc_suppress_annotate "$jsonl" "$suppress_file" > "$work/suppressed.jsonl"
  [ -s "$work/suppressed.jsonl" ] && jsonl="$work/suppressed.jsonl"
fi

# --- 3. merge ----------------------------------------------------------------
merged="$out_dir/scan-result.sarif"
if [ "$jq_ok" -eq 1 ]; then
  arc_sarif_merge "$jsonl" > "$merged"
else
  arc_skip "SARIF normalize/merge (jq not installed) -- verdict degraded to skipped"
  printf '{"version":"2.1.0","runs":[]}\n' > "$merged"
fi

# --- 4. triage ---------------------------------------------------------------
verdict_json="$out_dir/verdict.json"
if [ "$jq_ok" -eq 1 ]; then
  arc_triage_verdict "$merged" "$ran_csv" "$skipped_csv" > "$verdict_json"
  verdict="$(jq -r '.verdict' "$verdict_json")"
else
  printf '{"verdict":"skipped","reason":"jq missing","tools_ran":[],"tools_skipped":["jq"]}\n' > "$verdict_json"
  verdict="skipped"
fi

# --- 5. stamp ----------------------------------------------------------------
# Guard on -f, not -x: the ledger is invoked via `bash "$LEDGER"`, so it needs
# only to exist and be readable. git-on-Windows does not reliably track the exec
# bit, so -x is false on Linux CI even when the file is present (pre-mortem #6).
stamped="no"
if [ "$do_stamp" != "no" ] && [ -f "$LEDGER" ]; then
  if [ "$verdict" = "pass" ]; then
    bash "$LEDGER" stamp scan >/dev/null 2>&1 && stamped="yes"
  else
    bash "$LEDGER" unstamp scan >/dev/null 2>&1 || true
  fi
fi

# --- 6. report ---------------------------------------------------------------
findings="$(jq -r '.findings // 0' "$verdict_json" 2>/dev/null || echo 0)"
new_errors="$(jq -r '.new_errors // 0' "$verdict_json" 2>/dev/null || echo 0)"
baseline_n="$(jq -r '.baseline // 0' "$verdict_json" 2>/dev/null || echo 0)"
arc_log "verdict: $verdict ($findings finding(s): $new_errors new error(s), $baseline_n baselined) | ran: ${ran_csv:-none} | skipped: ${skipped_csv:-none} | stamped: $stamped"
arc_log "sarif:   $merged"
arc_log "verdict: $verdict_json"

case "$verdict" in
  block)
    if   [ "$exit_zero" -eq 1 ];    then exit 0
    elif [ "$SCAN_MODE" = "warn" ]; then arc_log "scan mode=warn: block downgraded to advisory (exit 0)"; exit 0
    else exit 2; fi
    ;;
  *) exit 0;;
esac

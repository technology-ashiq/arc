#!/usr/bin/env bash
# common.sh -- shared helpers for the arc-scan pipeline.
# Sourced by arc-scan.sh, the adapters, and the triage stub.
#
# Design notes:
#   * Everything degrades LOUDLY, never silently (PLAN non-negotiable).
#   * JSON work uses jq (the primary of the python3->jq->sed chain). On this
#     spine jq is required for normalize/merge/triage; when absent those steps
#     emit a SKIPPED line and the verdict degrades to "skipped" (exit 0), so a
#     missing jq downgrades enforcement but never crashes the hook.
#   * Cross-platform: Git Bash (Windows) + Linux CI. No PowerShell, no GNU-only
#     flags. sha1sum ships with Git for Windows and coreutils alike.

# --- logging -----------------------------------------------------------------
arc_log()  { printf 'arc-scan: %s\n' "$*" >&2; }
arc_skip() { printf 'SKIPPED %s\n' "$*" >&2; }   # the never-silent degrade marker
arc_die()  { printf 'arc-scan: ERROR: %s\n' "$*" >&2; exit 1; }

# --- tool detection ----------------------------------------------------------
arc_have() { command -v "$1" >/dev/null 2>&1; }

# semgrep spine: prefer opengrep (the installed fork) then semgrep proper.
# ARC_SEMGREP_BIN pins an explicit binary (empty result if it does not exist).
arc_semgrep_bin() {
  if [ -n "${ARC_SEMGREP_BIN:-}" ]; then
    arc_have "$ARC_SEMGREP_BIN" && echo "$ARC_SEMGREP_BIN" || echo ""
  elif arc_have opengrep; then echo opengrep
  elif arc_have semgrep;  then echo semgrep
  else echo ""; fi
}

# gitleaks binary or empty. ARC_GITLEAKS_BIN pins an explicit binary.
arc_gitleaks_bin() {
  if [ -n "${ARC_GITLEAKS_BIN:-}" ]; then
    arc_have "$ARC_GITLEAKS_BIN" && echo "$ARC_GITLEAKS_BIN" || echo ""
  elif arc_have gitleaks; then echo gitleaks
  else echo ""; fi
}

# jq path or empty. Callers decide whether absence is fatal or a SKIP.
arc_jq_bin() { arc_have jq && echo jq || echo ""; }

# --- fingerprinting ----------------------------------------------------------
# Stable per-finding fingerprint from identity fields, used when a tool does not
# supply one. Append-only + sorted by fingerprint => merge-friendly baselines.
arc_fingerprint() {
  # args: tool ruleId file line  (message is intentionally EXCLUDED -- tool
  # messages embed volatile detail like the staging path, which would make the
  # fingerprint non-deterministic and break baseline/suppression matching).
  local raw="$1|$2|$3|$4"
  if   arc_have sha1sum;  then printf '%s' "$raw" | sha1sum  | cut -d' ' -f1
  elif arc_have shasum;   then printf '%s' "$raw" | shasum   | cut -d' ' -f1
  else # last-resort deterministic fallback: no crypto, still stable
    printf '%s' "$raw" | cksum | tr -d ' ' | cut -c1-16
  fi
}

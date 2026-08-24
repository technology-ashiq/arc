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

# trivy binary or empty (SCA: dependency/lockfile vulnerabilities, Phase 03).
# ARC_TRIVY_BIN pins an explicit binary (empty result if it does not exist).
arc_trivy_bin() {
  if [ -n "${ARC_TRIVY_BIN:-}" ]; then
    arc_have "$ARC_TRIVY_BIN" && echo "$ARC_TRIVY_BIN" || echo ""
  elif arc_have trivy; then echo trivy
  else echo ""; fi
}

# trufflehog binary or empty (verified-secrets scan, Phase 03). ARC_TRUFFLEHOG_BIN
# pins an explicit binary (empty result if it does not exist).
arc_trufflehog_bin() {
  if [ -n "${ARC_TRUFFLEHOG_BIN:-}" ]; then
    arc_have "$ARC_TRUFFLEHOG_BIN" && echo "$ARC_TRUFFLEHOG_BIN" || echo ""
  elif arc_have trufflehog; then echo trufflehog
  else echo ""; fi
}

# codeql binary or empty (optional deep SAST, CI-tier, ADR-0004). ARC_CODEQL_BIN
# pins an explicit binary (empty result if it does not exist).
arc_codeql_bin() {
  if [ -n "${ARC_CODEQL_BIN:-}" ]; then
    arc_have "$ARC_CODEQL_BIN" && echo "$ARC_CODEQL_BIN" || echo ""
  elif arc_have codeql; then echo codeql
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

# arc_hash_file <path> -- portable sha256 of a file (GNU sha256sum / BSD-macOS
# shasum / cksum fallback). Empty string if the file is missing.
# Resolve a path to its PHYSICAL spelling, keeping any tail that does not exist yet.
#
# NEVER compare path strings without this. One machine calls a directory /var/folders/x and
# another calls the same directory /private/var/folders/x (macOS symlinks /var); Windows calls
# one path both C:/Users/RUNNER~1 and C:/Users/runneradmin (8.3 short names); Git Bash
# disagrees with git itself about /tmp. Every one of those is the same directory under a
# different spelling, and a prefix strip that misses leaves the path absolute, matches no
# allowed prefix, and blocks a boundary's own legitimate access.
#
# Lives in core because two design boundaries need it -- critic-scope-check.sh (writes) and
# composer-scope-check.sh (reads). It was duplicated between them for exactly one commit.
arc_canon_path() {
  _cp="$1"; _cs=""
  while [ -n "$_cp" ] && [ "$_cp" != "/" ] && [ ! -d "$_cp" ]; do
    _cs="$(basename "$_cp")${_cs:+/$_cs}"
    _cparent="$(dirname "$_cp")"
    [ "$_cparent" = "$_cp" ] && break
    _cp="$_cparent"
  done
  if [ -d "$_cp" ]; then
    _cbase="$(cd "$_cp" 2>/dev/null && pwd -P)" || _cbase="$_cp"
    # A root of "/" would concatenate to "//path". On Cygwin/MSYS "//host/share" is a UNC
    # path and in POSIX a leading "//" is implementation-defined, so the result stops being
    # the thing both boundaries believe it is.
    #
    # "//" is in the list for the same reason and was missed the first time: an input that
    # ALREADY starts "//" resolves to a base of "//" and concatenated to "///no-such/f". A
    # fresh attacker measured exactly that -- the guard named the UNC case in its own comment
    # and then did not cover the spelling the comment is about.
    case "$_cbase" in /|//) _cbase="";; esac
    printf '%s' "$_cbase${_cs:+/$_cs}"
  else
    printf '%s' "$1"
  fi
}

arc_hash_file() {
  [ -f "$1" ] || { echo ""; return 0; }
  if   arc_have sha256sum; then sha256sum "$1"      | cut -d' ' -f1
  elif arc_have shasum;    then shasum -a 256 "$1"  | cut -d' ' -f1
  else cksum "$1" | tr -s ' ' | cut -d' ' -f1; fi
}

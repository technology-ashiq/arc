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

# --- a run-scoped boundary: when it was armed ----------------------------------
# The design boundaries arm by writing a marker and disarm by deleting it, so a run that dies
# in between leaves its boundary refusing work indefinitely -- the operator's too, since a
# marker cannot tell who is calling. A composer marker did exactly that for three weeks behind
# a refusal that said neither when it was armed nor how to release it.
#
# These two are the one spelling of "when": arc_armed_stamp writes it into a marker and
# arc_armed_desc reads it back as a phrase for a refusal. Describing is ALL they do. Age never
# relaxes a refusal: the markers used to carry pid=$$, which is the --begin process itself and
# dead on its next line, so a liveness check on it would have disarmed every boundary on arrival.
arc_armed_stamp() {
  printf 'armed_at=%s\narmed_epoch=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(date -u +%s)"
}

# arc_marker_get <marker-file> <key>  ->  sets ARC_MV to the first value for <key>, CR-stripped,
# or to "" when there is none.
#
# Pure bash and no subshell, because a refusal reads several fields per marker and the first cut
# spent a tr|sed|head pipeline on each -- measured at double the cost of every refusal, growing
# per marker toward the hook timeout. The CR strip is the guard design-explore.sh's _sha_of
# carries: a CRLF marker must read the same on the leg whose sed strips CR silently and the two
# that do not.
#
# BOUNDED IN BYTES, not only in lines: at most 32 reads of at most 1024 characters each. A line
# cap alone was not a bound -- one marker line of a million zeros held this reader for over five
# minutes, and a hook that outlives its timeout is treated as ALLOW. A line longer than 1024 is
# read in pieces, so a key can only ever match at the start of a piece; that can misdescribe a
# hostile marker, never unlock anything, since nothing read here relaxes a refusal.
arc_marker_get() {
  ARC_MV=""; _mg_n=0; _mg_l=""
  [ -f "$1" ] || return 0
  while IFS= read -r -n 1024 _mg_l || [ -n "$_mg_l" ]; do
    _mg_n=$((_mg_n + 1)); [ "$_mg_n" -le 32 ] || break
    _mg_l="${_mg_l%$'\r'}"
    case "$_mg_l" in "$2="*) ARC_MV="${_mg_l#"$2="}"; return 0;; esac
    _mg_l=""
  done < "$1" 2>/dev/null
  return 0
}

# arc_armed_desc <marker-file>  ->  sets ARC_ARMED_DESC to "armed at <iso> (<n> <unit>s ago)" or
# "armed at an unknown time". A variable rather than stdout, for the same cost reason as above.
arc_armed_desc() {
  ARC_ARMED_DESC="armed at an unknown time"
  arc_marker_get "$1" armed_at;    _aa_at="$ARC_MV"
  arc_marker_get "$1" armed_epoch; _aa_ep="$ARC_MV"
  [ -n "${_ARC_NOW:-}" ] || _ARC_NOW="$(date -u +%s 2>/dev/null)"
  # LENGTH FIRST, then shape, then arithmetic -- in that order for two measured reasons. bash
  # evaluates a[$(cmd)] inside $(( )), so only digits may ever reach it. And every later step is
  # linear or worse in the value: the first cut stripped leading zeros one at a time, so a marker
  # carrying 64000 zeros held a hook for 79 seconds, past the timeout the harness treats as allow.
  [ "${#_aa_at}" -eq 20 ] || return 0
  [ "${#_aa_ep}" -ge 1 ] && [ "${#_aa_ep}" -le 20 ] || return 0
  case "$_aa_at"    in *[!0123456789TZ:-]*)    return 0;; esac
  case "$_aa_ep"    in *[!0123456789]*)        return 0;; esac
  case "$_ARC_NOW"  in ""|*[!0123456789]*)     return 0;; esac
  # Leading zeros in one expansion, then 10#: a zero-padded value is octal to bash, and an 8 or 9
  # in it is an expansion error that kills the hook with a code that is neither allow nor block.
  _aa_ep="${_aa_ep#"${_aa_ep%%[!0]*}"}"; [ -n "$_aa_ep" ] || _aa_ep=0
  [ "${#_aa_ep}" -le 12 ] || return 0
  _aa_age=$(( 10#$_ARC_NOW - 10#$_aa_ep ))
  if [ "$_aa_age" -lt 0 ]; then
    ARC_ARMED_DESC="armed at $_aa_at (in the future -- the marker or this clock is wrong)"
    return 0
  fi
  if   [ "$_aa_age" -ge 86400 ]; then _aa_n=$((_aa_age / 86400)); _aa_u=day
  elif [ "$_aa_age" -ge 3600 ];  then _aa_n=$((_aa_age / 3600));  _aa_u=hour
  else                                _aa_n=$((_aa_age / 60));    _aa_u=minute
  fi
  [ "$_aa_n" -eq 1 ] || _aa_u="${_aa_u}s"
  ARC_ARMED_DESC="armed at $_aa_at ($_aa_n $_aa_u ago)"
}

arc_hash_file() {
  [ -f "$1" ] || { echo ""; return 0; }
  if   arc_have sha256sum; then sha256sum "$1"      | cut -d' ' -f1
  elif arc_have shasum;    then shasum -a 256 "$1"  | cut -d' ' -f1
  else cksum "$1" | tr -s ' ' | cut -d' ' -f1; fi
}

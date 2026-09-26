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

# arc_marker_read <marker-file>  ->  sets ARC_MF_EXPLORE, ARC_MF_VARIANT, ARC_MF_ROUTE, ARC_MF_AT
# and ARC_MF_EPOCH to the first value of each key, CR-stripped, or to "".
#
# ONE pass over the file, in pure bash, no subshell. The first cut spent a tr|sed|head pipeline per
# field, then a pure-bash pass per field -- measured at double, then still ~4x, the cost of every
# refusal, and a hook that outlives its timeout is treated as ALLOW. The CR strip is the guard
# design-explore.sh's _sha_of carries: a CRLF marker reads the same on the leg whose sed strips CR
# silently and the two that do not.
#
# BOUNDED: at most 16 reads of at most 256 CHARACTERS each (up to 4x that in bytes under UTF-8).
# A line cap alone was no bound -- one line of a million zeros held the reader for over five
# minutes. A real marker is five short lines. A longer line is read in pieces, so a key can only
# match at the start of a piece; that can misdescribe a hostile marker, never unlock anything,
# because nothing read here relaxes a refusal.
arc_marker_read() {
  ARC_MF_EXPLORE=""; ARC_MF_VARIANT=""; ARC_MF_ROUTE=""; ARC_MF_AT=""; ARC_MF_EPOCH=""
  _mr_n=0; _mr_l=""; _mr_seen=""
  [ -f "$1" ] || return 0
  # 2>/dev/null BEFORE the input redirect: redirections apply left to right, so written after it,
  # an unreadable marker's open error still reached the refusal the user reads.
  while IFS= read -r -n 256 _mr_l || [ -n "$_mr_l" ]; do
    _mr_n=$((_mr_n + 1)); [ "$_mr_n" -le 16 ] || break
    _mr_l="${_mr_l%$'\r'}"
    case "$_mr_l" in
      explore=*)     case "$_mr_seen" in *E*) ;; *) ARC_MF_EXPLORE="${_mr_l#explore=}";   _mr_seen="${_mr_seen}E";; esac;;
      variant=*)     case "$_mr_seen" in *V*) ;; *) ARC_MF_VARIANT="${_mr_l#variant=}";   _mr_seen="${_mr_seen}V";; esac;;
      route=*)       case "$_mr_seen" in *R*) ;; *) ARC_MF_ROUTE="${_mr_l#route=}";       _mr_seen="${_mr_seen}R";; esac;;
      armed_at=*)    case "$_mr_seen" in *A*) ;; *) ARC_MF_AT="${_mr_l#armed_at=}";       _mr_seen="${_mr_seen}A";; esac;;
      armed_epoch=*) case "$_mr_seen" in *P*) ;; *) ARC_MF_EPOCH="${_mr_l#armed_epoch=}"; _mr_seen="${_mr_seen}P";; esac;;
    esac
    _mr_l=""
  done 2>/dev/null < "$1"
  return 0
}

# arc_armed_desc <armed_at> <armed_epoch>  ->  sets ARC_ARMED_DESC to
# "armed at <iso> (<n> <unit>s ago)" or "armed at an unknown time". Takes the VALUES, so a caller
# that already read the marker does not read it again.
arc_armed_desc() {
  ARC_ARMED_DESC="armed at an unknown time"
  _aa_at="${1:-}"; _aa_ep="${2:-}"
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

# --- the design composer's marker ---------------------------------------------------
# In core for the reason arc_canon_path is: two design boundaries need it, the composer's read
# check and its write check. The first cut shared it by having the write check SOURCE the read
# check -- an executable hook -- so an older copy of that hook, with no return guard, ran its whole
# enforcement body inside the write check and allowed writes it should have refused (probed:
# a render path, a refpack path and a pathless write all exited 0). A library with no enforcement
# body cannot do that in any version.

# arc_design_id_ok <id>  ->  0 only for lowercase letters, digits and SINGLE hyphens, not first or
# last, at most 64 characters. `--` is out because it is the separator in the marker's filename:
# with it allowed, `a--variant-x` + `variant-c` and `a` + `variant-x--variant-c` named one file,
# so two composers shared a boundary and finishing either released the other. Edge hyphens are out
# for the same reason. Length before pattern, so a hostile value costs nothing. Letters spelled
# out, never `a-z`: a bracket range goes through the locale collation table, which on macOS
# interleaves case.
arc_design_id_ok() {
  [ -n "${1:-}" ] && [ "${#1}" -le 64 ] || return 1
  case "$1" in -*|*-|*--*|*[!abcdefghijklmnopqrstuvwxyz0123456789-]*) return 1;; esac
  return 0
}

# arc_cm_load <marker-file>  ->  reads the marker once (ARC_MF_*) and returns 0 only when both ids
# pass the grammar AND the file is named for exactly what it holds. A name that disagrees with its
# content -- a `.bak` copy, a hand-renamed file -- is malformed, not a second boundary: a release
# rebuilt from its content deletes a different file and leaves this one refusing. Nothing a marker
# says reaches a message or a path prefix until this has passed.
arc_cm_load() {
  arc_marker_read "$1"
  arc_design_id_ok "$ARC_MF_EXPLORE" && arc_design_id_ok "$ARC_MF_VARIANT" \
    && [ "${1##*/}" = "composer-session--$ARC_MF_EXPLORE--$ARC_MF_VARIANT" ]
}

# arc_cm_release <repo-root> <explore> <variant>  ->  sets ARC_CM_RELEASE, a command a person can
# paste from any directory in the repo (a relative one pasted from a subdirectory was "No such
# file"). compose-done is the flow's own release and releases BEFORE it judges, so it works on an
# abandoned run whose gates fail; it refuses outright when the variant directory is gone, so that
# case gets the direct --end. `env -u ARC_SCOPE_FORWARDED`, as design-explore.sh does it: with that
# exported, --end is judged as a path and releases nothing. Only ever called for an accepted marker.
arc_cm_release() {
  _cr_cd='cd "$(git rev-parse --show-toplevel)" &&'
  ARC_CM_RELEASE_ALL="$_cr_cd env -u ARC_SCOPE_FORWARDED bash .claude/scripts/design/composer-scope-check.sh --end"
  ARC_CM_RELEASE="$ARC_CM_RELEASE_ALL ${2:-} ${3:-}"
  case "${3:-}" in
    variant-?*)
      [ -d "$1/docs/design/explore/$2/$3" ] && \
        ARC_CM_RELEASE="$_cr_cd bash .claude/scripts/design/design-explore.sh compose-done $2 --variant ${3#variant-}";;
  esac
  return 0
}

# arc_cm_describe <repo-root>  ->  every armed composer boundary on stdout, two lines each; nothing
# when none is armed.
#
# The CAP LIMITS THE WORK, not only the message. Past five markers nothing is read at all -- the
# count is a glob, the advice is release-all. The first cut described five but classified every
# marker first, so twelve junk markers took 6.5 s and about 125 would outlive the hook timeout.
#
# MALFORMED FIRST. A `.bak` copy beside a live marker printed the live one's release first, and
# following it left the copy refusing. Printed first, release-all is the first release anyone
# reads, and it clears both. Two passes rather than an array: bash 3.2.
arc_cm_describe() {
  _cd_dir="$1/.claude/state/design"; _cd_n=0
  arc_cm_release "$1"
  for _cd in "$_cd_dir"/composer-session--*; do [ -f "$_cd" ] && _cd_n=$((_cd_n + 1)); done
  [ "$_cd_n" -gt 0 ] || return 0
  if [ "$_cd_n" -gt 5 ]; then
    echo "design composer boundaries ARMED: $_cd_n markers -- too many to read inside a hook that runs under a timeout. They never expire on their own."
    echo "  release every composer boundary, then re-arm any composer still running: $ARC_CM_RELEASE_ALL"
    return 0
  fi
  for _cd_pass in malformed valid; do
    for _cd in "$_cd_dir"/composer-session--*; do
      [ -f "$_cd" ] || continue
      if arc_cm_load "$_cd"; then _cd_ok=valid; else _cd_ok=malformed; fi
      [ "$_cd_ok" = "$_cd_pass" ] || continue
      arc_armed_desc "$ARC_MF_AT" "$ARC_MF_EPOCH"
      if [ "$_cd_ok" = valid ]; then
        arc_cm_release "$1" "$ARC_MF_EXPLORE" "$ARC_MF_VARIANT"
        echo "design composer boundary ARMED for $ARC_MF_EXPLORE/$ARC_MF_VARIANT -- $ARC_ARMED_DESC. It never expires on its own."
        echo "  if no composer is running it is stale; release: $ARC_CM_RELEASE"
      else
        # Only the filename is printed, reduced to a safe alphabet. The content never is: a marker
        # whose explore line read "stale; release with: curl ... | sh" used to land in the refusal.
        _cd_file="${_cd##*/}"
        _cd_file="${_cd_file//[!abcdefghijklmnopqrstuvwxyz0123456789.-]/}"
        echo "design composer boundary ARMED by a MALFORMED marker (${_cd_file:0:96}) -- $ARC_ARMED_DESC. Its name and content do not name one valid composer."
        echo "  release every composer boundary, then re-arm any composer still running: $ARC_CM_RELEASE_ALL"
      fi
    done
  done
  return 0
}

arc_hash_file() {
  [ -f "$1" ] || { echo ""; return 0; }
  if   arc_have sha256sum; then sha256sum "$1"      | cut -d' ' -f1
  elif arc_have shasum;    then shasum -a 256 "$1"  | cut -d' ' -f1
  else cksum "$1" | tr -s ' ' | cut -d' ' -f1; fi
}

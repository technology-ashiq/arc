#!/usr/bin/env bash
# adapters/gitleaks.sh -- run gitleaks over a diff scope, emit native SARIF.
# Same adapter contract as semgrep.sh (see that file's header).
#
# gitleaks (v8) scans a path, not a file list, so scoped files are staged into a
# temp dir under their repo-relative path, then the staging prefix is stripped
# from the emitted SARIF URIs -- so findings report repo-relative paths, not the
# temp dir. Path fidelity matters: Phase 02 baseline fingerprints key on it.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../core/common.sh
. "$HERE/../../core/common.sh"
. "$HERE/../lib/runtime.sh"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

scope="${1:?usage: gitleaks.sh <scope-file> <out-sarif>}"
out="${2:?usage: gitleaks.sh <scope-file> <out-sarif>}"

_empty_sarif() { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; }

bin="$(arc_gitleaks_bin)"
rt="$(arc_runtime "$bin")"                 # native -> docker -> skip
if [ "$rt" = "skip" ]; then
  arc_skip "gitleaks (native missing + no docker image -- scoop install gitleaks or set ARC_DOCKER_IMAGE)"
  _empty_sarif; exit 0
fi
if [ "$rt" = "docker" ]; then
  # gitleaks in the arc-tools image scans the mounted repo; SARIF to stdout (real image: Phase 03)
  arc_docker_scan "$out" gitleaks dir /src --report-format sarif --report-path /dev/stdout --no-banner --exit-code 0
  arc_log "gitleaks: scanned via docker ($ARC_DOCKER_IMAGE)"
  [ -s "$out" ] || _empty_sarif
  exit 0
fi

# native: stage scoped files under their REPO-RELATIVE path so the URIs come back clean.
stage="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-gl.$$")"
mkdir -p "$stage"
n=0
if [ -s "$scope" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] || continue
    # normalize to repo-relative; strip a leading slash for any other absolute path
    rel="$f"
    case "$f" in
      "$ROOT"/*) rel="${f#"$ROOT"/}";;
      /*)        rel="${f#/}";;
    esac
    dest="$stage/$rel"; mkdir -p "$(dirname "$dest")"
    cp "$f" "$dest" 2>/dev/null && n=$((n+1))
  done < "$scope"
fi
if [ "$n" -eq 0 ]; then
  arc_log "gitleaks: empty scope, nothing to scan"
  rm -rf "$stage"; _empty_sarif; exit 0
fi

# exit-code 0 keeps the adapter degrade-safe: findings are reported via SARIF,
# not via gitleaks' own non-zero exit (that's the triage stub's decision).
"$bin" dir "$stage" \
  --report-format sarif --report-path "$out" \
  --no-banner --exit-code 0 >/dev/null 2>&1 || true

# Strip the staging prefix from every finding URI -> repo-relative path. gitleaks
# (a native binary) may report the stage dir in Windows form, so strip both the
# bash path and its cygpath/mixed form. jq `walk` catches every artifactLocation.
if [ -s "$out" ] && [ -n "$(arc_jq_bin)" ]; then
  stage_win=""
  command -v cygpath >/dev/null 2>&1 && stage_win="$(cygpath -m "$stage" 2>/dev/null || true)"
  jq --arg sb "$stage/" --arg sw "${stage_win:+$stage_win/}" '
    walk(
      if (type == "object") and has("uri") and ((.uri | type) == "string")
      then .uri |= ( ltrimstr("file://")
                     | (if $sw != "" then ltrimstr($sw) else . end)
                     | ltrimstr($sb) )
      else . end
    )
  ' "$out" > "$out.norm" 2>/dev/null && mv "$out.norm" "$out" || rm -f "$out.norm"
fi

rm -rf "$stage"
[ -s "$out" ] || _empty_sarif
arc_log "gitleaks: scanned $n staged file(s)"
exit 0

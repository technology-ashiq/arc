#!/usr/bin/env bash
# adapters/gitleaks.sh -- run gitleaks over a diff scope, emit native SARIF.
# Same adapter contract as semgrep.sh (see that file's header).
#
# gitleaks (v8) scans a path, not a file list, so scoped files are staged into a
# temp dir (relative paths preserved) and scanned there. Path fidelity relative
# to a staging dir is a known steel-thread simplification; Phase 2 revisits it.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
. "$HERE/../lib/common.sh"

scope="${1:?usage: gitleaks.sh <scope-file> <out-sarif>}"
out="${2:?usage: gitleaks.sh <scope-file> <out-sarif>}"

_empty_sarif() { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; }

bin="$(arc_gitleaks_bin)"
if [ -z "$bin" ]; then
  arc_skip "gitleaks (not installed -- scoop install gitleaks)"
  _empty_sarif; exit 0
fi

# Stage scoped files, preserving relative structure.
stage="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-gl.$$")"
mkdir -p "$stage"
n=0
if [ -s "$scope" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] || continue
    dest="$stage/$f"; mkdir -p "$(dirname "$dest")"
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

rm -rf "$stage"
[ -s "$out" ] || _empty_sarif
arc_log "gitleaks: scanned $n staged file(s)"
exit 0

#!/usr/bin/env bash
# adapters/trufflehog.sh -- verified-secrets scan over a diff scope, alongside
# gitleaks. Same adapter contract as semgrep.sh (see that file's header):
#   tool missing -> arc_skip + empty SARIF + exit 0; empty scope -> empty SARIF;
#   findings or not -> always exit 0.
#
# Two things make trufflehog different from the other adapters:
#   1. It emits JSON-lines, not SARIF -- so this adapter converts to the minimal
#      SARIF shape the normalize step expects.
#   2. VERIFIED mode: only secrets confirmed live against their provider are
#      reported (near-zero false positives; that's the point of running it next
#      to gitleaks). We also filter Verified==true in the conversion so a fake /
#      an older flag can't leak unverified noise. The message carries only the
#      detector name -- never the raw secret.
#
# Scoped files are staged under their repo-relative path (same technique as
# gitleaks) so finding URIs are clean (baseline/suppression fingerprint fidelity).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../../core/common.sh
. "$HERE/../../../core/common.sh"
. "$HERE/../lib/runtime.sh"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

scope="${1:?usage: trufflehog.sh <scope-file> <out-sarif>}"
out="${2:?usage: trufflehog.sh <scope-file> <out-sarif>}"

_empty_sarif() { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; }

# _th_to_sarif <raw-jsonl-file> -- convert trufflehog JSONL to minimal SARIF on
# stdout. Keeps only verified findings; message is the detector name (no secret).
_th_to_sarif() {
  local raw="$1"
  if [ ! -s "$raw" ] || [ -z "$(arc_jq_bin)" ]; then
    printf '{"version":"2.1.0","runs":[]}\n'; return 0
  fi
  jq -R 'fromjson? // empty' "$raw" | jq -s '{
    version: "2.1.0",
    runs: [ { tool: { driver: { name: "trufflehog" } },
      results: [ .[] | select(.Verified == true) | {
        ruleId:  ((.DetectorName // "secret") | tostring),
        level:   "error",
        message: { text: ("Verified secret: " + ((.DetectorName // "unknown") | tostring)) },
        locations: [ { physicalLocation: {
          artifactLocation: { uri: (((.SourceMetadata.Data.Filesystem.file) // "") | tostring) },
          region: { startLine: (((.SourceMetadata.Data.Filesystem.line) // 0) | tonumber? // 0) }
        } } ]
      } ]
    } ]
  }'
}

bin="$(arc_trufflehog_bin)"
rt="$(arc_runtime "$bin")"                 # native -> docker -> skip
if [ "$rt" = "skip" ]; then
  arc_skip "trufflehog (native missing + no docker image -- install trufflehog or set ARC_DOCKER_IMAGE)"
  _empty_sarif; exit 0
fi

raw="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-th-raw.$$")"

if [ "$rt" = "docker" ]; then
  # whole-repo verified-secrets scan via the image; JSONL to stdout -> convert.
  docker run --rm -v "${ROOT:-$PWD}:/src:ro" -w /src "$ARC_DOCKER_IMAGE" \
    trufflehog filesystem /src --only-verified --json --no-update > "$raw" 2>/dev/null || true
  _th_to_sarif "$raw" > "$out"
  rm -f "$raw"
  arc_log "trufflehog: scanned repo via docker ($ARC_DOCKER_IMAGE)"
  [ -s "$out" ] || _empty_sarif
  exit 0
fi

# native: stage scoped files under their REPO-RELATIVE path (like gitleaks).
stage="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-th.$$")"
mkdir -p "$stage"
n=0
if [ -s "$scope" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] || continue
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
  arc_log "trufflehog: empty scope, nothing to scan"
  rm -rf "$stage" "$raw"; _empty_sarif; exit 0
fi

# --no-update: no self-update ping. Findings via JSON, never a non-zero exit.
"$bin" filesystem "$stage" --only-verified --json --no-update > "$raw" 2>/dev/null || true
_th_to_sarif "$raw" > "$out"

# Strip the staging prefix from finding URIs -> repo-relative (same jq walk as
# gitleaks; trufflehog native may report the stage dir in mixed/Windows form).
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

rm -rf "$stage" "$raw"
[ -s "$out" ] || _empty_sarif
arc_log "trufflehog: scanned $n staged file(s) via $bin"
exit 0

#!/usr/bin/env bash
# adapters/zap.sh -- OWASP ZAP baseline DAST scan against a running app URL.
# Same adapter contract as semgrep.sh, with three gates in front:
#   1. Needs a target -- ARC_ZAP_TARGET (the preview/deploy URL); else SKIPPED.
#   2. CI-tier only (ADR-0006): ZAP is a minutes-heavy docker scan, past the
#      <30s hook budget. Runs when ARC_TIER=ci or a CI env is present.
#   3. A runner: ARC_ZAP_CMD (tests/override) or docker (pulls the ZAP image).
# ZAP emits JSON, not SARIF, so the adapter converts and maps risk -> level:
#   high(3)=error, medium(2)=warning, low(1)/info(0)=note -- so passive header
#   noise never floods the block path (only high-risk DAST findings block).
# Scans the whole target (not diff-scoped); findings merge via the normal pipeline.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../../core/common.sh
. "$HERE/../../../core/common.sh"
. "$HERE/../lib/runtime.sh"
ROOT="${ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

scope="${1:?usage: zap.sh <scope-file> <out-sarif>}"
out="${2:?usage: zap.sh <scope-file> <out-sarif>}"

_empty_sarif() { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; }
_ci_tier() { [ "${ARC_TIER:-}" = "ci" ] || [ -n "${CI:-}" ]; }

# --- gates -------------------------------------------------------------------
target="${ARC_ZAP_TARGET:-}"
if [ -z "$target" ]; then
  arc_skip "zap (no target url -- set ARC_ZAP_TARGET to the preview/deploy URL)"
  _empty_sarif; exit 0
fi
if ! _ci_tier; then
  arc_skip "zap (CI-tier only -- ADR-0006 heavy DAST; set ARC_TIER=ci)"
  _empty_sarif; exit 0
fi
if [ -z "${ARC_ZAP_CMD:-}" ] && ! command -v docker >/dev/null 2>&1; then
  arc_skip "zap (no docker and no ARC_ZAP_CMD -- cannot run the baseline scan)"
  _empty_sarif; exit 0
fi

# --- run ZAP baseline -> JSON on stdout --------------------------------------
# ARC_ZAP_CMD (tests/override) reads ARC_ZAP_TARGET and prints ZAP JSON. Default:
# the ZAP docker image writes report.json into a writable mount, which we cat.
_zap_json() {
  local url="$1"
  if [ -n "${ARC_ZAP_CMD:-}" ]; then
    ARC_ZAP_TARGET="$url" bash -c "$ARC_ZAP_CMD" 2>/dev/null; return 0
  fi
  local img="${ARC_ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
  local wrk; wrk="$(mktemp -d)"; chmod a+rwx "$wrk" 2>/dev/null || true
  # -m 1: cap the spider at 1 min; ZAP exits non-zero on findings (|| true).
  docker run --rm -v "${wrk}:/zap/wrk:rw" "$img" \
    zap-baseline.py -t "$url" -J report.json -m 1 >/dev/null 2>&1 || true
  cat "$wrk/report.json" 2>/dev/null
  rm -rf "$wrk"
}

json="$(_zap_json "$target")"
if [ -z "$json" ] || [ -z "$(arc_jq_bin)" ]; then
  arc_log "zap: no report produced for $target"
  _empty_sarif; exit 0
fi

printf '%s' "$json" | jq '{
  version: "2.1.0",
  runs: [ { tool: { driver: { name: "zap" } }, results: [
    (.site // [])[] as $s
    | ($s.alerts // [])[] as $a
    | ($a.instances // [{}])[] as $i
    | {
        ruleId:  (($a.pluginid // "zap") | tostring),
        level:   (( ($a.riskcode // "0") | tonumber ) as $r
                  | if $r >= 3 then "error" elif $r == 2 then "warning" else "note" end),
        message: { text: (($a.alert // "ZAP alert") | tostring) },
        locations: [ { physicalLocation: {
          artifactLocation: { uri: (($i.uri // "") | tostring) },
          region: { startLine: 0 }
        } } ]
      }
  ] } ]
}' > "$out" 2>/dev/null || _empty_sarif

[ -s "$out" ] || _empty_sarif
arc_log "zap: scanned $target ($(jq '[.runs[].results[]?] | length' "$out" 2>/dev/null || echo 0) finding(s))"
exit 0

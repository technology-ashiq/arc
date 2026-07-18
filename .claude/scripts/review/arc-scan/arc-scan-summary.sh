#!/usr/bin/env bash
# arc-scan-summary.sh -- concise digest of the last arc-scan run, for the
# security-auditor's Pass 0: consume the committed tool-tier evidence instead of
# re-running semgrep/gitleaks/trivy/trufflehog/codeql ad hoc. One owner per job
# -- arc-scan owns the tools; the auditor owns the threat model.
#
#   usage: arc-scan-summary.sh [merged-sarif] [verdict-json]
#   defaults to the committed .claude/state/scan/ artifacts.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../core/common.sh
. "$HERE/../../core/common.sh"
ROOT="${ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

sarif="${1:-$ROOT/.claude/state/scan/scan-result.sarif}"
verdict="${2:-$ROOT/.claude/state/scan/verdict.json}"

if [ ! -f "$sarif" ]; then
  echo "no arc-scan results at $sarif -- run: bash .claude/scripts/review/arc-scan/arc-scan.sh --all"
  exit 0
fi
if [ -z "$(arc_jq_bin)" ]; then
  echo "no arc-scan results parsable (jq missing)"; exit 0
fi

echo "=== arc-scan Pass 0 evidence (tool tier -- do NOT re-run these) ==="
if [ -f "$verdict" ]; then
  jq -r '"verdict: \(.verdict // "?") | findings: \(.findings // 0) | new_errors: \(.new_errors // 0) | tools_ran: \((.tools_ran // []) | join(","))"' "$verdict" 2>/dev/null || true
fi

n="$(jq '[.runs[].results[]?] | length' "$sarif" 2>/dev/null || echo 0)"
if [ "${n:-0}" -eq 0 ]; then
  echo "0 findings from the tool tier -- focus your manual pass entirely on logic/threat-model gaps."
  exit 0
fi

echo "by tool: $(jq -r '[.runs[].results[]? | .properties.tool // "?"] | group_by(.) | map("\(.[0])=\(length)") | join("  ")' "$sarif" 2>/dev/null)"
jq -r '.runs[].results[]?
  | "- \(.properties.tool // "?")  \(.level)  \(.ruleId)  \((.locations[0].physicalLocation.artifactLocation.uri) // "?"):\((.locations[0].physicalLocation.region.startLine) // 0)"' \
  "$sarif" 2>/dev/null
echo "--- These are covered by the tool tier. Your job is what they can't see: business logic, access control, trust-boundary threats. ---"
exit 0

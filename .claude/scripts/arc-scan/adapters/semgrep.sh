#!/usr/bin/env bash
# adapters/semgrep.sh -- run semgrep/opengrep over a diff scope, emit native SARIF.
#
# Adapter contract (v1, extracted after building semgrep + gitleaks):
#   usage: semgrep.sh <scope-file> <out-sarif>
#     scope-file : newline-separated list of files to scan (may be empty)
#     out-sarif  : path to write the tool's native SARIF
#   guarantees:
#     * tool missing        -> arc_skip, write empty SARIF ({runs:[]}), exit 0
#     * empty scope         -> write empty SARIF, exit 0
#     * findings or not      -> always exit 0 (verdict is the triage stub's job)
#   never: exit non-zero on a normal scan, or crash the hook on a missing tool.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../core/common.sh
. "$HERE/../../core/common.sh"
. "$HERE/../lib/runtime.sh"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

scope="${1:?usage: semgrep.sh <scope-file> <out-sarif>}"
out="${2:?usage: semgrep.sh <scope-file> <out-sarif>}"
# Canonical path (no ../) so semgrep derives stable rule ids across call sites.
rules="$(cd "$HERE/../rules" && pwd)/arc-min.yaml"

_empty_sarif() { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; }

bin="$(arc_semgrep_bin)"
rt="$(arc_runtime "$bin")"                 # native -> docker -> skip
if [ "$rt" = "skip" ]; then
  arc_skip "semgrep (native missing + no docker image -- install opengrep/semgrep or set ARC_DOCKER_IMAGE)"
  _empty_sarif; exit 0
fi

# Collect existing, non-empty scope targets.
targets=()
if [ -s "$scope" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] && targets+=("$f")
  done < "$scope"
fi
if [ "${#targets[@]}" -eq 0 ]; then
  arc_log "semgrep: empty scope, nothing to scan"
  _empty_sarif; exit 0
fi

# Offline, deterministic run: local rules only, no registry/telemetry/version pings.
if [ "$rt" = "docker" ]; then
  # semgrep in the arc-tools image emits SARIF to stdout (real image: Phase 03)
  arc_docker_scan "$out" semgrep scan --config "$rules" --sarif --disable-version-check --quiet "${targets[@]}"
  arc_log "semgrep: scanned ${#targets[@]} file(s) via docker ($ARC_DOCKER_IMAGE)"
else
  # native. opengrep and semgrep differ on the SARIF flag and metrics handling.
  case "$(basename "$bin")" in
    opengrep*)
      "$bin" scan --config "$rules" \
        --sarif-output="$out" --disable-version-check --quiet \
        "${targets[@]}" >/dev/null 2>&1 || true;;
    *) # semgrep proper
      "$bin" scan --config "$rules" \
        --sarif --output="$out" \
        --metrics=off --disable-version-check --quiet \
        "${targets[@]}" >/dev/null 2>&1 || true;;
  esac
  arc_log "semgrep: scanned ${#targets[@]} file(s) via $bin"
fi

# Adapter must always leave a valid SARIF behind for the merge step.
[ -s "$out" ] || _empty_sarif
exit 0

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
# shellcheck source=../../../core/common.sh
. "$HERE/../../../core/common.sh"
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
  #
  # THE STATUS AND STDERR ARE CAPTURED, NOT DISCARDED. This ran as `... >/dev/null 2>&1 || true`
  # for its whole life, which makes a scanner that DIED indistinguishable from one that ran and
  # found nothing: stdout gone, stderr gone, exit status thrown away, and the empty-SARIF
  # backstop at the end of this file then hands the pipeline a clean verdict.
  #
  # That is not hypothetical. opengrep v1.27.0 (published 2026-08-12T14:55:32Z, pulled UNPINNED
  # from releases/latest) is broken on the windows runner: the identical repo SHA 6792091c ran
  # arc-ci green at 14:02 and red at 17:24 with nothing changed but the binary, and ubuntu and
  # macOS stayed green throughout. Three tests that plant a finding started reporting
  # "0 finding(s)" -- and for two days nobody could see WHY, because these two lines ate the
  # reason. The tool exits 2, semgrep's fatal-error code, and said so the whole time.
  #
  # A non-zero status is REPORTED and the scan is marked degraded. The adapter still exits 0,
  # because its contract forbids failing the hook on a tool problem (lines 8-12) -- but
  # "degraded" and "clean" must never print the same line again.
  errf="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-semgrep-err.$$")"
  case "$(basename "$bin")" in
    opengrep*)
      "$bin" scan --config "$rules" \
        --sarif-output="$out" --disable-version-check --quiet \
        "${targets[@]}" >/dev/null 2>"$errf"
      rc=$?;;
    *) # semgrep proper
      "$bin" scan --config "$rules" \
        --sarif --output="$out" \
        --metrics=off --disable-version-check --quiet \
        "${targets[@]}" >/dev/null 2>"$errf"
      rc=$?;;
  esac
  if [ "$rc" -ne 0 ]; then
    # No --error is passed, so findings do NOT raise the exit status: any non-zero here is the
    # tool failing, and 2 is specifically fatal.
    arc_skip "semgrep (the scanner exited $rc -- it did not complete, so this is NOT a clean scan)"
    arc_log "semgrep: $bin exited $rc; first line of its stderr: $(head -n 1 "$errf" 2>/dev/null)"
  else
    arc_log "semgrep: scanned ${#targets[@]} file(s) via $bin"
  fi
  rm -f "$errf" 2>/dev/null || true
fi

# Adapter must always leave a valid SARIF behind for the merge step.
[ -s "$out" ] || _empty_sarif
exit 0

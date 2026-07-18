#!/usr/bin/env bash
# adapters/trivy.sh -- run Trivy (SCA: dependency/lockfile vulnerabilities) over
# the in-scope dependency manifests, emit native SARIF.
# Same adapter contract as semgrep.sh (see that file's header):
#   tool missing  -> arc_skip, empty SARIF ({runs:[]}), exit 0
#   empty/irrelevant scope -> empty SARIF, exit 0
#   findings or not -> always exit 0 (verdict is triage's job)
#
# SCA is manifest-driven, not source-file-driven, so only dependency manifests /
# lockfiles in scope are scanned. This keeps the NATIVE (hook-tier) rung cheap
# and diff-scoped: a scan runs only when dependencies actually change, and the
# manifests are staged under their repo-relative path so finding URIs stay clean
# (baseline/suppression fingerprints key on the path -- Phase 02). The DOCKER
# rung (CI-tier, pinned arc-tools image) scans the whole /src -- full-repo SCA
# with baseline separating new vs pre-existing, mirroring the gitleaks docker
# rung. Vulnerabilities are reported via SARIF, never via trivy's exit code.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../../core/common.sh
. "$HERE/../../../core/common.sh"
. "$HERE/../lib/runtime.sh"
# Respect an inherited ROOT (lets CI/tests point the docker rung at a specific
# tree); default to the repo toplevel for normal in-repo scans.
ROOT="${ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

scope="${1:?usage: trivy.sh <scope-file> <out-sarif>}"
out="${2:?usage: trivy.sh <scope-file> <out-sarif>}"

_empty_sarif() { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; }

# A file is an SCA target when its basename is a known dependency manifest /
# lockfile. Kept explicit (v1: npm, pip, go, ruby, rust, php, java, dotnet);
# unknown ecosystems are a documented boundary, not a silent gap.
_arc_is_manifest() {
  case "$(basename "$1")" in
    package-lock.json|npm-shrinkwrap.json|yarn.lock|pnpm-lock.yaml) return 0;;
    requirements*.txt|Pipfile.lock|poetry.lock|pdm.lock|uv.lock)     return 0;;
    go.mod|go.sum)                                                   return 0;;
    Gemfile.lock)                                                    return 0;;
    Cargo.lock)                                                      return 0;;
    composer.lock)                                                   return 0;;
    pom.xml|gradle.lockfile|packages.lock.json)                      return 0;;
    *) return 1;;
  esac
}

bin="$(arc_trivy_bin)"
rt="$(arc_runtime "$bin")"                 # native -> docker -> skip
if [ "$rt" = "skip" ]; then
  arc_skip "trivy (native missing + no docker image -- scoop install trivy or set ARC_DOCKER_IMAGE)"
  _empty_sarif; exit 0
fi

if [ "$rt" = "docker" ]; then
  # CI-tier: whole-repo SCA from the pinned arc-tools image; SARIF to stdout.
  # --skip-db-update uses the DB baked into the image (never the network) so the
  # image, not the run, fixes the DB version -> reproducible verdicts (ADR-0006).
  arc_docker_scan "$out" trivy fs --scanners vuln --skip-db-update \
    --format sarif --no-progress --quiet /src
  arc_log "trivy: scanned repo via docker ($ARC_DOCKER_IMAGE)"
  [ -s "$out" ] || _empty_sarif
  exit 0
fi

# native: stage in-scope dependency manifests under their REPO-RELATIVE path so
# trivy reports clean URIs (same fidelity technique as gitleaks).
stage="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-trivy.$$")"
mkdir -p "$stage"
n=0
if [ -s "$scope" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] || continue
    _arc_is_manifest "$f" || continue
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
  arc_log "trivy: no dependency manifest in scope, nothing to scan"
  rm -rf "$stage"; _empty_sarif; exit 0
fi

# --format sarif prints to stdout; exit 0 always (findings via SARIF, not code).
"$bin" fs --scanners vuln --format sarif --no-progress --quiet "$stage" > "$out" 2>/dev/null || true

# Strip the staging prefix from finding URIs -> repo-relative (same jq walk as
# gitleaks; trivy native may report the stage dir in mixed/Windows form).
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
arc_log "trivy: scanned $n staged manifest(s) via $bin"
exit 0

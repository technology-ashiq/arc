#!/usr/bin/env bash
# arc-tools-image.sh -- build / pin / run the CI-tier arc-tools docker image
# (ADR-0006 amendment). The hook tier never touches this; only CI-tier heavy
# verifiers (Trivy now; CodeQL/ZAP later) run from the pinned image so verdicts
# are reproducible. bash-3.2 / POSIX-friendly (macOS CI leg, ADR-0007).
#
# Subcommands:
#   ref               print the resolved image reference (override chain below)
#   build [tag]       docker build the image (tag defaults to `ref`)
#   verify [ref]      assert trivy runs inside the image (prints its version)
#   scan  <out> [ref] run the CI-tier trivy scan via the image -> SARIF at <out>
#   digest [ref]      print the image's pinnable digest (RepoDigest, else Id)
#
# Image ref resolution (first hit wins):
#   1. $ARC_TOOLS_IMAGE
#   2. first non-comment line of docker/arc-tools/IMAGE  (the committed pin)
#   3. arc-tools:dev
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null)"
[ -n "$ROOT" ] || ROOT="$(cd "$HERE/../.." && pwd)"
DOCKERDIR="$ROOT/docker/arc-tools"
PINFILE="$DOCKERDIR/IMAGE"
ADAPTER="$ROOT/.claude/scripts/review/arc-scan/adapters/trivy.sh"
DEFAULT_REF="arc-tools:dev"

log()  { printf 'arc-tools-image: %s\n' "$*" >&2; }
die()  { printf 'arc-tools-image: ERROR: %s\n' "$*" >&2; exit 1; }
need_docker() { command -v docker >/dev/null 2>&1 || die "docker not found (CI-tier only; the hook tier never needs it)"; }

resolve_ref() {
  if [ -n "${ARC_TOOLS_IMAGE:-}" ]; then printf '%s\n' "$ARC_TOOLS_IMAGE"; return 0; fi
  if [ -f "$PINFILE" ]; then
    # first non-empty, non-comment line
    local pin; pin="$(grep -vE '^\s*(#|$)' "$PINFILE" 2>/dev/null | head -1 | tr -d '[:space:]')"
    [ -n "$pin" ] && { printf '%s\n' "$pin"; return 0; }
  fi
  printf '%s\n' "$DEFAULT_REF"
}

cmd="${1:-}"; [ $# -gt 0 ] && shift || true
case "$cmd" in
  ref)
    resolve_ref;;

  build)
    need_docker
    tag="${1:-$(resolve_ref)}"
    log "building $tag from $DOCKERDIR/Dockerfile"
    docker build -t "$tag" -f "$DOCKERDIR/Dockerfile" "$DOCKERDIR" || die "docker build failed"
    log "built $tag"
    ;;

  verify)
    need_docker
    ref="${1:-$(resolve_ref)}"
    log "verifying trivy inside $ref"
    docker run --rm "$ref" trivy --version || die "trivy not runnable in $ref"
    ;;

  scan)
    need_docker
    out="${1:?usage: arc-tools-image.sh scan <out-sarif> [ref]}"
    ref="${2:-$(resolve_ref)}"
    log "CI-tier trivy scan of the repo via $ref -> $out"
    # docker rung ignores scope (scans the mounted /src); pass a throwaway path.
    ARC_DOCKER_IMAGE="$ref" ARC_FORCE_RUNTIME=docker ROOT="$ROOT" \
      bash "$ADAPTER" /dev/null "$out"
    ;;

  digest)
    need_docker
    ref="${1:-$(resolve_ref)}"
    d="$(docker inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$ref" 2>/dev/null)"
    [ -n "$d" ] || d="$(docker inspect --format '{{.Id}}' "$ref" 2>/dev/null)"
    [ -n "$d" ] || die "image not found locally: $ref (build it first)"
    printf '%s\n' "$d"
    ;;

  ""|-h|--help)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'; [ -z "$cmd" ] && exit 1 || exit 0;;

  *) die "unknown subcommand: $cmd (try: ref build verify scan digest)";;
esac

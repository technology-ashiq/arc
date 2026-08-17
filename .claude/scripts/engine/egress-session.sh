#!/usr/bin/env bash
# egress-session.sh -- bring the confined egress path up and down around a real dispatch.
#
# WHY THIS IS A SEPARATE SCRIPT AND NOT PART OF THE DRIVER. drivers/hermes.mjs deliberately does not
# create Docker networks: a driver that did would be arc taking on infrastructure it has no way to
# clean up after a SIGKILL, and the ADR-0222 workspace leak proved exactly how that ends. So egress
# stays OPT-IN at the driver and ORCHESTRATED here, by a human, around a session of dispatches.
#
# WHAT IT BUILDS (the topology measured on 2026-08-16 and written up in
# initiatives/engine/evidence/phase-06/fixtures-1-4-6-7-confinement.md):
#
#   arc-egress            an --internal docker network. No gateway, so a container on it alone
#                         reaches NOTHING -- not even the model endpoint.
#   arc-eproxy            egress-proxy.py, in the SAME pinned runtime image, attached to BOTH
#                         arc-egress and the default bridge. Dual-homed, so it is the single route
#                         out, and its allowlist is the whole policy.
#
# Both `--network none` and a bare `--internal` bridge were measured first and neither works alone:
# they block everything including the model. The proxy is what makes an honest restriction possible
# with stock Docker -- no netns, no seccomp, no VM.
#
# THE TRAIL IS CAPTURED HERE, and that is a fixed defect. egress-proxy.py logs every ALLOW and DENY
# to its own stderr, in its own container, and a comment used to claim arc-run scrubbed it. arc-run
# scrubs the DRIVER's transcript and never sees a byte of the proxy's. `logs` writes it into the
# lane's evidence path so a dispatch's egress decisions are retained rather than discarded.
#
# Usage:
#   bash .claude/scripts/engine/egress-session.sh up      [--allowlist FILE] [--image IMG]
#   bash .claude/scripts/engine/egress-session.sh logs    [--out FILE]
#   bash .claude/scripts/engine/egress-session.sh status
#   bash .claude/scripts/engine/egress-session.sh down
#
# `up` prints the exports a dispatch needs. It never sets them in your shell -- a script that
# silently mutates the caller's environment is how a dispatch ends up confined by accident and
# unconfined by accident equally often.

set -u
HERE="$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd)" || exit 1
REPO="$(CDPATH= cd -P -- "$HERE/../../.." && pwd)" || exit 1

NETWORK="${ARC_HERMES_NETWORK_NAME:-arc-egress}"
PROXY_NAME="${ARC_HERMES_PROXY_NAME:-arc-eproxy}"
PROXY_PORT="${ARC_HERMES_PROXY_PORT:-3128}"
ALLOWLIST="$REPO/engine/egress-allowlist.txt"
IMAGE="${ARC_HERMES_IMAGE:-}"
DOCKER="${ARC_HERMES_DOCKER_BIN:-docker}"
EVIDENCE="$REPO/initiatives/engine/evidence/phase-06"

die() { printf 'egress-session: %s\n' "$1" >&2; exit "${2:-1}"; }

verb="${1:-}"; shift || true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --allowlist) ALLOWLIST="${2:-}"; shift 2 ;;
    --image)     IMAGE="${2:-}"; shift 2 ;;
    --out)       OUT="${2:-}"; shift 2 ;;
    *) die "unknown flag $1" 2 ;;
  esac
done

# THE ALLOWLIST IS PARSED HERE THE SAME WAY THE PROXY PARSES IT, and a bad entry stops the session
# rather than starting a proxy that will refuse everything. The proxy refuses an empty allowlist by
# design; catching it here names the FILE, which the proxy cannot.
read_allowlist() {
  [ -f "$ALLOWLIST" ] || die "no allowlist at $ALLOWLIST -- the policy file is not optional"
  ENTRIES=""
  local count=0
  while IFS= read -r raw || [ -n "$raw" ]; do
    line="${raw%%#*}"
    line="$(printf '%s' "$line" | tr -d '[:space:]')"
    [ -n "$line" ] || continue
    ENTRIES="$ENTRIES --allow $line"
    count=$((count + 1))
  done < "$ALLOWLIST"
  [ "$count" -gt 0 ] || die "the allowlist at $ALLOWLIST has no entries -- that is a policy nobody wrote"
  printf 'egress-session: allowlist %s carries %s entr(y|ies)\n' "$ALLOWLIST" "$count" >&2
}

case "$verb" in
  up)
    [ -n "$IMAGE" ] || die "ARC_HERMES_IMAGE is not set (or pass --image) -- the proxy runs in the SAME pinned image, so there is no second artifact to vet"
    case "$IMAGE" in
      *@sha256:*) : ;;
      *) die "the image must be pinned by digest, got $IMAGE" ;;
    esac
    read_allowlist

    "$DOCKER" network inspect "$NETWORK" >/dev/null 2>&1 || {
      "$DOCKER" network create --internal "$NETWORK" >/dev/null || die "could not create the internal network $NETWORK"
      printf 'egress-session: created internal network %s\n' "$NETWORK" >&2
    }

    # Idempotent: a leftover proxy from an interrupted session is replaced rather than duplicated.
    "$DOCKER" rm -f "$PROXY_NAME" >/dev/null 2>&1 || true

    # GIT BASH REWRITES CONTAINER-SIDE PATHS, and it did it to this script on the first real run:
    # `/opt/egress-proxy.py` reached docker as `C:/Program Files/Git/opt/egress-proxy.py` and the
    # proxy died instantly with ENOENT. MSYS argument conversion applies to anything shaped like an
    # absolute POSIX path, including the container half of a -v spec. Disabled for the docker calls
    # only, and set inline rather than exported so nothing else in the session inherits it.
    #
    # Attached to the INTERNAL network at start, then also to the default bridge. That order matters:
    # starting on the bridge first would leave a window in which the proxy is reachable from the
    # internal side before its allowlist is loaded.
    #
    # The proxy script is MOUNTED IN rather than expected in the image: the runtime image carries
    # Python but not arc's file, and the whole point of reusing the image is that there is no second
    # artifact to pin and vet.
    # shellcheck disable=SC2086 -- ENTRIES is a deliberately word-split flag list
    MSYS2_ARG_CONV_EXCL='*' MSYS_NO_PATHCONV=1 "$DOCKER" run -d --name "$PROXY_NAME" --network "$NETWORK" \
      --restart no \
      -v "$HERE/egress-proxy.py:/opt/egress-proxy.py:ro" \
      --entrypoint python3 \
      "$IMAGE" -B /opt/egress-proxy.py --port "$PROXY_PORT" $ENTRIES >/dev/null \
      || die "could not create $PROXY_NAME"

    MSYS2_ARG_CONV_EXCL='*' "$DOCKER" network connect bridge "$PROXY_NAME" >/dev/null 2>&1 \
      || die "could not dual-home $PROXY_NAME onto the bridge -- it would have no route out, so every dispatch would lose egress while looking confined"

    # `docker run -d` EXITS 0 WHEN THE CONTAINER IS CREATED, not when the process inside it is
    # alive -- and on the first real run of this script it exited 0 while the proxy was already dead.
    # That is this repo's own rule arriving in new code: exit 0 from a fire-and-forget start is not
    # evidence anything is running. The proxy is asked, and its own startup line is the answer.
    ready=0
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      state="$("$DOCKER" inspect -f '{{.State.Status}}' "$PROXY_NAME" 2>/dev/null)"
      if [ "$state" = "running" ] && "$DOCKER" logs "$PROXY_NAME" 2>&1 | grep -q "listening on"; then
        ready=1; break
      fi
      [ "$state" = "exited" ] && break
      sleep 1
    done
    if [ "$ready" -ne 1 ]; then
      printf 'egress-session: the proxy did not come up. Its log:\n' >&2
      "$DOCKER" logs "$PROXY_NAME" 2>&1 | tail -20 >&2
      die "refusing to report a confined session while the proxy is not listening"
    fi

    printf 'egress-session: %s is up on %s and bridge, and ANSWERED\n' "$PROXY_NAME" "$NETWORK" >&2
    "$DOCKER" logs "$PROXY_NAME" 2>&1 | sed 's/^/egress-session:   /' >&2
    printf 'export ARC_HERMES_NETWORK=%s\n' "$NETWORK"
    printf 'export ARC_HERMES_PROXY=http://%s:%s\n' "$PROXY_NAME" "$PROXY_PORT"
    printf 'export ARC_HERMES_EGRESS=%s\n' "$ALLOWLIST"
    ;;

  logs)
    out="${OUT:-$EVIDENCE/egress-trail-$("$DOCKER" inspect -f '{{.Id}}' "$PROXY_NAME" 2>/dev/null | cut -c1-12).log}"
    mkdir -p "$(dirname "$out")" || die "could not create the evidence directory"
    "$DOCKER" logs "$PROXY_NAME" > "$out" 2>&1 || die "could not read the proxy log -- is the session up?"
    # A trail nobody can read afterwards is not an audit, and an EMPTY trail is a finding rather
    # than a clean result: it means no dispatch went through the proxy at all.
    if [ -s "$out" ]; then
      printf 'egress-session: wrote %s lines to %s\n' "$(wc -l < "$out" | tr -d ' ')" "$out" >&2
    else
      printf 'egress-session: WARNING the proxy log is EMPTY -- no dispatch reached it, so this is not evidence of confinement\n' >&2
    fi
    ;;

  status)
    "$DOCKER" network inspect "$NETWORK" >/dev/null 2>&1 && printf 'network %s: UP\n' "$NETWORK" || printf 'network %s: absent\n' "$NETWORK"
    state="$("$DOCKER" inspect -f '{{.State.Status}}' "$PROXY_NAME" 2>/dev/null)" || state="absent"
    printf 'proxy   %s: %s\n' "$PROXY_NAME" "$state"
    ;;

  down)
    "$DOCKER" rm -f "$PROXY_NAME" >/dev/null 2>&1 && printf 'egress-session: removed %s\n' "$PROXY_NAME" >&2
    "$DOCKER" network rm "$NETWORK" >/dev/null 2>&1 && printf 'egress-session: removed network %s\n' "$NETWORK" >&2
    # Neither removal is fatal: `down` after a partial `up` must leave the machine clean, not error.
    exit 0
    ;;

  *)
    die "usage: egress-session.sh up|logs|status|down" 2
    ;;
esac

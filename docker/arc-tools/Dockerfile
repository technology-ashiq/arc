# arc-tools -- the single, version-pinned image the CI tier runs its heavy
# verifiers from (ADR-0006 amendment). A verdict is only evidence if it is
# reproducible, so EVERYTHING that affects findings is pinned: the base image,
# the tool versions, and the vulnerability DB (baked at build time, then used
# read-only with --skip-db-update so the same input yields the same findings /
# fingerprints across runs and machines -- ties to the baseline in ADR-0002).
#
# Tools land here as their phase-03 slices arrive:
#   * Trivy  (SCA: dependency/lockfile vulns)      -- this slice
#   * CodeQL (deep SAST, optional tier, ADR-0004)  -- later slice
#   * ZAP    (DAST baseline, linux-only)           -- later slice
# The hook tier NEVER pulls this image (native only, <30s budget) -- ADR-0006.
#
# Build / pin:  .claude/scripts/arc-tools-image.sh build   (then `... digest`)
# Base pinned to an explicit Debian point release; the FINAL image is digest-
# pinned in CI (docker/arc-tools/IMAGE) so the scan step is byte-reproducible.
FROM debian:bookworm-slim

# --- pinned tool versions (bump = rebuild = re-pin the image digest) ----------
ARG TRIVY_VERSION=0.72.0

# Minimal runtime deps: ca-certificates for TLS, curl+tar to fetch trivy.
# git is handy for future rungs that inspect the mounted repo. No recommends.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl tar git; \
    rm -rf /var/lib/apt/lists/*

# --- Trivy (pinned release binary, checksum-guarded by the release tarball) ---
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) tarch=Linux-64bit ;; \
      arm64) tarch=Linux-ARM64 ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/trivy.tar.gz \
      "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_${tarch}.tar.gz"; \
    tar -xzf /tmp/trivy.tar.gz -C /usr/local/bin trivy; \
    rm -f /tmp/trivy.tar.gz; \
    trivy --version

# --- bake the vulnerability DB so runtime scans are offline + reproducible ----
# TRIVY_CACHE_DIR is read at runtime with --skip-db-update (see trivy adapter):
# the image, not the network, decides the DB version -> stable verdicts.
ENV TRIVY_CACHE_DIR=/opt/trivy-cache
RUN set -eux; \
    mkdir -p "$TRIVY_CACHE_DIR"; \
    trivy image --cache-dir "$TRIVY_CACHE_DIR" --download-db-only; \
    chmod -R a+rX "$TRIVY_CACHE_DIR"

# --- non-root; /src is where arc_docker_scan mounts the repo read-only --------
RUN useradd --create-home --uid 10001 arc
WORKDIR /src
USER arc

LABEL org.opencontainers.image.title="arc-tools" \
      org.opencontainers.image.description="Pinned CI-tier security verifiers for arc (ADR-0006)" \
      org.opencontainers.image.source="https://github.com/technology-ashiq/arc"

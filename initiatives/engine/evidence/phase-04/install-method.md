# Phase 04 — how the runtime was obtained, and what was verified

## The pin

```
docker pull nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e
```

Registry **Docker Hub** (`docker.io`), repository `nousresearch/hermes-agent`, corresponding to git
tag `v2026.8.3` (published 2026-08-03 16:57 UTC; image pushed 17:10 UTC the same day).

**Not** the host installer. Tag `v2026.8.3` carries `"assets": []` — nothing attached — and the npm
and PyPI channels were retired in that same release. `install.ps1` is not a tracked file at the tag;
it is served live from the docs site and defaults to *latest*. A `curl`-piped host install would
have been both unpinnable and the riskiest available shape for this runtime. The image digest is the
only content-addressable handle the vendor offers.

**`:latest` is NOT the same image.** At the time of checking it pointed at
`sha256:71b72002…02f37`, repushed on 2026-08-12 — a different, newer build. Pinning `:latest` would
not reproduce this release.

## Verified, not taken on trust

- The digest was resolved from the registry **before** pulling, two independent ways (Docker Hub v2
  API and the OCI Distribution manifest endpoint), which agreed.
- After pulling, `docker image inspect` reports `RepoDigests` **exactly equal** to the pinned digest.
- Per-architecture digests: amd64 `sha256:c0cab4e3…cb39e`, arm64 `sha256:153a021a…f2cd`.

## Image config as measured, where it differs from the docs

| | docs say | image config says |
|---|---|---|
| user | runs as non-root `hermes` UID 10000 | `User=root` |
| ports | 8642 gateway, 9119 dashboard | `ExposedPorts=null` |

Both differences are real and both are explained rather than waved away. The container **starts** as
root because s6-overlay needs PID 1, and drops privilege in code — confirmed by reading the
extracted wrapper, not by trusting the doc:

```sh
drop() { [ "$(id -u)" = 0 ] && set -- s6-setuidgid hermes "$@"; exec "$@"; }
```

The documented ports are simply not declared in the image; they are opened by configuration.

Base `debian:13.4`, entrypoint `/opt/hermes/docker/entrypoint-dispatch.sh`, `VOLUME /opt/data`,
size ~969 MB, amd64/linux.

## Content scan, and its honest limit

18 files were extracted from `/opt/hermes/docker` **without ever starting the container** (`docker
create`, then `docker cp`, then `docker rm`). Scanned:

- pipe-to-shell (`curl`/`wget` into an interpreter) — **none**
- base64 feeding `eval`/`exec` — **none**
- outbound network calls of any kind — **none**
- privilege drop — present in code, quoted above

`/var/run/docker.sock` is referenced in `stage2-hook.sh`, and the handling is guarded by
`[ -S "$sock" ] || continue`. **The socket is not mounted, so that entire docker-outside-of-docker
path is inert.** Mounting it would hand the agent the host Docker daemon, which is a full host
escape; not mounting it is deliberate.

**The limit, stated plainly:** this covered the runtime's own boot and exec scripts, **not** the
whole 969 MB image. The gate would have scanned the whole fetched tree. It did not run — see
issue #167 — so this scan is narrower than the gate's, and that is why the admission is recorded as
out-of-band rather than gate-blessed.

## Provenance

- **publisher-auth:** Docker Hub namespace `nousresearch`; the vendor CI workflow pushes to that
  exact namespace gated on `github.repository == NousResearch/hermes-agent`, from a protected
  `container-publish` environment with isolated secrets.
- **build-attestation:** a **real SLSA Provenance v1 in-toto attestation** is present in the image
  index — decoded directly, predicate type `https://slsa.dev/provenance/v1`.
- **No cosign signature. No SBOM attestation found.** Recorded as absent rather than omitted.

## A fabrication caught on the way

The first search returned a plausible `ghcr.io/nousresearch/hermes-agent` with invented run flags.
Three independent checks — GHCR package page 404, org package list empty, anonymous pull-token 401 —
confirm **no GHCR image exists for this project**. Had it gone into an allowlist, the entry would
have named a repository nobody owns, which anyone could later claim. Unofficial lookalikes that do
exist and are **not** the vendor: `ghcr.io/h-teske/hermes-agent-docker`,
`ghcr.io/jetbrains/hermes-agent` (unrelated name collision), `decentralize/hermes-agent`.

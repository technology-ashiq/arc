# arc-tools image

The single, **version-pinned** docker image the arc **CI tier** runs its heavy
security verifiers from (ADR-0006 amendment). One image, fixed tool versions, a
**baked vulnerability DB** — so the same input yields the same findings and
fingerprints on every run and machine. That reproducibility is what makes a gate
verdict *evidence* (ties to the baseline, ADR-0002).

The **hook tier never uses this image**: its <30s budget can't absorb container
start-up, and a pre-commit hook must not depend on a running Docker daemon. Hook
tools are installed natively (`/arc-toolcheck --fix`).

## What's inside

| Tool | Role | Arrived |
|------|------|---------|
| Trivy | SCA — dependency / lockfile vulnerabilities | Phase 03 · slice 1–2 |
| CodeQL | deep SAST (optional tier, ADR-0004) | later slice |
| ZAP | DAST baseline (linux-only) | later slice |

Tool versions are pinned as `ARG`s in the `Dockerfile`. Bumping a version means
rebuilding and **re-pinning the image digest** (below).

## Build / verify / scan

All via `.claude/scripts/arc-tools-image.sh` (docker required — CI tier only):

```bash
arc-tools-image.sh ref              # resolved image ref (override: $ARC_TOOLS_IMAGE)
arc-tools-image.sh build            # docker build -> the resolved ref
arc-tools-image.sh verify           # assert trivy runs inside the image
arc-tools-image.sh scan out.sarif   # CI-tier trivy scan of the repo -> SARIF
arc-tools-image.sh digest           # the pinnable digest (RepoDigest, else Id)
```

The scan path is the trivy adapter's **docker rung** (`arc_docker_scan`): the
repo is mounted read-only at `/src`, trivy runs with `--skip-db-update` against
the baked DB, and SARIF flows back through the normal normalize → merge → triage
pipeline — identical verdict logic to the native rung.

## Digest pinning (reproducibility)

`docker/arc-tools/IMAGE` holds the pinned reference. Locally it defaults to the
`arc-tools:dev` tag. In CI the image is built (and, once a registry is wired,
pushed to GHCR) and its `@sha256:` digest is recorded here, so the CI-tier scan
step pulls a byte-identical image every time. Update it with:

```bash
arc-tools-image.sh build && arc-tools-image.sh digest > docker/arc-tools/IMAGE.new
```

then commit the new pin.

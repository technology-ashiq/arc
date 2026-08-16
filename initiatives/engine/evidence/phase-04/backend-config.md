# Phase 04 — the execution backend, and what "container-backed" actually resolved to

## The `local` backend is not in use — but the reasoning changed, and that is worth recording

ADR-0208 says the runtime runs "ONLY through a container-backed execution backend — never the bare
`local` backend". Reading the vendor docs against the image revealed that sentence conflates two
genuinely different things, and following it literally would have been **worse** than not:

> *"There are two distinct ways Docker intersects with Hermes Agent: 1. Running Hermes IN Docker —
> the agent itself runs inside a container. 2. Docker as a terminal backend — the agent runs on your
> host but executes every command inside a single, persistent Docker sandbox container."*

The published image is **option 1**. `terminal.backend` is a separate, orthogonal axis.

**What was configured: option 1, and nothing else.** The whole agent runs inside the pinned image.
`terminal.backend` is left at its default *inside that container*, which means commands execute
inside the container — already confined relative to the host.

**Why not also `terminal.backend: docker`.** Doing that from inside the published image requires
bind-mounting `/var/run/docker.sock` (docker-outside-of-docker; the image ships the Docker CLI
precisely for it). That hands the agent control of the **host** Docker daemon, which is a complete
host escape. Following ADR-0208 to the letter would have produced strictly weaker isolation than
ignoring it. The intent of "never local" was **never unconfined**; running the whole agent inside
the pinned container satisfies the intent, and `local` inside a container is not the `local` the ADR
was warning about.

Confirmed from the extracted `stage2-hook.sh`: the socket path is guarded by
`[ -S "$sock" ] || continue`, so with no socket mounted the entire DooD branch is dead code.

## The run, exactly as invoked

```
docker run --rm -v <DATA>:/opt/data \
  nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e \
  -z "<the pinned prompt>"
```

No `--privileged`, no `/var/run/docker.sock`, no `--network host`, no added capabilities.

## Model endpoint

`<DATA>/config.yaml`, hashable, contents in full:

```yaml
model:
  default: llama3.1:8b
  provider: custom
  base_url: http://host.docker.internal:11434/v1
```

The `/v1` suffix is required. `host.docker.internal` is how a container reaches a host-run inference
server on Docker Desktop for Windows and macOS; on Linux the documented path is `--network host`
with `127.0.0.1` instead, which is a difference any CI leg would hit.

**Reachability was checked before the run, not assumed:** ollama already binds `0.0.0.0:11434`, not
`127.0.0.1`, so nothing had to be restarted to let the container reach it.

## Not done, and owed later

**Context length is at the ollama default.** The runtime expects >=64,000 tokens and ollama defaults
to as little as 4,096, and the failure mode is **silent truncation rather than an error** — a green
run where the model never saw its whole prompt. For a two-line smoke prompt that cannot bite, so
restarting a live service to prove nothing was the wrong trade. **Phase 08 owes
`OLLAMA_CONTEXT_LENGTH=64000` before any real drafting**, and a draft produced without it is not
evidence of anything.

**No egress restriction was applied.** The container ran with default networking. That is fixture 7,
and it belongs to Phase 06.

**71 bundled skills are active.** See `smoke-result.md`. Nothing was pinned or disabled here.

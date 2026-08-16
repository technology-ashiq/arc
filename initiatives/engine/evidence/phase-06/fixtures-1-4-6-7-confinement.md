# Phase 06 · fixtures 1, 4, 6, 7 — the container boundary, probed directly

Measured 2026-08-16 against `nousresearch/hermes-agent@sha256:16788311e2fa…3712c9e`, Docker `29.6.1`,
linux/WSL2. Probed **with a shell inside the container and no model call**: the runtime runs entirely
inside this image (ADR-0208 option 1), so what the container can reach *is* what the runtime can
reach. Probe script kept at `tests/fixtures/engine/hermes/confine-probe.sh`.

| Fixture | Property | Result |
|---|---|---|
| **1** | a write inside the arc repo from the runtime workspace is blocked, repo byte-identical after | **PASS** |
| **4** | an env audit inside the runtime shows only its own key and **zero** arc secrets | **PASS** |
| **6** | path traversal and symlink escape from the workspace are blocked | **PASS** |
| **7** | live egress configuration matches its pinned hash and fails loud on drift | **FAIL — behavioural arm** |

## Fixture 1 — PASS, and in the strongest form available

The arc repo is not merely unwritable, it is **not visible**. The only bind mount is the data volume:

```
/opt/data  ->  the configured runtime home, and nothing else
/opt/data/Windows   -> No such file or directory
/opt/data/Users     -> No such file or directory
/mnt                -> empty
/mnt/host/c/Users/ashiq/orca -> No such file or directory
```

`/proc/mounts` shows `aname=drvfs;path=C:\` on the 9p line, which reads alarming and is **not** what
is exposed: that is Docker Desktop's WSL2 share-root metadata. The exposed path is the mounted
directory alone, confirmed by listing it — the check that matters, rather than the string that looks
frightening.

## Fixture 4 — PASS

`env | grep -icE "ARC_|RESEND|STRIPE|SUPABASE|GITHUB_PAT|SENTRY|JUROR"` → **0**. The container's own
variables are `HERMES_HOME`, `HERMES_WRITE_SAFE_ROOT`, `HERMES_TUI_DIR`, `HERMES_WEB_DIST`,
`HERMES_DISABLE_LAZY_INSTALLS`, `HERMES_LAZY_INSTALL_TARGET`. arc's environment does not cross the
boundary, because `spawnSync` hands `docker run` an argv and the container gets a fresh env.

**The capped key is NOT in there either**, which is worth stating: nothing wires
`ARC_HERMES_API_KEY` into the container yet. The requirement is *"only its own capped key"*, and
today the answer is *neither its own key nor arc's* — the second half passes, the first half is
unbuilt.

## Fixture 6 — PASS

`touch /opt/data/../escape.txt` **succeeds**, and that is the right answer once you look at where the
file went: it resolves to `/escape.txt` in the **container's own layer**, not on the host side of the
mount. Listing `/opt/data/escape.txt` afterwards returns nothing. The traversal cannot climb out of
the mount onto the host because the mount is a boundary, not a prefix. A symlink to `/` resolves to
the container root — the same filesystem, and equally not the host.

**Asserting "the write was refused" would have failed this fixture on a system that is correctly
confined.** The property is *where it lands*, not *whether it errors*.

## Fixture 7 — FAIL, behavioural arm, and this was predicted

```
curl https://example.com              -> 200
curl https://openrouter.ai/api/v1/... -> 200
```

**Egress is unrestricted.** The container reaches any host on the internet. There is no allowlist, no
proxy, no netns policy — the run uses default Docker networking, exactly as Phase 04's evidence
already recorded (*"No egress restriction was applied… Fixture 7 is Phase 06"*).

REQ-02 requires a **behavioural** arm here precisely because *"a config match is a promise and this
REQ's whole outcome is that promises do not count"*. There is no config to match yet, so the
behavioural arm is the only arm, and it fails.

This is the pre-mortem's risk 4 arriving on schedule: *a prompt-injected runtime with network access
leaks the pack through a crafted URL, an image reference, or DNS-encoded subdomains — in a channel
that never appears in the draft the human reviews.* The L1-drafts ceiling and the scrubbed trail
(now actually forwarded, see the transcript fix) are what stand in for this until it is closed.

## Also measured, and not part of any fixture

**The runtime runs as `uid=0(root)` inside the container.** Confined to the container, so it is not a
host-escape by itself, but it means nothing inside the image constrains what the agent may do to its
own workspace, its 71 bundled skills, or its own configuration — including the config file whose
hash ADR-0209 pins. A runtime that can rewrite the file its own pin is computed over is a pin that
checks itself.

## Fixture 7 is PROVABLE, and the STOP therefore does NOT fire — measured, not argued

REQ-02's STOP is for a boundary that *"cannot be proven without netns/seccomp/VM work"*. Before
letting that fire on fixture 7, the available levers were measured rather than reasoned about:

| Configuration | `https://example.com` | the model endpoint |
|---|---|---|
| default networking (today) | **200** | 200 |
| `--network none` | **BLOCKED** | **BLOCKED** |
| `--internal` user-defined bridge | **BLOCKED** | **BLOCKED** |

So the two one-line levers block *everything*, the model included, and neither is usable alone. The
dual-homed proxy pattern was then built and run end to end:

```
network arc-int   : --internal, no gateway
container arc-proxy : attached to BOTH arc-int and bridge
container client    : attached to arc-int ONLY
```

| Probe | Result |
|---|---|
| proxy → `https://example.com` | **200** — the sidecar can reach out |
| client → `https://example.com` | **BLOCKED** — no direct route exists |
| client → `arc-proxy` by name | **REACHES** — the only path out is through the sidecar |

**That is an honest egress restriction with stock Docker, no netns, no seccomp, no VM.** Fixture 7 is
therefore **build work, not an unprovable boundary**, and REQ-02's STOP does not fire on it. The
allowlist lives in the sidecar, and the pinned-hash comparison ADR-0209 describes has something real
to compare against.

**What this does not yet prove:** that an allowlisting proxy passes the model traffic correctly (the
runtime must be pointed at it), that the pin covers the proxy's allowlist, and that a host *outside*
the allowlist is refused while one inside succeeds — the behavioural arm proper. The lever is
proven; the gate is not built.

## What is owed from here

1. **The egress sidecar itself** — an allowlisting proxy on the internal network, the runtime
   pointed at it, plus the pinned-hash comparison. The mechanism is proven available above; what
   remains is building it and asserting both directions (allowed host succeeds, disallowed host
   fails).
2. **The capped key into the container**, so fixture 4's first half has something to be true about.
3. **A non-root user**, or a written acceptance of root-in-container with the pin consequence named.

# Phase 06 fixture 7 — the egress allowlist, ORCHESTRATED and measured end to end

2026-08-17. The gate was built on 2026-08-16 and measured against a hand-assembled topology; what
was owed was the orchestration — *something* has to create the network and start the proxy for a
real dispatch — plus ADR-0209's pinned-hash comparison. Both are closed here, and the fixture was
re-measured against the real mechanism rather than against the hand-built one.

## What now exists

| Piece | Where |
|---|---|
| the allowlist, as a POLICY FILE | `engine/egress-allowlist.txt` |
| the proxy | `.claude/scripts/engine/egress-proxy.py` |
| the orchestration | `.claude/scripts/engine/egress-session.sh` (`up` / `logs` / `status` / `down`) |
| its CI gate | `tests/engine-egress-proxy.bats` (12 tests, no Docker, no network) |

`up` creates an `--internal` network, starts the proxy **in the same digest-pinned runtime image**,
dual-homes it onto the bridge, and prints the three exports a dispatch needs. It never sets them in
the caller's shell: a script that silently mutates the environment produces accidentally-confined
and accidentally-unconfined dispatches at about the same rate.

## The measurement, on the real orchestration

```
$ bash .claude/scripts/engine/egress-session.sh up
egress-session: allowlist engine/egress-allowlist.txt carries 1 entr(y|ies)
egress-session: created internal network arc-egress
egress-session: arc-eproxy is up on arc-egress and bridge, and ANSWERED
egress-session:   egress-proxy: allowlist = openrouter.ai:443
egress-session:   egress-proxy: listening on 0.0.0.0:3128
```

| Probe | Result |
|---|---|
| allowlisted `openrouter.ai:443` **through the proxy** | **HTTP 200** |
| non-allowlisted `example.com` **through the proxy** | **blocked** (`HTTP 000`) |
| **NEGATIVE CONTROL** — internal network, **no proxy**, allowlisted host | **blocked** (`HTTP 000`) |
| the decision trail | `ALLOW openrouter.ai:443 (requested 'openrouter.ai:443')` · `DENY example.com:443 -- host:port is not on the allowlist` |

**The negative control is the row that makes the other two mean something.** Without it, "the allowed
host returned 200" is equally consistent with a proxy that permits everything and a network that
restricts nothing. The third row proves the confinement comes from the network — on the internal
network *without* the proxy, even the allowlisted host is unreachable — so the proxy is genuinely
the only route out, rather than a component sitting beside an open one.

Trail captured at `egress-trail-fa0391a11c61.log` via `egress-session.sh logs`.

## ADR-0209's pin now has a preimage that exists

The driver's config hash named an `egress/network policy` component sourced from `ARC_HERMES_EGRESS`
— **a variable documented nowhere, set by nothing, and therefore `{named:false}` on every run ever
made.** The hash advertised a pin nobody had. `engine/egress-allowlist.txt` is that file, it is
declared in `.env.example`, and `egress-session.sh up` prints the export that points at it.

The preimage also gained the egress **mode** (`network`, `proxy`), because two dispatches with
opposite security postures used to hash identically. Schema moved `v1` → `v2`: a preimage that gains
a field while keeping its name makes two incomparable hashes look comparable.

## Two defects this orchestration produced in its own first run, both fixed

1. **Git Bash rewrote the container-side paths.** `/opt/egress-proxy.py` reached docker as
   `C:/Program Files/Git/opt/egress-proxy.py` and the proxy died instantly with ENOENT. MSYS
   argument conversion applies to anything shaped like an absolute POSIX path, including the
   container half of a `-v` spec.
2. **`docker run -d` exited 0 while the proxy was already dead**, and the script reported a confined
   session. That is this repo's own rule arriving in new code — *exit 0 from a fire-and-forget start
   is not evidence anything is running*. `up` now polls until the container is `running` **and its
   own `listening on` line is in the log**, and refuses to print the exports otherwise.

Both were caught by running it, not by reading it.

## Still honest about the weakness

`ARC_HERMES_NETWORK` / `ARC_HERMES_PROXY` remain **opt-in**, so an unconfigured dispatch is
unconfined. That is deliberate — a driver that silently created Docker networks would be arc taking
on infrastructure it cannot clean up after a SIGKILL, which is exactly how the ADR-0222 workspace
leak happened. What changed is that it is no longer *invisible*: the driver prints
`egress mode UNCONFINED ...` on the transcript, `tests/engine-hermes-egress.bats` asserts that line,
and the config hash now moves between the two modes.

The proxy also binds `0.0.0.0`, so on a dual-homed host every co-located container can reach it. It
warns about this at startup and `--bind` narrows it. Recorded rather than quietly left.

# Phase 04 — which layer actually enforces each of REQ-02's twelve fixtures

Done on paper, on day 1, deliberately. REQ-02 says a fixture that cannot be proven without
netns/seccomp/VM work is recorded UNPROVABLE and fires the STOP. Discovering that at day 4.5, inside
the STOP-gated phase, costs the cycle; discovering it in half an hour costs nothing. Layers:
`container` · `arc-run` · `shim` · `provider` · `config`.

| # | Fixture | Layer | Provable in Phase 06? |
|---|---|---|---|
| 1 | Repo write from the runtime workspace is blocked | `container` | **Yes.** The arc repo is simply not mounted. Only `/opt/data` is. Assert the write fails and the repo is byte-identical after |
| 2 | `internal-only` input refused **before** the runtime starts | `arc-run` | **Yes.** Pre-dispatch refusal, exit 5, above the driver (ADR-0219). Mechanism is built in Phase 06 |
| 3 | `internal-only` input against a `hosted: cloud` row refused at routing | `arc-run` | **Yes.** Router-level, same mechanism |
| 4 | Env audit inside the workspace shows only the runtime capped key | `container` | **Yes** — Docker controls what env crosses the boundary. **Needs the capped key to exist**, which Phase 04 deferred (see below) |
| 5 | Planted fake key absent from every artifact | `shim` | **Yes.** `scanSecrets()` over the four named artifact classes, with its negative control |
| 6 | Path traversal / symlink escape from the workspace | `container` | **Yes.** Mount namespace. Attempt to reach outside `/opt/data` and assert refusal |
| 7 | Egress config matches its pin, **plus a behavioural arm** | `config` + `container` | **PARTIAL — read the row below. This is the finding** |
| 8 | Marker planted in run N unrecallable in run N+1 | `config` | **Yes, with a caveat below** |
| 9 | Hostile output → schema-fail → one retry → proposal receipt | `shim` + `arc-run` | **Yes.** ENG-E ladder, fixture-driven |
| 10 | Exhausted capped key → `fail`/`budget` | `provider` | **Yes** — the provider returns HTTP 402. Needs the key |
| 11 | Wall-clock overrun stops at the budget line | `shim` | **Yes.** Run-owned clock (ADR-0210) |
| 12 | Unpinned runtime refused by a pin-required class | `arc-run` | **Yes.** Router/pin check |

## Fixture 7 is PARTIAL, and this is the day-1 finding REQ-02 asked for

The fixture has two arms and they are not equally provable.

**The config-pin arm is provable.** Hash the runtime egress/network configuration, compare the live
config against the pin, fail loud on drift. Pure `config`, no infrastructure.

**The behavioural arm splits, and the split matters:**

- **Binary egress (all network on, or all off) — PROVABLE.** `docker run --network none` and assert
  every outbound connection fails. Real containment, one flag, no infrastructure. But a runtime with
  no network cannot reach the model endpoint or browse, so this proves confinement of a runtime that
  cannot do its job.
- **Domain-granular egress (allow the model endpoint and a named allowlist, refuse everything else)
  — NOT PROVABLE with configuration alone.** It needs an egress proxy or a firewalled Docker network
  in front of the container. That is infrastructure this cycle explicitly refuses to build, and the
  threat research was blunt that claiming network-level enforcement without it is exactly the
  unprovable-fixture trap.

### DECIDED 2026-08-12, and the deciding evidence is a measurement, not an argument

Three probes were run against the real image rather than reasoned about:

| Topology | Reach the internet | Reach host ollama |
|---|---|---|
| default bridge network | **HTTP 200 — unrestricted** | yes (this is what the smoke run used) |
| `docker network create --internal` | **blocked** | **also blocked** |

The middle option I expected — internal network for the container, model still on the host — **does
not exist**. `--internal` severs the host route as well as the internet route. Assuming it worked
would have surfaced in Phase 06 as a certification that could not run.

**What that leaves, and the decision:**

- **Domain-granular egress** (allow a named set of internet hosts, refuse the rest): **UNPROVABLE**
  without an egress proxy. Confirmed, not merely suspected. Recorded out of scope for this cycle,
  with a named re-open trigger: **the day a job requires the runtime to browse.** This cycle REQ-07
  job does not — arc assembles the context pack and hands it in.
- **Zero-internet egress: PROVABLE, at config level, with no infrastructure** — but only in a
  topology where the model endpoint sits **inside the same internal network** as the runtime. Two
  containers, one `--internal` network, no route out.

**The STOP does NOT fire.** Fixture 7 is satisfiable, and the config-pin arm plus a behavioural arm
asserting zero internet reachability is a real boundary rather than a promise.

**The consequence Phase 06 inherits is a topology change, and it is not free:** the model endpoint
moves off the host and onto the internal network beside the runtime. That means an ollama container
and its model layer pulled again inside it (`llama3.1:8b` is ~4.9 GB). Phase 06 pays that, and it is
cheaper than the alternative, which is certifying an isolation claim the smoke topology cannot
support — **the smoke run had full unrestricted internet**, and nothing about it was egress-controlled.

**This is not hypothetical.** The residue the pre-mortem already accepts — side-channel exfiltration
through an allowed egress path — is exactly what domain-granular egress would narrow and binary
egress does not touch at all.

## Fixture 8 has a caveat that would have bitten

Memory-off is `config`, but the data volume is persistent by design: `/opt/data` holds `sessions/`,
`memories/`, `state.db` and `cron/`, all observed after the smoke run. A memory-plant fixture that
reuses the same volume is testing the runtime memory setting; one that uses a fresh volume each run
proves nothing at all, because a new volume is empty whether or not memory is disabled.

**The fixture must reuse ONE volume across run N and run N+1**, or it is a vacuous pass — green
because nothing could ever have been recalled. Written down now because it is the kind of detail
that reads as obviously correct in either direction until someone asks which one was built.

## Fixtures 4 and 10 need the capped key, which Phase 04 deferred

Both need a live capped credential. Phase 04 was to provision it, and did not: the ceiling figure is
the owner decision and is not invented (ADR-0213, assumption A-05), and Phases 04–06 otherwise run at
zero spend on the local model. Per the phase spec, a missing owner keystroke is **not** an EXE-A
signal and must never fire the STOP — so it is carried to **Phase 06 as an entry gate**, since those
two fixtures are the first thing that actually needs it.

## Score

**Eleven of twelve are provable at `container` / `arc-run` / `shim` / `provider` / `config` level
with no sandbox engineering.** One is partial and its strong form needs infrastructure. Nothing here
fires the STOP on its own — but fixture 7 hands Phase 06 a decision rather than a fixture, and that
is better known today than on day 4.5.

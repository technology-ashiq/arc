# ADR 0203 — ENG-D: the driver interface, and which layer owns a retry

**Status:** accepted
**Date:** 2026-08-03
**Product:** `engine` — lane `engine`, ADR band 0200–0299
**Reversibility:** one-way
**Revisit trigger:** a fourth driver cannot be written against this interface without changing it
— the north-star test is stubbing one in under an hour during Phase 3, so a stub that forces an
interface change is the signal, and it arrives inside this cycle rather than after it.

**Locked upstream.** ENG-D from `docs/strategy/plans/PLAN-engine-process-layer.md`. The
retry-layering half (below) resolves an implementation fork the design source left open.

## Context

Three drivers — `claude-code`, `codex`, `generic-api` — must be interchangeable behind one
interface, or REQ-04's "any process, any driver" is a slogan. They have wildly different transport
reliability: two shell out to a local CLI; one makes HTTP calls to a remote endpoint over a
network that drops requests, rate-limits, and times out.

Model selection is **not** in scope here. Which model a driver uses comes from `engine/router.yaml`,
which is the implementation of ADR-0069 blocks (a) and (b), not a decision this ADR makes.

## Options considered

1. **One flat retry ladder in `arc-run`, drivers do not retry** — pros: one place to reason about
   attempts. Cons: a 429 and a malformed answer consume the same budget, so network flakiness
   spends escalation attempts on a problem that was never about model quality.
2. **Two layers: transport retry inside the driver, contract retry in `arc-run`** — pros: each
   failure is retried by the layer that can actually fix it. Cons: two retry mechanisms to reason
   about, and a bounded-attempt bug in either is a hang.

## Decision

**The interface is `drivers/<name>.sh run <process> <input-json> <budget>`** → the output JSON
document on **stdout**, and the cost record on a **sidecar file** whose path is given by
`ARC_DRIVER_COST_FILE`. The design source offered "fd3 or sidecar"; the sidecar is chosen because
file descriptor 3 does not survive the Windows CI leg portably, and all three legs are gating.
stderr is for diagnostics and is never parsed.

A driver exits `0` on a produced answer (even a bad one — judging it is `arc-run`'s job), `1` on
its own failure, and `2` when it declined for budget.

**Retry is layered, and each layer is bounded:**

- **Transport retry belongs to the driver.** `generic-api` retries `429`, `5xx` and timeouts up to
  **2** times with backoff, then reports failure upward. A transport blip never consumes a
  contract attempt. The CLI drivers inherit the same rule for process-spawn failures.
- **Contract retry belongs to `arc-run`.** Only a response that was *produced and then failed
  its schema* counts against the ladder in ADR 0204.

**Each `drivers/NAME.sh` is a thin POSIX wrapper over a `drivers/NAME.mjs` core**, the shape
`arc-event.sh` already uses over `arc-event.mjs` (ADR-0031 — one logic core, a shell entry point).
This is load-bearing, not stylistic: the exit discipline proven in
`.claude/scripts/council/council-juror.mjs:144-149` — set `process.exitCode`, let the loop drain,
force-exit on an unref'd 250 ms backstop, never an abrupt `process.exit()` while a socket may be
closing — is **Node-only**. A shell script cannot reuse it. Without the wrapper shape, `generic-api`
would have to re-derive that fix in POSIX and curl, and would re-earn retro-log 2026-07-16's Windows
libuv assertion and garbage exit code the hard way, on both the happy and the error path.

**`generic-api` is plain HTTP with no vendor SDK** — `fetch` and nothing else.

**Confidence:** high
**Rejected because:** option 1 — it spends escalation budget on network weather, which is
precisely the "generic-api flaky beyond 2 days" scenario the plan's kill criterion anticipates.

## Consequences

**Easier.** A new driver is one shim file with a documented contract. The failure a run reports is
attributable to a layer.

**Harder.** Two bounded retry loops exist, and an unbounded one in either is a hang rather than a
failure — so both bounds are fixture-proven, not asserted. Cost reporting via a sidecar means a
driver that crashes mid-run may leave no cost record; `arc-run` treats an absent cost record as
**absent**, never as zero (ADR-0069 block (b)(5) — absent data is never estimated).

**What we'd revisit if this goes wrong.** If the sidecar proves awkward, stdout framing with a
sentinel line is the fallback — but it makes the output document harder to stream, which is why
it is not the first choice.

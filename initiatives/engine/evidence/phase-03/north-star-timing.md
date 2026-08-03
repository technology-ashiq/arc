# Phase 03 — the north-star timing run

**The claim under test (design source):** *"a NEW driver can be added by writing one shim
file — measured by actually stubbing a fourth driver in <1 hour during Phase 3."*

## Result

| | |
|---|---|
| Clock started | 08:49:37 |
| Contract fixture passing | 08:50:13 |
| **Elapsed** | **37 seconds** |
| Target | under 3600 seconds |

Artifacts written: `.claude/scripts/engine/drivers/ollama.mjs` (a `produce()` function and
nothing else) and `ollama.sh` (the POSIX wrapper, derived from `generic-api.sh`). Nothing in
`arc-run.mjs`, `common.mjs` or the contract suite was touched — which is the actual claim
being measured. The interface did not leak engine concerns: the new driver needed no
knowledge of schemas, budgets, receipts, escalation or secret scanning, because
`drivers/common.mjs` owns all of it.

## What this measurement does NOT prove, stated plainly

**The contract fixture passes through the FAKE path, and the fake path returns before
`produce()` ever runs.** `runDriver` short-circuits on `ARC_DRIVER_FAKE`. So "the 4th driver
passes the contract fixture" is a statement about interface conformance, not about the
driver's own logic working.

This was found while doing the timing, and it is a finding about **Phase 02's suite**, not
just about this stub: every `REQ-04` contract test used the fake, so all three production
drivers were passing "the same contract" without any of their real code executing.

Two things were done about it rather than noting it:

1. The real path was verified separately for the stub — pointed at an unreachable endpoint,
   it reaches `fetch`, fails, and reports exit 1 (the driver-failure code), proving the code
   runs rather than being skipped.
2. A test was added to `tests/engine-driver-contract.bats` that runs **every** driver with no
   fake and an unreachable endpoint/binary, asserting each reaches its own code and exits 1.
   Plus one asserting that a fake directory with no recording fails loudly — a fake with
   nothing in it is a silent pass, which is the same failure class one level down.

**Still unproven:** no driver has been observed succeeding against a live endpoint. There is
no Ollama running here, `codex` is not installed, and no LLM endpoint or key is configured.

## Honest reading of 37 seconds

The number is real and the target is met by two orders of magnitude, but it is the most
favourable possible measurement: the author already knew the interface intimately, and the
`.sh` wrapper was derived from an existing one. A fair restatement is **"the interface
imposes no work beyond one `produce()` function"**, which the 37 seconds supports, rather
than **"anyone can add a driver in 37 seconds"**, which it does not.

The stub is **not promoted** and must be removed before this phase closes (exit criterion).
A local-model driver is a declared no-go for this cycle; it exists here only as a stopwatch.

# ADR 2019 — OpenCode sessions run through one wrapper that caps spend and writes the transcript

**Status:** accepted
**Date:** 2026-10-13
**Product:** `distribute`
**Reversibility:** two-way
**Why two-way:** one engine script and its bats; nothing outside this lane calls it
**Revisit trigger:** OpenCode stops printing a per-step cost in `--format json` (the wrapper then sees cost 0 and must refuse, not run uncapped), OpenRouter offers a per-request hard cap the wrapper could set instead, or a second harness (Codex) needs the same headless run.

## Context

REQ-03 (Cycle 1, owed) needs arc's loop run in OpenCode on a non-Anthropic model, with receipts whose `evidence` points at a committed transcript carrying the OpenCode version and session id. The owner set the model and the cap on 2026-10-13: `openrouter/deepseek/deepseek-v4-flash-0731`, **$0.50**.

The Cycle 1 survey (2026-10-13) found: no `opencode run` call anywhere in the repo; no USD cap in arc code (`arc-run.mjs` caps INR on its own drivers, not on a foreign harness); the spike's seven raw transcripts sit outside the repo, so nothing committed proves a run. The spike did prove the invocation that works on 1.17.18: `opencode run --pure --command NAME --agent A -m MODEL --format json -- MESSAGE` (`--` before the message, `--pure` to keep the owner's global plugins and MCP servers out).

## Options considered

1. **Run `opencode` by hand and paste the output.** No cap; the transcript is whatever was copied. This is what left Cycle 1 with a summary and no transcript.
2. **Set a credit limit on the OpenRouter key.** The real ceiling, but it lives in the owner's account, arc cannot read it back, and it caps every use of that key, not this run.
3. **A wrapper, `.claude/scripts/engine/opencode-session.mjs`, that is the only way this lane runs OpenCode.** It refuses before spend when the model, cap or binary is missing, writes the version line and every JSON event to a transcript, sums the cost OpenCode reports per step, and kills the process tree the moment the sum reaches the cap.

## Decision

Option 3, with option 2 as a recommended second ceiling that the owner may set and the wrapper never assumes.

- **Invocation.** `node .claude/scripts/engine/opencode-session.mjs --cap-usd 0.50 --model M --command C --transcript PATH [--agent A] [--cwd DIR] -- MESSAGE`. The `opencode` binary is resolved from `ARC_OPENCODE_BIN`, else `PATH`. That variable is the fake's door for tests. The child is always `opencode run --pure --command C --agent A -m M --format json -- MESSAGE`, never `--auto`. Measured on 1.17.18 in P05: headless, a permission the fence would ask about is refused ("The user rejected permission"), which is the fence working; `--auto` instead approved every ask under a primary agent and hung to the timeout under a command's subagent fence. The kickoff attack had restored `--auto` from the spike's invocation; the probe transcripts in `evidence/phase-05/transcripts/probe-ask-*.jsonl` reversed it, spawned with an argv array and never through a shell string, with `PWD` set to the session directory (OpenCode reads its project directory from an inherited `PWD` before the spawn cwd). On Windows a `.cmd`/`.bat` binary is run as `cmd.exe /d /s /c` with each argument quoted by the wrapper's own escaper, so MESSAGE reaches the program byte-identical.
- **Refuse before spend.** Exit 2 by name when `--cap-usd` is missing, not a positive number, or above `1.00` (a typo guard, not policy); when `--model` names an `anthropic/` model (the REQ is a non-Anthropic run); when the binary is missing; when `opencode --version` does not answer within 10 s.
- **Transcript.** Line 1 is `harness-proof: opencode <version> session=<id> model=<M> cap_usd=<cap> command=<C> cwd=<dir> date=<iso>`, written when the first event names the session id (events before it are buffered); a run killed before any event writes `session=none`. Every stdout line follows verbatim, as JSONL. Stderr goes to `<PATH>.stderr`. The file is written as it streams, so a killed run still leaves its transcript.
- **Cap.** Every event with a numeric `cost` (OpenCode's step-finish part) adds to a running sum. At sum ≥ cap the wrapper kills the process tree, appends `cap-breach: spent=<sum> cap=<cap>`, and exits 3. Before spawning, the wrapper sums the final `spent=` line of every `*.jsonl` under `initiatives/distribute/evidence/**/transcripts/` plus `--prior-spent-usd`, and refuses with exit 2 `CYCLE-CAP` when that prior spend plus `--cap-usd` exceeds `--cycle-cap-usd` (default `0.50`): the owner's cap is per cycle, and the remainder is computed, never typed. The last transcript line is always `spent=<sum>`, on success, kill, timeout and exit 4 alike. Killing means the whole tree: `taskkill /T /F /PID` on win32, a negative-pid signal to the detached process group elsewhere. A run that ends with **zero** cost events and more than zero step events exits 4 `COST-UNREADABLE`: it cannot tell the run stayed under the cap, so it never reports one as capped.
- **Wall clock.** `--timeout-s` (default 1200) kills and exits 5, the spike's measured stall shape.
- **Exit 0** prints `opencode-session: ok spent=<sum> session=<id> transcript=<PATH>`.

## Consequences

- A cap breach can overshoot by one step's cost, because OpenCode reports cost when a step finishes. At this model's prices one step is a fraction of a cent; the transcript records the exact overshoot.
- The wrapper is tested offline by a fake `opencode` (a node script emitting scripted JSON events) through `ARC_OPENCODE_BIN`: cap breach, unreadable cost, timeout, refuse-before-spend, and the transcript header, each asserting it RAN.
- No model, driver, router or profile changes (ADR-2006): the wrapper takes the model as an argument and reads no profile store.

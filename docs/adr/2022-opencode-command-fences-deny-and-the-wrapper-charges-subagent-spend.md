# ADR 2022 — OpenCode command fences deny, and the wrapper charges subagent spend

**Status:** accepted (amends ADR-2018's OpenCode fence rule and ADR-2019's cap)
**Date:** 2026-10-13
**Product:** `distribute`
**Reversibility:** two-way
**Why two-way:** one adapter value and its goldens, and one post-step read in the wrapper
**Revisit trigger:** an OpenCode release lets a headless run answer a subagent's permission ask (an `--auto` that reaches subagents, or an env override that beats an agent rule), or the JSON stream starts carrying subagent steps.

## Context

Phase 05's live smokes of the rendered `arc-commit` measured two facts on OpenCode 1.17.18 (transcripts and probes in `initiatives/distribute/evidence/phase-05/transcripts/`):

1. **A subagent's `ask` hangs a headless run forever.** ADR-2018 renders a command's `allowed-tools` as `"*": ask` on a hidden companion subagent. The model ran `git branch --show-current`, the fence asked, and the run sat until the 900 s timeout, twice. `--auto` did not reach the subagent (probe-ask-auto), `--port` changed nothing, and `OPENCODE_PERMISSION` loses to the agent's own rule. With `"*": deny` the same call was refused at once and the run finished in 18 s (probe-deny).
2. **The JSON stream carries only the parent session.** A command run through its fence is a `task` tool call; the subagent's steps, and their cost, never reach stdout. The parent's $0.0011 was reported while the subagent spent another $0.00045, visible only through `opencode export <session>`.

## Decision

- **Fences deny.** A command's fence renders `"*": deny` then `allow` per tool, exactly as an agent's `tools` does. On OpenCode that is stricter than Claude Code's pre-approval (an interactive user can no longer approve a one-off call inside the command), and it is the only rule that runs headless.
- **Subagent spend is charged.** When a `task` tool part completes (or errors) and names a child session, the wrapper runs `opencode export <id>` with the same binary, sums every `step-finish` cost in it, follows nested task sessions, writes `subagent: <id> spent=<n>` to the transcript, and adds it to the cap before reading the next event. An export that fails or holds no readable cost makes the run COST-UNREADABLE.

## Consequences

- The cap is enforced per completed subagent task, not per subagent step: one task can overshoot by its own cost. At this model's prices one task is a fraction of a cent; the transcript records the exact overshoot.
- The opencode golden changes for every fenced command (25 files), and the sync golden does not (it carries no `.opencode/`).

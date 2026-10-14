# ADR 0915 — a benched model sees the contract, and not the owner's setup

**Status:** accepted
**Date:** 2026-10-14
**Product:** `bench` (touches `engine` drivers by exception, recorded here)
**Reversibility:** two-way
**Revisit trigger:** a process whose answer legitimately depends on user-level settings is benched,
or a driver gains a native structured-output flag that carries the schema itself.

## Context

Phase 03's real event ran for the first time on 2026-10-14. It measured three things, and none of
them was the model.

1. **`generic-api` cannot do an agentic class.** It is a plain chat completion: no tools and no
   repo. DeepSeek V4 Flash honestly answered `{"commits": []}` to every `commit-msg-draft` fixture,
   because it could not see a diff or make a commit. Each call was 267 tokens in, the same for every
   fixture, since the repo state never reached the prompt. ADR-0914 Amendment 1 is reversed by
   Amendment 2.
2. **No driver ever showed the model the output contract.** Every prompt ended with "Reply with ONE
   JSON document matching this process's output contract", and no driver ever included the
   contract. `commit-msg-draft`'s body never names the `commits[{sha, subject}]` shape. On
   `claude-code`, sonnet answered `{"branch": ..., "commits": [...]}` on both attempts of both
   fixtures it reached, and failed `additionalProperties: false`.
3. **`claude -p` loaded the owner's personal setup.** User hooks, plugins and MCP servers all
   loaded. A session-start hook injects a `Branch:` line into the context, which is the likeliest
   source of the invented `branch` key. A bench score taken that way depends on whose machine ran
   it.

## Decision

- **The contract goes in the prompt** (`contractLines` in `drivers/common.mjs`). The process's
  `output` JSON Schema goes after the input and before the closing instruction, in all four
  prompt-building drivers: `claude-code`, `codex`, `generic-api` and `hermes`. A process with no
  `output` block keeps its old prompt. This applies to every run, not only bench runs, because the
  instruction was already asking for the contract. Showing it is the fix, not a new behaviour.
- **A benched run is isolated.** Bench sets `ARC_DRIVER_ISOLATE=1` on each arc-run it spawns, and
  `claude-code` then adds `--setting-sources project,local --strict-mcp-config`. User settings,
  hooks, plugins and MCP servers stay out. Authentication is unchanged. `--bare` was rejected
  because it requires `ANTHROPIC_API_KEY` and refuses OAuth, the owner's login. Non-bench runs are
  unchanged: some governed runs, such as the face's Ask, may rely on the owner's setup, and that is
  a separate decision.

**The scope fence** (PLAN § Out of scope: "nothing else under `.claude/scripts/engine/drivers/` may
be touched") is lifted for exactly these two edits. The fence existed to keep bench from becoming a
new provider driver. These edits add no provider. They correct what every driver already claimed to
send.

## Consequences

**Easier:** a bench score now measures the model answering a question it was actually shown, under
settings that are the same on any machine.

**Harder:** every prompt grows by the size of its schema. For `commit-msg-draft` that is about 300
characters.

**What isolation does NOT cover** (attack a59752e B1, B4): project and local settings still load.
For bench that is the materialized fixture repo, which is a fresh temp directory with no `.claude/`,
so it adds nothing. A bench run against a repo that carries its own hooks would carry those hooks.
`codex` and `hermes` ignore `ARC_DRIVER_ISOLATE`: only `claude-code` reads user-level settings
this way today, so the claim is made for `claude-code` alone.

**Not proven by this ADR:** that isolation removes every user-level input. `~/.claude/CLAUDE.md`
loading under `--setting-sources` is the CLI's behaviour, and the CLI is not arc's code. The re-run's
captures are the evidence: an answer free of `branch` with the contract in the prompt.

## Correction (2026-10-14, ADR-0916)

The isolation note above says project settings come from the materialized fixture repo. They did
not: `claude-code` spawned its CLI in `ARC_ROOT`, which is arc, so arc's project hooks loaded and
the model worked inside the arc checkout. ADR-0916 moves the CLI to the work root, which makes the
note true from that merge on.
